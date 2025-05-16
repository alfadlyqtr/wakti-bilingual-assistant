
import { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";

/**
 * @deprecated Direct usage of MobileHeader is deprecated. 
 * The AppLayout component in App.tsx now provides header functionality.
 * Use AppHeader directly if needed for special cases.
 */
interface MobileHeaderProps {
  title: string;
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
