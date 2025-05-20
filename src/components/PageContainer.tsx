
import { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  enableScroll?: boolean;
}

export function PageContainer({ 
  children,
  title = "WAKTI",
  showBackButton = false,
  showUserMenu = true,
  showHeader = true,
  enableScroll = true
}: PageContainerProps) {
  const { language } = useTheme();
  
  return (
    <div className="flex flex-col flex-1 h-full w-full">
      {showHeader && (
        <AppHeader 
          title={title ? t(title as any, language) : "WAKTI"}
          showBackButton={showBackButton}
          showUserMenu={showUserMenu}
        />
      )}
      {enableScroll ? (
        <ScrollArea className="flex-1 h-[calc(100%-4rem)] pb-24">
          {children}
        </ScrollArea>
      ) : (
        <div className="flex-1 overflow-y-auto pb-24">
          {children}
        </div>
      )}
    </div>
  );
}
