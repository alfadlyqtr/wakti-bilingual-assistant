
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

/**
 * @deprecated Direct usage of MobileHeader is deprecated. 
 * The AppLayout component in App.tsx now provides header functionality.
 * Use AppHeader directly if needed for special cases.
 */
interface MobileHeaderProps {
  title?: string;
  showBackButton?: boolean;
  showUserMenu?: boolean;
  onBackClick?: () => void;
  children?: ReactNode;
}

/**
 * @deprecated Direct usage of MobileHeader is deprecated.
 * The AppLayout component in App.tsx now provides header functionality.
 * Use AppHeader directly if needed for special cases.
 */
export function MobileHeader({
  title,
  showBackButton = false,
  showUserMenu = true,
  onBackClick,
  children,
}: MobileHeaderProps) {
  const navigate = useNavigate();
  
  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(-1);
    }
  };
  
  return (
    <div className="bg-background border-b sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between py-4">
        {showBackButton && (
          <Button variant="ghost" size="icon" onClick={handleBackClick} className="mr-2">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        
        <div className="flex-1">
          {title && <h1 className="text-lg font-semibold">{title}</h1>}
        </div>
        
        {children}
      </div>
    </div>
  );
}
