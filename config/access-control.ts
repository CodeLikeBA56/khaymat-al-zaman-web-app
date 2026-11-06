import {
  PERMISSIONS,
  resolvePermissions,
  type Permission,
} from "@/config/roles";
import { getCurrentRoleFromProfile } from "@/lib/employment";
import type { UserDocument } from "@/types/user";

export const MODULE_KEYS = {
  DASHBOARD: "dashboard",
  EMPLOYEES: "employees",
  VENDORS: "vendors",
  PURCHASE_INVOICES: "purchase_invoices",
  SUPPLIER_PAYMENTS: "supplier_payments",
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

export const PRODUCTION_ENABLED_MODULES: ReadonlyArray<ModuleKey> = [
  MODULE_KEYS.DASHBOARD,
  MODULE_KEYS.EMPLOYEES,
  MODULE_KEYS.VENDORS,
  MODULE_KEYS.PURCHASE_INVOICES,
  MODULE_KEYS.SUPPLIER_PAYMENTS,
];

const DISABLE_NON_PRODUCTION_MODULES = true;

type RoutePermissionRule = {
  pathPrefix: string;
  permission: Permission;
  module: ModuleKey;
};

export const NAVIGATION_PERMISSIONS: ReadonlyArray<RoutePermissionRule> = [
  {
    pathPrefix: "/dashboard",
    permission: PERMISSIONS.DASHBOARD_VIEW,
    module: MODULE_KEYS.DASHBOARD,
  },
  {
    pathPrefix: "/employee",
    permission: PERMISSIONS.USERS_VIEW,
    module: MODULE_KEYS.EMPLOYEES,
  },
  {
    pathPrefix: "/vendor",
    permission: PERMISSIONS.VENDORS_VIEW,
    module: MODULE_KEYS.VENDORS,
  },
  {
    pathPrefix: "/purchase-invoice",
    permission: PERMISSIONS.PURCHASE_INVOICES_VIEW,
    module: MODULE_KEYS.PURCHASE_INVOICES,
  },
  {
    pathPrefix: "/supplier-payment",
    permission: PERMISSIONS.SUPPLIER_PAYMENTS_VIEW,
    module: MODULE_KEYS.SUPPLIER_PAYMENTS,
  },
];

export const DEFAULT_POST_LOGIN_PATH = "/dashboard";

export function getEffectivePermissions(profile?: UserDocument | null) {
  const role = getCurrentRoleFromProfile(profile);
  if (!role || !profile) return [] as Permission[];

  return resolvePermissions(role, profile.permissionOverrides);
}

export function hasPermission(
  permissions: Permission[],
  requiredPermission: Permission,
) {
  return permissions.includes(requiredPermission);
}

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export function isModuleEnabled(module: ModuleKey) {
  const isListedForProduction = PRODUCTION_ENABLED_MODULES.includes(module);

  if (isProductionEnvironment()) {
    return isListedForProduction;
  }

  if (DISABLE_NON_PRODUCTION_MODULES) {
    return isListedForProduction;
  }

  return true;
}

function getRouteRule(pathname: string) {
  const normalizedPath = pathname.trim();

  return NAVIGATION_PERMISSIONS
    .filter((rule) =>
      normalizedPath === rule.pathPrefix ||
      normalizedPath.startsWith(`${rule.pathPrefix}/`),
    )
    .sort((a, b) => b.pathPrefix.length - a.pathPrefix.length)[0];
}

export function isPathEnabled(pathname: string) {
  const matchedRule = getRouteRule(pathname);
  if (!matchedRule) return true;
  return isModuleEnabled(matchedRule.module);
}

export function canAccessPath(pathname: string, permissions: Permission[]) {
  const matchedRule = getRouteRule(pathname);

  if (!matchedRule) {
    return true;
  }

  return (
    isModuleEnabled(matchedRule.module) &&
    hasPermission(permissions, matchedRule.permission)
  );
}

export function canViewLink(pathname: string, permissions: Permission[]) {
  const matchedRule = getRouteRule(pathname);
  if (!matchedRule) return false;
  return hasPermission(permissions, matchedRule.permission);
}

export function getFirstAccessiblePath(permissions: Permission[]) {
  for (const rule of NAVIGATION_PERMISSIONS) {
    if (isModuleEnabled(rule.module) && hasPermission(permissions, rule.permission)) {
      return rule.pathPrefix;
    }
  }

  return null;
}
