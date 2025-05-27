
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

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
  const navigate = useNavigate();
  
  return (
    <div className="mobile-container">
      {showHeader && (
        <div className="bg-background border-b sticky top-0 z-50">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          
          <div className="flex-1">
            {title && <h1 className="text-lg font-semibold">{typeof title === 'string' ? t(title as any, language) : "WAKTI"}</h1>}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto scrollbar-hide pb-24">
        {children}
      </div>
    </div>
  );
}
