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
  ORDERS_VIEW: "orders.view",
  ORDERS_CREATE: "orders.create",
  ORDERS_UPDATE: "orders.update",
  ORDERS_CANCEL: "orders.cancel",
  KITCHEN_VIEW: "kitchen.view",
  KITCHEN_UPDATE: "kitchen.update",
  FULFILLMENT_VIEW: "fulfillment.view",
  FULFILLMENT_UPDATE: "fulfillment.update",
  TABLES_VIEW: "tables.view",
  TABLES_UPDATE: "tables.update",
  BILLING_VIEW: "billing.view",
  BILLING_CREATE: "billing.create",
  BILLING_UPDATE: "billing.update",
  MENU_VIEW: "menu.view",
  MENU_CREATE: "menu.create",
  MENU_UPDATE: "menu.update",
  MENU_DELETE: "menu.delete",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_UPDATE: "inventory.update",
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  ATTENDANCE_VIEW: "attendance.view",
  ATTENDANCE_UPDATE: "attendance.update",
  SALARY_VIEW: "salary.view",
  SALARY_UPDATE: "salary.update",
  SALARY_PAYMENT_CREATE: "salary_payment.create",
  SALARY_ADVANCE_CREATE: "salary_advance.create",
  FINANCIAL_REPORTS_VIEW: "financial_reports.view",
  REPORTS_VIEW: "reports.view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type PermissionOverrides = {
  allow: Permission[];
  deny: Permission[];
};

export type PermissionOverridesInput = Permission[] | PermissionOverrides | null | undefined;

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: Object.values(PERMISSIONS),
  cashier: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_CREATE,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.SALARY_VIEW,
    PERMISSIONS.SALARY_PAYMENT_CREATE,
  ],
  chef: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.KITCHEN_VIEW,
    PERMISSIONS.KITCHEN_UPDATE,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
  ],
  order_fulfillment: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.FULFILLMENT_VIEW,
    PERMISSIONS.FULFILLMENT_UPDATE,
    PERMISSIONS.MENU_VIEW,
  ],
  waiter: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.TABLES_VIEW,
    PERMISSIONS.TABLES_UPDATE,
    PERMISSIONS.MENU_VIEW,
  ],
  roti_specialist: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.KITCHEN_VIEW,
    PERMISSIONS.KITCHEN_UPDATE,
    PERMISSIONS.MENU_VIEW,
  ],
  paratha_specialist: [
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.KITCHEN_VIEW,
    PERMISSIONS.KITCHEN_UPDATE,
    PERMISSIONS.MENU_VIEW,
  ],
  cleaner: [PERMISSIONS.TABLES_VIEW],
};

export function normalizePermissionOverrides(overrides: PermissionOverridesInput): PermissionOverrides {
  if (!overrides) return { allow: [], deny: [] };
  if (Array.isArray(overrides)) return { allow: overrides, deny: [] };
  return {
    allow: overrides.allow ?? [],
    deny: overrides.deny ?? [],
  };
}

export function resolvePermissions(role: Role, overrides?: PermissionOverridesInput): Permission[] {
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
