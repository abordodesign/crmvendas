export const appRoles = ["admin", "manager", "sales"] as const;

export type AppRole = (typeof appRoles)[number];

export const roleLabels: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Gestor",
  sales: "Comercial"
};

const rolePermissions: Record<AppRole, string[]> = {
  admin: [
    "accounts:write",
    "contacts:write",
    "dashboard:view",
    "opportunities:write",
    "pipeline:write",
    "settings:write",
    "team:manage"
  ],
  manager: [
    "accounts:write",
    "contacts:write",
    "dashboard:view",
    "opportunities:write",
    "pipeline:write",
    "team:view"
  ],
  sales: [
    "accounts:write",
    "contacts:write",
    "dashboard:view",
    "opportunities:write"
  ]
};

export function hasPermission(role: AppRole, permission: string) {
  return rolePermissions[role].includes(permission);
}
