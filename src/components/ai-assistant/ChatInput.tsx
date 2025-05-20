
import React, { useRef } from "react";
import { Menu, Send, Loader2, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";

interface ChatInputProps {
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  handleSendMessage: () => void;
  isSending: boolean;
  isTyping: boolean;
  user: any;
  onOpenLeftDrawer: () => void;
  onOpenRightDrawer: () => void;
  language: string;
  theme: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  setInputValue,
  handleSendMessage,
  isSending,
  isTyping,
  user,
  onOpenLeftDrawer,
  onOpenRightDrawer,
  language,
  theme
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className="py-3 px-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky bottom-0 left-0 right-0 w-full z-10 shadow-lg pb-20"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-2 max-w-md mx-auto">
        {/* Left Menu Button (Hamburger) */}
        <Button
          size="icon"
          variant="outline"
          onClick={onOpenLeftDrawer}
          className="h-10 w-10 rounded-full flex-shrink-0"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Input Box */}
        <div className="flex-1">
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-300 dark:border-zinc-700">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={t("typeMessage" as TranslationKey, language)}
              className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-4 pr-1 h-10 rounded-full"
              disabled={isSending || !user}
            />
            <div className="flex items-center px-1">
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isSending || !user}
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-full"
                type="submit"
              >
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
          {!user && (
            <p className="text-xs text-center mt-1 text-muted-foreground">
              {t("loginToChat" as TranslationKey, language)}
            </p>
          )}
        </div>

        {/* Right Menu Button (Settings/Tools) */}
        <Button
          size="icon"
          variant="outline"
          onClick={onOpenRightDrawer}
          className="h-10 w-10 rounded-full flex-shrink-0"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
