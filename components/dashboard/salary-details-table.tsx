import { formatCurrency } from "@/lib/finance";
import type { SalaryDetailsRow } from "@/lib/dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SalaryDetailsTableProps = {
  rows: SalaryDetailsRow[];
};

export function SalaryDetailsTable({ rows }: SalaryDetailsTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee Name</TableHead>
            <TableHead className="text-right">Salary</TableHead>
            <TableHead className="text-right">Remaining Salary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow key={row.uid}>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(row.salary)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(row.remainingSalary)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={3}
                className="py-8 text-center text-muted-foreground"
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
