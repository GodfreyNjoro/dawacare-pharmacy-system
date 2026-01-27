"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useState, useEffect, ReactNode } from "react";
import { BranchProvider } from "@/lib/branch-context";
import dynamic from "next/dynamic";

// Dynamically import the chatbot to avoid SSR issues
const AIPharmacistChat = dynamic(() => import("@/components/ui/ai-pharmacist-chat"), {
  ssr: false,
});

function ChatWrapper() {
  const { data: session } = useSession() || {};
  
  // Only show chatbot for authenticated users
  if (!session) return null;
  
  return <AIPharmacistChat />;
}

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
      <BranchProvider>
        {children}
        <ChatWrapper />
      </BranchProvider>
    </SessionProvider>
  );
}
