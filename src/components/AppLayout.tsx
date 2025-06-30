
import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AppHeader } from "@/components/AppHeader";
import { MobileNav } from "@/components/MobileNav";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 min-h-0">
          {children}
        </div>
        <MobileNav />
      </div>
    </ProtectedRoute>
  );
}
