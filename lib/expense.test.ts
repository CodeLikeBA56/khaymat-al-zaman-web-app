import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase/firestore";
import { calculateSalaryPlanStats } from "./expense";
import type { ExpenseTransaction, SalaryPlan } from "../types/expense";

const plan: SalaryPlan = {
  id: "plan-1",
  userId: "user-1",
  month: "2026-11",
  salaryAmount: 1000,
  currency: "SAR",
  status: "active",
  categories: [
    { categoryId: "food", categoryName: "Food", budgetAmount: 400 },
    { categoryId: "transport", categoryName: "Transport", budgetAmount: 200 },
  ],
  createdAt: Timestamp.fromMillis(0),
  updatedAt: Timestamp.fromMillis(0),
};

const transactions: ExpenseTransaction[] = [
  {
    id: "tx-1",
    categoryId: "food",
    categoryName: "Food",
    amount: 100,
    transactionDate: Timestamp.fromMillis(1),
    createdAt: Timestamp.fromMillis(1),
    createdBy: "user-1",
  },
  {
    id: "tx-2",
    categoryId: "food",
    categoryName: "Food",
    amount: 50,
    transactionDate: Timestamp.fromMillis(2),
    createdAt: Timestamp.fromMillis(2),
    createdBy: "user-1",
  },
];

test("calculateSalaryPlanStats computes plan totals", () => {
  const stats = calculateSalaryPlanStats(plan, transactions);
  assert.equal(stats.totalAllocated, 600);
  assert.equal(stats.totalSpent, 150);
  assert.equal(stats.unallocatedAmount, 400);
  assert.equal(stats.remainingAllocated, 450);
});

test("calculateSalaryPlanStats computes category usage", () => {
  const stats = calculateSalaryPlanStats(plan, transactions);
  assert.deepEqual(stats.categories[0], {
    categoryId: "food",
    categoryName: "Food",
    budgetAmount: 400,
    categorySpent: 150,
    categoryRemaining: 250,
    usagePercentage: 37.5,
  });
  assert.equal(stats.categories[1].categorySpent, 0);
  assert.equal(stats.categories[1].usagePercentage, 0);
});
