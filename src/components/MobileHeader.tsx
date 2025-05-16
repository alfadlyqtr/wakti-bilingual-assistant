
import { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";

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
  // Use the new AppHeader component for consistency
  return (
    <AppHeader
      title={title}
      showBackButton={showBackButton}
      showUserMenu={showUserMenu}
      onBackClick={onBackClick}
      children={children}
    />
  );
}
