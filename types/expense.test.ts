import assert from "node:assert/strict";
import test from "node:test";
import {
  validateExpenseTransactionCategory,
  validateNonNegativeAmount,
  validateSalaryPlanCategories,
  validateSalaryPlanMonth,
  type SalaryPlanCategory,
} from "./expense";

test("expense amount validation rejects negative and non-finite amounts", () => {
  assert.equal(validateNonNegativeAmount(125.5), 125.5);
  assert.throws(() => validateNonNegativeAmount(-1), /non-negative/);
  assert.throws(() => validateNonNegativeAmount(Number.NaN), /non-negative/);
});

test("salary plan month validation requires YYYY-MM", () => {
  assert.equal(validateSalaryPlanMonth("2026-11"), "2026-11");
  assert.throws(() => validateSalaryPlanMonth("2026-13"), /YYYY-MM/);
  assert.throws(() => validateSalaryPlanMonth("11-2026"), /YYYY-MM/);
});

test("salary plan categories require valid unique IDs and budgets", () => {
  const categories: SalaryPlanCategory[] = [
    { categoryId: "food", categoryName: "Food", budgetAmount: 100 },
  ];

  assert.deepEqual(validateSalaryPlanCategories(categories, ["food"]), categories);
  assert.throws(
    () => validateSalaryPlanCategories(categories, ["transport"]),
    /Unknown category id/,
  );
  assert.throws(
    () =>
      validateSalaryPlanCategories([
        ...categories,
        { categoryId: "food", categoryName: "Food", budgetAmount: 50 },
      ]),
    /Duplicate category id/,
  );
});

test("expense transaction category must exist in the salary plan", () => {
  const categories: SalaryPlanCategory[] = [
    { categoryId: "food", categoryName: "Food", budgetAmount: 100 },
  ];

  assert.equal(validateExpenseTransactionCategory("food", categories), "food");
  assert.throws(
    () => validateExpenseTransactionCategory("rent", categories),
    /not selected/,
  );
});
