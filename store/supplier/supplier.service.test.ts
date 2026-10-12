import assert from "node:assert/strict";
import test from "node:test";
import {
  __supplierServiceInternals,
  type ListSuppliersPageInput,
} from "./supplier.service";

test("resolveStatusFilter defaults to active", () => {
  const input: ListSuppliersPageInput = {};
  const status = __supplierServiceInternals.resolveStatusFilter(input);

  assert.equal(status, "active");
});

test("resolveStatusFilter keeps backward compatibility with includeInactive", () => {
  const input: ListSuppliersPageInput = { includeInactive: true };
  const status = __supplierServiceInternals.resolveStatusFilter(input);

  assert.equal(status, "all");
});

test("resolveStatusFilter supports inactive-only filtering", () => {
  const input: ListSuppliersPageInput = { status: "inactive" };
  const status = __supplierServiceInternals.resolveStatusFilter(input);

  assert.equal(status, "inactive");
});

test("resolveStatusFilter throws on invalid status", () => {
  const input = {
    status: "invalid-status",
  } as unknown as ListSuppliersPageInput;

  assert.throws(
    () => __supplierServiceInternals.resolveStatusFilter(input),
    /Supplier status filter is invalid/,
  );
});

test("buildActivationUpdatePayload sets isActive true", () => {
  const payload = __supplierServiceInternals.buildActivationUpdatePayload(true);

  assert.equal(payload.isActive, true);
  assert.ok(payload.updatedAt);
});

test("buildActivationUpdatePayload sets isActive false", () => {
  const payload =
    __supplierServiceInternals.buildActivationUpdatePayload(false);

  assert.equal(payload.isActive, false);
  assert.ok(payload.updatedAt);
});
