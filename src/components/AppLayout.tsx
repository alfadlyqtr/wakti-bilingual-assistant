
import React from "react";
import { AppHeader } from "@/components/AppHeader";
import MobileNav from "@/components/MobileNav";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
