"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
} from "@/store/purchase-invoice/purchase-invoice.service";
import {
  DEFAULT_CURRENCY_CODE,
  DEFAULT_CURRENCY_MINOR_UNIT,
} from "@/config/currency";
import { recordSupplierPaymentService } from "@/store/supplier-payment/supplier-payment.service";
import {
  PurchaseInvoiceStatus,
  type PurchaseInvoice,
} from "@/types/purchase-invoice";
import {
  SupplierPaymentMethod,
  validateSupplierPaymentAllocationSummary,
} from "@/types/supplier-payment";
import type { Supplier } from "@/types/supplier";

type AllocationRow = {
  invoiceId: string;
  amountMinor: string;
};

type SupplierPaymentFormState = {
  supplierId: string;
  paymentDate: string;
  amountMinor: string;
  currency: string;
  method: SupplierPaymentMethod;
  referenceNumber: string;
  notes: string;
  allocations: AllocationRow[];
};

const initialForm: SupplierPaymentFormState = {
  supplierId: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  amountMinor: "",
  currency: DEFAULT_CURRENCY_CODE,
  method: SupplierPaymentMethod.BANK_TRANSFER,
  referenceNumber: "",
  notes: "",
  allocations: [{ invoiceId: "", amountMinor: "" }],
};

function dateInputToTimestamp(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Payment date is required.");
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Payment date is invalid.");
  }

  return Timestamp.fromDate(date);
}

function formatMinorAmount(
  amountMinor: number,
  currency: string,
  currencyMinorUnit: number,
) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: currencyMinorUnit,
    maximumFractionDigits: currencyMinorUnit,
  }).format(amountMinor / 10 ** currencyMinorUnit);
}

function parseMajorAmountToMinor(
  rawValue: string,
  fieldName: string,
  currencyMinorUnit: number,
) {
  const normalized = rawValue.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  const parsedMajor = Number(normalized);
  if (!Number.isFinite(parsedMajor) || parsedMajor <= 0) {
    throw new Error(`${fieldName} must be a positive amount.`);
  }

  const factor = 10 ** currencyMinorUnit;
  const minor = Math.round(parsedMajor * factor);

  if (!Number.isInteger(minor) || minor <= 0) {
    throw new Error(`${fieldName} must be a valid amount.`);
  }

  return minor;
}

export function SupplierPaymentForm() {
  const router = useRouter();

  const [form, setForm] = useState<SupplierPaymentFormState>(initialForm);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSuppliers() {
      setLoadingSuppliers(true);
      try {
        const activeSuppliers = await listActiveSuppliersForInvoiceService();
        setSuppliers(activeSuppliers);

        if (!form.supplierId && activeSuppliers.length > 0) {
          setForm((prev) => ({ ...prev, supplierId: activeSuppliers[0].id }));
        }
      } catch {
        setSuppliers([]);
      } finally {
        setLoadingSuppliers(false);
      }
    }

    void loadSuppliers();
  }, []);

  useEffect(() => {
    async function loadPayableInvoices() {
      if (!form.supplierId) {
        setInvoices([]);
        return;
      }

      setLoadingInvoices(true);
      try {
        const [posted, partial] = await Promise.all([
          listPurchaseInvoicesPageService({
            supplierId: form.supplierId,
            status: PurchaseInvoiceStatus.POSTED,
            pageSize: 100,
          }),
          listPurchaseInvoicesPageService({
            supplierId: form.supplierId,
            status: PurchaseInvoiceStatus.PARTIALLY_PAID,
            pageSize: 100,
          }),
        ]);

        setInvoices([...posted.invoices, ...partial.invoices]);
      } catch {
        setInvoices([]);
      } finally {
        setLoadingInvoices(false);
      }
    }

    void loadPayableInvoices();
  }, [form.supplierId]);

  const paymentCurrencyMinorUnit = DEFAULT_CURRENCY_MINOR_UNIT;

  const summary = useMemo(() => {
    let amountMinor = 0;

    try {
      amountMinor = parseMajorAmountToMinor(
        form.amountMinor,
        "Payment amount",
        paymentCurrencyMinorUnit,
      );
    } catch {
      return {
        allocatedMinor: 0,
        unallocatedMinor: 0,
        hasError: true,
      };
    }

    const allocations = form.allocations
      .filter((item) => item.invoiceId.trim() && item.amountMinor.trim())
      .map((item) => ({
        invoiceId: item.invoiceId,
        amountMinor: Number(item.amountMinor),
      }));

    try {
      const normalizedAllocations = allocations.map((item) => ({
        invoiceId: item.invoiceId,
        amountMinor: parseMajorAmountToMinor(
          String(item.amountMinor),
          "Allocation amount",
          paymentCurrencyMinorUnit,
        ),
      }));

      const result = validateSupplierPaymentAllocationSummary({
        amountMinor,
        allocations: normalizedAllocations,
      });

      return {
        ...result,
        hasError: false,
      };
    } catch {
      return {
        allocatedMinor: 0,
        unallocatedMinor: 0,
        hasError: true,
      };
    }
  }, [form.allocations, form.amountMinor, paymentCurrencyMinorUnit]);

  function addAllocationRow() {
    setForm((prev) => ({
      ...prev,
      allocations: [...prev.allocations, { invoiceId: "", amountMinor: "" }],
    }));
  }

  function removeAllocationRow(index: number) {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateAllocationRow(index: number, patch: Partial<AllocationRow>) {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const amountMinor = parseMajorAmountToMinor(
        form.amountMinor,
        "Payment amount",
        paymentCurrencyMinorUnit,
      );

      const allocations = form.allocations
        .filter((item) => item.invoiceId.trim() && item.amountMinor.trim())
        .map((item, index) => {
          const parsedAmountMinor = parseMajorAmountToMinor(
            item.amountMinor,
            `Allocation ${index + 1} amount`,
            paymentCurrencyMinorUnit,
          );

          return {
            invoiceId: item.invoiceId,
            amountMinor: parsedAmountMinor,
          };
        });

      validateSupplierPaymentAllocationSummary({
        amountMinor,
        allocations,
      });

      await recordSupplierPaymentService({
        supplierId: form.supplierId,
        paymentDate: dateInputToTimestamp(form.paymentDate),
        amountMinor,
        currency: DEFAULT_CURRENCY_CODE,
        currencyMinorUnit: paymentCurrencyMinorUnit,
        method: form.method,
        referenceNumber: form.referenceNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
        allocations,
      });

      toast.success("Supplier payment recorded.");
      router.replace("/supplier-payment");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not record supplier payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">
          Payment details
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record supplier payment amount, method, and references.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="text-destructive">*</span> Required fields
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>
              Supplier <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.supplierId}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  supplierId: value,
                  allocations: [{ invoiceId: "", amountMinor: "" }],
                }))
              }
              disabled={loadingSuppliers}
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
                    {supplier.name} ({supplier.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-date">
              Payment date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="payment-date"
              type="date"
              required
              value={form.paymentDate}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  paymentDate: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount-minor">
              Amount (SAR) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="amount-minor"
              required
              type="number"
              min={0.01}
              step={0.01}
              value={form.amountMinor}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  amountMinor: event.target.value,
                }))
              }
              placeholder="e.g. 10.50"
            />
            <p className="text-xs text-muted-foreground">
              Currency is fixed to {DEFAULT_CURRENCY_CODE}. Precision:{" "}
              {paymentCurrencyMinorUnit} decimal place(s).
            </p>
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Input
              value={DEFAULT_CURRENCY_CODE}
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label>
              Method <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.method}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  method: value as SupplierPaymentMethod,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(SupplierPaymentMethod).map((method) => (
                  <SelectItem
                    key={method}
                    value={method}
                  >
                    {method.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference-number">Reference number</Label>
            <Input
              id="reference-number"
              value={form.referenceNumber}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  referenceNumber: event.target.value,
                }))
              }
              placeholder="Bank transaction / cheque number"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Allocations
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional invoice allocations. Unallocated amount stays available
              for future reconciliation.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addAllocationRow}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add allocation
          </Button>
        </div>

        <div className="space-y-3">
          {form.allocations.map((row, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-lg border p-3 md:grid-cols-12"
            >
              <div className="space-y-2 md:col-span-8">
                <Label>Invoice</Label>
                <Select
                  value={row.invoiceId}
                  onValueChange={(value) =>
                    updateAllocationRow(index, { invoiceId: value })
                  }
                  disabled={loadingInvoices || !form.supplierId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payable invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map((invoice) => (
                      <SelectItem
                        key={invoice.id}
                        value={invoice.id}
                      >
                        {invoice.invoiceNumber} • Remaining{" "}
                        {formatMinorAmount(
                          invoice.remainingPayableMinor,
                          invoice.currency,
                          invoice.currencyMinorUnit,
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-3">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={row.amountMinor}
                  onChange={(event) =>
                    updateAllocationRow(index, {
                      amountMinor: event.target.value,
                    })
                  }
                  placeholder="Amount (SAR)"
                />
              </div>

              <div className="md:col-span-1 md:self-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAllocationRow(index)}
                  disabled={form.allocations.length === 1}
                  aria-label="Remove allocation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
          <p>
            Allocated:{" "}
            {formatMinorAmount(
              summary.allocatedMinor,
              form.currency || "SAR",
              paymentCurrencyMinorUnit,
            )}
          </p>
          <p>
            Unallocated:{" "}
            {formatMinorAmount(
              summary.unallocatedMinor,
              form.currency || "SAR",
              paymentCurrencyMinorUnit,
            )}
          </p>
          {summary.hasError ? (
            <p className="mt-1 text-destructive">
              Check amount/allocation values to continue.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || !form.supplierId || summary.hasError}
        >
          {saving ? "Saving..." : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
