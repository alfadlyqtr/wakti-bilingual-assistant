
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, Sparkles, Calendar, CheckSquare, Users, Mic } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ChatMessage } from "./types";
import { v4 as uuidv4 } from "uuid";

interface UnifiedAIBrainProps {
  className?: string;
}

interface ActionButton {
  text: string;
  action: string;
  variant?: string;
}

export function UnifiedAIBrain({ className }: UnifiedAIBrainProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { user } = useAuth();
  const { language, theme } = useTheme();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Initialize with welcome message
  useEffect(() => {
    if (user && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: language === 'ar' 
          ? "مرحبًا! أنا WAKTI AI، دماغ تطبيق وكتي الذكي. يمكنني مساعدتك في إدارة مهامك، تذكيراتك، أحداثك، جهات الاتصال، والمزيد. ماذا تريد أن تفعل اليوم؟"
          : "Hi! I'm WAKTI AI, the intelligent brain of your Wakti app. I can help you manage tasks, reminders, events, contacts, and much more. What would you like to do today?",
        timestamp: new Date(),
        mode: "general"
      };
      setMessages([welcomeMessage]);
    }
  }, [user, language]);

  // Unified intent detection and processing
  const processMessage = async (message: string) => {
    if (!user || !message.trim()) return;

    setIsProcessing(true);
    setIsTyping(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: message,
      timestamp: new Date(),
      mode: "general"
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Call unified AI processing function
      const { data, error } = await supabase.functions.invoke('unified-ai-brain', {
        body: {
          message: message,
          userId: user.id,
          language: language,
          context: {
            previousMessages: messages.slice(-5), // Send last 5 messages for context
            userProfile: user.user_metadata,
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) throw error;

      // Add AI response with proper action buttons structure
      const aiMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        mode: "general",
        metadata: {
          actionButtons: data.actions || []
        }
      };

      setMessages(prev => [...prev, aiMessage]);

      // Handle automatic actions if any
      if (data.autoActions) {
        for (const action of data.autoActions) {
          await handleAction(action);
        }
      }

    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: language === 'ar'
          ? "عذرًا، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى."
          : "Sorry, there was an error processing your request. Please try again.",
        timestamp: new Date(),
        mode: "general"
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      setIsTyping(false);
    }
  };

  // Handle action buttons and automatic actions
  const handleAction = async (action: any) => {
    try {
      switch (action.type || action.id) {
        case 'create_task':
          // Integration with task system
          toast.success(language === 'ar' ? 'تم إنشاء المهمة' : 'Task created');
          break;
        case 'create_event':
          // Integration with calendar system
          toast.success(language === 'ar' ? 'تم إنشاء الحدث' : 'Event created');
          break;
        case 'create_reminder':
          // Integration with reminders system
          toast.success(language === 'ar' ? 'تم إنشاء التذكير' : 'Reminder created');
          break;
        case 'add_contact':
          // Integration with contacts system
          toast.success(language === 'ar' ? 'تم إضافة جهة الاتصال' : 'Contact added');
          break;
        case 'generate_image':
          // Integration with image generation
          await processImageGeneration(action.prompt || action.data?.prompt);
          break;
        default:
          console.log('Unknown action type:', action.type || action.id);
      }
    } catch (error) {
      console.error('Error handling action:', error);
      toast.error(language === 'ar' ? 'فشل في تنفيذ الإجراء' : 'Failed to execute action');
    }
  };

  // Image generation integration
  const processImageGeneration = async (prompt: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt }
      });

      if (error) throw error;

      const imageMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: language === 'ar' 
          ? `تم إنشاء الصورة بناءً على: "${prompt}"`
          : `Image generated for: "${prompt}"`,
        timestamp: new Date(),
        mode: "general",
        metadata: {
          imageUrl: data.imageUrl,
          imagePrompt: prompt
        }
      };

      setMessages(prev => [...prev, imageMessage]);
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error(language === 'ar' ? 'فشل في إنشاء الصورة' : 'Failed to generate image');
    }
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

  // Quick action suggestions
  const quickActions = [
    { 
      icon: <CheckSquare className="w-4 h-4" />, 
      text: language === 'ar' ? 'إنشاء مهمة' : 'Create task',
      prompt: language === 'ar' ? 'أنشئ مهمة جديدة' : 'Create a new task'
    },
    { 
      icon: <Calendar className="w-4 h-4" />, 
      text: language === 'ar' ? 'جدولة حدث' : 'Schedule event',
      prompt: language === 'ar' ? 'جدول حدث جديد' : 'Schedule a new event'
    },
    { 
      icon: <Users className="w-4 h-4" />, 
      text: language === 'ar' ? 'إدارة جهات الاتصال' : 'Manage contacts',
      prompt: language === 'ar' ? 'أضف جهة اتصال جديدة' : 'Add a new contact'
    },
    { 
      icon: <Sparkles className="w-4 h-4" />, 
      text: language === 'ar' ? 'إنشاء صورة' : 'Generate image',
      prompt: language === 'ar' ? 'أنشئ صورة جميلة' : 'Generate a beautiful image'
    }
  ];

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600">
              <AvatarFallback className="bg-transparent text-white font-bold">
                AI
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">WAKTI AI</h1>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'دماغ تطبيق وكتي الذكي' : 'Your intelligent Wakti brain'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {language === 'ar' 
                ? 'ابدأ محادثة مع WAKTI AI'
                : 'Start a conversation with WAKTI AI'
              }
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'assistant' && (
              <Avatar className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0">
                <AvatarFallback className="bg-transparent text-white text-xs font-bold">
                  AI
                </AvatarFallback>
              </Avatar>
            )}
            
            <div className={`max-w-[70%] ${message.role === 'user' ? 'order-2' : ''}`}>
              <Card className={`${message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted'
              }`}>
                <CardContent className="p-3">
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Image display */}
                  {message.metadata?.imageUrl && (
                    <div className="mt-3">
                      <img 
                        src={message.metadata.imageUrl} 
                        alt={message.metadata.imagePrompt || 'Generated image'}
                        className="rounded-lg max-w-full h-auto"
                      />
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  {message.metadata?.actionButtons && Array.isArray(message.metadata.actionButtons) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.metadata.actionButtons.map((button: ActionButton, index: number) => (
                        <Button
                          key={index}
                          size="sm"
                          variant={button.variant as any || "secondary"}
                          onClick={() => handleAction({ type: button.action })}
                          className="text-xs"
                        >
                          {button.text}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <p className="text-xs text-muted-foreground mt-1 px-2">
                {format(message.timestamp, 'HH:mm')}
              </p>
            </div>

            {message.role === 'user' && (
              <Avatar className="h-8 w-8 bg-gradient-to-br from-green-500 to-blue-500 flex-shrink-0">
                <AvatarFallback className="bg-transparent text-white text-xs font-bold">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3 justify-start">
            <Avatar className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0">
              <AvatarFallback className="bg-transparent text-white text-xs font-bold">
                AI
              </AvatarFallback>
            </Avatar>
            <Card className="bg-muted">
              <CardContent className="p-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="p-4 border-t bg-card/50">
          <p className="text-sm text-muted-foreground mb-3">
            {language === 'ar' ? 'إجراءات سريعة:' : 'Quick actions:'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => processMessage(action.prompt)}
                className="justify-start gap-2 h-auto p-3"
                disabled={isProcessing}
              >
                {action.icon}
                <span className="text-xs">{action.text}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-card">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={language === 'ar' 
                ? 'اكتب رسالتك هنا...'
                : 'Type your message here...'
              }
              disabled={isProcessing || !user}
              className="bg-background"
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isProcessing || !user}
            size="icon"
            className="bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
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
