"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
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
  activateSupplierService,
  deactivateSupplierService,
  listSuppliersPageService,
  type ListSuppliersPageInput,
  type SupplierStatusFilter,
} from "@/store/supplier/supplier.service";
import type { Supplier } from "@/types/supplier";

type SearchField = "name" | "code" | "phone";

export default function VendorsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SupplierStatusFilter>("active");
  const [searchField, setSearchField] = useState<SearchField>("name");
  const [searchText, setSearchText] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [savingSupplierId, setSavingSupplierId] = useState<string | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const loadSuppliers = useCallback(
    async ({ reset }: { reset: boolean }) => {
      setError(null);
      if (reset) {
        setLoading(true);
      }

      const input: ListSuppliersPageInput = {
        status,
        pageSize: 20,
      };

      if (searchText.trim()) {
        input.search = {
          field: searchField,
          text: searchText,
        };
      }

      if (!reset && nextCursor) {
        input.cursor = nextCursor;
      }

      try {
        const page = await listSuppliersPageService(input);
        setSuppliers((prev) =>
          reset ? page.suppliers : [...prev, ...page.suppliers],
        );
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore && Boolean(page.nextCursor));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load vendors.",
        );
      } finally {
        setLoading(false);
      }
    },
    [nextCursor, searchField, searchText, status],
  );

  useEffect(() => {
    void loadSuppliers({ reset: true });
  }, [loadSuppliers]);

  async function refreshSuppliers() {
    setRefreshing(true);
    await loadSuppliers({ reset: true });
    setRefreshing(false);
  }

  async function changeActivation(supplier: Supplier, nextActive: boolean) {
    setSavingSupplierId(supplier.id);
    try {
      if (nextActive) {
        await activateSupplierService(supplier.id);
        toast.success("Vendor activated.");
      } else {
        await deactivateSupplierService(supplier.id);
        toast.success("Vendor deactivated.");
      }

      await loadSuppliers({ reset: true });
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Manage supplier directory, contacts, and activation status.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void refreshSuppliers()}
            aria-label="Refresh vendors"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
          <Button asChild>
            <Link href="/vendor/create">
              <Plus className="mr-2 h-4 w-4" />
              Add vendor
            </Link>
          </Button>
        </div>
      </div>

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
              onClick={() => void loadSuppliers({ reset: true })}
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
        <>
          <VendorsTable
            data={suppliers}
            busySupplierId={savingSupplierId}
            onEdit={(supplier) => setEditingSupplier(supplier)}
            onActivate={(supplier) => void changeActivation(supplier, true)}
            onDeactivate={(supplier) => void changeActivation(supplier, false)}
          />

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => void loadSuppliers({ reset: false })}
              >
                Load more
              </Button>
            </div>
          )}
        </>
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
          onSaved={refreshSuppliers}
        />
      ) : null}
    </section>
  );
}
