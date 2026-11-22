import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  validateNonNegativeAmount,
  validateSalaryPlanCategories,
  validateSalaryPlanMonth,
  type CreateSalaryPlanInput,
  type ExpenseCategoryDocument,
  type SalaryPlan,
  type SalaryPlanCategory,
  type SalaryPlanDocument,
  type UpdateSalaryPlanInput,
} from "@/types/expense";

const SALARY_PLANS_COLLECTION = "salaryPlans";
const EXPENSE_CATEGORIES_COLLECTION = "expenseCategories";

function getAuthenticatedUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in.");
  return uid;
}

function mapSalaryPlan(
  snapshot:
    | QueryDocumentSnapshot<DocumentData>
    | DocumentSnapshot<DocumentData>,
): SalaryPlan {
  const data = snapshot.data() as SalaryPlanDocument | undefined;
  if (!data) throw new Error("Salary plan document data is missing.");
  return { id: snapshot.id, ...data };
}

function getDeterministicPlanId(userId: string, month: string) {
  return `${encodeURIComponent(userId)}_${month}`;
}

async function resolveCategoryBudgets(
  userId: string,
  categories: SalaryPlanCategory[],
) {
  validateSalaryPlanCategories(categories);

  const resolved: SalaryPlanCategory[] = [];
  for (const category of categories) {
    const snapshot = await getDoc(
      doc(db, EXPENSE_CATEGORIES_COLLECTION, category.categoryId),
    );
    if (!snapshot.exists()) {
      throw new Error(`Category ${category.categoryId} does not exist.`);
    }
    const data = snapshot.data() as ExpenseCategoryDocument;
    if (data.userId !== userId) {
      throw new Error("Category does not belong to the authenticated user.");
    }
    if (!data.isActive) {
      throw new Error(`Category ${category.categoryId} is inactive.`);
    }
    resolved.push({
      categoryId: category.categoryId,
      categoryName: data.name,
      budgetAmount: validateNonNegativeAmount(category.budgetAmount),
    });
  }
  return resolved;
}

async function assertPlanOwnedByCurrentUser(planId: string) {
  const snapshot = await getDoc(doc(db, SALARY_PLANS_COLLECTION, planId));
  if (!snapshot.exists()) return null;
  const plan = mapSalaryPlan(snapshot);
  if (plan.userId !== getAuthenticatedUid()) return null;
  return plan;
}

function calculateAllocated(categories: SalaryPlanCategory[]) {
  return categories.reduce((sum, category) => sum + category.budgetAmount, 0);
}

export async function createSalaryPlan(input: CreateSalaryPlanInput) {
  const userId = getAuthenticatedUid();
  const month = validateSalaryPlanMonth(input.month);
  const salaryAmount = validateNonNegativeAmount(
    input.salaryAmount,
    "Salary amount",
  );
  const categories = await resolveCategoryBudgets(userId, input.categories);
  const totalAllocated = calculateAllocated(categories);
  if (totalAllocated > salaryAmount) {
    throw new Error("Total allocated budget cannot exceed salary amount.");
  }

  const planRef = doc(db, SALARY_PLANS_COLLECTION, getDeterministicPlanId(userId, month));
  const created = await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(planRef);
    if (existing.exists()) {
      throw new Error(`A salary plan already exists for ${month}.`);
    }

    const status = input.status ?? "draft";
    if (status !== "draft" && status !== "active") {
      throw new Error("A salary plan can only be created as draft or active.");
    }
    if (status === "active") {
      validateSalaryPlanCategories(categories);
    }

    transaction.set(planRef, {
      userId,
      month,
      salaryAmount,
      currency: input.currency?.trim() || "SAR",
      status,
      categories,
      totalAllocated,
      totalSpent: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: planRef.id };
  });

  const snapshot = await getDoc(planRef);
  if (!snapshot.exists()) throw new Error("Could not load the created salary plan.");
  return { ...mapSalaryPlan(snapshot), id: created.id };
}

export async function getSalaryPlans() {
  const userId = getAuthenticatedUid();
  const snapshot = await getDocs(
    query(
      collection(db, SALARY_PLANS_COLLECTION),
      where("userId", "==", userId),
      orderBy("month", "desc"),
    ),
  );
  return snapshot.docs.map(mapSalaryPlan);
}

export async function getSalaryPlanById(planId: string) {
  return assertPlanOwnedByCurrentUser(planId);
}

export async function updateSalaryPlan(
  planId: string,
  input: UpdateSalaryPlanInput,
) {
  const plan = await assertPlanOwnedByCurrentUser(planId);
  if (!plan) throw new Error("Salary plan not found.");
  if (plan.status === "closed") throw new Error("Closed salary plans cannot be edited.");
  if (plan.status !== "draft") throw new Error("Only draft salary plans can be edited.");

  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  const nextSalaryAmount =
    input.salaryAmount === undefined
      ? plan.salaryAmount
      : validateNonNegativeAmount(input.salaryAmount, "Salary amount");
  updates.salaryAmount = nextSalaryAmount;

  const nextCategories =
    input.categories === undefined
      ? plan.categories
      : await resolveCategoryBudgets(plan.userId, input.categories);
  const nextAllocated = calculateAllocated(nextCategories);
  if (nextAllocated > nextSalaryAmount) {
    throw new Error("Total allocated budget cannot exceed salary amount.");
  }
  updates.categories = nextCategories;
  updates.totalAllocated = nextAllocated;

  if (input.month !== undefined) {
    const nextMonth = validateSalaryPlanMonth(input.month);
    if (nextMonth !== plan.month) {
      throw new Error("Salary plan month cannot be changed.");
    }
  }
  if (input.currency !== undefined)
    updates.currency = input.currency.trim() || "SAR";
  if (input.status !== undefined) {
    if (input.status !== "draft" && input.status !== "active") {
      throw new Error("Salary plan status must be draft or active for editing.");
    }
    updates.status = input.status;
  }

  await updateDoc(doc(db, SALARY_PLANS_COLLECTION, plan.id), updates);
  return (await getSalaryPlanById(plan.id)) as SalaryPlan;
}

export async function activateSalaryPlan(planId: string) {
  const plan = await assertPlanOwnedByCurrentUser(planId);
  if (!plan) throw new Error("Salary plan not found.");
  if (plan.status === "closed") throw new Error("Closed salary plans cannot be activated.");
  if (plan.categories.length === 0) {
    throw new Error("A salary plan requires at least one category budget before activation.");
  }
  validateSalaryPlanCategories(plan.categories);
  const totalAllocated = calculateAllocated(plan.categories);
  if (totalAllocated > plan.salaryAmount) {
    throw new Error("Total allocated budget cannot exceed salary amount.");
  }

  await updateDoc(doc(db, SALARY_PLANS_COLLECTION, plan.id), {
    status: "active",
    totalAllocated,
    updatedAt: serverTimestamp(),
  });
  return (await getSalaryPlanById(plan.id)) as SalaryPlan;
}

export async function closeSalaryPlan(planId: string) {
  const plan = await assertPlanOwnedByCurrentUser(planId);
  if (!plan) throw new Error("Salary plan not found.");
  await updateDoc(doc(db, SALARY_PLANS_COLLECTION, plan.id), {
    status: "closed",
    updatedAt: serverTimestamp(),
  });
  return (await getSalaryPlanById(plan.id)) as SalaryPlan;
}
