export const ROLES = {
  ADMIN: "admin",
  CASHIER: "cashier",
  CHEF: "chef",
  ORDER_FULFILLMENT: "order_fulfillment",
  WAITER: "waiter",
  ROTI_SPECIALIST: "roti_specialist",
  PARATHA_SPECIALIST: "paratha_specialist",
  CLEANER: "cleaner",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const DEFAULT_ROLE_ALIASES: Record<Role, string> = {
  admin: "Admin",
  cashier: "Bill wala",
  chef: "Bawarchi",
  order_fulfillment: "Order tayyar karne wala",
  waiter: "Khana serve karne wala",
  roti_specialist: "Roti banane wala",
  paratha_specialist: "Paratha banane wala",
  cleaner: "Safai wala",
};

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  VENDORS_VIEW: "vendors.view",
  VENDORS_CREATE: "vendors.create",
  VENDORS_UPDATE: "vendors.update",
  PURCHASE_INVOICES_VIEW: "purchase_invoices.view",
  PURCHASE_INVOICES_CREATE: "purchase_invoices.create",
  PURCHASE_INVOICES_UPDATE: "purchase_invoices.update",
  SUPPLIER_PAYMENTS_VIEW: "supplier_payments.view",
  SUPPLIER_PAYMENTS_CREATE: "supplier_payments.create",
  SUPPLIER_PAYMENTS_VOID: "supplier_payments.void",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionOverrides = {
  allow: Permission[];
  deny: Permission[];
};

export type PermissionOverridesInput =
  | Permission[]
  | PermissionOverrides
  | null
  | undefined;

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: Object.values(PERMISSIONS),
  cashier: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.VENDORS_VIEW,
    PERMISSIONS.PURCHASE_INVOICES_VIEW,
    PERMISSIONS.SUPPLIER_PAYMENTS_VIEW,
  ],
  chef: [PERMISSIONS.DASHBOARD_VIEW],
  order_fulfillment: [PERMISSIONS.DASHBOARD_VIEW],
  waiter: [PERMISSIONS.DASHBOARD_VIEW],
  roti_specialist: [PERMISSIONS.DASHBOARD_VIEW],
  paratha_specialist: [PERMISSIONS.DASHBOARD_VIEW],
  cleaner: [PERMISSIONS.DASHBOARD_VIEW],
};

export function normalizePermissionOverrides(
  overrides: PermissionOverridesInput,
): PermissionOverrides {
  if (!overrides) return { allow: [], deny: [] };
  if (Array.isArray(overrides)) return { allow: overrides, deny: [] };
  return {
    allow: overrides.allow ?? [],
    deny: overrides.deny ?? [],
  };
}

export function resolvePermissions(
  role: Role,
  overrides?: PermissionOverridesInput,
): Permission[] {
  const basePermissions = new Set(DEFAULT_ROLE_PERMISSIONS[role]);
  const normalized = normalizePermissionOverrides(overrides);

  for (const permission of normalized.allow) {
    basePermissions.add(permission);
  }

  for (const permission of normalized.deny) {
    basePermissions.delete(permission);
  }

  return Array.from(basePermissions);
}

export function getPermissionOverridesForPersistence(
  role: Role,
  overrides?: PermissionOverridesInput,
): PermissionOverrides {
  if (Array.isArray(overrides) && overrides.length === 0) {
    return { allow: DEFAULT_ROLE_PERMISSIONS[role], deny: [] };
  }

  const normalized = normalizePermissionOverrides(overrides);
  if (normalized.allow.length === 0 && normalized.deny.length === 0) {
    return { allow: DEFAULT_ROLE_PERMISSIONS[role], deny: [] };
  }

  return normalized;
}
