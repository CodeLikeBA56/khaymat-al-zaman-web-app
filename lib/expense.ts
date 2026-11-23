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

export type ExpensePeriodSummary = {
  period: string;
  total: number;
};

export function calculateExpensePeriodStats(
  transactions: readonly ExpenseTransaction[],
  now: Date = new Date(),
) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const inRange = (start: Date) => (transaction: ExpenseTransaction) =>
    transaction.transactionDate.toMillis() >= start.getTime();

  const sum = (items: readonly ExpenseTransaction[]) =>
    items.reduce((total, transaction) => total + transaction.amount, 0);

  return {
    daily: sum(transactions.filter(inRange(startOfDay))),
    weekly: sum(transactions.filter(inRange(startOfWeek))),
    monthly: sum(transactions.filter(inRange(startOfMonth))),
  };
}

export function calculateCategorySpending(
  transactions: readonly ExpenseTransaction[],
) {
  const totals = new Map<
    string,
    { categoryId: string; categoryName: string; total: number }
  >();
  transactions.forEach((transaction) => {
    const current = totals.get(transaction.categoryId);
    totals.set(transaction.categoryId, {
      categoryId: transaction.categoryId,
      categoryName: transaction.categoryName,
      total: (current?.total ?? 0) + transaction.amount,
    });
  });
  return Array.from(totals.values()).sort((a, b) => b.total - a.total);
}

export function calculateHistoricalMonthlyComparison(
  transactions: readonly ExpenseTransaction[],
) {
  const totals = new Map<string, number>();
  transactions.forEach((transaction) => {
    const date = transaction.transactionDate.toDate();
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    totals.set(period, (totals.get(period) ?? 0) + transaction.amount);
  });
  return Array.from(totals.entries())
    .map(([period, total]) => ({ period, total }))
    .sort((a, b) => a.period.localeCompare(b.period));
}
