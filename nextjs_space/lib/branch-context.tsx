"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface BranchContextType {
  selectedBranchId: string | null;
  selectedBranch: Branch | null;
  branches: Branch[];
  setSelectedBranchId: (id: string | null) => void;
  isAdmin: boolean;
  viewAllBranches: boolean;
  setViewAllBranches: (value: boolean) => void;
  loading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession() || {};
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [viewAllBranches, setViewAllBranches] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = session?.user?.role === "ADMIN";
  const userBranchId = session?.user?.branchId;

  // Fetch branches only when authenticated
  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    
    const fetchBranches = async () => {
      try {
        const response = await fetch("/api/branches?all=true");
        if (response.ok) {
          const data = await response.json();
          setBranches(data.branches || []);
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBranches();
  }, [session?.user]);

  // Set default branch based on user's branch or first available
  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      if (userBranchId) {
        setSelectedBranchId(userBranchId);
      } else if (isAdmin && branches.length > 0) {
        // Admins default to main branch or first branch
        const mainBranch = branches.find((b) => b.code === "MAIN");
        setSelectedBranchId(mainBranch?.id || branches[0].id);
      }
    }
  }, [branches, userBranchId, isAdmin, selectedBranchId]);

  // Update selected branch object when ID changes
  useEffect(() => {
    if (selectedBranchId) {
      const branch = branches.find((b) => b.id === selectedBranchId);
      setSelectedBranch(branch || null);
    } else {
      setSelectedBranch(null);
    }
  }, [selectedBranchId, branches]);

  const handleSetSelectedBranchId = useCallback((id: string | null) => {
    setSelectedBranchId(id);
    if (id) {
      setViewAllBranches(false);
    }
  }, []);

  const handleSetViewAllBranches = useCallback((value: boolean) => {
    setViewAllBranches(value);
  }, []);

  return (
    <BranchContext.Provider
      value={{
        selectedBranchId,
        selectedBranch,
        branches,
        setSelectedBranchId: handleSetSelectedBranchId,
        isAdmin,
        viewAllBranches,
        setViewAllBranches: handleSetViewAllBranches,
        loading,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}
