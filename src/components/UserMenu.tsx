import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LogOut, MessageCircle, 
  Users, User as UserIcon, ChevronDown 
} from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { t } from "@/utils/translations";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { language } = useTheme();
  const { user, signOut } = useAuth();

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
  
  // Check if user has a profile picture
  const hasProfilePicture = !!user?.user_metadata?.avatar_url;

  // User menu options - removed Settings from here
  const menuOptions = [
    { icon: <MessageCircle size={16} />, label: t("messages", language), path: "/messages" },
    { icon: <Users size={16} />, label: t("contacts", language), path: "/contacts" },
    { icon: <UserIcon size={16} />, label: t("account", language), path: "/account" },
    { divider: true },
    { icon: <LogOut size={16} />, label: t("logout", language), action: handleLogout },
  ];

  return (
    <div className="relative z-50">
      <button 
        onClick={toggleMenu}
        className="flex items-center space-x-1 bg-muted/40 hover:bg-muted/60 px-2 py-1 rounded-full transition-colors"
      >
        <Avatar className="h-6 w-6">
          <AvatarImage 
            src={user?.user_metadata?.avatar_url || ''} 
            alt={displayName}
          />
          <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
        </Avatar>
        <span className="text-sm max-w-[70px] truncate">{displayName}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for closing menu when clicked outside */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={closeMenu}
            />
            
            {/* User menu dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-1 w-48 bg-background border border-border rounded-md shadow-lg overflow-hidden z-50"
            >
              <div className="py-2 px-3 border-b border-border">
                <div className="flex items-center space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={user?.user_metadata?.avatar_url || ''} 
                      alt={displayName}
                    />
                    <AvatarFallback>{getInitials()}</AvatarFallback>
                  </Avatar>
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
