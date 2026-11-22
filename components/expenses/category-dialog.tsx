"use client";

import { useEffect, useState } from "react";
import { ReusableDialog } from "@/components/reusable-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExpenseCategory } from "@/types/expense";

type CategoryDialogProps = {
  open: boolean;
  category?: ExpenseCategory | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: { name: string; description?: string; icon?: string; color?: string }) => Promise<void>;
  saving?: boolean;
};

export function CategoryDialog({ open, category, onOpenChange, onSubmit, saving }: CategoryDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setIcon(category?.icon ?? "");
    setColor(category?.color ?? "#3b82f6");
    setError(null);
  }, [category, open]);

  async function submit() {
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    setError(null);
    await onSubmit({ name: name.trim(), description: description.trim() || undefined, icon: icon.trim() || undefined, color });
    onOpenChange(false);
  }

  return (
    <ReusableDialog open={open} onOpenChange={onOpenChange} title={category ? "Edit category" : "Create category"} description="Create a reusable personal expense category.">
      <div className="space-y-4">
        {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <div className="space-y-2"><Label htmlFor="category-name">Name</Label><Input id="category-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="category-description">Description</Label><Textarea id="category-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="category-icon">Icon</Label><Input id="category-icon" value={icon} onChange={(event) => setIcon(event.target.value)} placeholder="e.g. Utensils" /></div>
          <div className="space-y-2"><Label htmlFor="category-color">Color</Label><Input id="category-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={() => void submit()} disabled={saving}>{saving ? "Saving..." : "Save category"}</Button></div>
      </div>
    </ReusableDialog>
  );
}
