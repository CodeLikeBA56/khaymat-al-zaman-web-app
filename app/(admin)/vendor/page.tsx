"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
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
import { VendorsTable } from "@/components/vendors/vendors-table";
import { VendorFormDialog } from "@/components/vendors/vendor-form-dialog";
import {
  fetchSuppliers,
  setSupplierActivation,
} from "@/store/supplier/supplier.reducer";
import type { Supplier } from "@/types/supplier";
import { PageSectionHeader } from "@/components/layout/page-section-header";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

type SearchField = "name" | "code" | "phone";
type SupplierStatusFilter = "active" | "inactive" | "all";

export default function VendorsPage() {
  const dispatch = useAppDispatch();
  const { suppliers, isLoading, error } = useAppSelector(
    (state) => state.supplier,
  );

  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<SupplierStatusFilter>("active");
  const [searchField, setSearchField] = useState<SearchField>("name");
  const [searchText, setSearchText] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<SupplierStatusFilter>(
    "active",
  );
  const [appliedSearchField, setAppliedSearchField] =
    useState<SearchField>("name");
  const [appliedSearchText, setAppliedSearchText] = useState("");
  const [savingSupplierId, setSavingSupplierId] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    void dispatch(fetchSuppliers());
  }, [dispatch]);

  async function refreshSuppliers() {
    setRefreshing(true);
    try {
      await dispatch(fetchSuppliers({ force: true })).unwrap();
    } finally {
      setRefreshing(false);
    }
  }

  function applyFilters() {
    setAppliedStatus(status);
    setAppliedSearchField(searchField);
    setAppliedSearchText(searchText);
  }

  const filteredSuppliers = useMemo(() => {
    const normalizedSearchText = appliedSearchText.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      if (appliedStatus === "active" && !supplier.isActive) return false;
      if (appliedStatus === "inactive" && supplier.isActive) return false;

      if (!normalizedSearchText) return true;

      if (appliedSearchField === "name") {
        return supplier.name.toLowerCase().startsWith(normalizedSearchText);
      }

      if (appliedSearchField === "code") {
        return supplier.code.toLowerCase().startsWith(normalizedSearchText);
      }

      return supplier.phone.toLowerCase().startsWith(normalizedSearchText);
    });
  }, [appliedSearchField, appliedSearchText, appliedStatus, suppliers]);

  const loading = isLoading && suppliers.length === 0;

  async function changeActivation(supplier: Supplier, nextActive: boolean) {
    setSavingSupplierId(supplier.id);
    try {
      await dispatch(
        setSupplierActivation({
          supplierId: supplier.id,
          isActive: nextActive,
        }),
      ).unwrap();

      toast.success(nextActive ? "Vendor activated." : "Vendor deactivated.");
    } catch (activationError) {
      toast.error(
        activationError instanceof Error
          ? activationError.message
          : "Could not update vendor status.",
      );
    } finally {
      setSavingSupplierId(null);
    }
  }

  return (
    <section className="space-y-6">
      <PageSectionHeader
        title="Vendors"
        description="Manage supplier directory, contacts, and activation status."
        onRefresh={refreshSuppliers}
        refreshing={refreshing}
        refreshAriaLabel="Refresh vendors"
        addHref="/vendor/create"
        addLabel="Add vendor"
      />

      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="space-y-2 md:col-span-3">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as SupplierStatusFilter)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label>Search by</Label>
            <Select
              value={searchField}
              onValueChange={(value) => setSearchField(value as SearchField)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="code">Code</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-4">
            <Label htmlFor="vendor-search">Search text</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="vendor-search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Prefix search"
                className="pl-9"
              />
            </div>
          </div>

          <div className="md:col-span-2 md:self-end">
            <Button
              className="w-full"
              onClick={applyFilters}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Loading vendors...
        </div>
      ) : (
        <VendorsTable
          data={filteredSuppliers}
          busySupplierId={savingSupplierId}
          onEdit={(supplier) => setEditingSupplier(supplier)}
          onActivate={(supplier) => void changeActivation(supplier, true)}
          onDeactivate={(supplier) => void changeActivation(supplier, false)}
        />
      )}

      {editingSupplier ? (
        <VendorFormDialog
          open={Boolean(editingSupplier)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingSupplier(null);
            }
          }}
          supplier={editingSupplier}
          onSaved={async () => {
            setEditingSupplier(null);
          }}
        />
      ) : null}
    </section>
  );
}
