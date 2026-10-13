"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { ReusableDialog } from "@/components/reusable-dialog";
import { PurchaseInvoicesTable } from "@/components/purchase-invoices/purchase-invoices-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  listPurchaseInvoicesPageService,
  listActiveSuppliersForInvoiceService,
  postPurchaseInvoiceService,
  voidPurchaseInvoiceService,
  type ListPurchaseInvoicesPageInput,
} from "@/store/purchase-invoice/purchase-invoice.service";
import { PurchaseInvoiceStatus, type PurchaseInvoice } from "@/types/purchase-invoice";
import type { Supplier } from "@/types/supplier";

type InvoiceStatusFilter = PurchaseInvoiceStatus | "ALL";

type VoidDialogState = {
  invoice: PurchaseInvoice;
  reason: string;
} | null;

function toTimestamp(dateValue: string) {
  const trimmed = dateValue.trim();
  if (!trimmed) return undefined;

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date filter is invalid.");
  }

  return Timestamp.fromDate(date);
}

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("ALL");
  const [status, setStatus] = useState<InvoiceStatusFilter>("ALL");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [nextCursor, setNextCursor] = useState<Timestamp | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [voidDialog, setVoidDialog] = useState<VoidDialogState>(null);

  const supplierNameMap = useMemo(
    () =>
      suppliers.reduce<Record<string, string>>((acc, supplier) => {
        acc[supplier.id] = supplier.name;
        return acc;
      }, {}),
    [suppliers],
  );

  const loadInvoices = useCallback(
    async ({
      reset,
      cursor,
    }: {
      reset: boolean;
      cursor?: Timestamp | null;
    }) => {
      setError(null);
      if (reset) {
        setLoading(true);
        setNextCursor(null);
      }

      try {
        const input: ListPurchaseInvoicesPageInput = {
          pageSize: 20,
        };

        if (supplierId !== "ALL") {
          input.supplierId = supplierId;
        }

        if (status !== "ALL") {
          input.status = status;
        }

        if (invoiceNumber.trim()) {
          input.invoiceNumber = invoiceNumber;
        }

        const from = toTimestamp(dateFrom);
        const to = toTimestamp(dateTo);
        if (from || to) {
          input.dateRange = { from, to };
        }

        if (!reset && cursor) {
          input.cursor = cursor;
        }

        const page = await listPurchaseInvoicesPageService(input);
        setInvoices((prev) => (reset ? page.invoices : [...prev, ...page.invoices]));
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore && Boolean(page.nextCursor));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load purchase invoices.",
        );
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo, invoiceNumber, status, supplierId],
  );

  const loadSuppliers = useCallback(async () => {
    try {
      const items = await listActiveSuppliersForInvoiceService();
      setSuppliers(items);
    } catch {
      setSuppliers([]);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadSuppliers(), loadInvoices({ reset: true })]);
  }, [loadInvoices, loadSuppliers]);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([loadSuppliers(), loadInvoices({ reset: true })]);
    setRefreshing(false);
  }

  async function handlePost(invoice: PurchaseInvoice) {
    setBusyInvoiceId(invoice.id);
    try {
      await postPurchaseInvoiceService(invoice.id);
      toast.success("Purchase invoice posted.");
      await loadInvoices({ reset: true });
    } catch (postError) {
      toast.error(
        postError instanceof Error
          ? postError.message
          : "Could not post invoice.",
      );
    } finally {
      setBusyInvoiceId(null);
    }
  }

  async function handleConfirmVoid() {
    if (!voidDialog) return;

    setBusyInvoiceId(voidDialog.invoice.id);
    try {
      await voidPurchaseInvoiceService(voidDialog.invoice.id, {
        reason: voidDialog.reason,
      });
      toast.success("Purchase invoice voided.");
      setVoidDialog(null);
      await loadInvoices({ reset: true });
    } catch (voidError) {
      toast.error(
        voidError instanceof Error
          ? voidError.message
          : "Could not void invoice.",
      );
    } finally {
      setBusyInvoiceId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase invoices</h1>
          <p className="text-sm text-muted-foreground">
            Track supplier invoices, post drafts, and preserve full financial history.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void refresh()}
            aria-label="Refresh invoices"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button asChild>
            <Link href="/purchase-invoice/create">
              <Plus className="mr-2 h-4 w-4" />
              New invoice
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="space-y-2 md:col-span-3">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All suppliers</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as InvoiceStatusFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {Object.values(PurchaseInvoiceStatus).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label htmlFor="invoice-number-filter">Invoice number</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="invoice-number-filter"
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                placeholder="Exact invoice number"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2 md:self-end">
            <Button className="w-full" onClick={() => void loadInvoices({ reset: true })}>
              Apply
            </Button>
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="date-from-filter">Date from</Label>
            <Input
              id="date-from-filter"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="date-to-filter">Date to</Label>
            <Input
              id="date-to-filter"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      ) : null}

      {loading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Loading purchase invoices...
        </div>
      ) : (
        <>
          <PurchaseInvoicesTable
            data={invoices}
            supplierNameMap={supplierNameMap}
            busyInvoiceId={busyInvoiceId}
            onPost={(invoice) => void handlePost(invoice)}
            onVoid={(invoice) => setVoidDialog({ invoice, reason: "" })}
          />

          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => void loadInvoices({ reset: false, cursor: nextCursor })}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}

      <ReusableDialog
        open={Boolean(voidDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setVoidDialog(null);
          }
        }}
        title="Void purchase invoice"
        description="Voiding preserves invoice history and marks this document as cancelled."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea
              id="void-reason"
              value={voidDialog?.reason ?? ""}
              onChange={(event) =>
                setVoidDialog((prev) =>
                  prev
                    ? {
                        ...prev,
                        reason: event.target.value,
                      }
                    : prev,
                )
              }
              placeholder="Explain why this invoice is being voided"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVoidDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleConfirmVoid()}
              disabled={!voidDialog?.reason.trim()}
            >
              Confirm void
            </Button>
          </div>
        </div>
      </ReusableDialog>
    </section>
  );
}
