"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Eye, MoreHorizontal, Pencil } from "lucide-react";
import type { UserDocument } from "@/types/user";
import {
  getCurrentEmploymentSnapshot,
  getRecentActiveEmploymentPeriod,
  getUserPrimaryContact,
} from "@/lib/employment";
import { getRoleLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SalaryVisibilityCell } from "@/components/employees/salary-visibility-cell";
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

type EmployeesTableProps = {
  data: UserDocument[];
};

export function EmployeesTable({ data }: EmployeesTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<UserDocument>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">
              {getUserPrimaryContact(row.original)}
            </div>
          </div>
        ),
      },
      {
        id: "role",
        header: "Role",
        cell: ({ row }) => {
          const role = getRecentActiveEmploymentPeriod(
            row.original.workHistory,
          )?.role;
          return (
            <Badge variant="secondary">{role ? getRoleLabel(role) : "—"}</Badge>
          );
        },
      },
      {
        accessorKey: "alias",
        header: "Alias",
        cell: ({ row }) => row.original.alias || "Default role alias",
      },
      {
        id: "salary",
        header: "Salary",
        cell: ({ row }) => {
          const salary = getCurrentEmploymentSnapshot(row.original).salary;
          return <SalaryVisibilityCell salary={salary} />;
        },
      },
      {
        id: "workingHoursPerDay",
        header: "Hours",
        cell: ({ row }) => {
          const workingHoursPerDay = getCurrentEmploymentSnapshot(
            row.original,
          ).workingHoursPerDay;
          return `${workingHoursPerDay}h`;
        },
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => router.push(`/employee/${row.original.uid}`)}
              >
                <Eye className="mr-2 h-4 w-4" /> View
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/employee/update?id=${row.original.uid}`)
                }
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [router],
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
                No employees found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
