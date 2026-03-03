export const appRoles = ["admin", "manager", "sales"] as const;

export type AppRole = (typeof appRoles)[number];

export const roleLabels: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Gestor",
  sales: "Comercial"
};

const rolePermissions: Record<AppRole, string[]> = {
  admin: [
    "accounts:view",
    "accounts:write",
    "contacts:write",
    "dashboard:view",
    "opportunities:write",
    "pipeline:write",
    "settings:write",
    "tasks:write",
    "records:edit",
    "team:manage"
  ],
  manager: [
    "accounts:view",
    "accounts:write",
    "contacts:write",
    "dashboard:view",
    "opportunities:write",
    "pipeline:write",
    "tasks:write",
    "records:edit",
    "team:view"
  ],
  sales: [
    "accounts:view",
    "contacts:write",
    "dashboard:view",
    "opportunities:write",
    "tasks:write"
  ]
};

export function hasPermission(role: AppRole, permission: string) {
  return rolePermissions[role].includes(permission);
}
