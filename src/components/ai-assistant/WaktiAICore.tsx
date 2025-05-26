
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, Sparkles, Mic, Wand2, Bot, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { ChatMessage, ActionButton, AIContext, IntentResult } from "./types";
import { AIMessageBubble } from "./AIMessageBubble";
import { QuickActions } from "./QuickActions";
import { AITypingIndicator } from "./AITypingIndicator";

interface WaktiAICoreProps {
  className?: string;
}

export function WaktiAICore({ className }: WaktiAICoreProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [context, setContext] = useState<AIContext>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const { language, theme } = useTheme();

  // Auto-scroll to bottom with smooth animation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Initialize with enhanced welcome message
  useEffect(() => {
    if (user && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: language === 'ar' 
          ? "مرحبًا! أنا WAKTI AI 🚀 - دماغ تطبيقك الذكي والمتطور. يمكنني مساعدتك في إنشاء المهام، جدولة الأحداث، إضافة جهات الاتصال، إنشاء الصور، والكثير أكثر. أخبرني، ماذا تريد أن نفعل معًا اليوم؟"
          : "Hello! I'm WAKTI AI 🚀 - your intelligent app brain. I can help you create tasks, schedule events, add contacts, generate images, and so much more. What would you like to accomplish together today?",
        timestamp: new Date(),
        type: 'text',
        metadata: {
          provider: 'system'
        }
      };
      setMessages([welcomeMessage]);
      updateContext();
    }
  }, [user, language]);

  // Update context for smarter responses
  const updateContext = useCallback(async () => {
    if (!user) return;

    try {
      // Get current app state for context
      const currentPage = window.location.pathname;
      
      // This would fetch actual counts in a real implementation
      const newContext: AIContext = {
        currentPage,
        recentActions: [], // Would be populated from recent user actions
        userPreferences: user.user_metadata || {},
        taskCount: 0, // Would fetch from database
        eventCount: 0, // Would fetch from database
        reminderCount: 0, // Would fetch from database
        lastInteraction: new Date()
      };

      setContext(newContext);
    } catch (error) {
      console.error('Error updating context:', error);
    }
  }, [user]);

  // Enhanced AI processing with smart intent detection
  const processMessage = async (message: string) => {
    if (!user || !message.trim()) return;

    setIsProcessing(true);
    setIsTyping(true);

    // Add user message with enhanced metadata
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: message,
      timestamp: new Date(),
      type: 'text'
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Call enhanced unified AI brain
      const { data, error } = await supabase.functions.invoke('unified-ai-brain', {
        body: {
          message: message,
          userId: user.id,
          language: language,
          context: {
            ...context,
            previousMessages: messages.slice(-5), // Last 5 messages for context
            userProfile: user.user_metadata,
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) throw error;

      // Create enhanced AI response
      const aiMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        type: data.type || 'text',
        imageUrl: data.imageUrl,
        actions: data.actions || [],
        autoExecuted: data.autoActions?.length > 0,
        metadata: {
          intent: data.intent,
          confidence: data.confidence,
          executionTime: Date.now(),
          provider: data.provider || 'deepseek'
        }
      };

      setMessages(prev => [...prev, aiMessage]);

      // Auto-execute high-confidence actions
      if (data.autoActions && data.autoActions.length > 0) {
        for (const action of data.autoActions) {
          await executeAction(action, true);
        }
      }

      // Show success animation for auto-executed actions
      if (data.autoActions?.length > 0) {
        toast.success(
          language === 'ar' 
            ? '✨ تم تنفيذ الإجراء تلقائياً!' 
            : '✨ Action executed automatically!',
          {
            duration: 2000,
            className: "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
          }
        );
      }

    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: language === 'ar'
          ? "عذرًا، حدث خطأ أثناء معالجة طلبك. دعني أحاول مرة أخرى..."
          : "Sorry, there was an error processing your request. Let me try again...",
        timestamp: new Date(),
        type: 'text',
        metadata: {
          provider: 'error'
        }
      };
      setMessages(prev => [...prev, errorMessage]);
      toast.error(language === 'ar' ? 'حدث خطأ في النظام' : 'System error occurred');
    } finally {
      setIsProcessing(false);
      setIsTyping(false);
      updateContext();
    }
  };

  // Enhanced action execution with feedback
  const executeAction = async (action: any, autoExecuted = false) => {
    try {
      const startTime = Date.now();

      const { data, error } = await supabase.functions.invoke('wakti-execute-action', {
        body: {
          action: action,
          userId: user?.id,
          language: language,
          autoExecuted: autoExecuted
        }
      });

      if (error) throw error;

      const executionTime = Date.now() - startTime;

      if (data.success) {
        const successMessage = data.message || (
          language === 'ar' ? 'تم التنفيذ بنجاح!' : 'Successfully executed!'
        );

        if (!autoExecuted) {
          toast.success(successMessage, {
            duration: 3000,
            className: "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
          });
        }
        
        // Add confirmation message for manual actions
        if (!autoExecuted) {
          const confirmationMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: `✅ ${successMessage} ${language === 'ar' ? `(${executionTime}ms)` : `(${executionTime}ms)`}`,
            timestamp: new Date(),
            type: 'text',
            metadata: {
              executionTime,
              provider: 'system'
            }
          };
          setMessages(prev => [...prev, confirmationMessage]);
        }
      }
    } catch (error) {
      console.error('Error executing action:', error);
      toast.error(
        language === 'ar' 
          ? 'فشل في تنفيذ الإجراء' 
          : 'Failed to execute action'
      );
    }
  };

  // Enhanced voice input processing
  const startVoiceInput = async () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error(
        language === 'ar' 
          ? 'المتصفح لا يدعم التعرف على الصوت'
          : 'Browser does not support voice recognition'
      );
      return;
    }

    setIsListening(true);
    
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = language === 'ar' ? 'ar-SA' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error(
        language === 'ar' 
          ? 'خطأ في التعرف على الصوت'
          : 'Voice recognition error'
      );
    };

    recognition.start();
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const message = inputValue;
    setInputValue("");
    await processMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Enhanced Header */}
      <div className="border-b bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <AvatarFallback className="bg-transparent text-white font-bold">
                <Bot className="w-6 h-6" />
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background animate-pulse flex items-center justify-center">
              <Sparkles className="w-2 h-2 text-white" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              WAKTI AI 2.0
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {language === 'ar' ? 'دماغ تطبيقك الذكي' : 'Your intelligent app brain'}
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {messages.map((message) => (
          <AIMessageBubble
            key={message.id}
            message={message}
            onActionClick={(action) => executeAction(action)}
            language={language as "en" | "ar"}
            user={user}
          />
        ))}

        {/* Enhanced Typing Indicator */}
        {isTyping && (
          <AITypingIndicator language={language as "en" | "ar"} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions - Enhanced Design */}
      {messages.length <= 1 && (
        <QuickActions
          onActionClick={(prompt) => processMessage(prompt)}
          isProcessing={isProcessing}
          language={language as "en" | "ar"}
        />
      )}

      {/* Enhanced Input Area */}
      <div className="p-4 border-t bg-card/50 backdrop-blur-sm flex-shrink-0 sticky bottom-0">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={language === 'ar' 
                ? 'اكتب رسالتك هنا... (أو اضغط لاستخدام الصوت)'
                : 'Type your message here... (or press for voice)'
              }
              disabled={isProcessing || !user}
              className="bg-background h-12 text-base pr-12 border-2 focus:border-blue-500 transition-colors"
            />
            <Button
              onClick={startVoiceInput}
              disabled={isProcessing || isListening}
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-10 w-10 text-muted-foreground hover:text-blue-500"
            >
              <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse text-red-500' : ''}`} />
            </Button>
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isProcessing || !user}
            size="icon"
            className="bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-12 w-12 shadow-lg transition-all duration-200"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        
        {!user && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {language === 'ar' 
              ? 'يرجى تسجيل الدخول للمتابعة'
              : 'Please login to continue'
            }
          </p>
        )}
      </div>
    </div>
  );
}
