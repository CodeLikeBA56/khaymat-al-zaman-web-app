"use client";

import { useEffect, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  DEFAULT_ROLE_ALIASES,
  getPermissionOverridesForPersistence,
  normalizePermissionOverrides,
  ROLES,
  type Role,
} from "@/config/roles";
import type { UserDocument } from "@/types/user";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type EmployeeFormProps = {
  employee?: UserDocument | null;
  employeeId?: string;
  mode: "create" | "update";
};

const roleOptions = Object.values(ROLES);

type DutyScheduleField = {
  startTime: string;
  endTime: string;
};

const initialForm = {
  name: "",
  email: "",
  password: "",
  pin: "",
  role: "cashier" as Role,
  salary: "0",
  workingHoursPerDay: "12",
  alias: "",
  dutySchedule: [{ startTime: "08:00", endTime: "14:00" }] as DutyScheduleField[],
};

function getSecondaryAuth() {
  const name = "employee-creator";
  const secondaryApp =
    getApps().find((app) => app.name === name) ??
    initializeApp(getApp().options, name);
  return getAuth(secondaryApp);
}

export function EmployeeForm({
  employee,
  employeeId,
  mode,
}: EmployeeFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const selectableRoles = employee?.role === ROLES.ADMIN
    ? roleOptions
    : roleOptions.filter((role) => role !== ROLES.ADMIN);

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name,
        email: employee.email,
        password: "",
        pin: employee.pin ?? "",
        role: employee.role,
        salary: String(employee.salary ?? 0),
        workingHoursPerDay: String(employee.workingHoursPerDay ?? 12),
        alias: employee.alias ?? "",
        dutySchedule:
          employee.dutySchedule?.length > 0
            ? employee.dutySchedule
            : [{ startTime: "08:00", endTime: "14:00" }],
      });
    } else {
      setForm(initialForm);
    }
  }, [employee]);

  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addShift() {
    setForm((prev) => ({
      ...prev,
      dutySchedule: [...prev.dutySchedule, { startTime: "08:00", endTime: "14:00" }],
    }));
  }

  function removeShift(index: number) {
    setForm((prev) => ({
      ...prev,
      dutySchedule: prev.dutySchedule.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateShift(index: number, key: keyof DutyScheduleField, value: string) {
    setForm((prev) => ({
      ...prev,
      dutySchedule: prev.dutySchedule.map((shift, itemIndex) =>
        itemIndex === index ? { ...shift, [key]: value } : shift,
      ),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      if (employee) {
        const existingWorkHistory = Array.isArray(employee.workHistory)
          ? employee.workHistory
          : [];

        await updateDoc(doc(db, "users", employee.uid), {
          name: form.name.trim(),
          email: form.email.trim(),
          pin: form.pin,
          role: form.role,
          salary: Number(form.salary),
          workingHoursPerDay: Number(form.workingHoursPerDay),
          dutySchedule: form.dutySchedule,
          alias: form.alias.trim() || DEFAULT_ROLE_ALIASES[form.role],
          permissionOverrides: getPermissionOverridesForPersistence(
            form.role,
            employee.permissionOverrides,
          ),
          workHistory:
            existingWorkHistory.length > 0
              ? existingWorkHistory
              : [{ joinedAt: employee.createdAt ?? serverTimestamp(), leftAt: null }],
          updatedAt: serverTimestamp(),
        });
      } else {
        if (!form.password)
          throw new Error("Password is required when creating a user.");

        const secondaryAuth = getSecondaryAuth();
        const credential = await createUserWithEmailAndPassword(
          secondaryAuth,
          form.email.trim(),
          form.password,
        );

        await setDoc(doc(db, "users", credential.user.uid), {
          uid: credential.user.uid,
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          salary: Number(form.salary),
          workingHoursPerDay: Number(form.workingHoursPerDay),
          dutySchedule: form.dutySchedule,
          alias: form.alias.trim() || DEFAULT_ROLE_ALIASES[form.role],
          pin: form.pin,
          permissionOverrides: normalizePermissionOverrides([]),
          workHistory: [{ joinedAt: serverTimestamp(), leftAt: null }],
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await signOut(secondaryAuth);
      }

      toast.success(employee ? "Employee updated successfully." : "Employee created successfully.");

      if (mode === "update" && employeeId) {
        router.replace(`/employee/${employeeId}`);
      } else {
        router.replace("/employee");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save employee.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          {employee ? "Update employee" : "Create employee"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {employee
            ? "Update account, work schedule, and profile details."
            : "Create a Firebase login and employee profile."}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>

          {!employee && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                minLength={6}
                required
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used only by Firebase Authentication. It is never stored in
                Firestore.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={form.role}
              onValueChange={(value) => update("role", value as Role)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableRoles.map((role) => (
                    <SelectItem
                      key={role}
                      value={role}
                    >
                      {role
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alias">Alias</Label>
            <Input
              id="alias"
              placeholder={DEFAULT_ROLE_ALIASES[form.role]}
              value={form.alias}
              onChange={(e) => update("alias", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use default: {DEFAULT_ROLE_ALIASES[form.role]}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="salary">Salary</Label>
            <Input
              id="salary"
              type="number"
              min={0}
              value={form.salary}
              onChange={(e) => update("salary", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Working hours / day</Label>
            <Input
              id="hours"
              type="number"
              min={1}
              max={24}
              value={form.workingHoursPerDay}
              onChange={(e) => update("workingHoursPerDay", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              inputMode="numeric"
              maxLength={6}
              value={form.pin}
              onChange={(e) => update("pin", e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">Duty schedule</h3>
              <p className="text-xs text-muted-foreground">
                Add one or multiple shifts. Example: 06:00-12:00 and 18:00-00:00.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addShift}>
              <Plus className="mr-2 h-4 w-4" />
              Add shift
            </Button>
          </div>

          <div className="space-y-3">
            {form.dutySchedule.map((shift, index) => (
              <div key={`${shift.startTime}-${shift.endTime}-${index}`} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor={`shift-start-${index}`}>Start time</Label>
                  <Input
                    id={`shift-start-${index}`}
                    type="time"
                    value={shift.startTime}
                    onChange={(e) => updateShift(index, "startTime", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`shift-end-${index}`}>End time</Label>
                  <Input
                    id={`shift-end-${index}`}
                    type="time"
                    value={shift.endTime}
                    onChange={(e) => updateShift(index, "endTime", e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeShift(index)}
                    disabled={form.dutySchedule.length === 1}
                    aria-label={`Remove shift ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : employee ? "Update" : "Create user"}
          </Button>
        </div>
      </form>
      </div>
    </section>
  );
}
