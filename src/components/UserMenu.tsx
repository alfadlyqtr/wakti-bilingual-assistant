
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings, MessageSquare, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { profile } = useUserProfile();
  const { language } = useTheme();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getUserInitials = () => {
    // Use profile data first, then fallback to user metadata
    const displayName = profile?.display_name || user?.user_metadata?.display_name;
    const email = profile?.email || user?.email;
    const fullName = displayName || email || "";
    
    return fullName
      .split(" ")
      .map(name => name[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Get avatar URL from profile data (not user metadata)
  const avatarUrl = profile?.avatar_url;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {avatarUrl ? (
              <AvatarImage 
                src={avatarUrl} 
                alt={profile?.display_name || user?.user_metadata?.full_name || "User"}
              />
            ) : null}
            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-xs">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            {(profile?.display_name || user?.user_metadata?.full_name) && (
              <p className="font-medium">{profile?.display_name || user?.user_metadata?.full_name}</p>
            )}
            {(profile?.email || user?.email) && (
              <p className="w-[200px] truncate text-sm text-muted-foreground">
                {profile?.email || user?.email}
              </p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>{t("settings", language)}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/contacts")}>
          <MessageSquare className="mr-2 h-4 w-4" />
          <span>{t("contacts", language)}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/contacts")}>
          <Users className="mr-2 h-4 w-4" />
          <span>{t("contacts", language)}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/account")}>
          <User className="mr-2 h-4 w-4" />
          <span>{t("account", language)}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} disabled={isLoggingOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isLoggingOut ? t("loading", language) : t("logout", language)}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
