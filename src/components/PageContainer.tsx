
import { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

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
  title = "WAKTI",
  showBackButton = false,
  showUserMenu = true,
  showHeader = true
}: PageContainerProps) {
  const { language } = useTheme();
  
  return (
    <div className="mobile-container">
      {showHeader && (
        <AppHeader 
          title={title ? t(title as any, language) : "WAKTI"}
          showBackButton={showBackButton}
          showUserMenu={showUserMenu}
        />
      )}
      <div className="flex-1 overflow-y-auto pb-24">
        {children}
      </div>
    </div>
  );
}
