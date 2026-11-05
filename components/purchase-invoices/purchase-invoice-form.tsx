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
  createPurchaseInvoiceDraftService,
  listActiveSuppliersForInvoiceService,
  updateDraftPurchaseInvoiceService,
} from "@/store/purchase-invoice/purchase-invoice.service";
import {
  DEFAULT_CURRENCY_CODE,
  DEFAULT_CURRENCY_MINOR_UNIT,
} from "@/config/currency";
import { getSupplierByIdService } from "@/store/supplier/supplier.service";
import {
  PurchaseInvoiceStatus,
  type PurchaseInvoice,
} from "@/types/purchase-invoice";
import type { Supplier } from "@/types/supplier";

type PurchaseInvoiceFormProps = {
  mode: "create" | "update";
  invoice?: PurchaseInvoice | null;
  invoiceId?: string;
  onSaved?: (invoiceId: string) => Promise<void> | void;
};

type LineForm = {
  description: string;
  amountMinor: string;
};

type PurchaseInvoiceFormState = {
  supplierId: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  currencyMinorUnit: string;
  taxAmountMinor: string;
  discountAmountMinor: string;
  notes: string;
  lines: LineForm[];
};

const initialForm: PurchaseInvoiceFormState = {
  supplierId: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  currency: DEFAULT_CURRENCY_CODE,
  currencyMinorUnit: String(DEFAULT_CURRENCY_MINOR_UNIT),
  taxAmountMinor: "0.00",
  discountAmountMinor: "0.00",
  notes: "",
  lines: [{ description: "", amountMinor: "" }],
};

function timestampToDateInput(value?: Timestamp) {
  if (!value) return "";
  return value.toDate().toISOString().slice(0, 10);
}

function dateInputToTimestamp(value: string, fieldName: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return Timestamp.fromDate(date);
}

function toFormState(
  invoice?: PurchaseInvoice | null,
): PurchaseInvoiceFormState {
  if (!invoice) return initialForm;

  return {
    supplierId: invoice.supplierId,
    invoiceDate: timestampToDateInput(invoice.invoiceDate),
    dueDate: timestampToDateInput(invoice.dueDate),
    currency: DEFAULT_CURRENCY_CODE,
    currencyMinorUnit: String(DEFAULT_CURRENCY_MINOR_UNIT),
    taxAmountMinor: (
      invoice.taxAmountMinor /
      10 ** DEFAULT_CURRENCY_MINOR_UNIT
    ).toFixed(DEFAULT_CURRENCY_MINOR_UNIT),
    discountAmountMinor: (
      invoice.discountAmountMinor /
      10 ** DEFAULT_CURRENCY_MINOR_UNIT
    ).toFixed(DEFAULT_CURRENCY_MINOR_UNIT),
    notes: invoice.notes ?? "",
    lines: invoice.lines.length
      ? invoice.lines.map((line) => ({
          description: line.description,
          amountMinor: (
            line.amountMinor /
            10 ** DEFAULT_CURRENCY_MINOR_UNIT
          ).toFixed(DEFAULT_CURRENCY_MINOR_UNIT),
        }))
      : [{ description: "", amountMinor: "" }],
  };
}

function parseOptionalMinor(value: string, name: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative amount.`);
  }

  return Math.round(parsed * 10 ** DEFAULT_CURRENCY_MINOR_UNIT);
}

function parseRequiredMajorToMinor(value: string, name: string) {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive amount.`);
  }

  const minor = Math.round(parsed * 10 ** DEFAULT_CURRENCY_MINOR_UNIT);
  if (!Number.isInteger(minor) || minor <= 0) {
    throw new Error(`${name} is invalid.`);
  }

  return minor;
}

function formatMinorAmount(
  amountMinor: number,
  currency: string,
  minorUnit: number,
) {
  const divisor = 10 ** minorUnit;
  const major = amountMinor / divisor;

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit,
  }).format(major);
}

export function PurchaseInvoiceForm({
  mode,
  invoice,
  invoiceId,
  onSaved,
}: PurchaseInvoiceFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<PurchaseInvoiceFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  const isDraft = invoice?.status === PurchaseInvoiceStatus.DRAFT;

  useEffect(() => {
    setForm(toFormState(invoice));
  }, [invoice]);

  useEffect(() => {
    async function loadSuppliers() {
      setLoadingSuppliers(true);
      try {
        const activeSuppliers = await listActiveSuppliersForInvoiceService();
        const currentSupplierId = invoice?.supplierId;

        if (!currentSupplierId) {
          setSuppliers(activeSuppliers);
          return;
        }

        const exists = activeSuppliers.some(
          (item) => item.id === currentSupplierId,
        );
        if (exists) {
          setSuppliers(activeSuppliers);
          return;
        }

        const currentSupplier = await getSupplierByIdService(currentSupplierId);
        if (currentSupplier) {
          setSuppliers([currentSupplier, ...activeSuppliers]);
        } else {
          setSuppliers(activeSuppliers);
        }
      } catch {
        setSuppliers([]);
      } finally {
        setLoadingSuppliers(false);
      }
    }

    void loadSuppliers();
  }, [invoice?.supplierId]);

  const totalsPreview = useMemo(() => {
    const minorUnit = DEFAULT_CURRENCY_MINOR_UNIT;
    const lineTotal = form.lines.reduce((sum, line) => {
      const parsed = Number(line.amountMinor || "0");
      if (!Number.isFinite(parsed) || parsed <= 0) return sum;

      return sum + Math.round(parsed * 10 ** DEFAULT_CURRENCY_MINOR_UNIT);
    }, 0);

    const tax = Number(form.taxAmountMinor || "0");
    const discount = Number(form.discountAmountMinor || "0");
    const taxSafe =
      Number.isFinite(tax) && tax > 0
        ? Math.round(tax * 10 ** DEFAULT_CURRENCY_MINOR_UNIT)
        : 0;
    const discountSafe =
      Number.isFinite(discount) && discount > 0
        ? Math.round(discount * 10 ** DEFAULT_CURRENCY_MINOR_UNIT)
        : 0;
    const grand = lineTotal + taxSafe - discountSafe;

    return {
      lineTotal,
      tax: taxSafe,
      discount: discountSafe,
      grand: grand < 0 ? 0 : grand,
      minorUnit,
      currency: DEFAULT_CURRENCY_CODE,
    };
  }, [form.discountAmountMinor, form.lines, form.taxAmountMinor]);

  function updateLine(index: number, patch: Partial<LineForm>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  function addLine() {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { description: "", amountMinor: "" }],
    }));
  }

  function removeLine(index: number) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "update" && !isDraft) {
      toast.error("Only draft invoices can be edited.");
      return;
    }

    setSaving(true);

    try {
      const invoiceDate = dateInputToTimestamp(
        form.invoiceDate,
        "Invoice date",
      );
      const dueDate = form.dueDate.trim()
        ? dateInputToTimestamp(form.dueDate, "Due date")
        : undefined;

      const lines = form.lines.map((line, index) => {
        const description = line.description.trim();
        const amountMinor = parseRequiredMajorToMinor(
          line.amountMinor,
          `Line ${index + 1} amount`,
        );

        if (!description) {
          throw new Error(`Line ${index + 1} description is required.`);
        }

        return {
          description,
          amountMinor,
        };
      });

      const payload = {
        supplierId: form.supplierId,
        invoiceDate,
        dueDate,
        lines,
        currency: DEFAULT_CURRENCY_CODE,
        currencyMinorUnit: DEFAULT_CURRENCY_MINOR_UNIT,
        taxAmountMinor: parseOptionalMinor(form.taxAmountMinor, "Tax amount"),
        discountAmountMinor: parseOptionalMinor(
          form.discountAmountMinor,
          "Discount amount",
        ),
        notes: form.notes.trim() || undefined,
      };

      if (mode === "create") {
        const createdId = await createPurchaseInvoiceDraftService(payload);
        toast.success("Purchase invoice draft created.");

        if (onSaved) {
          await onSaved(createdId);
        }

        router.replace(`/purchase-invoice/${createdId}`);
      } else {
        const targetId = invoiceId ?? invoice?.id;
        if (!targetId) {
          throw new Error("Invoice id is required.");
        }

        await updateDraftPurchaseInvoiceService(targetId, payload);
        toast.success("Purchase invoice draft updated.");

        if (onSaved) {
          await onSaved(targetId);
        }

        router.replace(`/purchase-invoice/${targetId}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save purchase invoice.",
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
          Invoice details
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Supplier and invoice dates. Currency is fixed to SAR.
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
                setForm((prev) => ({ ...prev, supplierId: value }))
              }
              disabled={loadingSuppliers || (mode === "update" && !isDraft)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select active supplier" />
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
            <Label htmlFor="invoice-date">
              Invoice date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invoice-date"
              type="date"
              required
              value={form.invoiceDate}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  invoiceDate: event.target.value,
                }))
              }
              disabled={mode === "update" && !isDraft}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due date</Label>
            <Input
              id="due-date"
              type="date"
              value={form.dueDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, dueDate: event.target.value }))
              }
              disabled={mode === "update" && !isDraft}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Currency</Label>
            <Input
              value={DEFAULT_CURRENCY_CODE}
              disabled
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Invoice lines
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Description and financial amount only.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addLine}
            disabled={mode === "update" && !isDraft}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add line
          </Button>
        </div>

        <div className="space-y-3">
          {form.lines.map((line, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-12"
            >
              <div className="space-y-2 sm:col-span-8">
                <Label htmlFor={`line-description-${index}`}>
                  Description <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`line-description-${index}`}
                  value={line.description}
                  onChange={(event) =>
                    updateLine(index, { description: event.target.value })
                  }
                  disabled={mode === "update" && !isDraft}
                />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor={`line-amount-${index}`}>
                  Amount (SAR) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`line-amount-${index}`}
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={line.amountMinor}
                  onChange={(event) =>
                    updateLine(index, { amountMinor: event.target.value })
                  }
                  disabled={mode === "update" && !isDraft}
                />
              </div>
              <div className="sm:col-span-1 sm:self-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(index)}
                  disabled={
                    form.lines.length === 1 || (mode === "update" && !isDraft)
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">
          Totals and notes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Totals are recalculated by trusted business logic on save/post.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tax-amount-minor">Tax amount (SAR)</Label>
            <Input
              id="tax-amount-minor"
              type="number"
              min={0}
              step={0.01}
              value={form.taxAmountMinor}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  taxAmountMinor: event.target.value,
                }))
              }
              disabled={mode === "update" && !isDraft}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount-amount-minor">Discount amount (SAR)</Label>
            <Input
              id="discount-amount-minor"
              type="number"
              min={0}
              step={0.01}
              value={form.discountAmountMinor}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  discountAmountMinor: event.target.value,
                }))
              }
              disabled={mode === "update" && !isDraft}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="invoice-notes">Notes</Label>
            <Textarea
              id="invoice-notes"
              value={form.notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              disabled={mode === "update" && !isDraft}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Sub total</p>
            <p className="font-medium">
              {formatMinorAmount(
                totalsPreview.lineTotal,
                totalsPreview.currency,
                totalsPreview.minorUnit,
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Tax</p>
            <p className="font-medium">
              {formatMinorAmount(
                totalsPreview.tax,
                totalsPreview.currency,
                totalsPreview.minorUnit,
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Discount</p>
            <p className="font-medium">
              {formatMinorAmount(
                totalsPreview.discount,
                totalsPreview.currency,
                totalsPreview.minorUnit,
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Grand total</p>
            <p className="font-semibold">
              {formatMinorAmount(
                totalsPreview.grand,
                totalsPreview.currency,
                totalsPreview.minorUnit,
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.replace(
              mode === "create"
                ? "/purchase-invoice"
                : `/purchase-invoice/${invoiceId ?? invoice?.id ?? ""}`,
            )
          }
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            saving || loadingSuppliers || (mode === "update" && !isDraft)
          }
        >
          {saving
            ? "Saving..."
            : mode === "create"
              ? "Create draft"
              : "Save draft"}
        </Button>
      </div>
    </form>
  );
}
