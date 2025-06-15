import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LogOut, Users, User as UserIcon, ChevronDown, Book
} from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { t } from "@/utils/translations";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { UnreadBadge } from "./UnreadBadge";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { language } = useTheme();
  const { user, signOut } = useAuth();
  const { unreadTotal } = useUnreadMessages();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleMenuItemClick = (path: string) => {
    navigate(path);
    closeMenu();
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success(language === 'en' ? 'You have been logged out successfully' : 'لقد تم تسجيل خروجك بنجاح');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error(language === 'en' ? 'Failed to log out' : 'فشل تسجيل الخروج');
    }
    closeMenu();
  };

  // Shorthand for avatar display name
  const getInitials = () => {
    if (!user) return "?";
    
    const name = user.user_metadata?.full_name || user.email || '';
    if (!name) return "?";
    
    if (name.includes(' ')) {
      const [first, last] = name.split(' ');
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    }
    
    return name.charAt(0).toUpperCase();
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t("user", language);
  
  // Add cache-busting to avatar URL
  const getCacheBustedAvatarUrl = (url: string) => {
    if (!url) return url;
    const timestamp = Date.now();
    return `${url}?t=${timestamp}`;
  };

  const avatarUrl = user?.user_metadata?.avatar_url ? getCacheBustedAvatarUrl(user.user_metadata.avatar_url) : '';

  // Adjusted UnreadBadge sizing for avatar in dropdown
  const dropdownAvatarBadgeSize = "sm"; // Use "sm" but can be increased if needed

  // User menu options with blinking and badge
  const menuOptions = [
    { 
      icon: (
        <span className="relative">
          <Users size={16} />
          <UnreadBadge
            count={unreadTotal}
            size="sm"
            blink={!!unreadTotal}
            className="-right-2 -top-2"
          />
        </span>
      ),
      label: t("contacts", language), 
      path: "/contacts" 
    },
    { icon: <UserIcon size={16} />, label: t("account", language), path: "/account" },
    { icon: <Book size={16} />, label: t("help", language), path: "/help" },
    { divider: true },
    { icon: <LogOut size={16} />, label: t("logout", language), action: handleLogout },
  ];

  return (
    <div className="relative z-50">
      <button 
        onClick={toggleMenu}
        className="flex items-center space-x-1 bg-muted/40 hover:bg-muted/60 px-2 py-1 rounded-full transition-colors relative"
      >
        <span className="relative">
          <Avatar className="h-6 w-6">
            <AvatarImage 
              src={avatarUrl} 
              alt={displayName}
            />
            <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
          </Avatar>
          {/* Header avatar badge, tiny size & offset */}
          <UnreadBadge
            count={unreadTotal}
            size="sm"
            className="-right-1.5 -top-1.5"
          />
        </span>
        <span className="text-sm max-w-[70px] truncate">{displayName}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={closeMenu}
            />
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-1 w-48 bg-background border border-border rounded-md shadow-lg overflow-hidden z-50"
            >
              <div className="py-2 px-3 border-b border-border">
                <div className="flex items-center space-x-2">
                  <span className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={avatarUrl} 
                        alt={displayName}
                      />
                      <AvatarFallback>{getInitials()}</AvatarFallback>
                    </Avatar>
                    {/* Dropdown avatar badge, keep 'sm' but move slightly for more visibility */}
                    <UnreadBadge
                      count={unreadTotal}
                      size={dropdownAvatarBadgeSize}
                      className="-right-1.5 -top-1.5"
                    />
                  </span>
                  <div>
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
              
              <div className="py-1">
                {menuOptions.map((option, i) => (
                  option.divider ? (
                    <div key={`divider-${i}`} className="my-1 border-t border-border" />
                  ) : (
                    <button
                      key={option.label}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center space-x-2"
                      onClick={() => option.action ? option.action() : handleMenuItemClick(option.path)}
                    >
                      <span className="text-muted-foreground">{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  )
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
