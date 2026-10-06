"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Wallet, Coins, CalendarClock, Calculator } from "lucide-react";
import { toast } from "sonner";
import type { UserDocument } from "@/types/user";
import type {
  AttendanceStatus,
  SalaryAdvance,
  SalaryAdjustmentType,
  SalaryPayment,
  SalaryPeriod,
} from "@/types/finance";
import {
  formatCurrency,
  formatDateYmd,
  formatMonthYear,
  parseUnknownDate,
  toMonthId,
} from "@/lib/finance";
import { getCurrentEmploymentSnapshot } from "@/lib/employment";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addSalaryAdjustment,
  buildAllocationPreview,
  createSalaryAdvance,
  createSalaryPayment,
  fetchEmployeeFinance,
  fetchOutstandingSalaryPeriods,
  generateSalaryPeriod,
} from "@/store/finance/finance.reducer";
import {
  fetchMonthlyAttendance,
  upsertAttendance,
} from "@/store/attendance/attendance.reducer";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReusableDialog } from "@/components/reusable-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const attendanceStatuses: AttendanceStatus[] = [
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
];

const paymentMethods: Array<"cash" | "bank_transfer" | "other"> = [
  "cash",
  "bank_transfer",
  "other",
];

const adjustmentTypes: SalaryAdjustmentType[] = [
  "bonus",
  "overtime",
  "deduction",
  "advance",
  "other",
];

function getNowYearMonth() {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

function toStatusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function EmployeeFinanceAttendance({ employee }: { employee: UserDocument }) {
  const { user } = useAuth();
  const dispatch = useAppDispatch();

  const currentYearMonth = useMemo(getNowYearMonth, []);
  const currentEmployment = useMemo(() => getCurrentEmploymentSnapshot(employee), [employee]);

  const [selectedYear, setSelectedYear] = useState(currentYearMonth.year);
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth.month);

  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    date: formatDateYmd(new Date()),
    status: "present" as AttendanceStatus,
    checkIn: "",
    checkOut: "",
    workingMinutes: "",
    notes: "",
  });

  const [salaryGenDialogOpen, setSalaryGenDialogOpen] = useState(false);
  const [salaryGenForm, setSalaryGenForm] = useState({
    year: String(selectedYear),
    month: String(selectedMonth),
    status: "pending",
    baseSalaryOverride: "",
  });

  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    amount: "",
    paymentMethod: "cash" as "cash" | "bank_transfer" | "other",
    description: "",
  });

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "cash" as "cash" | "bank_transfer" | "other",
    description: "Salary payment",
  });

  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    salaryPeriodId: "",
    adjustmentType: "bonus" as SalaryAdjustmentType,
    amount: "",
    description: "",
    referenceId: "",
  });

  const [selectedPayment, setSelectedPayment] = useState<SalaryPayment | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<SalaryPeriod | null>(null);
  const [selectedAdvance, setSelectedAdvance] = useState<SalaryAdvance | null>(null);

  const financeState = useAppSelector(
    (state) => state.finance.byUserId[employee.uid],
  );

  const attendanceState = useAppSelector((state) => {
    const key = `${employee.uid}_${toMonthId(selectedYear, selectedMonth)}`;
    return state.attendance.byUserMonth[key];
  });

  const attendanceLoading = useAppSelector((state) => state.attendance.loading);
  const financeLoading = financeState?.loading ?? false;

  const salaryPeriods = financeState?.salaryPeriods ?? [];
  const salaryPayments = financeState?.salaryPayments ?? [];
  const salaryAdvances = financeState?.salaryAdvances ?? [];
  const outstandingPeriods = financeState?.outstandingPeriods ?? [];

  const attendanceSummary = attendanceState?.summary ?? {
    present: 0,
    absent: 0,
    half_day: 0,
    leave: 0,
    holiday: 0,
  };

  const totalOutstandingSalary = useMemo(
    () => salaryPeriods.reduce((sum, period) => sum + period.remainingAmount, 0),
    [salaryPeriods],
  );

  const totalOutstandingAdvance = useMemo(
    () => salaryAdvances.reduce((sum, advance) => sum + advance.remainingAmount, 0),
    [salaryAdvances],
  );

  const totalPaidSalary = useMemo(
    () => salaryPeriods.reduce((sum, period) => sum + period.paidAmount, 0),
    [salaryPeriods],
  );

  const allocationPreview = useMemo(() => {
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0 || outstandingPeriods.length === 0) return null;

    try {
      return buildAllocationPreview(outstandingPeriods, amount);
    } catch {
      return null;
    }
  }, [outstandingPeriods, paymentForm.amount]);

  useEffect(() => {
    void dispatch(fetchEmployeeFinance({ userId: employee.uid }));
    void dispatch(fetchOutstandingSalaryPeriods({ userId: employee.uid }));
  }, [dispatch, employee.uid]);

  useEffect(() => {
    void dispatch(
      fetchMonthlyAttendance({
        userId: employee.uid,
        year: selectedYear,
        month: selectedMonth,
      }),
    );
  }, [dispatch, employee.uid, selectedMonth, selectedYear]);

  async function refreshFinance() {
    await dispatch(fetchEmployeeFinance({ userId: employee.uid }));
    await dispatch(fetchOutstandingSalaryPeriods({ userId: employee.uid }));
  }

  async function handleAttendanceSubmit() {
    try {
      await dispatch(
        upsertAttendance({
          userId: employee.uid,
          date: attendanceForm.date,
          status: attendanceForm.status,
          checkIn: attendanceForm.checkIn || null,
          checkOut: attendanceForm.checkOut || null,
          workingMinutes: attendanceForm.workingMinutes
            ? Number(attendanceForm.workingMinutes)
            : undefined,
          notes: attendanceForm.notes,
        }),
      ).unwrap();

      toast.success("Attendance updated.");
      setAttendanceDialogOpen(false);
      await dispatch(
        fetchMonthlyAttendance({
          userId: employee.uid,
          year: selectedYear,
          month: selectedMonth,
        }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save attendance.");
    }
  }

  async function handleGenerateSalaryPeriod() {
    try {
      await dispatch(
        generateSalaryPeriod({
          userId: employee.uid,
          year: Number(salaryGenForm.year),
          month: Number(salaryGenForm.month),
          status: salaryGenForm.status as
            | "pending"
            | "partial"
            | "paid"
            | "final_settlement",
          baseSalaryOverride: salaryGenForm.baseSalaryOverride
            ? Number(salaryGenForm.baseSalaryOverride)
            : undefined,
        }),
      ).unwrap();

      toast.success("Salary period generated.");
      setSalaryGenDialogOpen(false);
      await refreshFinance();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate salary period.");
    }
  }

  async function handleCreateAdvance() {
    try {
      await dispatch(
        createSalaryAdvance({
          userId: employee.uid,
          amount: Number(advanceForm.amount),
          paymentMethod: advanceForm.paymentMethod,
          description: advanceForm.description,
          paidBy: user?.uid ?? "system",
        }),
      ).unwrap();

      toast.success("Advance recorded.");
      setAdvanceDialogOpen(false);
      setAdvanceForm({ amount: "", paymentMethod: "cash", description: "" });
      await refreshFinance();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record advance.");
    }
  }

  async function handleCreatePayment() {
    try {
      const amount = Number(paymentForm.amount);
      const allocations = allocationPreview?.allocations;

      await dispatch(
        createSalaryPayment({
          userId: employee.uid,
          amount,
          paymentMethod: paymentForm.paymentMethod,
          description: paymentForm.description,
          allocations,
          paidBy: user?.uid ?? "system",
        }),
      ).unwrap();

      toast.success("Salary payment recorded.");
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: "", paymentMethod: "cash", description: "Salary payment" });
      await refreshFinance();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create salary payment.");
    }
  }

  async function handleAddAdjustment() {
    try {
      await dispatch(
        addSalaryAdjustment({
          userId: employee.uid,
          salaryPeriodId: adjustmentForm.salaryPeriodId,
          adjustmentType: adjustmentForm.adjustmentType,
          amount: Number(adjustmentForm.amount),
          description: adjustmentForm.description,
          referenceId:
            adjustmentForm.adjustmentType === "advance"
              ? adjustmentForm.referenceId
              : undefined,
        }),
      ).unwrap();

      toast.success("Adjustment added.");
      setAdjustmentDialogOpen(false);
      setAdjustmentForm({
        salaryPeriodId: "",
        adjustmentType: "bonus",
        amount: "",
        description: "",
        referenceId: "",
      });
      await refreshFinance();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add adjustment.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Current Salary</div>
          <div className="mt-1 text-xl font-semibold">{formatCurrency(currentEmployment.salary)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Salary Due</div>
          <div className="mt-1 text-xl font-semibold">{formatCurrency(totalOutstandingSalary)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Advance Due</div>
          <div className="mt-1 text-xl font-semibold">{formatCurrency(totalOutstandingAdvance)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total Salary Paid</div>
          <div className="mt-1 text-xl font-semibold">{formatCurrency(totalPaidSalary)}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">Attendance ({formatMonthYear(selectedYear, selectedMonth)})</h3>
            <p className="text-xs text-muted-foreground">Daily attendance is recorded separately from salary calculations.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              className="w-24"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            />
            <Input
              type="number"
              min={1}
              max={12}
              className="w-20"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(Number(event.target.value))}
            />
            <Button variant="outline" onClick={() => setAttendanceDialogOpen(true)}>
              <CalendarClock className="mr-2 h-4 w-4" />
              Mark Attendance
            </Button>
          </div>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-5">
          {attendanceStatuses.map((status) => (
            <div key={status} className="rounded-md border p-2 text-xs">
              <div className="text-muted-foreground">{toStatusLabel(status)}</div>
              <div className="text-lg font-semibold">{attendanceSummary[status]}</div>
            </div>
          ))}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Working Minutes</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendanceLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Loading attendance...</TableCell>
              </TableRow>
            ) : attendanceState?.records?.length ? (
              attendanceState.records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.date}</TableCell>
                  <TableCell><Badge variant="secondary">{toStatusLabel(record.status)}</Badge></TableCell>
                  <TableCell>{record.checkIn || "—"}</TableCell>
                  <TableCell>{record.checkOut || "—"}</TableCell>
                  <TableCell>{record.workingMinutes ?? "—"}</TableCell>
                  <TableCell>{record.notes || "—"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No attendance records for this month.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-medium">Salary & Finance Ledger</h3>
            <p className="text-xs text-muted-foreground">Salary periods, payments, and advances are tracked as separate financial events.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSalaryGenDialogOpen(true)}>
              <Calculator className="mr-2 h-4 w-4" />
              Generate Salary Period
            </Button>
            <Button variant="outline" onClick={() => setAdjustmentDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Adjustment
            </Button>
            <Button variant="outline" onClick={() => setAdvanceDialogOpen(true)}>
              <Coins className="mr-2 h-4 w-4" />
              Give Advance
            </Button>
            <Button onClick={() => setPaymentDialogOpen(true)}>
              <Wallet className="mr-2 h-4 w-4" />
              Pay Salary
            </Button>
          </div>
        </div>

        <h4 className="mb-2 mt-4 text-sm font-medium">Salary History</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Net Salary</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {financeLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Loading salary history...</TableCell>
              </TableRow>
            ) : salaryPeriods.length ? (
              salaryPeriods.map((period) => (
                <TableRow key={period.id}>
                  <TableCell>{formatMonthYear(period.year, period.month)}</TableCell>
                  <TableCell>{formatCurrency(period.netSalary)}</TableCell>
                  <TableCell>{formatCurrency(period.paidAmount)}</TableCell>
                  <TableCell>{formatCurrency(period.remainingAmount)}</TableCell>
                  <TableCell><Badge variant="secondary">{toStatusLabel(period.status)}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPeriod(period)}>View</Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No salary periods yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <h4 className="mb-2 mt-6 text-sm font-medium">Payment History</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Description</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salaryPayments.length ? (
              salaryPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{parseUnknownDate(payment.date)?.toLocaleDateString() ?? "—"}</TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>{toStatusLabel(payment.paymentMethod)}</TableCell>
                  <TableCell>{payment.description ?? "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPayment(payment)}>View</Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">No salary payments yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <h4 className="mb-2 mt-6 text-sm font-medium">Advance History</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Deducted</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salaryAdvances.length ? (
              salaryAdvances.map((advance) => (
                <TableRow key={advance.id}>
                  <TableCell>{parseUnknownDate(advance.date)?.toLocaleDateString() ?? "—"}</TableCell>
                  <TableCell>{formatCurrency(advance.amount)}</TableCell>
                  <TableCell>{formatCurrency(advance.amount - advance.remainingAmount)}</TableCell>
                  <TableCell>{formatCurrency(advance.remainingAmount)}</TableCell>
                  <TableCell><Badge variant="secondary">{toStatusLabel(advance.status)}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedAdvance(advance)}>View</Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No salary advances yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ReusableDialog
        open={attendanceDialogOpen}
        onOpenChange={setAttendanceDialogOpen}
        title="Mark Attendance"
        description="Record daily attendance, check-in, check-out, and optional notes."
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={attendanceForm.date} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, date: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={attendanceForm.status} onValueChange={(value) => setAttendanceForm((prev) => ({ ...prev, status: value as AttendanceStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {attendanceStatuses.map((status) => <SelectItem key={status} value={status}>{toStatusLabel(status)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Check In</Label>
              <Input type="time" value={attendanceForm.checkIn} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, checkIn: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Check Out</Label>
              <Input type="time" value={attendanceForm.checkOut} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, checkOut: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Working Minutes</Label>
            <Input type="number" min={0} value={attendanceForm.workingMinutes} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, workingMinutes: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={attendanceForm.notes} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAttendanceDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleAttendanceSubmit()}>Save Attendance</Button>
          </div>
        </div>
      </ReusableDialog>

      <ReusableDialog open={salaryGenDialogOpen} onOpenChange={setSalaryGenDialogOpen} title="Generate Salary Period">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Year</Label>
              <Input type="number" value={salaryGenForm.year} onChange={(event) => setSalaryGenForm((prev) => ({ ...prev, year: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Month (1-12)</Label>
              <Input type="number" min={1} max={12} value={salaryGenForm.month} onChange={(event) => setSalaryGenForm((prev) => ({ ...prev, month: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={salaryGenForm.status} onValueChange={(value) => setSalaryGenForm((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="final_settlement">Final Settlement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Base Salary Override (optional)</Label>
            <Input type="number" min={0} value={salaryGenForm.baseSalaryOverride} onChange={(event) => setSalaryGenForm((prev) => ({ ...prev, baseSalaryOverride: event.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSalaryGenDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleGenerateSalaryPeriod()}>Generate</Button>
          </div>
        </div>
      </ReusableDialog>

      <ReusableDialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen} title="Give Advance">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Advance Amount</Label>
            <Input type="number" min={1} value={advanceForm.amount} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, amount: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={advanceForm.paymentMethod} onValueChange={(value) => setAdvanceForm((prev) => ({ ...prev, paymentMethod: value as "cash" | "bank_transfer" | "other" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => <SelectItem key={method} value={method}>{toStatusLabel(method)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={advanceForm.description} onChange={(event) => setAdvanceForm((prev) => ({ ...prev, description: event.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdvanceDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreateAdvance()}>Give Advance</Button>
          </div>
        </div>
      </ReusableDialog>

      <ReusableDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen} title="Pay Salary">
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-sm">
            <p className="text-muted-foreground">Total Salary Due</p>
            <p className="text-xl font-semibold">{formatCurrency(outstandingPeriods.reduce((sum, period) => sum + period.remainingAmount, 0))}</p>
          </div>

          <div className="space-y-2">
            <Label>Payment Amount</Label>
            <Input type="number" min={1} value={paymentForm.amount} onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentForm.paymentMethod} onValueChange={(value) => setPaymentForm((prev) => ({ ...prev, paymentMethod: value as "cash" | "bank_transfer" | "other" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => <SelectItem key={method} value={method}>{toStatusLabel(method)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={paymentForm.description} onChange={(event) => setPaymentForm((prev) => ({ ...prev, description: event.target.value }))} />
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Allocation Preview</p>
            {allocationPreview ? (
              <div className="space-y-1 text-sm">
                {allocationPreview.allocations.map((allocation) => {
                  const period = outstandingPeriods.find((item) => item.id === allocation.salaryPeriodId);
                  return (
                    <div key={allocation.salaryPeriodId} className="flex justify-between">
                      <span>{period ? formatMonthYear(period.year, period.month) : allocation.salaryPeriodId}</span>
                      <span>{formatCurrency(allocation.amount)}</span>
                    </div>
                  );
                })}
                <div className="mt-2 flex justify-between border-t pt-2 font-medium">
                  <span>Total</span>
                  <span>{formatCurrency(allocationPreview.totalAllocated)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Remaining After Payment</span>
                  <span>{formatCurrency(allocationPreview.remainingAfterPayment)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a valid payment amount that does not exceed outstanding salary.</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreatePayment()} disabled={!allocationPreview}>Confirm Payment</Button>
          </div>
        </div>
      </ReusableDialog>

      <ReusableDialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen} title="Add Salary Adjustment">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Salary Period</Label>
            <Select value={adjustmentForm.salaryPeriodId} onValueChange={(value) => setAdjustmentForm((prev) => ({ ...prev, salaryPeriodId: value }))}>
              <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
              <SelectContent>
                {salaryPeriods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>{formatMonthYear(period.year, period.month)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <Select value={adjustmentForm.adjustmentType} onValueChange={(value) => setAdjustmentForm((prev) => ({ ...prev, adjustmentType: value as SalaryAdjustmentType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {adjustmentTypes.map((type) => <SelectItem key={type} value={type}>{toStatusLabel(type)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" min={1} value={adjustmentForm.amount} onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, amount: event.target.value }))} />
          </div>
          {adjustmentForm.adjustmentType === "advance" && (
            <div className="space-y-2">
              <Label>Advance Reference</Label>
              <Select value={adjustmentForm.referenceId} onValueChange={(value) => setAdjustmentForm((prev) => ({ ...prev, referenceId: value }))}>
                <SelectTrigger><SelectValue placeholder="Select advance" /></SelectTrigger>
                <SelectContent>
                  {salaryAdvances.filter((advance) => advance.remainingAmount > 0).map((advance) => (
                    <SelectItem key={advance.id} value={advance.id}>
                      {`${parseUnknownDate(advance.date)?.toLocaleDateString() ?? advance.id} - ${formatCurrency(advance.remainingAmount)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={adjustmentForm.description} onChange={(event) => setAdjustmentForm((prev) => ({ ...prev, description: event.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdjustmentDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleAddAdjustment()} disabled={!adjustmentForm.salaryPeriodId}>Add Adjustment</Button>
          </div>
        </div>
      </ReusableDialog>

      <ReusableDialog
        open={!!selectedPayment}
        onOpenChange={(open) => {
          if (!open) setSelectedPayment(null);
        }}
        title="Payment Allocation"
      >
        {selectedPayment && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="flex justify-between"><span>Amount</span><span>{formatCurrency(selectedPayment.amount)}</span></div>
              <div className="flex justify-between"><span>Method</span><span>{toStatusLabel(selectedPayment.paymentMethod)}</span></div>
              <div className="flex justify-between"><span>Paid By</span><span>{selectedPayment.paidBy}</span></div>
            </div>
            <div className="space-y-1">
              {selectedPayment.allocations.map((allocation) => {
                const period = salaryPeriods.find((item) => item.id === allocation.salaryPeriodId);
                return (
                  <div key={allocation.salaryPeriodId} className="flex justify-between rounded-md border p-2">
                    <span>{period ? formatMonthYear(period.year, period.month) : allocation.salaryPeriodId}</span>
                    <span>{formatCurrency(allocation.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ReusableDialog>

      <ReusableDialog
        open={!!selectedPeriod}
        onOpenChange={(open) => {
          if (!open) setSelectedPeriod(null);
        }}
        title="Salary Period Details"
      >
        {selectedPeriod && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="flex justify-between"><span>Period</span><span>{formatMonthYear(selectedPeriod.year, selectedPeriod.month)}</span></div>
              <div className="flex justify-between"><span>Base Salary</span><span>{formatCurrency(selectedPeriod.baseSalary)}</span></div>
              <div className="flex justify-between"><span>Gross Salary</span><span>{formatCurrency(selectedPeriod.grossSalary)}</span></div>
              <div className="flex justify-between"><span>Total Deductions</span><span>{formatCurrency(selectedPeriod.totalDeductions)}</span></div>
              <div className="flex justify-between"><span>Net Salary</span><span>{formatCurrency(selectedPeriod.netSalary)}</span></div>
              <div className="flex justify-between"><span>Paid</span><span>{formatCurrency(selectedPeriod.paidAmount)}</span></div>
              <div className="flex justify-between"><span>Remaining</span><span>{formatCurrency(selectedPeriod.remainingAmount)}</span></div>
            </div>
            <div>
              <p className="mb-2 font-medium">Adjustments</p>
              {selectedPeriod.adjustments.length ? (
                <div className="space-y-1">
                  {selectedPeriod.adjustments.map((adjustment) => (
                    <div key={adjustment.id} className="flex items-center justify-between rounded-md border p-2">
                      <div>
                        <p>{toStatusLabel(adjustment.type)}</p>
                        <p className="text-xs text-muted-foreground">{adjustment.description || "—"}</p>
                      </div>
                      <span>{formatCurrency(adjustment.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No adjustments.</p>
              )}
            </div>
          </div>
        )}
      </ReusableDialog>

      <ReusableDialog
        open={!!selectedAdvance}
        onOpenChange={(open) => {
          if (!open) setSelectedAdvance(null);
        }}
        title="Advance Details"
      >
        {selectedAdvance && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="flex justify-between"><span>Advance Amount</span><span>{formatCurrency(selectedAdvance.amount)}</span></div>
              <div className="flex justify-between"><span>Remaining</span><span>{formatCurrency(selectedAdvance.remainingAmount)}</span></div>
              <div className="flex justify-between"><span>Status</span><span>{toStatusLabel(selectedAdvance.status)}</span></div>
            </div>

            <div>
              <p className="mb-2 font-medium">Deduction References</p>
              <div className="space-y-2">
                {salaryPeriods
                  .flatMap((period) =>
                    period.adjustments
                      .filter((adjustment) => adjustment.referenceId === selectedAdvance.id)
                      .map((adjustment) => ({ period, adjustment })),
                  )
                  .map(({ period, adjustment }) => (
                    <div key={`${period.id}_${adjustment.id}`} className="flex items-center justify-between rounded-md border p-2">
                      <span>{formatMonthYear(period.year, period.month)}</span>
                      <span>{formatCurrency(adjustment.amount)}</span>
                    </div>
                  ))}

                {!salaryPeriods.some((period) =>
                  period.adjustments.some((adjustment) => adjustment.referenceId === selectedAdvance.id),
                ) && <p className="text-muted-foreground">No deductions linked yet.</p>}
              </div>
            </div>
          </div>
        )}
      </ReusableDialog>
    </section>
  );
}
