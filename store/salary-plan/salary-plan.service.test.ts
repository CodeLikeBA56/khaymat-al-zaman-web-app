import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase/firestore";
import { __salaryPlanServiceInternals } from "./salary-plan.service";
import type {
  ExpenseCategoryDocument,
  SalaryPlanCategory,
} from "@/types/expense";

function categoryDocument(
  overrides: Partial<ExpenseCategoryDocument> = {},
): ExpenseCategoryDocument {
  return {
    userId: "user-1",
    name: "Food",
    isActive: true,
    createdAt: Timestamp.fromMillis(0),
    updatedAt: Timestamp.fromMillis(0),
    ...overrides,
  };
}

function allocation(categoryId: string, name = "Food"): SalaryPlanCategory {
  return { categoryId, categoryName: name, budgetAmount: 100 };
}

test("category validation returns immediately for an empty selection", async () => {
  let queryCount = 0;
  const resolved = await __salaryPlanServiceInternals.resolveCategoryBudgets(
    "user-1",
    [],
    async () => {
      queryCount += 1;
      return [];
    },
  );

  assert.deepEqual(resolved, []);
  assert.equal(queryCount, 0);
});

test("category validation resolves one valid category", async () => {
  const resolved = await __salaryPlanServiceInternals.resolveCategoryBudgets(
    "user-1",
    [allocation("cat-1")],
    async (_userId, ids) =>
      ids.map((id) => ({ id, data: categoryDocument({ name: "Food" }) })),
  );

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].categoryId, "cat-1");
  assert.equal(resolved[0].categoryName, "Food");
});

test("category validation resolves multiple valid categories", async () => {
  const resolved = await __salaryPlanServiceInternals.resolveCategoryBudgets(
    "user-1",
    [allocation("cat-1", "Food"), allocation("cat-2", "Travel")],
    async (_userId, ids) =>
      ids.map((id) => ({
        id,
        data: categoryDocument({
          name: id === "cat-1" ? "Food" : "Travel",
        }),
      })),
  );

  assert.deepEqual(
    resolved.map((item) => item.categoryId),
    ["cat-1", "cat-2"],
  );
});

test("category validation chunks more than 30 categories", async () => {
  const categories = Array.from({ length: 67 }, (_, index) =>
    allocation(`cat-${index + 1}`, `Category ${index + 1}`),
  );
  const queriedChunks: string[][] = [];

  const resolved = await __salaryPlanServiceInternals.resolveCategoryBudgets(
    "user-1",
    categories,
    async (_userId, ids) => {
      queriedChunks.push([...ids]);
      return ids.map((id, index) => ({
        id,
        data: categoryDocument({ name: `Category ${index + 1}` }),
      }));
    },
  );

  assert.equal(resolved.length, 67);
  assert.equal(queriedChunks.length, 3);
  assert.deepEqual(
    queriedChunks.map((chunk) => chunk.length),
    [30, 30, 7],
  );
});

test("category validation rejects a missing category", async () => {
  await assert.rejects(
    () =>
      __salaryPlanServiceInternals.resolveCategoryBudgets(
        "user-1",
        [allocation("missing")],
        async () => [],
      ),
    /missing.*does not exist or is not accessible/i,
  );
});

test("category validation rejects an inactive category", async () => {
  await assert.rejects(
    () =>
      __salaryPlanServiceInternals.resolveCategoryBudgets(
        "user-1",
        [allocation("cat-1")],
        async () => [
          {
            id: "cat-1",
            data: categoryDocument({ isActive: false }),
          },
        ],
      ),
    /cat-1.*inactive/i,
  );
});

test("category validation rejects a category owned by another user", async () => {
  await assert.rejects(
    () =>
      __salaryPlanServiceInternals.resolveCategoryBudgets(
        "user-1",
        [allocation("cat-1")],
        async () => [
          {
            id: "cat-1",
            data: categoryDocument({ userId: "user-2" }),
          },
        ],
      ),
    /does not belong to the authenticated user/i,
  );
});

test("category validation rejects duplicate category IDs", async () => {
  let queryCount = 0;
  await assert.rejects(
    () =>
      __salaryPlanServiceInternals.resolveCategoryBudgets(
        "user-1",
        [allocation("cat-1"), allocation("cat-1")],
        async () => {
          queryCount += 1;
          return [];
        },
      ),
    /Duplicate category id/i,
  );
  assert.equal(queryCount, 0);
});

test("category validation wraps Firestore query failures", async () => {
  await assert.rejects(
    () =>
      __salaryPlanServiceInternals.resolveCategoryBudgets(
        "user-1",
        [allocation("cat-1")],
        async () => {
          throw new Error("permission denied");
        },
      ),
    /Could not validate expense categories: permission denied/i,
  );
});
