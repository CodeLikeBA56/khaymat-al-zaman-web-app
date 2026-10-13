"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PurchaseInvoiceForm } from "@/components/purchase-invoices/purchase-invoice-form";
import { getPurchaseInvoiceByIdService } from "@/store/purchase-invoice/purchase-invoice.service";
import type { PurchaseInvoice } from "@/types/purchase-invoice";

export default function UpdatePurchaseInvoicePage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInvoice() {
      if (!id) {
        setError("Missing invoice id in query parameter.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const document = await getPurchaseInvoiceByIdService(id);
        if (!document) {
          setError("Purchase invoice not found.");
          return;
        }

        setInvoice(document);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load purchase invoice.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadInvoice();
  }, [id]);

  if (loading) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        Loading purchase invoice...
      </div>
    );
  }

  if (error || !invoice || !id) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        {error || "Purchase invoice not found."}
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Update draft invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update draft details before posting.
        </p>
      </div>

      <PurchaseInvoiceForm mode="update" invoice={invoice} invoiceId={id} />
    </section>
  );
}
