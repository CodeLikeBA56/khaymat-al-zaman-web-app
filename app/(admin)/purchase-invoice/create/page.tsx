"use client";

import { PurchaseInvoiceForm } from "@/components/purchase-invoices/purchase-invoice-form";

export default function CreatePurchaseInvoicePage() {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Create purchase invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a draft invoice for an active supplier. Totals are validated by business rules.
        </p>
      </div>

      <PurchaseInvoiceForm mode="create" />
    </section>
  );
}
