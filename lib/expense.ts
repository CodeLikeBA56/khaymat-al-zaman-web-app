import type {
  CategorySalaryStatistics,
  ExpenseTransaction,
  SalaryPlan,
  SalaryPlanStatistics,
} from "../types/expense";

export interface SalaryPlanStats extends SalaryPlanStatistics {
  categories: CategorySalaryStatistics[];
}

/**
 * Pure salary-plan calculations. This module does not depend on Firebase or
 * Redux; transaction values and category budgets are supplied by the caller.
 */
export function calculateSalaryPlanStats(
  salaryPlan: SalaryPlan,
  transactions: readonly ExpenseTransaction[],
): SalaryPlanStats {
  const totalAllocated = salaryPlan.categories.reduce(
    (sum, category) => sum + category.budgetAmount,
    0,
  );
  const totalSpent = transactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );

  const categories = salaryPlan.categories.map((category) => {
    const categorySpent = transactions
      .filter((transaction) => transaction.categoryId === category.categoryId)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const categoryRemaining = category.budgetAmount - categorySpent;
    const usagePercentage =
      category.budgetAmount === 0
        ? 0
        : (categorySpent / category.budgetAmount) * 100;

    return {
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      budgetAmount: category.budgetAmount,
      categorySpent,
      categoryRemaining,
      usagePercentage,
    };
  });

  return {
    totalAllocated,
    totalSpent,
    unallocatedAmount: salaryPlan.salaryAmount - totalAllocated,
    remainingAllocated: totalAllocated - totalSpent,
    categories,
  };
}
