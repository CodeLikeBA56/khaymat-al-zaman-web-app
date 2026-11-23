import Link from "next/link";
import { PageSectionHeader } from "@/components/layout/page-section-header";
import { Button } from "@/components/ui/button";

export default function ExpensePage() {
  return (
    <section className="space-y-6">
      <PageSectionHeader
        title="Personal salary & expenses"
        description="Divide monthly salary into category budgets and track personal expenses."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold">Expense categories</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create, edit, deactivate and reactivate reusable categories.
          </p>
          <Button
            asChild
            className="mt-4"
          >
            <Link href="/expense/categories">Manage categories</Link>
          </Button>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold">Salary plans</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create monthly drafts, activate budgets and review spending.
          </p>
          <Button
            asChild
            className="mt-4"
          >
            <Link href="/expense/plans">Open salary plans</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
