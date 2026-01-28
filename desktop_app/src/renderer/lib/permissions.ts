// Role definitions and permissions - aligned with web app
export type Role = 'ADMIN' | 'PHARMACIST' | 'CASHIER';

export const ROLES = {
  ADMIN: 'ADMIN',
  PHARMACIST: 'PHARMACIST',
  CASHIER: 'CASHIER',
} as const;

// Permission definitions for each feature
export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: ['ADMIN', 'PHARMACIST', 'CASHIER'],
  
  // Inventory
  VIEW_INVENTORY: ['ADMIN', 'PHARMACIST'],
  ADD_MEDICINE: ['ADMIN', 'PHARMACIST'],
  EDIT_MEDICINE: ['ADMIN', 'PHARMACIST'],
  DELETE_MEDICINE: ['ADMIN'],
  
  // Controlled Substances (Kenya Poisons Act)
  VIEW_CONTROLLED_SUBSTANCES: ['ADMIN', 'PHARMACIST'],
  MANAGE_CONTROLLED_SUBSTANCES: ['ADMIN', 'PHARMACIST'],
  
  // POS
  USE_POS: ['ADMIN', 'PHARMACIST', 'CASHIER'],
  
  // Sales
  VIEW_SALES: ['ADMIN', 'PHARMACIST', 'CASHIER'],
  VIEW_ALL_SALES: ['ADMIN', 'PHARMACIST'],
  
  // Customers
  VIEW_CUSTOMERS: ['ADMIN', 'PHARMACIST', 'CASHIER'],
  MANAGE_CUSTOMERS: ['ADMIN', 'PHARMACIST'],
  
  // Procurement
  VIEW_SUPPLIERS: ['ADMIN', 'PHARMACIST'],
  MANAGE_SUPPLIERS: ['ADMIN'],
  VIEW_PURCHASE_ORDERS: ['ADMIN', 'PHARMACIST'],
  CREATE_PURCHASE_ORDER: ['ADMIN', 'PHARMACIST'],
  MANAGE_PURCHASE_ORDER: ['ADMIN'],
  VIEW_GRN: ['ADMIN', 'PHARMACIST'],
  CREATE_GRN: ['ADMIN', 'PHARMACIST'],
  
  // Reports
  VIEW_REPORTS: ['ADMIN', 'PHARMACIST'],
  EXPORT_REPORTS: ['ADMIN', 'PHARMACIST'],
  
  // User Management
  VIEW_USERS: ['ADMIN'],
  CREATE_USER: ['ADMIN'],
  EDIT_USER: ['ADMIN'],
  DELETE_USER: ['ADMIN'],
  
  // Branch Management
  VIEW_BRANCHES: ['ADMIN'],
  MANAGE_BRANCHES: ['ADMIN'],
  
  // Settings
  VIEW_SETTINGS: ['ADMIN'],
  MANAGE_SETTINGS: ['ADMIN'],
} as const;

export function hasPermission(role: string | undefined, permission: keyof typeof PERMISSIONS): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSIONS[permission] as readonly string[];
  return allowedRoles.includes(role);
}

export function isAdmin(role: string | undefined): boolean {
  return role === 'ADMIN';
}

export function isPharmacist(role: string | undefined): boolean {
  return role === 'PHARMACIST';
}

export function isCashier(role: string | undefined): boolean {
  return role === 'CASHIER';
}

// Navigation items with permissions
export interface NavItem {
  path: string;
  label: string;
  permission: keyof typeof PERMISSIONS;
  icon?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', permission: 'VIEW_DASHBOARD' },
  { path: '/pos', label: 'POS', permission: 'USE_POS' },
  { path: '/inventory', label: 'Inventory', permission: 'VIEW_INVENTORY' },
  { path: '/controlled-substances', label: 'Controlled', permission: 'VIEW_CONTROLLED_SUBSTANCES' },
  { path: '/sales', label: 'Sales', permission: 'VIEW_SALES' },
  { path: '/customers', label: 'Customers', permission: 'VIEW_CUSTOMERS' },
];

export const PROCUREMENT_ITEMS: NavItem[] = [
  { path: '/procurement/suppliers', label: 'Suppliers', permission: 'VIEW_SUPPLIERS' },
  { path: '/procurement/purchase-orders', label: 'Purchase Orders', permission: 'VIEW_PURCHASE_ORDERS' },
  { path: '/procurement/grn', label: 'Goods Received', permission: 'VIEW_GRN' },
];

export const ADMIN_ITEMS: NavItem[] = [
  { path: '/admin/users', label: 'Users', permission: 'VIEW_USERS' },
  { path: '/admin/branches', label: 'Branches', permission: 'VIEW_BRANCHES' },
  { path: '/admin/reports', label: 'Reports', permission: 'VIEW_REPORTS' },
  { path: '/admin/settings', label: 'Settings', permission: 'VIEW_SETTINGS' },
];

export function getAccessibleNavItems(role: string | undefined): NavItem[] {
  return NAV_ITEMS.filter(item => hasPermission(role, item.permission));
}

export function getAccessibleProcurementItems(role: string | undefined): NavItem[] {
  return PROCUREMENT_ITEMS.filter(item => hasPermission(role, item.permission));
}

export function getAccessibleAdminItems(role: string | undefined): NavItem[] {
  return ADMIN_ITEMS.filter(item => hasPermission(role, item.permission));
}
