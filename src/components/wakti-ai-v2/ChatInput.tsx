
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Mic, Send, Loader2, Trash2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
}

export function ChatInput({
  message,
  setMessage,
  isLoading,
  sessionMessages,
  onSendMessage,
  onClearChat
}: ChatInputProps) {
  const { language } = useTheme();

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <>
      {/* Clear Chat Button */}
      {sessionMessages.length > 0 && (
        <div className="px-6 py-2 border-b border-border/30">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearChat}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {language === 'ar' ? 'مسح المحادثة' : 'Clear Chat'}
            </Button>
          </div>
        </div>
      )}

      {/* Modern Chat Input Area */}
      <div className="p-4 bg-background border-t">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3">
            {/* Upload Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-muted"
            >
              <Upload className="h-5 w-5" />
            </Button>

            {/* Input Container */}
            <div className="flex-1 relative">
              <div className="flex items-end bg-muted/50 rounded-2xl border border-border/30 overflow-hidden">
                {/* Mic Button (when input is empty) */}
                {!message.trim() && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 m-1 rounded-xl hover:bg-background/80"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                )}

                {/* Text Input */}
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    language === 'ar' ? 'اكتب رسالتك...' : 'Type a message...'
                  }
                  rows={1}
                  className="flex-1 border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 py-3 px-3 max-h-24 overflow-y-auto"
                  style={{ minHeight: '40px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />

                {/* Send Button (when there's text) */}
                {message.trim() && (
                  <Button
                    onClick={handleSend}
                    disabled={isLoading}
                    className="h-8 w-8 m-2 rounded-full p-0"
                    size="icon"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
