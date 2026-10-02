"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Plus, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import type { UserDocument } from "@/types/user";
import { Button } from "@/components/ui/button";
import { EmployeesTable } from "@/components/employees/employees-table";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const snapshot = await getDocs(query(collection(db, "users"), orderBy("name")));
      setEmployees(snapshot.docs.map((item) => item.data() as UserDocument));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load employees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage restaurant staff accounts, roles, salary and duty schedules.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => void loadEmployees()} aria-label="Refresh employees">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button asChild>
            <Link href="/emplyee/create">
            <Plus className="mr-2 h-4 w-4" />
            Add employee
            </Link>
          </Button>
        </div>
      </div>

      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Loading employees...</div>
      ) : (
        <EmployeesTable data={employees} />
      )}
    </section>
  );
}
