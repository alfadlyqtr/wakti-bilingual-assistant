
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, Zap, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ChatMessage, ActionButton } from "./types";

interface AIMessageBubbleProps {
  message: ChatMessage;
  onActionClick: (action: ActionButton) => void;
  language: "en" | "ar";
  user: any;
}

export function AIMessageBubble({ message, onActionClick, language, user }: AIMessageBubbleProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <Avatar className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0">
          <AvatarFallback className="bg-transparent text-white text-xs font-bold">
            <Bot className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={`max-w-[70%] ${isUser ? 'order-2' : ''}`}>
        <Card className={`${
          isUser 
            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-lg' 
            : 'bg-muted/50 backdrop-blur-sm border-2'
        } transition-all duration-200 hover:shadow-md`}>
          <CardContent className="p-3">
            {/* Message Content */}
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
            
            {/* Auto-execution indicator */}
            {message.autoExecuted && (
              <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
                <CheckCircle className="w-3 h-3" />
                {language === 'ar' ? 'تم التنفيذ تلقائياً' : 'Auto-executed'}
              </div>
            )}
            
            {/* Image display */}
            {message.imageUrl && (
              <div className="mt-3">
                <img 
                  src={message.imageUrl} 
                  alt="Generated content"
                  className="rounded-lg max-w-full h-auto shadow-lg border-2 border-white/20"
                />
              </div>
            )}
            
            {/* Enhanced Action buttons */}
            {message.actions && message.actions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {message.actions.map((action) => (
                  <Button
                    key={action.id}
                    size="sm"
                    variant={action.variant || "secondary"}
                    onClick={() => onActionClick(action)}
                    className="text-xs h-7 bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200"
                  >
                    {action.autoTrigger && <Zap className="w-3 h-3 mr-1" />}
                    {action.text}
                  </Button>
                ))}
              </div>
            )}
            
            {/* Metadata display for AI responses */}
            {!isUser && message.metadata && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                {message.metadata.provider && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {message.metadata.provider}
                  </span>
                )}
                {message.metadata.confidence && (
                  <span>
                    {Math.round(message.metadata.confidence * 100)}% confidence
                  </span>
                )}
                {message.metadata.executionTime && (
                  <span>
                    {message.metadata.executionTime}ms
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1 px-2">
          {format(message.timestamp, 'HH:mm')}
        </p>
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 bg-gradient-to-br from-green-500 to-blue-500 flex-shrink-0">
          <AvatarFallback className="bg-transparent text-white text-xs font-bold">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
