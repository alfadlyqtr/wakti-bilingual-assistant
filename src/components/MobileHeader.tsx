
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";

interface MobileHeaderProps {
  title: string;
  showBackButton?: boolean;
  showUserMenu?: boolean;
  onBackClick?: () => void;
}

export function MobileHeader({
  title,
  showBackButton = false,
  showUserMenu = true,
  onBackClick,
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
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      {showUserMenu && <UserMenu />}
    </div>
  );
}
