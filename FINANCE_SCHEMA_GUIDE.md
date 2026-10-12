# Finance & Attendance Schema Guide

This file explains the current data schemas, how they connect, and simple examples.

## 1) Collections


### users

Stores employee profile + employment history.

Core fields:

- `uid`
- `name`
- `authProvider` (`email` | `phone`)
- `email?`, `phoneNumber?`
- `pin` (bcrypt encrypted)
- `workHistory[]` (role/salary/hours over time)
- `isActive`

Example:

```json
{
  "uid": "u_1",
  "name": "Ali",
  "authProvider": "email",
  "email": "ali@example.com",
  "pin": "$2b$10$...",
  "workHistory": [
    {
      "id": "p1",
      "joinedAt": "2026-09-01T00:00:00.000Z",
      "leftAt": null,
      "salary": 2500,
      "role": "cashier",
      "workingHoursPerDay": 12
    }
  ],
  "isActive": true
}
```

---


### attendance

Daily attendance records. Not directly used in salary math yet.

Core fields:

- `id` (`userId_YYYY-MM-DD`)
- `userId`
- `date`
- `status` (`present`, `absent`, `half_day`, `leave`, `holiday`)

---


### salaryPeriods

Monthly salary slip snapshot for one employee and one month.

Core fields:

- `id` (`userId_YYYY_MM`)
- `userId`, `year`, `month`
- `baseSalary`
- `adjustments[]` (bonus/overtime/deduction/advance)
- `grossSalary`, `totalDeductions`, `netSalary`
- `paidAmount`, `remainingAmount`
- `status` (`pending`, `partial`, `paid`, `final_settlement`)

---


### salaryPayments

Payment event (can be partial). One payment can target multiple salary periods.

Core fields:

- `id`
- `userId`
- `amount`
- `allocations[]` with `{ salaryPeriodId, amount }`
- `paymentMethod`, `paidBy`

---


### salaryAdvances

Advance given to employee and deducted later from generated slips.

Core fields:

- `id`
- `userId`
- `amount`
- `remainingAmount`
- `status` (`unpaid`, `partially_deducted`, `fully_deducted`)

---

## 2) How collections connect


- `users.uid` -> `attendance.userId`
- `users.uid` -> `salaryPeriods.userId`
- `users.uid` -> `salaryPayments.userId`
- `users.uid` -> `salaryAdvances.userId`
- `salaryPayments.allocations[].salaryPeriodId` -> `salaryPeriods.id`

In short:

- `salaryPeriods` are monthly liabilities.
- `salaryPayments` reduce liabilities.
- `salaryAdvances` become deductions during salary generation.

---

## 3) Process examples


## A) Generate September salary slip

Given active work history salary = `2500` and one outstanding advance `500`:

- Create period `u_1_2026_09`
- Add adjustment: `advance 500`
- `netSalary = 2000`
- `paidAmount = 0`, `remainingAmount = 2000`

---


## B) Pay salary in 3 chunks

For remaining `2000`:

1. Payment `700` -> remaining `1300`
2. Payment `600` -> remaining `700`
3. Payment `700` -> remaining `0`, status becomes `paid`

Each payment creates a `salaryPayments` document and updates the linked `salaryPeriods`.

---


## C) Give advance and auto-deduct next slip

- Give advance `1000` in October -> `salaryAdvances.remainingAmount = 1000`
- Generate November slip:
  - system auto-adds `advance` deduction from outstanding advances
  - reduces advance remaining amount

---

## 4) Ledger behavior (current)

Current system is an operational ledger model:

- `salaryPayments` = payment events
- `salaryPeriods` = running monthly balances (`paidAmount`, `remainingAmount`)
- `salaryAdvances` = advance balances

This gives clear balance tracking, but if strict accounting immutability is needed, use append-only journal entries + reversal entries in future.

---

## 5) Dashboard logic (current implementation)

- Salary details pages aggregate **outstanding salary** from `salaryPeriods.remainingAmount > 0`.
- Employee name/current salary comes from `users` + active `workHistory`.

So dashboard “Overall Salary to Pay” now represents generated-but-unpaid slip liabilities.
