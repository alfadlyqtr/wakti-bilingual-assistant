
import { ReactNode } from "react";
import { MobileHeader } from "@/components/MobileHeader";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

interface PageContainerProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
  showUserMenu?: boolean;
}

export function PageContainer({ 
  children,
  title = "WAKTI",
  showBackButton = false,
  showUserMenu = true
}: PageContainerProps) {
  const { language } = useTheme();
  
  return (
    <div className="mobile-container">
      <MobileHeader 
        title={title ? t(title as any, language) : "WAKTI"}
        showBackButton={showBackButton}
        showUserMenu={showUserMenu}
      />
      <div className="flex-1 overflow-y-auto pb-24">
        {children}
      </div>
      {/* MobileNav is now a global component rendered in App.tsx */}
    </div>
  );
}
