
import { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";

/**
 * @note When using PageContainer inside an AppLayout (from App.tsx),
 * set showHeader to false to prevent duplicate headers
 */
interface PageContainerProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
  showUserMenu?: boolean;
  showHeader?: boolean;
}

export function PageContainer({ 
  children,
  title,
  showBackButton = false,
  showUserMenu = true,
  showHeader = true
}: PageContainerProps) {
  
  return (
    <div className="min-h-screen bg-background">
      {showHeader && (
        <AppHeader />
      )}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
