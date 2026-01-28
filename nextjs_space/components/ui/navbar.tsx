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
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { useBranch } from "@/lib/branch-context";

export function Navbar() {
  const [mounted, setMounted] = useState(false);
  const [procurementOpen, setProcurementOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const procurementRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);
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
    setViewAllBranches 
  } = useBranch();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (procurementRef.current && !procurementRef.current.contains(event.target as Node)) {
        setProcurementOpen(false);
      }
      if (branchRef.current && !branchRef.current.contains(event.target as Node)) {
        setBranchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Define nav links with permissions
  const allNavLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "VIEW_DASHBOARD" },
    { href: "/pos", label: "POS", icon: ShoppingCart, permission: "USE_POS" },
    { href: "/inventory", label: "Inventory", icon: Package, permission: "VIEW_INVENTORY" },
    { href: "/sales", label: "Sales", icon: Receipt, permission: "VIEW_SALES" },
    { href: "/customers", label: "Customers", icon: Users, permission: "VIEW_CUSTOMERS" },
    { href: "/reports", label: "Reports", icon: BarChart3, permission: "VIEW_REPORTS" },
    { href: "/audit-logs", label: "Audit Trail", icon: Shield, permission: "VIEW_AUDIT_LOGS" },
    { href: "/users", label: "Users", icon: UserCog, permission: "VIEW_USERS" },
    { href: "/branches", label: "Branches", icon: Building2, permission: "VIEW_BRANCHES" },
  ];

  const procurementLinks = [
    { href: "/procurement/suppliers", label: "Suppliers", icon: Building2 },
    { href: "/procurement/purchase-orders", label: "Purchase Orders", icon: FileText },
    { href: "/procurement/grn", label: "Goods Received", icon: ClipboardCheck },
  ];

  // Filter nav links based on permissions
  const navLinks = allNavLinks.filter(link => 
    hasPermission(userRole, link.permission as Parameters<typeof hasPermission>[1])
  );

  const canViewProcurement = hasPermission(userRole, "VIEW_PURCHASE_ORDERS");
  const isProcurementActive = pathname.startsWith("/procurement");
  const isUsersActive = pathname === "/users";

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
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Pill className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="font-bold text-xl text-gray-900">
                DawaCare
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}

              {/* Procurement Dropdown - only show if user has permission */}
              {canViewProcurement && (
                <div className="relative" ref={procurementRef}>
                  <button
                    onClick={() => setProcurementOpen(!procurementOpen)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isProcurementActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    Procurement
                    <ChevronDown className={`w-4 h-4 transition-transform ${procurementOpen ? "rotate-180" : ""}`} />
                  </button>
                  {procurementOpen && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      {procurementLinks.map((link) => {
                        const Icon = link.icon;
                        const isActive = pathname === link.href;
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setProcurementOpen(false)}
                            className={`flex items-center gap-2 px-4 py-2 transition-colors ${
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
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Branch Switcher - Admin Only */}
            {isAdmin && branches.length > 0 && (
              <div className="relative" ref={branchRef}>
                <button
                  onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Building2 className="w-4 h-4" />
                  <span className="hidden md:inline">
                    {viewAllBranches ? "All Branches" : selectedBranch?.name || "Select Branch"}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${branchDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {branchDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <button
                      onClick={() => {
                        setViewAllBranches(true);
                        setBranchDropdownOpen(false);
                      }}
                      className={`flex items-center gap-2 w-full px-4 py-2 text-left transition-colors ${
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
                        className={`flex items-center gap-2 w-full px-4 py-2 text-left transition-colors ${
                          !viewAllBranches && selectedBranch?.id === branch.id
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                        {branch.name}
                        <span className="text-xs text-gray-400">({branch.code})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Non-admin branch display */}
            {!isAdmin && selectedBranch && (
              <Badge variant="outline" className="hidden sm:flex items-center gap-1 border-blue-500 text-blue-700">
                <Building2 className="w-3 h-3" />
                {selectedBranch.name}
              </Badge>
            )}

            <div className="hidden sm:flex items-center gap-2">
              <Badge className={`${getRoleBadgeColor(userRole)} flex items-center gap-1`}>
                <Shield className="w-3 h-3" />
                {userRole || "User"}
              </Badge>
              <span className="text-sm text-gray-600">{session?.user?.email}</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className="md:hidden border-t border-gray-200 px-4 py-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                  isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
          {canViewProcurement && (
            <Link
              href="/procurement/suppliers"
              className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                isProcurementActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Truck className="w-4 h-4" />
              Procurement
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
