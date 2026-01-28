"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  LogOut,
  Pill,
  ShoppingCart,
  Receipt,
  Truck,
  ChevronDown,
  Building2,
  FileText,
  ClipboardCheck,
  BarChart3,
  Users,
  UserCog,
  Shield,
  Globe,
  ChevronRight,
  Download,
  Settings,
  Calculator,
  Stethoscope,
} from "lucide-react";
import { useState, useEffect } from "react";
import { hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { useBranch } from "@/lib/branch-context";

export function Sidebar() {
  const [mounted, setMounted] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [customersOpen, setCustomersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [procurementOpen, setProcurementOpen] = useState(false);
  const [accountingOpen, setAccountingOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const sessionData = useSession();
  const session = sessionData?.data;
  const pathname = usePathname();
  const userRole = session?.user?.role;

  const {
    selectedBranch,
    branches,
    setSelectedBranchId,
    isAdmin,
    viewAllBranches,
    setViewAllBranches,
  } = useBranch();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Auto-expand dropdowns based on current page
    if (pathname.startsWith("/procurement")) {
      setProcurementOpen(true);
    }
    if (pathname.startsWith("/accounting")) {
      setAccountingOpen(true);
    }
    if (pathname === "/inventory" || pathname.startsWith("/inventory/") || pathname === "/controlled-substances") {
      setInventoryOpen(true);
    }
    if (pathname === "/customers" || pathname.startsWith("/prescriptions") || pathname === "/prescribers") {
      setCustomersOpen(true);
    }
    if (pathname === "/audit-logs" || pathname === "/users" || pathname === "/branches") {
      setSettingsOpen(true);
    }
  }, [pathname]);

  // Define simple nav links (no dropdowns)
  const simpleNavLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "VIEW_DASHBOARD" },
    { href: "/pos", label: "POS", icon: ShoppingCart, permission: "USE_POS" },
    { href: "/sales", label: "Sales", icon: Receipt, permission: "VIEW_SALES" },
    { href: "/reports", label: "Reports", icon: BarChart3, permission: "VIEW_REPORTS" },
  ];

  // Inventory dropdown links
  const inventoryLinks = [
    { href: "/inventory", label: "Medicine List", icon: Package, permission: "VIEW_INVENTORY" },
    { href: "/controlled-substances", label: "Controlled Substances", icon: Pill, permission: "VIEW_CONTROLLED_SUBSTANCES" },
  ];

  // Customers dropdown links
  const customersLinks = [
    { href: "/customers", label: "Customer List", icon: Users, permission: "VIEW_CUSTOMERS" },
    { href: "/prescriptions", label: "Prescriptions", icon: FileText, permission: "VIEW_PRESCRIPTIONS" },
    { href: "/prescribers", label: "Prescribers", icon: Stethoscope, permission: "VIEW_PRESCRIPTIONS" },
  ];

  // Settings dropdown links
  const settingsLinks = [
    { href: "/audit-logs", label: "Audit Trail", icon: Shield, permission: "VIEW_AUDIT_LOGS" },
    { href: "/users", label: "Users", icon: UserCog, permission: "VIEW_USERS" },
    { href: "/branches", label: "Branches", icon: Building2, permission: "VIEW_BRANCHES" },
  ];

  const procurementLinks = [
    { href: "/procurement/suppliers", label: "Suppliers", icon: Building2 },
    { href: "/procurement/purchase-orders", label: "Purchase Orders", icon: FileText },
    { href: "/procurement/grn", label: "Goods Received", icon: ClipboardCheck },
  ];

  const accountingLinks = [
    { href: "/accounting/exports", label: "Data Exports", icon: Download },
    { href: "/accounting/mappings", label: "Account Mappings", icon: Settings },
  ];

  // Filter simple nav links based on permissions
  const navLinks = simpleNavLinks.filter((link) =>
    hasPermission(userRole, link.permission as Parameters<typeof hasPermission>[1])
  );

  // Check permissions for dropdowns
  const canViewInventory = hasPermission(userRole, "VIEW_INVENTORY");
  const canViewControlled = hasPermission(userRole, "VIEW_CONTROLLED_SUBSTANCES");
  const showInventoryDropdown = canViewInventory || canViewControlled;
  const isInventoryActive = pathname === "/inventory" || pathname.startsWith("/inventory/") || pathname === "/controlled-substances";

  const canViewCustomers = hasPermission(userRole, "VIEW_CUSTOMERS");
  const canViewPrescriptions = hasPermission(userRole, "VIEW_PRESCRIPTIONS");
  const showCustomersDropdown = canViewCustomers || canViewPrescriptions;
  const isCustomersActive = pathname === "/customers" || pathname.startsWith("/prescriptions") || pathname === "/prescribers";

  const canViewAuditLogs = hasPermission(userRole, "VIEW_AUDIT_LOGS");
  const canViewUsers = hasPermission(userRole, "VIEW_USERS");
  const canViewBranches = hasPermission(userRole, "VIEW_BRANCHES");
  const showSettingsDropdown = canViewAuditLogs || canViewUsers || canViewBranches;
  const isSettingsActive = pathname === "/audit-logs" || pathname === "/users" || pathname === "/branches";

  const canViewProcurement = hasPermission(userRole, "VIEW_PURCHASE_ORDERS");
  const isProcurementActive = pathname.startsWith("/procurement");
  
  const canViewAccounting = hasPermission(userRole, "VIEW_REPORTS");
  const isAccountingActive = pathname.startsWith("/accounting");

  const getRoleBadgeColor = (role: string | undefined) => {
    switch (role) {
      case "ADMIN":
        return "bg-purple-100 text-purple-700";
      case "PHARMACIST":
        return "bg-blue-100 text-blue-700";
      case "CASHIER":
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (!mounted || !session) return null;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col z-40">
      {/* Logo */}
      <div className="p-4 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Pill className="w-6 h-6 text-emerald-600" />
          </div>
          <span className="font-bold text-xl text-gray-900">DawaCare</span>
        </Link>
      </div>

      {/* User Info & Branch */}
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-emerald-700 font-medium text-sm">
              {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {session?.user?.name || "User"}
            </p>
            <Badge className={`${getRoleBadgeColor(userRole)} text-xs`}>
              <Shield className="w-2.5 h-2.5 mr-1" />
              {userRole || "User"}
            </Badge>
          </div>
        </div>

        {/* Branch Selector for Admin */}
        {isAdmin && branches.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="truncate">
                  {viewAllBranches ? "All Branches" : selectedBranch?.name || "Select Branch"}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${branchDropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {branchDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <button
                  onClick={() => {
                    setViewAllBranches(true);
                    setBranchDropdownOpen(false);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors ${
                    viewAllBranches
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  All Branches
                </button>
                <div className="border-t my-1" />
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => {
                      setSelectedBranchId(branch.id);
                      setBranchDropdownOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors ${
                      !viewAllBranches && selectedBranch?.id === branch.id
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span className="truncate">{branch.name}</span>
                    <span className="text-xs text-gray-400">({branch.code})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Non-admin branch display */}
        {!isAdmin && selectedBranch && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm">
            <Building2 className="w-4 h-4" />
            <span className="truncate">{selectedBranch.name}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {/* Simple nav links (Dashboard, POS, Sales) */}
        {navLinks.slice(0, 2).map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                isActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon className="w-5 h-5" />
              {link.label}
            </Link>
          );
        })}

        {/* Inventory Dropdown */}
        {showInventoryDropdown && (
          <div>
            <button
              onClick={() => setInventoryOpen(!inventoryOpen)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                isInventoryActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5" />
                Inventory
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-transform ${inventoryOpen ? "rotate-90" : ""}`}
              />
            </button>
            {inventoryOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                {inventoryLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  const canView = hasPermission(userRole, link.permission as Parameters<typeof hasPermission>[1]);
                  if (!canView) return null;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Sales link */}
        {navLinks.find(l => l.href === "/sales") && (
          <Link
            href="/sales"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
              pathname === "/sales" || pathname.startsWith("/sales/")
                ? "bg-emerald-100 text-emerald-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Receipt className="w-5 h-5" />
            Sales
          </Link>
        )}

        {/* Customers Dropdown */}
        {showCustomersDropdown && (
          <div>
            <button
              onClick={() => setCustomersOpen(!customersOpen)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                isCustomersActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5" />
                Customers
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-transform ${customersOpen ? "rotate-90" : ""}`}
              />
            </button>
            {customersOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                {customersLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  const canView = hasPermission(userRole, link.permission as Parameters<typeof hasPermission>[1]);
                  if (!canView) return null;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Reports link */}
        {navLinks.find(l => l.href === "/reports") && (
          <Link
            href="/reports"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
              pathname === "/reports"
                ? "bg-emerald-100 text-emerald-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            Reports
          </Link>
        )}

        {/* Procurement Dropdown */}
        {canViewProcurement && (
          <div>
            <button
              onClick={() => setProcurementOpen(!procurementOpen)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                isProcurementActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5" />
                Procurement
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-transform ${procurementOpen ? "rotate-90" : ""}`}
              />
            </button>
            {procurementOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                {procurementLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Accounting Dropdown */}
        {canViewAccounting && (
          <div>
            <button
              onClick={() => setAccountingOpen(!accountingOpen)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                isAccountingActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <Calculator className="w-5 h-5" />
                Accounting
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-transform ${accountingOpen ? "rotate-90" : ""}`}
              />
            </button>
            {accountingOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                {accountingLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Settings Dropdown (Audit Trail, Users, Branches) */}
        {showSettingsDropdown && (
          <div>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                isSettingsActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                Settings
              </div>
              <ChevronRight
                className={`w-4 h-4 transition-transform ${settingsOpen ? "rotate-90" : ""}`}
              />
            </button>
            {settingsOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                {settingsLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  const canView = hasPermission(userRole, link.permission as Parameters<typeof hasPermission>[1]);
                  if (!canView) return null;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
