import type {
  AttendanceDocument,
  AttendanceStatus,
  EmployeeAttendanceSummary,
  SalaryAdjustment,
  SalaryPeriod,
  SalaryPaymentAllocation,
} from "@/types/finance";

export const ATTENDANCE_COLLECTION = "attendance";
export const SALARY_PERIODS_COLLECTION = "salaryPeriods";
export const SALARY_PAYMENTS_COLLECTION = "salaryPayments";
export const SALARY_ADVANCES_COLLECTION = "salaryAdvances";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
];

export function toMonthId(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function toSalaryPeriodId(userId: string, year: number, month: number) {
  return `${userId}_${year}_${String(month).padStart(2, "0")}`;
}

export function toAttendanceDocId(userId: string, date: string) {
  return `${userId}_${date}`;
}

export function getMonthDateRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    startDateString: formatDateYmd(start),
    endDateString: formatDateYmd(end),
    start,
    end,
  };
}

export function formatDateYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatCurrency(amount: number, currency = "SAR") {
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMonthYear(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function summarizeAttendance(records: AttendanceDocument[]): EmployeeAttendanceSummary {
  return records.reduce<EmployeeAttendanceSummary>(
    (summary, record) => {
      summary[record.status] += 1;
      return summary;
    },
    {
      present: 0,
      absent: 0,
      half_day: 0,
      leave: 0,
      holiday: 0,
    },
  );
}

export function calculateSalaryTotals(baseSalary: number, adjustments: SalaryAdjustment[]) {
  const positive = new Set(["bonus", "overtime", "other"]);
  const negative = new Set(["advance", "deduction"]);

  const grossSalary =
    baseSalary +
    adjustments
      .filter((item) => positive.has(item.type))
      .reduce((sum, item) => sum + item.amount, 0);

  const totalDeductions = adjustments
    .filter((item) => negative.has(item.type))
    .reduce((sum, item) => sum + item.amount, 0);

  if (grossSalary < 0 || totalDeductions < 0) {
    throw new Error("Calculated salary values cannot be negative.");
  }

  if (totalDeductions > grossSalary) {
    throw new Error("Total deductions cannot exceed gross salary.");
  }

  const netSalary = grossSalary - totalDeductions;
  return { grossSalary, totalDeductions, netSalary };
}

export function deriveSalaryStatus(period: SalaryPeriod) {
  if (period.remainingAmount <= 0) {
    return period.status === "final_settlement" ? "final_settlement" : "paid";
  }

  if (period.paidAmount > 0) return "partial";
  return period.status === "final_settlement" ? "final_settlement" : "pending";
}

export function autoAllocateOldestOutstanding(
  outstandingPeriods: Array<Pick<SalaryPeriod, "id" | "remainingAmount" | "year" | "month">>,
  paymentAmount: number,
): SalaryPaymentAllocation[] {
  if (paymentAmount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  let remaining = paymentAmount;
  const ordered = [...outstandingPeriods].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const allocations: SalaryPaymentAllocation[] = [];

  for (const period of ordered) {
    if (remaining <= 0) break;
    if (period.remainingAmount <= 0) continue;

    const allocationAmount = Math.min(period.remainingAmount, remaining);
    if (allocationAmount > 0) {
      allocations.push({
        salaryPeriodId: period.id,
        amount: allocationAmount,
      });
      remaining -= allocationAmount;
    }
  }

  if (remaining > 0) {
    throw new Error("Payment exceeds outstanding salary.");
  }

  return allocations;
}

export function sumAllocations(allocations: SalaryPaymentAllocation[]) {
  return allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
}

export function parseUnknownDate(value: unknown) {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}
