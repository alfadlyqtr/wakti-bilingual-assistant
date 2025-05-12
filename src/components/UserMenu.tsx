
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Settings, MessageSquare, Users, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

interface UserMenuProps {
  userImage?: string;
  userName?: string;
}

export function UserMenu({ userImage, userName = "User" }: UserMenuProps) {
  const navigate = useNavigate();
  const { theme, language, toggleTheme, toggleLanguage } = useTheme();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    // Will implement with Supabase later
    navigate("/");
    setOpen(false);
  };
  
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={userImage} alt={userName} />
            <AvatarFallback className="text-xs">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>{t("settings", language)}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/messages")}>
          <MessageSquare className="mr-2 h-4 w-4" />
          <span>{t("messaging", language)}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/contacts")}>
          <Users className="mr-2 h-4 w-4" />
          <span>{t("contacts", language)}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleTheme}>
          {theme === "dark" ? (
            <span>{t("lightMode", language)}</span>
          ) : (
            <span>{t("darkMode", language)}</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleLanguage}>
          <span>{t("language", language)}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t("logout", language)}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
