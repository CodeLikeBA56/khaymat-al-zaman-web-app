"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageSectionHeader } from "@/components/layout/page-section-header";
import { TransactionDialog } from "@/components/expenses/transaction-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchSalaryPlanById } from "@/store/salary-plan/salary-plan.reducer";
import {
  createExpenseTransactionThunk,
  deleteExpenseTransactionThunk,
  fetchExpenseTransactions,
  updateExpenseTransactionThunk,
} from "@/store/expense-transaction/expense-transaction.reducer";
import {
  calculateCategorySpending,
  calculateExpensePeriodStats,
  calculateHistoricalMonthlyComparison,
  calculateSalaryPlanStats,
} from "@/lib/expense";
import type { ExpenseTransaction } from "@/types/expense";

function formatMoney(amount: number, currency = "SAR") {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

export default function SalaryPlanDetailsPage() {
  const params = useParams<{ planId: string }>();
  const planId = params.planId;
  const dispatch = useAppDispatch();
  const selectedPlan = useAppSelector((state) => state.salaryPlan.selectedPlan);
  const planLoading = useAppSelector((state) => state.salaryPlan.isLoading);
  const transactionsState = useAppSelector((state) => state.expenseTransaction);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseTransaction | null>(null);

  useEffect(() => {
    if (!planId) return;
    void dispatch(fetchSalaryPlanById(planId));
    void dispatch(fetchExpenseTransactions(planId));
  }, [dispatch, planId]);

  const stats = useMemo(
    () =>
      selectedPlan
        ? calculateSalaryPlanStats(selectedPlan, transactionsState.transactions)
        : null,
    [selectedPlan, transactionsState.transactions],
  );
  const periodStats = useMemo(
    () => calculateExpensePeriodStats(transactionsState.transactions),
    [transactionsState.transactions],
  );
  const categorySpending = useMemo(
    () => calculateCategorySpending(transactionsState.transactions),
    [transactionsState.transactions],
  );
  const history = useMemo(
    () => calculateHistoricalMonthlyComparison(transactionsState.transactions),
    [transactionsState.transactions],
  );
  const overallPercentage =
    stats && selectedPlan && selectedPlan.salaryAmount > 0
      ? (stats.totalSpent / selectedPlan.salaryAmount) * 100
      : 0;

  async function submitTransaction(value: {
    categoryId: string;
    categoryName: string;
    amount: number;
    description?: string;
    transactionDate: import("firebase/firestore").Timestamp;
  }) {
    if (!selectedPlan) return;
    if (editing) {
      const result = await dispatch(
        updateExpenseTransactionThunk({
          salaryPlanId: selectedPlan.id,
          transactionId: editing.id,
          input: value,
        }),
      );
      if (updateExpenseTransactionThunk.fulfilled.match(result))
        toast.success("Expense updated.");
    } else {
      const result = await dispatch(
        createExpenseTransactionThunk({
          salaryPlanId: selectedPlan.id,
          input: value,
        }),
      );
      if (createExpenseTransactionThunk.fulfilled.match(result))
        toast.success("Expense added.");
    }
  }

  async function deleteTransaction(transaction: ExpenseTransaction) {
    if (!selectedPlan) return;
    const result = await dispatch(
      deleteExpenseTransactionThunk({
        salaryPlanId: selectedPlan.id,
        transactionId: transaction.id,
      }),
    );
    if (deleteExpenseTransactionThunk.fulfilled.match(result))
      toast.success("Expense deleted.");
  }

  if (planLoading && !selectedPlan)
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        Loading salary plan...
      </div>
    );
  if (!selectedPlan || !stats)
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        Salary plan not found.
      </div>
    );

  const mutable = selectedPlan.status === "active";

  return (
    <section className="space-y-6">
      <PageSectionHeader
        title={`Salary plan ${selectedPlan.month}`}
        description="Monthly allocation and expense dashboard."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: "Monthly salary",
            value: formatMoney(
              selectedPlan.salaryAmount,
              selectedPlan.currency,
            ),
          },
          {
            label: "Total allocated",
            value: formatMoney(stats.totalAllocated, selectedPlan.currency),
          },
          {
            label: "Total spent",
            value: formatMoney(stats.totalSpent, selectedPlan.currency),
          },
          {
            label: "Unallocated",
            value: formatMoney(stats.unallocatedAmount, selectedPlan.currency),
          },
          {
            label: "Remaining allocated",
            value: formatMoney(stats.remainingAllocated, selectedPlan.currency),
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border bg-card p-4"
          >
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex justify-between text-sm">
          <span>Overall spending</span>
          <strong>{overallPercentage.toFixed(1)}%</strong>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(overallPercentage, 100)}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="font-semibold">Category allocations</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Spent</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Usage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.categories.map((category) => {
              const exceeded = category.categoryRemaining < 0;
              return (
                <TableRow
                  key={category.categoryId}
                  className={exceeded ? "bg-destructive/5" : undefined}
                >
                  <TableCell className="font-medium">
                    {category.categoryName}
                    {exceeded ? (
                      <Badge
                        className="ml-2 text-destructive"
                        variant="outline"
                      >
                        Over budget
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {formatMoney(category.budgetAmount, selectedPlan.currency)}
                  </TableCell>
                  <TableCell>
                    {formatMoney(category.categorySpent, selectedPlan.currency)}
                  </TableCell>
                  <TableCell className={exceeded ? "text-destructive" : ""}>
                    {formatMoney(
                      category.categoryRemaining,
                      selectedPlan.currency,
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-28">
                      <div className="flex justify-between text-xs">
                        <span>{category.usagePercentage.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${exceeded ? "bg-destructive" : "bg-primary"}`}
                          style={{
                            width: `${Math.min(category.usagePercentage, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="mt-1 text-xl font-semibold">
            {formatMoney(periodStats.daily, selectedPlan.currency)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">This week</p>
          <p className="mt-1 text-xl font-semibold">
            {formatMoney(periodStats.weekly, selectedPlan.currency)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">This month</p>
          <p className="mt-1 text-xl font-semibold">
            {formatMoney(periodStats.monthly, selectedPlan.currency)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Category spending</h2>
          {categorySpending.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No category spending yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {categorySpending.map((item) => (
                <div
                  key={item.categoryId}
                  className="flex justify-between text-sm"
                >
                  <span>{item.categoryName}</span>
                  <strong>
                    {formatMoney(item.total, selectedPlan.currency)}
                  </strong>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 border-t pt-3 text-sm">
            <strong>Highest:</strong> {categorySpending[0]?.categoryName ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">Historical monthly comparisons</h2>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No historical data.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {history.map((item) => (
                <div
                  key={item.period}
                  className="flex justify-between text-sm"
                >
                  <span>{item.period}</span>
                  <strong>
                    {formatMoney(item.total, selectedPlan.currency)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Transactions</h2>
            <p className="text-sm text-muted-foreground">
              Expense history for this plan.
            </p>
          </div>
          {mutable ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              Add expense
            </Button>
          ) : (
            <Badge variant="outline">Read-only closed plan</Badge>
          )}
        </div>
        {transactionsState.isLoading &&
        transactionsState.transactions.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            Loading transactions...
          </div>
        ) : transactionsState.transactions.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            No expenses recorded for this plan.
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  {mutable ? (
                    <TableHead className="text-right">Actions</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsState.transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {transaction.transactionDate
                        .toDate()
                        .toLocaleDateString()}
                    </TableCell>
                    <TableCell>{transaction.categoryName}</TableCell>
                    <TableCell>{transaction.description || "—"}</TableCell>
                    <TableCell className="font-medium">
                      {formatMoney(transaction.amount, selectedPlan.currency)}
                    </TableCell>
                    {mutable ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(transaction);
                              setDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void deleteTransaction(transaction)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <TransactionDialog
        open={dialogOpen}
        transaction={editing}
        categories={selectedPlan.categories}
        onOpenChange={setDialogOpen}
        onSubmit={submitTransaction}
        saving={transactionsState.isSaving}
      />
    </section>
  );
}
