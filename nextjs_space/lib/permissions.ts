// Role definitions and permissions
export type Role = "ADMIN" | "PHARMACIST" | "CASHIER";

export const ROLES = {
  ADMIN: "ADMIN",
  PHARMACIST: "PHARMACIST",
  CASHIER: "CASHIER",
} as const;

// Permission definitions for each feature
export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: ["ADMIN", "PHARMACIST", "CASHIER"],
  
  // Inventory
  VIEW_INVENTORY: ["ADMIN", "PHARMACIST"],
  ADD_MEDICINE: ["ADMIN", "PHARMACIST"],
  EDIT_MEDICINE: ["ADMIN", "PHARMACIST"],
  DELETE_MEDICINE: ["ADMIN"],
  
  // POS
  USE_POS: ["ADMIN", "PHARMACIST", "CASHIER"],
  
  // Sales
  VIEW_SALES: ["ADMIN", "PHARMACIST", "CASHIER"],
  VIEW_ALL_SALES: ["ADMIN", "PHARMACIST"],
  
  // Customers
  VIEW_CUSTOMERS: ["ADMIN", "PHARMACIST", "CASHIER"],
  MANAGE_CUSTOMERS: ["ADMIN", "PHARMACIST"],
  
  // Procurement
  VIEW_SUPPLIERS: ["ADMIN", "PHARMACIST"],
  MANAGE_SUPPLIERS: ["ADMIN"],
  VIEW_PURCHASE_ORDERS: ["ADMIN", "PHARMACIST"],
  CREATE_PURCHASE_ORDER: ["ADMIN", "PHARMACIST"],
  MANAGE_PURCHASE_ORDER: ["ADMIN"],
  VIEW_GRN: ["ADMIN", "PHARMACIST"],
  CREATE_GRN: ["ADMIN", "PHARMACIST"],
  
  // Reports
  VIEW_REPORTS: ["ADMIN", "PHARMACIST"],
  EXPORT_REPORTS: ["ADMIN", "PHARMACIST"],
  
  // User Management
  VIEW_USERS: ["ADMIN"],
  CREATE_USER: ["ADMIN"],
  EDIT_USER: ["ADMIN"],
  DELETE_USER: ["ADMIN"],
} as const;

export function hasPermission(role: string | undefined, permission: keyof typeof PERMISSIONS): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSIONS[permission] as readonly string[];
  return allowedRoles.includes(role);
}

export function isAdmin(role: string | undefined): boolean {
  return role === "ADMIN";
}

export function isPharmacist(role: string | undefined): boolean {
  return role === "PHARMACIST";
}

export function isCashier(role: string | undefined): boolean {
  return role === "CASHIER";
}

// Get accessible nav items based on role
export function getAccessibleNavItems(role: string | undefined) {
  const items = [
    { href: "/dashboard", label: "Dashboard", permission: "VIEW_DASHBOARD" },
    { href: "/pos", label: "POS", permission: "USE_POS" },
    { href: "/inventory", label: "Inventory", permission: "VIEW_INVENTORY" },
    { href: "/sales", label: "Sales", permission: "VIEW_SALES" },
    { href: "/reports", label: "Reports", permission: "VIEW_REPORTS" },
  ];

  return items.filter(item => hasPermission(role, item.permission as keyof typeof PERMISSIONS));
}
