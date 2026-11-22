# Personal Salary and Expense Frontend

## Routes

- `/expense` — module overview
- `/expense/categories` — category management
- `/expense/plans` — monthly draft and plan management
- `/expense/plans/{planId}` — detailed monthly dashboard and transactions

## User workflow

1. Create reusable personal categories.
2. Create a monthly draft and allocate an available salary.
3. Copy a previous month's allocations when useful.
4. Activate a valid plan.
5. Add, edit, or delete expenses while the plan is active.
6. Review category and period statistics on the plan detail page.

## Redux integration

Pages dispatch the existing category, salary-plan, and transaction async thunks. The UI does not call Firestore directly. Loading, rejected, and success states come from the existing slices.

## Tests

Run the pure calculation tests with:

```sh
rm -rf .tmp-expense-test
./node_modules/.bin/tsc types/expense.ts lib/expense.ts lib/expense.test.ts --outDir .tmp-expense-test --module commonjs --target ES2022 --skipLibCheck --esModuleInterop --types node
node --test .tmp-expense-test/lib/expense.test.js
rm -rf .tmp-expense-test
```

Run the strict project TypeScript check with:

```sh
./node_modules/.bin/tsc --noEmit
```

The project does not currently contain a React component testing library or emulator configuration, so Firebase-dependent and component interaction tests should be added in a later test setup rather than introducing an unnecessary dependency.
