
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Brain } from "lucide-react";

interface AITypingIndicatorProps {
  language: "en" | "ar";
}

export function AITypingIndicator({ language }: AITypingIndicatorProps) {
  return (
    <div className="flex gap-3 justify-start">
      <Avatar className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0">
        <AvatarFallback className="bg-transparent text-white text-xs font-bold">
          <Bot className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>
      <Card className="bg-muted/50 backdrop-blur-sm border-2 border-blue-200/50">
        <CardContent className="p-3">
          <div className="flex items-center space-x-2">
            <Brain className="w-4 h-4 text-blue-500 animate-pulse" />
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {language === 'ar' ? 'جاري التفكير...' : 'Thinking...'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
