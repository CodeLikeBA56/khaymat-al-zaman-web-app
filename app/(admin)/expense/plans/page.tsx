"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PageSectionHeader } from "@/components/layout/page-section-header";
import { ReusableDialog } from "@/components/reusable-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchExpenseCategories } from "@/store/expense-category/expense-category.reducer";
import { activateSalaryPlanThunk, createSalaryPlanThunk, fetchSalaryPlans } from "@/store/salary-plan/salary-plan.reducer";
import type { SalaryPlanCategory, SalaryPlanMonth } from "@/types/expense";

function currentMonth() { return new Date().toISOString().slice(0, 7); }

export default function SalaryPlansPage() {
  const dispatch = useAppDispatch();
  const categories = useAppSelector((state) => state.expenseCategory.categories);
  const { plans, isLoading, isSaving, error } = useAppSelector((state) => state.salaryPlan);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<SalaryPlanMonth>(currentMonth() as SalaryPlanMonth);
  const [salary, setSalary] = useState("");
  const [allocations, setAllocations] = useState<SalaryPlanCategory[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => { void dispatch(fetchSalaryPlans({ force: true })); void dispatch(fetchExpenseCategories({ force: true })); }, [dispatch]);

  const totalAllocated = useMemo(() => allocations.reduce((sum, item) => sum + item.budgetAmount, 0), [allocations]);
  const salaryAmount = Number(salary) || 0;

  function addCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    if (!category || allocations.some((item) => item.categoryId === categoryId)) return;
    setAllocations((previous) => [...previous, { categoryId, categoryName: category.name, budgetAmount: 0 }]);
  }

  function copyPreviousMonth() {
    const [year, monthNumber] = month.split("-").map(Number);
    const previous = new Date(year, monthNumber - 2, 1);
    const previousMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
    const plan = plans.find((item) => item.month === previousMonth);
    if (!plan) { setValidationError(`No salary plan exists for ${previousMonth}.`); return; }
    setSalary(String(plan.salaryAmount));
    setAllocations(plan.categories.map((item) => ({ ...item })));
    setValidationError(null);
  }

  async function saveDraft() {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { setValidationError("Month must use YYYY-MM format."); return; }
    if (!Number.isFinite(salaryAmount) || salaryAmount < 0) { setValidationError("Salary must be a non-negative amount."); return; }
    if (allocations.length === 0) { setValidationError("Select at least one category."); return; }
    if (allocations.some((item) => item.budgetAmount < 0)) { setValidationError("Budget amounts cannot be negative."); return; }
    if (totalAllocated > salaryAmount) { setValidationError("Total allocated budget cannot exceed salary."); return; }
    setValidationError(null);
    const result = await dispatch(createSalaryPlanThunk({ month: month as SalaryPlanMonth, salaryAmount, currency: "SAR", status: "draft", categories: allocations }));
    if (createSalaryPlanThunk.fulfilled.match(result)) { toast.success("Draft salary plan saved."); setOpen(false); setAllocations([]); setSalary(""); }
  }

  async function activate(planId: string) {
    const result = await dispatch(activateSalaryPlanThunk(planId));
    if (activateSalaryPlanThunk.fulfilled.match(result)) toast.success("Salary plan activated.");
  }

  return (
    <section className="space-y-6">
      <PageSectionHeader title="Monthly salary plans" description="Allocate salary across personal expense categories." onRefresh={() => { void dispatch(fetchSalaryPlans({ force: true })); }} refreshing={isLoading} refreshAriaLabel="Refresh salary plans" />
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}>Create salary plan</Button></div>
      {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      {isLoading && plans.length === 0 ? <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Loading salary plans...</div> : plans.length === 0 ? <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">No salary plans yet. Create a monthly draft.</div> : (
        <div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Salary</TableHead><TableHead>Allocated</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{plans.map((plan) => <TableRow key={plan.id}><TableCell className="font-medium">{plan.month}</TableCell><TableCell>{plan.salaryAmount.toLocaleString()} {plan.currency}</TableCell><TableCell>{(plan.totalAllocated ?? plan.categories.reduce((sum, item) => sum + item.budgetAmount, 0)).toLocaleString()}</TableCell><TableCell><Badge variant={plan.status === "closed" ? "outline" : "default"}>{plan.status}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button asChild size="sm" variant="outline"><Link href={`/expense/plans/${plan.id}`}>View</Link></Button>{plan.status === "draft" ? <Button size="sm" disabled={isSaving} onClick={() => void activate(plan.id)}>Activate</Button> : null}</div></TableCell></TableRow>)}</TableBody></Table></div>
      )}
      <ReusableDialog open={open} onOpenChange={setOpen} title="Create monthly salary plan" description="Allocate salary to selected categories.">
        <div className="space-y-4">
          {validationError ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{validationError}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="plan-month">Month</Label><Input id="plan-month" type="month" value={month} onChange={(event) => setMonth(event.target.value as SalaryPlanMonth)} /></div><div className="space-y-2"><Label htmlFor="salary">Available salary</Label><Input id="salary" type="number" min="0" value={salary} onChange={(event) => setSalary(event.target.value)} /></div></div>
          <Button type="button" variant="outline" onClick={copyPreviousMonth}>Copy previous month allocations</Button>
          <div className="space-y-2"><Label>Add category</Label><Select onValueChange={addCategory}><SelectTrigger><SelectValue placeholder="Select active category" /></SelectTrigger><SelectContent>{categories.filter((category) => category.isActive).map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
          {allocations.length === 0 ? <p className="text-sm text-muted-foreground">No categories selected.</p> : <div className="space-y-2">{allocations.map((allocation) => <div key={allocation.categoryId} className="grid items-end gap-2 sm:grid-cols-[1fr_150px_auto]"><div><Label>Category</Label><p className="py-2 text-sm font-medium">{allocation.categoryName}</p></div><div className="space-y-1"><Label>Budget</Label><Input type="number" min="0" value={allocation.budgetAmount} onChange={(event) => setAllocations((previous) => previous.map((item) => item.categoryId === allocation.categoryId ? { ...item, budgetAmount: Number(event.target.value) || 0 } : item))} /></div><Button type="button" variant="destructive" size="sm" onClick={() => setAllocations((previous) => previous.filter((item) => item.categoryId !== allocation.categoryId))}>Remove</Button></div>)}</div>}
          <div className="grid gap-2 rounded-md bg-muted p-3 text-sm sm:grid-cols-2"><p>Total allocated: <strong>{totalAllocated.toLocaleString()} SAR</strong></p><p>Unallocated: <strong>{(salaryAmount - totalAllocated).toLocaleString()} SAR</strong></p></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={isSaving} onClick={() => void saveDraft()}>{isSaving ? "Saving..." : "Save draft"}</Button></div>
        </div>
      </ReusableDialog>
    </section>
  );
}
