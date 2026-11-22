# Employee Expense Module Services

The expense module uses two top-level Firestore collections:

- `expenseCategories`: reusable, user-owned categories with `isActive` soft deactivation.
- `salaryPlans`: monthly plans keyed deterministically by Firebase UID and `YYYY-MM`.

Transactions are stored at `salaryPlans/{salaryPlanId}/transactions/{transactionId}`.

## Ownership and mutation rules

- Category and salary-plan queries always filter or verify `userId` against `auth.currentUser.uid`.
- Salary plans use `${uid}_${YYYY-MM}` document IDs to prevent duplicate monthly plans.
- Only draft salary plans can be edited. Closed plans cannot be activated or edited.
- Category budgets must identify active categories owned by the current user, and their total cannot exceed the salary amount.
- Transactions require a category selected in the owned salary plan. Closed plans reject transaction mutations.
- Transaction creates, updates, and deletes use Firestore transactions to update `totalSpent` atomically.

## Redux state

The expense feature exposes three Redux slices:

- `expenseCategory`: category loading, saving, list, selection, error, and success state.
- `salaryPlan`: monthly plan loading, saving, list, selection, error, and success state.
- `expenseTransaction`: plan-scoped transaction loading, saving, list, selection, error, and success state.

Async thunks call the Firestore services only; React components should dispatch thunks and select state through `store/hooks.ts`.

## Salary statistics

`calculateSalaryPlanStats` in `lib/expense.ts` is pure and independent of Firebase and Redux. It returns plan totals and per-category spending, remaining budget, and usage percentage.
