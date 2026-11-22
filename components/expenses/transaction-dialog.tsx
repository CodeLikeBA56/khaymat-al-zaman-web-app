"use client";

import { useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { ReusableDialog } from "@/components/reusable-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ExpenseTransaction, SalaryPlanCategory } from "@/types/expense";

type Props = {
  open: boolean;
  transaction?: ExpenseTransaction | null;
  categories: SalaryPlanCategory[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: { categoryId: string; categoryName: string; amount: number; description?: string; transactionDate: Timestamp }) => Promise<void>;
  saving?: boolean;
};

export function TransactionDialog({ open, transaction, categories, onOpenChange, onSubmit, saving }: Props) {
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCategoryId(transaction?.categoryId ?? "");
    setAmount(transaction ? String(transaction.amount) : "");
    setDescription(transaction?.description ?? "");
    setDate(transaction ? transaction.transactionDate.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setError(null);
  }, [transaction, open]);

  async function submit() {
    const parsedAmount = Number(amount);
    const category = categories.find((item) => item.categoryId === categoryId);
    if (!category) { setError("Select a category included in this salary plan."); return; }
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) { setError("Amount must be a non-negative number."); return; }
    if (!date) { setError("Transaction date is required."); return; }
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) { setError("Transaction date is invalid."); return; }
    setError(null);
    await onSubmit({ categoryId: category.categoryId, categoryName: category.categoryName, amount: parsedAmount, description: description.trim() || undefined, transactionDate: Timestamp.fromDate(parsedDate) });
    onOpenChange(false);
  }

  return (
    <ReusableDialog open={open} onOpenChange={onOpenChange} title={transaction ? "Edit expense" : "Add expense"} description="Add an expense to the selected salary plan.">
      <div className="space-y-4">
        {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <div className="space-y-2"><Label>Category</Label><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.categoryId} value={category.categoryId}>{category.categoryName}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="expense-amount">Amount</Label><Input id="expense-amount" type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="expense-date">Date</Label><Input id="expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div></div>
        <div className="space-y-2"><Label htmlFor="expense-description">Description</Label><Textarea id="expense-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving} onClick={() => void submit()}>{saving ? "Saving..." : "Save expense"}</Button></div>
      </div>
    </ReusableDialog>
  );
}
