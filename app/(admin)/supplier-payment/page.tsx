"use client";

import { useCallback, useEffect, useState } from "react";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import { PageSectionHeader } from "@/components/layout/page-section-header";
import { ReusableDialog } from "@/components/reusable-dialog";
import { SupplierPaymentsTable } from "@/components/supplier-payments/supplier-payments-table";
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
import { listActiveSuppliersForInvoiceService } from "@/store/purchase-invoice/purchase-invoice.service";
import {
  listSupplierPaymentsBySupplierService,
  voidSupplierPaymentService,
} from "@/store/supplier-payment/supplier-payment.service";
import {
  SupplierPaymentStatus,
  type SupplierPayment,
} from "@/types/supplier-payment";
import type { Supplier } from "@/types/supplier";

type StatusFilter = SupplierPaymentStatus | "ALL";

type VoidDialogState = {
  payment: SupplierPayment;
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

export default function SupplierPaymentsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<Timestamp | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [voidDialog, setVoidDialog] = useState<VoidDialogState>(null);

  const loadSuppliers = useCallback(async () => {
    try {
      const items = await listActiveSuppliersForInvoiceService();
      setSuppliers(items);

      if (!supplierId && items.length > 0) {
        setSupplierId(items[0].id);
      }

      return items;
    } catch {
      setSuppliers([]);
      return [] as Supplier[];
    }
  }, [supplierId]);

  const loadPayments = useCallback(
    async ({
      reset,
      cursor,
    }: {
      reset: boolean;
      cursor?: Timestamp | null;
    }) => {
      if (!supplierId) {
        setPayments([]);
        setHasMore(false);
        setNextCursor(null);
        setLoading(false);
        return;
      }

      setError(null);
      if (reset) {
        setLoading(true);
        setNextCursor(null);
      }

      try {
        const input = {
          supplierId,
          pageSize: 20,
          ...(status !== "ALL" ? { status } : {}),
          ...(toTimestamp(dateFrom) ? { dateFrom: toTimestamp(dateFrom) } : {}),
          ...(toTimestamp(dateTo) ? { dateTo: toTimestamp(dateTo) } : {}),
          ...(!reset && cursor ? { cursor } : {}),
        };

        const page = await listSupplierPaymentsBySupplierService(input);
        setPayments((prev) =>
          reset ? page.payments : [...prev, ...page.payments],
        );
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore && Boolean(page.nextCursor));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load supplier payments.",
        );
      } finally {
        setLoading(false);
      }
    },
    [dateFrom, dateTo, status, supplierId],
  );

  useEffect(() => {
    async function initialize() {
      setLoading(true);
      const supplierList = await loadSuppliers();
      const selectedSupplierId = supplierId || supplierList[0]?.id;
      if (!selectedSupplierId) {
        setLoading(false);
        return;
      }

      await loadPayments({ reset: true });
    }

    void initialize();
  }, [loadPayments, loadSuppliers, supplierId]);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([loadSuppliers(), loadPayments({ reset: true })]);
    setRefreshing(false);
  }

  async function handleConfirmVoid() {
    if (!voidDialog) return;

    setBusyPaymentId(voidDialog.payment.id);
    try {
      await voidSupplierPaymentService(voidDialog.payment.id, {
        reason: voidDialog.reason,
      });

      toast.success("Supplier payment voided.");
      setVoidDialog(null);
      await loadPayments({ reset: true });
    } catch (voidError) {
      toast.error(
        voidError instanceof Error
          ? voidError.message
          : "Could not void supplier payment.",
      );
    } finally {
      setBusyPaymentId(null);
    }
  }

  return (
    <section className="space-y-6">
      <PageSectionHeader
        title="Supplier payments"
        description="Record supplier settlements, track allocations, and preserve payment audit history."
        onRefresh={refresh}
        refreshing={refreshing}
        refreshAriaLabel="Refresh supplier payments"
        addHref="/supplier-payment/create"
        addLabel="Record payment"
      />

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="space-y-2 md:col-span-3">
            <Label>Supplier</Label>
            <Select
              value={supplierId}
              onValueChange={setSupplierId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem
                    key={supplier.id}
                    value={supplier.id}
                  >
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
              onValueChange={(value) => setStatus(value as StatusFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {Object.values(SupplierPaymentStatus).map((value) => (
                  <SelectItem
                    key={value}
                    value={value}
                  >
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="payment-date-from">Date from</Label>
            <Input
              id="payment-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="payment-date-to">Date to</Label>
            <Input
              id="payment-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>

          <div className="md:col-span-2 md:self-end">
            <Button
              className="w-full"
              onClick={() => void loadPayments({ reset: true })}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Loading supplier payments...
        </div>
      ) : (
        <>
          <SupplierPaymentsTable
            data={payments}
            busyPaymentId={busyPaymentId}
            onVoid={(payment) => setVoidDialog({ payment, reason: "" })}
          />

          {hasMore ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() =>
                  void loadPayments({ reset: false, cursor: nextCursor })
                }
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
        title="Void supplier payment"
        description="Voiding payment preserves audit history and reverses linked invoice allocations."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="void-payment-reason">Reason</Label>
            <Textarea
              id="void-payment-reason"
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
              placeholder="Explain why this payment is being voided"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setVoidDialog(null)}
            >
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
