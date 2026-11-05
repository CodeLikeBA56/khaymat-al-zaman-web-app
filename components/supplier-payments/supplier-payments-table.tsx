"use client";

import { useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Ban, MoreHorizontal } from "lucide-react";
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
import {
  SupplierPaymentStatus,
  type SupplierPayment,
} from "@/types/supplier-payment";

type SupplierPaymentsTableProps = {
  data: SupplierPayment[];
  busyPaymentId?: string | null;
  onVoid: (payment: SupplierPayment) => void;
};

function formatDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) return "—";
  const timestampLike = value as { toDate?: () => Date };
  if (typeof timestampLike.toDate !== "function") return "—";
  return timestampLike.toDate().toLocaleDateString();
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

export function SupplierPaymentsTable({
  data,
  busyPaymentId,
  onVoid,
}: SupplierPaymentsTableProps) {
  const columns = useMemo<ColumnDef<SupplierPayment>[]>(
    () => [
      {
        accessorKey: "paymentNumber",
        header: "Payment",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.paymentNumber}</div>
            <div className="text-xs text-muted-foreground">
              {formatDate(row.original.paymentDate)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "method",
        header: "Method",
        cell: ({ row }) => row.original.method.replaceAll("_", " "),
      },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) =>
          formatMinorAmount(
            row.original.amountMinor,
            row.original.currency,
            row.original.currencyMinorUnit,
          ),
      },
      {
        id: "allocated",
        header: "Allocated",
        cell: ({ row }) =>
          formatMinorAmount(
            row.original.amountMinor - row.original.unallocatedAmountMinor,
            row.original.currency,
            row.original.currencyMinorUnit,
          ),
      },
      {
        id: "unallocated",
        header: "Unallocated",
        cell: ({ row }) =>
          formatMinorAmount(
            row.original.unallocatedAmountMinor,
            row.original.currency,
            row.original.currencyMinorUnit,
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "RECORDED" ? "default" : "outline"}
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const payment = row.original;
          const isBusy = busyPaymentId === payment.id;
          const canVoid = payment.status === SupplierPaymentStatus.RECORDED;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isBusy}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canVoid ? (
                  <DropdownMenuItem onClick={() => onVoid(payment)}>
                    <Ban className="mr-2 h-4 w-4" /> Void
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [busyPaymentId, onVoid],
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
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
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
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center"
              >
                No supplier payments found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
