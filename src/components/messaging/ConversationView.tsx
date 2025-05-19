
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { MessageInputBar } from "./MessageInputBar";
import { getMessages, getConversationById, sendMessage } from "@/services/messageService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingSpinner } from "@/components/ui/loading";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ConversationViewProps {
  conversationId: string;
  onBack: () => void;
}

export function ConversationView({ conversationId, onBack }: ConversationViewProps) {
  const { language } = useTheme();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Get current user ID
  useEffect(() => {
    async function getUserId() {
      const { data } = await supabase.auth.getSession();
      setCurrentUserId(data.session?.user.id || null);
    }
    getUserId();
  }, []);
  
  // Get conversation details
  const { data: conversation, isLoading: isLoadingConversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversationById(conversationId),
  });
  
  // Get messages for this conversation
  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => getMessages(conversationId),
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: any) => sendMessage(conversationId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast({
        title: t("error", language),
        description: t("errorSendingMessage", language),
        variant: "destructive"
      });
    }
  });

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          // Refetch messages when new message is inserted
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current && messages) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  // Send a new message
  const handleSendMessage = (messageData: any) => {
    sendMessageMutation.mutate(messageData);
  };

  // Group messages by date
  const groupedByDate = (messages || []).reduce((acc: any, message) => {
    const date = new Date(message.created_at);
    const dateStr = date.toDateString();
    
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    
    acc[dateStr].push(message);
    return acc;
  }, {});

  // Format date for iOS Messages style timestamp displays
  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
      return t("today", language);
    }
    
    return date.toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  };

  if (isLoadingConversation || isLoadingMessages) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-muted-foreground">{t("loadingMessages", language)}</p>
      </div>
    );
  }

  // Check if user is blocked
  const isBlocked = false; // We need to implement this with the contacts API

  // Get other participant display info
  const getOtherParticipantName = () => {
    if (!conversation || !conversation.participants) return "";
    
    const otherParticipants = conversation.participants.filter(
      (p: any) => p.user_id !== currentUserId
    );
    
    if (otherParticipants.length === 0) return "";
    
    const profile = otherParticipants[0].profile || {};
    return ((profile as any).display_name as string) || ((profile as any).username as string) || "";
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Messages area with reduced bottom padding to make room for input */}
      <ScrollArea 
        className="flex-1 pb-2"
        ref={scrollAreaRef}
      >
        <div className="py-4 pb-6">
          {Object.entries(groupedByDate).map(([date, dateMessages]: [string, any]) => (
            <div key={date} className="mb-4">
              <div className="flex justify-center mb-4">
                <div className="text-center text-xs text-muted-foreground">
                  {formatDateHeader(date)}
                </div>
              </div>
              
              <div className="space-y-2 px-4">
                {dateMessages.map((message: any) => (
                  <MessageBubble 
                    key={message.id}
                    message={message}
                    isSelf={message.sender_id === currentUserId}
                    contactName={getOtherParticipantName()}
                  />
                ))}
              </div>
            </div>
          ))}

          {(!messages || messages.length === 0) && (
            <div className="flex justify-center items-center h-32">
              <p className="text-muted-foreground">{t("startConversation", language)}</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Input Area - Now positioned at bottom with absolute positioning */}
      <div className="w-full bottom-0 left-0 right-0 bg-background z-10">
        {isBlocked ? (
          <div className="p-4 text-center border-t border-border bg-muted">
            <p className="text-sm text-muted-foreground mb-2">
              {t("contactBlocked", language)}
            </p>
            <button className="px-4 py-2 bg-transparent text-blue-500 border border-blue-500 rounded-full text-sm">
              {t("unblockContact", language)}
            </button>
          </div>
        ) : (
          <MessageInputBar 
            onSendMessage={handleSendMessage} 
            isSubmitting={sendMessageMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}
