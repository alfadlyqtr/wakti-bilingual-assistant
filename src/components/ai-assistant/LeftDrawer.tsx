
import React from "react";
import { X, Menu, MessageCircle } from "lucide-react";
import { Button } from "../ui/button";
import { AIMode } from "./types";
import { useToast } from "@/hooks/use-toast";

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
  const drawerClasses = isOpen 
    ? "translate-x-0" 
    : "-translate-x-full";

  return (
    <>
      {/* Overlay when drawer is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}
    
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-900 shadow-lg transform transition-transform duration-300 ease-in-out ${drawerClasses}`}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <div className="flex items-center">
            <MessageCircle className="h-5 w-5 mr-2" />
            <h2 className="text-lg font-semibold">
              {language === "ar" ? "المحادثات السابقة" : "Previous Chats"}
            </h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4 overflow-y-auto h-full pb-20">
          <p className="text-muted-foreground text-sm mb-4">
            {language === "ar"
              ? "ستظهر محادثاتك السابقة هنا"
              : "Your previous conversations will appear here"}
          </p>
          
          {/* Mock chat history items */}
          {[1, 2, 3].map((item) => (
            <div 
              key={item} 
              className="mb-2 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <p className="font-medium truncate">Chat session {item}</p>
              <p className="text-xs text-muted-foreground">Yesterday</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
