
import React from "react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, Camera, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";

interface PlusMenuProps {
  onCamera: () => void;
  onUpload: () => void;
  onOpenConversations: () => void;
  onOpenQuickActions: () => void;
  isLoading?: boolean;
}

export const PlusMenu: React.FC<PlusMenuProps> = ({
  onCamera,
  onUpload,
  onOpenConversations,
  onOpenQuickActions,
  isLoading,
}) => {
  const { language } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-2xl bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 border-0 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-lg flex-shrink-0"
          aria-label={language === "ar" ? "خيارات إضافية" : "More options"}
          disabled={isLoading}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="z-[999] bg-background rounded-xl shadow-2xl border">
        <DropdownMenuItem onClick={onCamera} className="gap-2">
          <Camera className="h-4 w-4" />{language === "ar" ? "التقاط صورة" : "Take Photo"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onUpload} className="gap-2">
          <FileUp className="h-4 w-4" />{language === "ar" ? "رفع ملف" : "Upload File"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenConversations} className="gap-2">
          💬 {language === "ar" ? "المحادثات" : "Conversations"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenQuickActions} className="gap-2">
          ⚡ {language === "ar" ? "إجراءات سريعة" : "Quick Actions"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
