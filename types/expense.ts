import type { Timestamp } from "firebase/firestore";

/**
 * Month key for a salary plan. Runtime validation also verifies the month
 * number and calendar shape; this template literal documents YYYY-MM format.
 */
export type SalaryPlanMonth =
  `${number}${number}${number}${number}-${number}${number}`;

/** A reusable amount represented as a non-negative number. */
export type NonNegativeAmount = number;

/** Status of a monthly personal salary plan. */
export type SalaryPlanStatus = "draft" | "active" | "closed";

/** Reusable expense category stored in the expenseCategories collection. */
export interface ExpenseCategoryDocument {
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Expense category with its separate Firestore document ID. */
export interface ExpenseCategory extends ExpenseCategoryDocument {
  id: string;
}

/** Fields required to create a reusable expense category. */
export type CreateExpenseCategoryInput = Pick<ExpenseCategoryDocument, "name"> &
  Partial<
    Pick<ExpenseCategoryDocument, "description" | "icon" | "color" | "isActive">
  >;

/** Fields that may be changed on an existing expense category. */
export type UpdateExpenseCategoryInput = Partial<CreateExpenseCategoryInput>;

/** Historical budget snapshot for a category selected in a salary plan. */
export interface SalaryPlanCategory {
  categoryId: string;
  categoryName: string;
  budgetAmount: NonNegativeAmount;
}

/** Monthly salary plan stored in the salaryPlans collection. */
export interface SalaryPlanDocument {
  userId: string;
  month: SalaryPlanMonth;
  salaryAmount: NonNegativeAmount;
  currency: string;
  status: SalaryPlanStatus;
  categories: SalaryPlanCategory[];
  totalAllocated?: NonNegativeAmount;
  totalSpent?: NonNegativeAmount;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Salary plan with its separate Firestore document ID. */
export interface SalaryPlan extends SalaryPlanDocument {
  id: string;
}

/** Fields required to create a monthly salary plan. */
export type CreateSalaryPlanInput = Pick<
  SalaryPlanDocument,
  "month" | "salaryAmount" | "categories"
> &
  Partial<
    Pick<
      SalaryPlanDocument,
      "currency" | "status" | "totalAllocated" | "totalSpent"
    >
  >;

/** Fields that may be changed on an existing salary plan. */
export type UpdateSalaryPlanInput = Partial<CreateSalaryPlanInput>;

/** Expense transaction stored in a salary plan's transactions subcollection. */
export interface ExpenseTransactionDocument {
  categoryId: string;
  categoryName: string;
  amount: NonNegativeAmount;
  description?: string;
  transactionDate: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
}

/** Expense transaction with its separate Firestore document ID. */
export interface ExpenseTransaction extends ExpenseTransactionDocument {
  id: string;
}

/** Fields required to create an expense transaction. */
export type CreateExpenseTransactionInput = Pick<
  ExpenseTransactionDocument,
  "categoryId" | "categoryName" | "amount" | "transactionDate"
> &
  Partial<Pick<ExpenseTransactionDocument, "description">>;

/** Fields that may be changed on an existing expense transaction. */
export type UpdateExpenseTransactionInput = Partial<
  Pick<
    CreateExpenseTransactionInput,
    "categoryId" | "categoryName" | "amount" | "description" | "transactionDate"
  >
>;

/** Calculated totals for a monthly salary plan. */
export interface SalaryPlanStatistics {
  totalAllocated: NonNegativeAmount;
  totalSpent: NonNegativeAmount;
  unallocatedAmount: number;
  remainingAllocated: number;
}

/** Calculated spending values for one category in a salary plan. */
export interface CategorySalaryStatistics {
  categoryId: string;
  categoryName: string;
  budgetAmount: NonNegativeAmount;
  categorySpent: NonNegativeAmount;
  categoryRemaining: number;
  usagePercentage: number;
}

/** Throws when an amount is negative or is not a finite number. */
export function validateNonNegativeAmount(
  amount: number,
  fieldName = "Amount",
): NonNegativeAmount {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return amount;
}

/** Throws unless month follows a valid YYYY-MM month key. */
export function validateSalaryPlanMonth(month: string): SalaryPlanMonth {
  const match = /^([0-9]{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) {
    throw new Error("Salary plan month must follow YYYY-MM format.");
  }
  return month as SalaryPlanMonth;
}

/** Validates category budgets and optionally requires IDs from known categories. */
export function validateSalaryPlanCategories(
  categories: SalaryPlanCategory[],
  validCategoryIds?: readonly string[],
): SalaryPlanCategory[] {
  const seen = new Set<string>();
  const knownIds = validCategoryIds ? new Set(validCategoryIds) : null;

  categories.forEach((category, index) => {
    if (!category.categoryId.trim()) {
      throw new Error(`Category ${index + 1} category id is required.`);
    }
    if (!category.categoryName.trim()) {
      throw new Error(`Category ${index + 1} category name is required.`);
    }
    if (seen.has(category.categoryId)) {
      throw new Error(`Duplicate category id: ${category.categoryId}.`);
    }
    if (knownIds && !knownIds.has(category.categoryId)) {
      throw new Error(`Unknown category id: ${category.categoryId}.`);
    }
    seen.add(category.categoryId);
    validateNonNegativeAmount(
      category.budgetAmount,
      `Category ${index + 1} budget`,
    );
  });

  return categories;
}

/** Throws when a transaction category is not selected in the salary plan. */
export function validateExpenseTransactionCategory(
  categoryId: string,
  salaryPlanCategories: readonly SalaryPlanCategory[],
): string {
  const selected = salaryPlanCategories.some(
    (category) => category.categoryId === categoryId,
  );
  if (!selected) {
    throw new Error(
      `Category ${categoryId} is not selected in this salary plan.`,
    );
  }
  return categoryId;
}
