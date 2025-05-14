
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import { Logo3D } from "@/components/Logo3D";

interface MobileHeaderProps {
  title: string;
  showBackButton?: boolean;
  showUserMenu?: boolean;
  onBackClick?: () => void;
  children?: ReactNode;
}

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

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  return (
    <div className="mobile-header sticky top-0 z-20">
      <div className="flex items-center">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackClick}
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Logo3D size="sm" onClick={handleLogoClick} className="mr-3" />
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      {children ? (
        children
      ) : (
        showUserMenu && <UserMenu />
      )}
    </div>
  );
}
