import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getRecentActiveEmploymentPeriod } from "@/lib/employment";
import {
  autoAllocateOldestOutstanding,
  calculateSalaryTotals,
  deriveSalaryStatus,
  SALARY_ADVANCES_COLLECTION,
  SALARY_PAYMENTS_COLLECTION,
  SALARY_PERIODS_COLLECTION,
  sumAllocations,
  toSalaryPeriodId,
} from "@/lib/finance";
import type { UserDocument } from "@/types/user";
import type {
  SalaryAdjustment,
  SalaryAdjustmentType,
  SalaryAdvance,
  SalaryAdvanceStatus,
  SalaryPayment,
  SalaryPaymentAllocation,
  SalaryPeriod,
  SalaryStatus,
} from "@/types/finance";

export async function fetchEmployeeFinanceService(userId: string) {
  const [periodsSnapshot, paymentsSnapshot, advancesSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, SALARY_PERIODS_COLLECTION),
        where("userId", "==", userId),
        orderBy("year", "desc"),
        orderBy("month", "desc"),
      ),
    ),
    getDocs(
      query(
        collection(db, SALARY_PAYMENTS_COLLECTION),
        where("userId", "==", userId),
        orderBy("date", "desc"),
      ),
    ),
    getDocs(
      query(
        collection(db, SALARY_ADVANCES_COLLECTION),
        where("userId", "==", userId),
        orderBy("date", "desc"),
      ),
    ),
  ]);

  return {
    salaryPeriods: periodsSnapshot.docs.map((item) => item.data() as SalaryPeriod),
    salaryPayments: paymentsSnapshot.docs.map((item) => item.data() as SalaryPayment),
    salaryAdvances: advancesSnapshot.docs.map((item) => item.data() as SalaryAdvance),
  };
}

export type GenerateSalaryPeriodInput = {
  userId: string;
  year: number;
  month: number;
  periodStart: Date;
  periodEnd: Date;
  status?: SalaryStatus;
  baseSalaryOverride?: number;
};

function toAdvanceStatus(remainingAmount: number): SalaryAdvanceStatus {
  if (remainingAmount <= 0) return "fully_deducted";
  return "partially_deducted";
}

export async function generateSalaryPeriodService(input: GenerateSalaryPeriodInput) {
  if (input.month < 1 || input.month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  const periodId = toSalaryPeriodId(input.userId, input.year, input.month);
  const salaryPeriodRef = doc(db, SALARY_PERIODS_COLLECTION, periodId);
  const userRef = doc(db, "users", input.userId);

  const advancesSnapshot = await getDocs(
    query(
      collection(db, SALARY_ADVANCES_COLLECTION),
      where("userId", "==", input.userId),
      where("remainingAmount", ">", 0),
      orderBy("remainingAmount", "desc"),
      orderBy("date", "asc"),
    ),
  );

  await runTransaction(db, async (transaction) => {
    const periodExisting = await transaction.get(salaryPeriodRef);
    if (periodExisting.exists()) {
      throw new Error("Salary period already exists for this month.");
    }

    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists()) {
      throw new Error("Employee not found.");
    }

    const employee = userSnapshot.data() as UserDocument;
    const activeEmploymentPeriod = getRecentActiveEmploymentPeriod(employee.workHistory);
    const baseSalary = input.baseSalaryOverride ?? activeEmploymentPeriod?.salary ?? 0;

    if (!activeEmploymentPeriod) {
      throw new Error("Employee has no employment history period.");
    }

    if (baseSalary < 0) {
      throw new Error("Base salary cannot be negative.");
    }

    let remainingForAdvanceDeduction = baseSalary;
    const adjustments: SalaryAdjustment[] = [];

    for (const advanceDoc of advancesSnapshot.docs) {
      if (remainingForAdvanceDeduction <= 0) break;

      const advanceRef = doc(
        db,
        SALARY_ADVANCES_COLLECTION,
        advanceDoc.id,
      ) as DocumentReference<SalaryAdvance>;

      const latestAdvance = await transaction.get(advanceRef);
      if (!latestAdvance.exists()) continue;

      const advance = latestAdvance.data();
      if (advance.remainingAmount <= 0) continue;

      const deductionAmount = Math.min(
        advance.remainingAmount,
        remainingForAdvanceDeduction,
      );

      if (deductionAmount <= 0) continue;

      adjustments.push({
        id: crypto.randomUUID(),
        type: "advance",
        amount: deductionAmount,
        description: "Advance deduction",
        referenceId: advance.id,
      });

      remainingForAdvanceDeduction -= deductionAmount;

      const nextRemaining = advance.remainingAmount - deductionAmount;
      transaction.update(advanceRef, {
        remainingAmount: nextRemaining,
        status: nextRemaining <= 0 ? "fully_deducted" : toAdvanceStatus(nextRemaining),
        updatedAt: serverTimestamp(),
      });
    }

    const totals = calculateSalaryTotals(baseSalary, adjustments);

    const salaryPeriod: SalaryPeriod = {
      id: periodId,
      userId: input.userId,
      year: input.year,
      month: input.month,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      baseSalary,
      adjustments,
      grossSalary: totals.grossSalary,
      totalDeductions: totals.totalDeductions,
      netSalary: totals.netSalary,
      paidAmount: 0,
      remainingAmount: totals.netSalary,
      status: input.status ?? "pending",
      roleAtPeriod: activeEmploymentPeriod.role,
      workingHoursPerDayAtPeriod: activeEmploymentPeriod.workingHoursPerDay,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(salaryPeriodRef, salaryPeriod);
  });

  return periodId;
}

export type AddSalaryAdjustmentInput = {
  salaryPeriodId: string;
  adjustmentType: SalaryAdjustmentType;
  amount: number;
  description?: string;
  referenceId?: string;
};

export async function addSalaryAdjustmentService(input: AddSalaryAdjustmentInput) {
  if (input.amount <= 0) {
    throw new Error("Adjustment amount must be greater than zero.");
  }

  const salaryPeriodRef = doc(db, SALARY_PERIODS_COLLECTION, input.salaryPeriodId);

  await runTransaction(db, async (transaction) => {
    const salaryPeriodSnapshot = await transaction.get(salaryPeriodRef);
    if (!salaryPeriodSnapshot.exists()) {
      throw new Error("Salary period not found.");
    }

    const salaryPeriod = salaryPeriodSnapshot.data() as SalaryPeriod;

    if (input.adjustmentType === "advance") {
      if (!input.referenceId) {
        throw new Error("Advance deduction requires a reference advance id.");
      }

      const advanceRef = doc(db, SALARY_ADVANCES_COLLECTION, input.referenceId);
      const advanceSnapshot = await transaction.get(advanceRef);
      if (!advanceSnapshot.exists()) {
        throw new Error("Referenced advance was not found.");
      }

      const advance = advanceSnapshot.data() as SalaryAdvance;
      if (input.amount > advance.remainingAmount) {
        throw new Error("Advance deduction exceeds remaining advance.");
      }

      const nextRemaining = advance.remainingAmount - input.amount;
      transaction.update(advanceRef, {
        remainingAmount: nextRemaining,
        status: nextRemaining <= 0 ? "fully_deducted" : "partially_deducted",
        updatedAt: serverTimestamp(),
      });
    }

    const nextAdjustments: SalaryAdjustment[] = [
      ...salaryPeriod.adjustments,
      {
        id: crypto.randomUUID(),
        type: input.adjustmentType,
        amount: input.amount,
        description: input.description?.trim() || undefined,
        referenceId: input.referenceId,
      },
    ];

    const totals = calculateSalaryTotals(salaryPeriod.baseSalary, nextAdjustments);
    if (salaryPeriod.paidAmount > totals.netSalary) {
      throw new Error("Adjustment would make paid amount exceed net salary.");
    }

    const nextPeriod: SalaryPeriod = {
      ...salaryPeriod,
      adjustments: nextAdjustments,
      grossSalary: totals.grossSalary,
      totalDeductions: totals.totalDeductions,
      netSalary: totals.netSalary,
      remainingAmount: totals.netSalary - salaryPeriod.paidAmount,
      updatedAt: serverTimestamp(),
    };

    transaction.update(salaryPeriodRef, {
      adjustments: nextPeriod.adjustments,
      grossSalary: nextPeriod.grossSalary,
      totalDeductions: nextPeriod.totalDeductions,
      netSalary: nextPeriod.netSalary,
      remainingAmount: nextPeriod.remainingAmount,
      status: deriveSalaryStatus(nextPeriod),
      updatedAt: serverTimestamp(),
    });
  });
}

export type CreateSalaryAdvanceInput = {
  userId: string;
  date: Date;
  amount: number;
  description?: string;
  paymentMethod: "cash" | "bank_transfer" | "other";
  paidBy: string;
};

export async function createSalaryAdvanceService(input: CreateSalaryAdvanceInput) {
  if (input.amount <= 0) {
    throw new Error("Advance amount must be greater than zero.");
  }

  const ref = doc(collection(db, SALARY_ADVANCES_COLLECTION));

  const advance: SalaryAdvance = {
    id: ref.id,
    userId: input.userId,
    date: input.date,
    amount: input.amount,
    remainingAmount: input.amount,
    description: input.description?.trim() || undefined,
    paymentMethod: input.paymentMethod,
    paidBy: input.paidBy,
    status: "unpaid",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, advance);
  return ref.id;
}

export async function fetchOutstandingSalaryPeriodsService(userId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, SALARY_PERIODS_COLLECTION),
      where("userId", "==", userId),
      where("remainingAmount", ">", 0),
      orderBy("remainingAmount", "desc"),
      orderBy("year", "asc"),
      orderBy("month", "asc"),
    ),
  );

  return snapshot.docs.map((item) => item.data() as SalaryPeriod);
}

export type CreateSalaryPaymentInput = {
  userId: string;
  date: Date;
  amount: number;
  allocations?: SalaryPaymentAllocation[];
  paymentMethod: "cash" | "bank_transfer" | "other";
  description?: string;
  paidBy: string;
};

export async function createSalaryPaymentService(input: CreateSalaryPaymentInput) {
  if (input.amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const outstandingPeriods = await fetchOutstandingSalaryPeriodsService(input.userId);
  const allocations = input.allocations?.length
    ? input.allocations
    : autoAllocateOldestOutstanding(
        outstandingPeriods.map((period) => ({
          id: period.id,
          remainingAmount: period.remainingAmount,
          year: period.year,
          month: period.month,
        })),
        input.amount,
      );

  const allocationTotal = sumAllocations(allocations);
  if (allocationTotal !== input.amount) {
    throw new Error("Allocation total must be equal to payment amount.");
  }

  const paymentRef = doc(collection(db, SALARY_PAYMENTS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    const periodSnapshots = await Promise.all(
      allocations.map((allocation) =>
        transaction.get(doc(db, SALARY_PERIODS_COLLECTION, allocation.salaryPeriodId)),
      ),
    );

    for (let index = 0; index < allocations.length; index += 1) {
      const allocation = allocations[index];
      const periodSnapshot = periodSnapshots[index];

      if (!periodSnapshot.exists()) {
        throw new Error("One of the selected salary periods does not exist.");
      }

      const period = periodSnapshot.data() as SalaryPeriod;
      if (period.userId !== input.userId) {
        throw new Error("Payment allocation does not match selected employee.");
      }
      if (allocation.amount <= 0) {
        throw new Error("Allocation amount must be greater than zero.");
      }
      if (allocation.amount > period.remainingAmount) {
        throw new Error("Allocation exceeds salary period remaining amount.");
      }

      const paidAmount = period.paidAmount + allocation.amount;
      const remainingAmount = period.netSalary - paidAmount;

      if (remainingAmount < 0) {
        throw new Error("Allocation cannot overpay a salary period.");
      }

      const nextPeriod: SalaryPeriod = {
        ...period,
        paidAmount,
        remainingAmount,
      };

      transaction.update(periodSnapshot.ref, {
        paidAmount,
        remainingAmount,
        status: deriveSalaryStatus(nextPeriod),
        updatedAt: serverTimestamp(),
      });
    }

    const payment: SalaryPayment = {
      id: paymentRef.id,
      userId: input.userId,
      date: input.date,
      amount: input.amount,
      allocations,
      paymentMethod: input.paymentMethod,
      description: input.description?.trim() || undefined,
      paidBy: input.paidBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(paymentRef, payment);
  });

  return paymentRef.id;
}

export async function getEmployeeByIdService(userId: string) {
  const snapshot = await getDoc(doc(db, "users", userId));
  if (!snapshot.exists()) return null;
  return snapshot.data() as UserDocument;
}
