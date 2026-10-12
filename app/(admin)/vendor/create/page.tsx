"use client";

import { VendorForm } from "@/components/vendors/vendor-form";

export default function CreateVendorPage() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Create vendor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a supplier profile for procurement operations.
        </p>
      </div>

      <VendorForm mode="create" />
    </section>
  );
}
