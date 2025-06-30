
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
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="pb-16">
          {children}
        </main>
        <MobileNav />
      </div>
    </ProtectedRoute>
  );
}
