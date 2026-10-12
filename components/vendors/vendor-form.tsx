"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  createSupplierService,
  updateSupplierService,
} from "@/store/supplier/supplier.service";
import { SupplierType, type Supplier } from "@/types/supplier";

type VendorFormProps = {
  mode: "create" | "update";
  supplier?: Supplier | null;
  supplierId?: string;
  onSaved?: () => Promise<void> | void;
};

type VendorFormState = {
  name: string;
  type: SupplierType;
  phone: string;
  email: string;
  taxNumber: string;
  registrationNumber: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const initialState: VendorFormState = {
  name: "",
  type: SupplierType.COMPANY,
  phone: "",
  email: "",
  taxNumber: "",
  registrationNumber: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

function toFormState(supplier?: Supplier | null): VendorFormState {
  if (!supplier) return initialState;

  return {
    name: supplier.name,
    type: supplier.type,
    phone: supplier.phone,
    email: supplier.email ?? "",
    taxNumber: supplier.taxNumber ?? "",
    registrationNumber: supplier.registrationNumber ?? "",
    line1: supplier.address?.line1 ?? "",
    line2: supplier.address?.line2 ?? "",
    city: supplier.address?.city ?? "",
    state: supplier.address?.state ?? "",
    zip: supplier.address?.zip ?? "",
    country: supplier.address?.country ?? "",
  };
}

function buildOptionalAddress(form: VendorFormState) {
  const line1 = form.line1.trim();
  const line2 = form.line2.trim();
  const city = form.city.trim();
  const state = form.state.trim();
  const zip = form.zip.trim();
  const country = form.country.trim();

  const hasAnyAddress = [line1, line2, city, state, zip, country].some(Boolean);
  if (!hasAnyAddress) {
    return undefined;
  }

  if (!line1 || !city || !country) {
    throw new Error(
      "If address is provided, line 1, city, and country are required.",
    );
  }

  return {
    line1,
    line2: line2 || undefined,
    city,
    state: state || undefined,
    zip: zip || undefined,
    country,
  };
}

export function VendorForm({
  mode,
  supplier,
  supplierId,
  onSaved,
}: VendorFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<VendorFormState>(initialState);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(toFormState(supplier));
  }, [supplier]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const address = buildOptionalAddress(form);

      const payload = {
        name: form.name,
        type: form.type,
        phone: form.phone,
        email: form.email || undefined,
        taxNumber: form.taxNumber || undefined,
        registrationNumber: form.registrationNumber || undefined,
        address,
      };

      if (mode === "update") {
        const targetSupplierId = supplierId ?? supplier?.id;
        if (!targetSupplierId) {
          throw new Error("Supplier id is required.");
        }

        await updateSupplierService(targetSupplierId, payload);
        toast.success("Vendor updated successfully.");
      } else {
        await createSupplierService(payload);
        toast.success("Vendor created successfully.");
      }

      if (onSaved) {
        await onSaved();
      }

      if (mode === "create") {
        router.replace("/vendor");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save vendor.",
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
          Personal information
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vendor identity and contact details.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="text-destructive">*</span> Required fields
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="vendor-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vendor-name"
              required
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>
              Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.type}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, type: value as SupplierType }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SupplierType.COMPANY}>Company</SelectItem>
                <SelectItem value={SupplierType.INDIVIDUAL}>
                  Individual
                </SelectItem>
                <SelectItem value={SupplierType.PARTNERSHIP}>
                  Partnership
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-phone">
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vendor-phone"
              required
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-email">Email</Label>
            <Input
              id="vendor-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-tax-number">Tax number</Label>
            <Input
              id="vendor-tax-number"
              value={form.taxNumber}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, taxNumber: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="vendor-registration-number">
              Registration number
            </Label>
            <Input
              id="vendor-registration-number"
              value={form.registrationNumber}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  registrationNumber: event.target.value,
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">
          Address (optional)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Leave all fields empty if this vendor has no address yet.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="vendor-line1">Address line 1</Label>
            <Input
              id="vendor-line1"
              value={form.line1}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, line1: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-line2">Address line 2</Label>
            <Input
              id="vendor-line2"
              value={form.line2}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, line2: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-city">City</Label>
            <Input
              id="vendor-city"
              value={form.city}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, city: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-state">State</Label>
            <Input
              id="vendor-state"
              value={form.state}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, state: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-zip">Zip</Label>
            <Input
              id="vendor-zip"
              value={form.zip}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, zip: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-country">Country</Label>
            <Input
              id="vendor-country"
              value={form.country}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, country: event.target.value }))
              }
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {mode === "create" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => router.replace("/vendor")}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : mode === "create"
              ? "Create vendor"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
