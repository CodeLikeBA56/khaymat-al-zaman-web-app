"use client";

import { SupplierPaymentForm } from "@/components/supplier-payments/supplier-payment-form";

export default function CreateSupplierPaymentPage() {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Record supplier payment
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record supplier settlement and optionally allocate it across payable
          invoices.
        </p>
      </div>

      <SupplierPaymentForm />
    </section>
  );
}
