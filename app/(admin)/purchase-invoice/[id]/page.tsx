"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ReusableDialog } from "@/components/reusable-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { canVoidStatus } from "@/lib/purchase-invoice";
import {
  getPurchaseInvoiceByIdService,
  postPurchaseInvoiceService,
  voidPurchaseInvoiceService,
} from "@/store/purchase-invoice/purchase-invoice.service";
import { getSupplierByIdService } from "@/store/supplier/supplier.service";
import { PurchaseInvoiceStatus, type PurchaseInvoice } from "@/types/purchase-invoice";
import type { Supplier } from "@/types/supplier";

function formatDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) return "—";

  const timestampLike = value as { toDate?: () => Date };
  if (typeof timestampLike.toDate !== "function") return "—";
  return timestampLike.toDate().toLocaleDateString();
}

function formatMinorAmount(amountMinor: number, currency: string, minorUnit: number) {
  const divisor = 10 ** minorUnit;
  const major = amountMinor / divisor;

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit,
  }).format(major);
}

function statusBadgeVariant(status: PurchaseInvoiceStatus): "default" | "secondary" | "outline" {
  if (status === PurchaseInvoiceStatus.POSTED || status === PurchaseInvoiceStatus.PAID) {
    return "default";
  }

  if (status === PurchaseInvoiceStatus.DRAFT || status === PurchaseInvoiceStatus.PARTIALLY_PAID) {
    return "secondary";
  }

  return "outline";
}

export default function PurchaseInvoiceViewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const isDraft = invoice?.status === PurchaseInvoiceStatus.DRAFT;

  const canVoid = useMemo(
    () => (invoice ? canVoidStatus(invoice.status) : false),
    [invoice],
  );

  useEffect(() => {
    async function loadInvoice() {
      if (!id) {
        setError("Missing purchase invoice id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const document = await getPurchaseInvoiceByIdService(id);
        if (!document) {
          setError(
            `The purchase invoice having document id ${id} is not found in the database.`,
          );
          return;
        }

        setInvoice(document);

        const supplierDocument = await getSupplierByIdService(document.supplierId);
        setSupplier(supplierDocument);
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

  async function handlePost() {
    if (!invoice) return;

    setBusy(true);
    try {
      await postPurchaseInvoiceService(invoice.id);
      toast.success("Purchase invoice posted.");
      const refreshed = await getPurchaseInvoiceByIdService(invoice.id);
      setInvoice(refreshed);
    } catch (postError) {
      toast.error(postError instanceof Error ? postError.message : "Could not post invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid() {
    if (!invoice) return;

    setBusy(true);
    try {
      await voidPurchaseInvoiceService(invoice.id, {
        reason: voidReason,
      });

      toast.success("Purchase invoice voided.");
      setVoidDialogOpen(false);
      setVoidReason("");
      const refreshed = await getPurchaseInvoiceByIdService(invoice.id);
      setInvoice(refreshed);
    } catch (voidError) {
      toast.error(voidError instanceof Error ? voidError.message : "Could not void invoice.");
    } finally {
      setBusy(false);
    }
  }

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
    <>
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
              <p className="text-sm text-muted-foreground">Supplier: {supplier?.name || invoice.supplierId}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/purchase-invoice">Back</Link>
              </Button>
              {isDraft ? (
                <Button asChild>
                  <Link href={`/purchase-invoice/update?id=${invoice.id}`}>Edit draft</Link>
                </Button>
              ) : null}
              {isDraft ? (
                <Button variant="outline" onClick={() => void handlePost()} disabled={busy}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Post
                </Button>
              ) : null}
              {canVoid ? (
                <Button variant="outline" onClick={() => setVoidDialogOpen(true)} disabled={busy}>
                  <Ban className="mr-2 h-4 w-4" /> Void
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-medium">Invoice profile</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge className="ml-2" variant={statusBadgeVariant(invoice.status)}>
                  {invoice.status.replaceAll("_", " ")}
                </Badge>
              </p>
              <p>
                <span className="text-muted-foreground">Invoice date:</span>{" "}
                {formatDate(invoice.invoiceDate)}
              </p>
              <p>
                <span className="text-muted-foreground">Due date:</span>{" "}
                {formatDate(invoice.dueDate)}
              </p>
              <p>
                <span className="text-muted-foreground">Currency:</span>{" "}
                {invoice.currency} (minor unit: {invoice.currencyMinorUnit})
              </p>
              <p>
                <span className="text-muted-foreground">Created:</span>{" "}
                {formatDate(invoice.createdAt)}
              </p>
              <p>
                <span className="text-muted-foreground">Updated:</span>{" "}
                {formatDate(invoice.updatedAt)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-medium">Totals</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Sub total:</span>{" "}
                {formatMinorAmount(
                  invoice.subTotalMinor,
                  invoice.currency,
                  invoice.currencyMinorUnit,
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Tax:</span>{" "}
                {formatMinorAmount(
                  invoice.taxAmountMinor,
                  invoice.currency,
                  invoice.currencyMinorUnit,
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Discount:</span>{" "}
                {formatMinorAmount(
                  invoice.discountAmountMinor,
                  invoice.currency,
                  invoice.currencyMinorUnit,
                )}
              </p>
              <p className="font-semibold">
                <span className="text-muted-foreground">Grand total:</span>{" "}
                {formatMinorAmount(
                  invoice.grandTotalMinor,
                  invoice.currency,
                  invoice.currencyMinorUnit,
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-medium">Invoice lines</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((line, index) => (
                <TableRow key={`${line.description}-${index}`}>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">
                    {formatMinorAmount(
                      line.amountMinor,
                      invoice.currency,
                      invoice.currencyMinorUnit,
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-medium">Notes</h2>
          <p className="text-sm text-muted-foreground">{invoice.notes || "No notes."}</p>
        </div>
      </section>

      <ReusableDialog
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        title="Void purchase invoice"
        description="Voiding preserves this record for audit and historical reporting."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea
              id="void-reason"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Required reason for cancellation"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleVoid()} disabled={!voidReason.trim() || busy}>
              Confirm void
            </Button>
          </div>
        </div>
      </ReusableDialog>
    </>
  );
}
