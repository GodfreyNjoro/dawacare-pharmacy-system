"use client";

import { SessionProvider } from "next-auth/react";
import { useState, useEffect, ReactNode } from "react";
import { BranchProvider } from "@/lib/branch-context";

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <SessionProvider>
      <BranchProvider>{children}</BranchProvider>
    </SessionProvider>
  );
}
