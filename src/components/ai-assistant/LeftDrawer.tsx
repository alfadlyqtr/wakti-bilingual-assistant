import React from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { AIMode } from "./types";
import { toast } from "@/hooks/use-toast"; // Fixed import

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: AIMode;
  language: string;
}

export const LeftDrawer: React.FC<LeftDrawerProps> = ({
  isOpen,
  onClose,
  activeMode,
  language,
}) => {
  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-900 shadow-lg transform transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {language === "ar" ? "المحادثات السابقة" : "Previous Chats"}
        </h2>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="p-4">
        <p className="text-muted-foreground text-sm">
          {language === "ar"
            ? "ستظهر محادثاتك السابقة هنا"
            : "Your previous conversations will appear here"}
        </p>
      </div>
    </div>
  );
};
