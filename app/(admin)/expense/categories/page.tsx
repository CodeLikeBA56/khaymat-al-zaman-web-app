"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageSectionHeader } from "@/components/layout/page-section-header";
import { CategoryDialog } from "@/components/expenses/category-dialog";
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
import {
  createExpenseCategoryThunk,
  deactivateExpenseCategoryThunk,
  fetchExpenseCategories,
  updateExpenseCategoryThunk,
} from "@/store/expense-category/expense-category.reducer";
import type { ExpenseCategory } from "@/types/expense";

export default function ExpenseCategoriesPage() {
  const dispatch = useAppDispatch();
  const { categories, isLoading, isSaving, error } = useAppSelector(
    (state) => state.expenseCategory,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);

  useEffect(() => {
    void dispatch(fetchExpenseCategories());
  }, [dispatch]);

  async function submitCategory(value: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
  }) {
    if (editing) {
      const result = await dispatch(
        updateExpenseCategoryThunk({ categoryId: editing.id, input: value }),
      );
      if (updateExpenseCategoryThunk.fulfilled.match(result))
        toast.success("Category updated.");
    } else {
      const result = await dispatch(createExpenseCategoryThunk(value));
      if (createExpenseCategoryThunk.fulfilled.match(result))
        toast.success("Category created.");
    }
  }

  async function setActive(category: ExpenseCategory) {
    const result = category.isActive
      ? await dispatch(deactivateExpenseCategoryThunk(category.id))
      : await dispatch(
          updateExpenseCategoryThunk({
            categoryId: category.id,
            input: { isActive: true },
          }),
        );
    if (
      deactivateExpenseCategoryThunk.fulfilled.match(result) ||
      updateExpenseCategoryThunk.fulfilled.match(result)
    ) {
      toast.success(
        category.isActive ? "Category deactivated." : "Category reactivated.",
      );
    }
  }

  return (
    <section className="space-y-6">
      <PageSectionHeader
        title="Expense categories"
        description="Manage reusable categories for personal monthly salary plans."
        onRefresh={() => {
          void dispatch(fetchExpenseCategories({ force: true }));
        }}
        refreshing={isLoading}
        refreshAriaLabel="Refresh categories"
      />
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Add category
        </Button>
      </div>
      {error ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {isLoading && categories.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Loading categories...
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No expense categories yet. Create one to begin a salary plan.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.color ?? "#3b82f6" }}
                      />
                      <span className="font-medium">{category.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{category.description || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={category.isActive ? "default" : "outline"}>
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(category);
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={category.isActive ? "destructive" : "outline"}
                        disabled={isSaving}
                        onClick={() => void setActive(category)}
                      >
                        {category.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <CategoryDialog
        open={dialogOpen}
        category={editing}
        onOpenChange={setDialogOpen}
        onSubmit={submitCategory}
        saving={isSaving}
      />
    </section>
  );
}
