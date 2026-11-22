import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  validateExpenseTransactionCategory,
  validateNonNegativeAmount,
  type CreateExpenseTransactionInput,
  type ExpenseTransaction,
  type ExpenseTransactionDocument,
  type SalaryPlanDocument,
  type UpdateExpenseTransactionInput,
} from "@/types/expense";

const SALARY_PLANS_COLLECTION = "salaryPlans";

function getAuthenticatedUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in.");
  return uid;
}

function mapExpenseTransaction(
  snapshot:
    | QueryDocumentSnapshot<DocumentData>
    | DocumentSnapshot<DocumentData>,
): ExpenseTransaction {
  const data = snapshot.data() as ExpenseTransactionDocument | undefined;
  if (!data) throw new Error("Expense transaction document data is missing.");
  return { id: snapshot.id, ...data };
}

async function getOwnedOpenPlan(planId: string) {
  const normalizedId = planId.trim();
  if (!normalizedId) throw new Error("Salary plan id is required.");
  const snapshot = await getDoc(doc(db, SALARY_PLANS_COLLECTION, normalizedId));
  if (!snapshot.exists()) throw new Error("Salary plan not found.");
  const plan = snapshot.data() as SalaryPlanDocument;
  if (plan.userId !== getAuthenticatedUid()) {
    throw new Error("Salary plan does not belong to the authenticated user.");
  }
  if (plan.status === "closed") {
    throw new Error("Transactions cannot be changed on a closed salary plan.");
  }
  return {
    snapshot,
    plan,
    planRef: doc(db, SALARY_PLANS_COLLECTION, normalizedId),
  };
}

async function getOwnedPlan(planId: string) {
  const normalizedId = planId.trim();
  if (!normalizedId) throw new Error("Salary plan id is required.");
  const snapshot = await getDoc(doc(db, SALARY_PLANS_COLLECTION, normalizedId));
  if (!snapshot.exists()) throw new Error("Salary plan not found.");
  const plan = snapshot.data() as SalaryPlanDocument;
  if (plan.userId !== getAuthenticatedUid()) {
    throw new Error("Salary plan does not belong to the authenticated user.");
  }
  return {
    snapshot,
    plan,
    planRef: doc(db, SALARY_PLANS_COLLECTION, normalizedId),
  };
}

function resolveSelectedCategory(plan: SalaryPlanDocument, categoryId: string) {
  const normalizedId = categoryId.trim();
  if (!normalizedId) throw new Error("Transaction category id is required.");
  validateExpenseTransactionCategory(normalizedId, plan.categories);
  const category = plan.categories.find(
    (item) => item.categoryId === normalizedId,
  );
  if (!category)
    throw new Error(
      "Transaction category is not selected in this salary plan.",
    );
  return category;
}

export async function createExpenseTransaction(
  salaryPlanId: string,
  input: CreateExpenseTransactionInput,
) {
  const { plan, planRef } = await getOwnedOpenPlan(salaryPlanId);
  const category = resolveSelectedCategory(plan, input.categoryId);
  const amount = validateNonNegativeAmount(input.amount, "Transaction amount");

  const transactionRef = doc(
    collection(db, SALARY_PLANS_COLLECTION, salaryPlanId, "transactions"),
  );

  await runTransaction(db, async (transaction) => {
    const currentPlanSnapshot = await transaction.get(planRef);
    if (!currentPlanSnapshot.exists())
      throw new Error("Salary plan not found.");
    const currentPlan = currentPlanSnapshot.data() as SalaryPlanDocument;
    if (currentPlan.userId !== getAuthenticatedUid()) {
      throw new Error("Salary plan does not belong to the authenticated user.");
    }
    if (currentPlan.status === "closed") {
      throw new Error("Transactions cannot be added to a closed salary plan.");
    }
    resolveSelectedCategory(currentPlan, category.categoryId);

    transaction.set(transactionRef, {
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      amount,
      ...(input.description?.trim()
        ? { description: input.description.trim() }
        : {}),
      transactionDate: input.transactionDate,
      createdAt: serverTimestamp(),
      createdBy: getAuthenticatedUid(),
    });

    transaction.update(planRef, {
      totalSpent: validateNonNegativeAmount(
        (currentPlan.totalSpent ?? 0) + amount,
        "Total spent",
      ),
      updatedAt: serverTimestamp(),
    });
  });

  const created = await getDoc(transactionRef);
  if (!created.exists())
    throw new Error("Could not load the created transaction.");
  return mapExpenseTransaction(created);
}

export async function getExpenseTransactions(salaryPlanId: string) {
  await getOwnedPlan(salaryPlanId);
  const snapshot = await getDocs(
    query(
      collection(db, SALARY_PLANS_COLLECTION, salaryPlanId, "transactions"),
      orderBy("transactionDate", "desc"),
    ),
  );
  return snapshot.docs.map(mapExpenseTransaction);
}

export async function getExpenseTransactionById(
  salaryPlanId: string,
  transactionId: string,
) {
  await getOwnedPlan(salaryPlanId);
  const normalizedId = transactionId.trim();
  if (!normalizedId) throw new Error("Expense transaction id is required.");
  const snapshot = await getDoc(
    doc(
      db,
      SALARY_PLANS_COLLECTION,
      salaryPlanId,
      "transactions",
      normalizedId,
    ),
  );
  if (!snapshot.exists()) return null;
  return mapExpenseTransaction(snapshot);
}

export async function updateExpenseTransaction(
  salaryPlanId: string,
  transactionId: string,
  input: UpdateExpenseTransactionInput,
) {
  const { plan, planRef } = await getOwnedOpenPlan(salaryPlanId);
  const normalizedId = transactionId.trim();
  if (!normalizedId) throw new Error("Expense transaction id is required.");
  const transactionRef = doc(
    db,
    SALARY_PLANS_COLLECTION,
    salaryPlanId,
    "transactions",
    normalizedId,
  );

  await runTransaction(db, async (transaction) => {
    const planSnapshot = await transaction.get(planRef);
    if (!planSnapshot.exists()) throw new Error("Salary plan not found.");
    const currentPlan = planSnapshot.data() as SalaryPlanDocument;
    if (currentPlan.userId !== getAuthenticatedUid()) {
      throw new Error("Salary plan does not belong to the authenticated user.");
    }
    if (currentPlan.status === "closed") {
      throw new Error(
        "Transactions cannot be changed on a closed salary plan.",
      );
    }

    const existingSnapshot = await transaction.get(transactionRef);
    if (!existingSnapshot.exists())
      throw new Error("Expense transaction not found.");
    const existing = existingSnapshot.data() as ExpenseTransactionDocument;

    const nextCategoryId = input.categoryId ?? existing.categoryId;
    const category = resolveSelectedCategory(currentPlan, nextCategoryId);
    const nextAmount =
      input.amount === undefined
        ? existing.amount
        : validateNonNegativeAmount(input.amount, "Transaction amount");

    const updates: Record<string, unknown> = {
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      amount: nextAmount,
    };
    if (input.description !== undefined)
      updates.description = input.description?.trim() || "";
    if (input.transactionDate !== undefined)
      updates.transactionDate = input.transactionDate;

    transaction.update(transactionRef, updates);
    transaction.update(planRef, {
      totalSpent: validateNonNegativeAmount(
        (currentPlan.totalSpent ?? 0) - existing.amount + nextAmount,
        "Total spent",
      ),
      updatedAt: serverTimestamp(),
    });
  });

  return (await getExpenseTransactionById(
    salaryPlanId,
    normalizedId,
  )) as ExpenseTransaction;
}

export async function deleteExpenseTransaction(
  salaryPlanId: string,
  transactionId: string,
) {
  await getOwnedOpenPlan(salaryPlanId);
  const normalizedId = transactionId.trim();
  if (!normalizedId) throw new Error("Expense transaction id is required.");
  const planRef = doc(db, SALARY_PLANS_COLLECTION, salaryPlanId);
  const transactionRef = doc(
    db,
    SALARY_PLANS_COLLECTION,
    salaryPlanId,
    "transactions",
    normalizedId,
  );

  await runTransaction(db, async (transaction) => {
    const planSnapshot = await transaction.get(planRef);
    if (!planSnapshot.exists()) throw new Error("Salary plan not found.");
    const currentPlan = planSnapshot.data() as SalaryPlanDocument;
    if (currentPlan.userId !== getAuthenticatedUid()) {
      throw new Error("Salary plan does not belong to the authenticated user.");
    }
    if (currentPlan.status === "closed") {
      throw new Error(
        "Transactions cannot be deleted on a closed salary plan.",
      );
    }

    const existingSnapshot = await transaction.get(transactionRef);
    if (!existingSnapshot.exists())
      throw new Error("Expense transaction not found.");
    const existing = existingSnapshot.data() as ExpenseTransactionDocument;

    transaction.delete(transactionRef);
    transaction.update(planRef, {
      totalSpent: validateNonNegativeAmount(
        (currentPlan.totalSpent ?? 0) - existing.amount,
        "Total spent",
      ),
      updatedAt: serverTimestamp(),
    });
  });
}
