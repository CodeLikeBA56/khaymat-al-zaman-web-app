"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Ban, CheckCircle2, Eye, MoreHorizontal, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canVoidStatus } from "@/lib/purchase-invoice";
import { PurchaseInvoiceStatus, type PurchaseInvoice } from "@/types/purchase-invoice";

type PurchaseInvoicesTableProps = {
  data: PurchaseInvoice[];
  supplierNameMap: Record<string, string>;
  busyInvoiceId?: string | null;
  onPost: (invoice: PurchaseInvoice) => void;
  onVoid: (invoice: PurchaseInvoice) => void;
};

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

export function PurchaseInvoicesTable({
  data,
  supplierNameMap,
  busyInvoiceId,
  onPost,
  onVoid,
}: PurchaseInvoicesTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<PurchaseInvoice>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: "Invoice",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.invoiceNumber}</div>
            <div className="text-xs text-muted-foreground">{formatDate(row.original.invoiceDate)}</div>
          </div>
        ),
      },
      {
        id: "supplier",
        header: "Supplier",
        cell: ({ row }) => supplierNameMap[row.original.supplierId] || row.original.supplierId,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>
            {row.original.status.replaceAll("_", " ")}
          </Badge>
        ),
      },
      {
        id: "grandTotal",
        header: "Total",
        cell: ({ row }) =>
          formatMinorAmount(
            row.original.grandTotalMinor,
            row.original.currency,
            row.original.currencyMinorUnit,
          ),
      },
      {
        accessorKey: "dueDate",
        header: "Due",
        cell: ({ row }) => formatDate(row.original.dueDate),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const invoice = row.original;
          const busy = busyInvoiceId === invoice.id;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={busy}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/purchase-invoice/${invoice.id}`)}>
                  <Eye className="mr-2 h-4 w-4" /> View
                </DropdownMenuItem>
                {invoice.status === PurchaseInvoiceStatus.DRAFT ? (
                  <DropdownMenuItem onClick={() => router.push(`/purchase-invoice/update?id=${invoice.id}`)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit draft
                  </DropdownMenuItem>
                ) : null}
                {invoice.status === PurchaseInvoiceStatus.DRAFT ? (
                  <DropdownMenuItem onClick={() => onPost(invoice)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Post
                  </DropdownMenuItem>
                ) : null}
                {canVoidStatus(invoice.status) ? (
                  <DropdownMenuItem onClick={() => onVoid(invoice)}>
                    <Ban className="mr-2 h-4 w-4" /> Void
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [busyInvoiceId, onPost, onVoid, router, supplierNameMap],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No purchase invoices found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
