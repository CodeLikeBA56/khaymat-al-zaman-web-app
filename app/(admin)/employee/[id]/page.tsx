"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserDocument } from "@/types/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRoleLabel } from "@/lib/utils";

function formatDate(value: unknown) {
  if (!value) return "—";

  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString();
}

export default function EmployeeViewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [employee, setEmployee] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEmployee() {
      if (!id) {
        setError("Missing employee id.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const snapshot = await getDoc(doc(db, "users", id));
        if (!snapshot.exists()) {
          setError("Employee not found.");
          return;
        }

        setEmployee(snapshot.data() as UserDocument);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load employee.");
      } finally {
        setLoading(false);
      }
    }

    void loadEmployee();
  }, [id]);

  const schedule = useMemo(() => employee?.dutySchedule ?? [], [employee]);
  const history = useMemo(() => employee?.workHistory ?? [], [employee]);

  if (loading) {
    return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Loading employee...</div>;
  }

  if (error || !employee || !id) {
    return <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error || "Employee not found."}</div>;
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{employee.name}</h1>
            <p className="text-sm text-muted-foreground">{employee.email}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/employee">Back</Link>
            </Button>
            <Button asChild>
              <Link href={`/employee/update?id=${id}`}>Edit</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-medium">Profile</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Role:</span> <Badge variant="secondary" className="ml-2">{getRoleLabel(employee.role)}</Badge></p>
            <p><span className="text-muted-foreground">Alias:</span> {employee.alias || "Default"}</p>
            <p><span className="text-muted-foreground">Salary:</span> {employee.salary} SAR</p>
            <p><span className="text-muted-foreground">Hours/day:</span> {employee.workingHoursPerDay}h</p>
            <p><span className="text-muted-foreground">PIN:</span> {employee.pin || "—"}</p>
            <p>
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={employee.isActive ? "default" : "secondary"} className="ml-2">
                {employee.isActive ? "Active" : "Inactive"}
              </Badge>
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-medium">Duty schedule</h2>
          <div className="space-y-2">
            {schedule.length > 0 ? schedule.map((shift, index) => (
              <div key={`${shift.startTime}-${shift.endTime}-${index}`} className="rounded-md border px-3 py-2 text-sm">
                Shift {index + 1}: {shift.startTime} - {shift.endTime}
              </div>
            )) : <p className="text-sm text-muted-foreground">No schedule available.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-medium">Work history</h2>
        <div className="space-y-2">
          {history.length > 0 ? history.map((item, index) => (
            <div key={`${index}-${String(item.joinedAt)}`} className="rounded-md border px-3 py-2 text-sm">
              Period {index + 1}: Joined {formatDate(item.joinedAt)} · Left {item.leftAt ? formatDate(item.leftAt) : "Currently working"}
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">No work history recorded.</p>
          )}
        </div>
      </div>
    </section>
  );
}
