
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
import { toast } from "sonner";
import { MessageSquare, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBlockStatus, unblockContact } from "@/services/contactsService";

interface ConversationViewProps {
  conversationId: string;
  onBack: () => void;
}

export function ConversationView({ conversationId, onBack }: ConversationViewProps) {
  const { language } = useTheme();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [blockStatus, setBlockStatus] = useState<{
    isBlocked: boolean;
    isBlockedBy: boolean;
  }>({ isBlocked: false, isBlockedBy: false });
  
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

  // Check if the other participant is blocked
  useEffect(() => {
    async function checkBlockStatus() {
      if (conversation && conversation.participants) {
        // Find participant who is not current user
        const otherParticipant = conversation.participants.find(
          p => p.user_id !== currentUserId
        );
        
        if (otherParticipant) {
          try {
            const status = await getBlockStatus(otherParticipant.user_id);
            setBlockStatus(status);
          } catch (error) {
            console.error("Error checking block status:", error);
          }
        }
      }
    }
    
    if (currentUserId && conversation) {
      checkBlockStatus();
    }
  }, [conversation, currentUserId]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: any) => sendMessage(conversationId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast.error(t("errorSendingMessage", language));
    }
  });

  // Unblock contact mutation
  const unblockMutation = useMutation({
    mutationFn: (contactId: string) => unblockContact(contactId),
    onSuccess: () => {
      // Refetch conversations and block status
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['blockedContacts'] });
      
      setBlockStatus(prev => ({ ...prev, isBlocked: false }));
      toast.success(t("contactUnblocked", language));
    },
    onError: (error) => {
      console.error("Error unblocking contact:", error);
      toast.error(t("errorUnblockingContact", language));
    }
  });

  // Handle unblock contact
  const handleUnblock = async () => {
    if (conversation && conversation.participants) {
      // Find participant who is not current user
      const otherParticipant = conversation.participants.find(
        p => p.user_id !== currentUserId
      );
      
      if (otherParticipant) {
        unblockMutation.mutate(otherParticipant.user_id);
      }
    }
  };

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

  // Check if messaging is blocked
  const isMessagingBlocked = blockStatus.isBlocked || blockStatus.isBlockedBy;

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
            <div className="flex flex-col justify-center items-center h-64 px-4 text-center">
              <MessageSquare className="h-16 w-16 opacity-20 mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">{t("startConversation", language)}</p>
              <p className="text-sm text-muted-foreground">{t("sayHelloPrompt", language)}</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Input Area - Now positioned at bottom with absolute positioning */}
      <div className="w-full bottom-0 left-0 right-0 bg-background z-10">
        {isMessagingBlocked ? (
          <div className="p-4 text-center border-t border-border bg-muted">
            {blockStatus.isBlocked ? (
              <>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-muted-foreground">
                    {t("contactBlocked", language)}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleUnblock}
                  disabled={unblockMutation.isPending}
                  className="px-4 py-2 text-sm"
                >
                  {unblockMutation.isPending ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : null}
                  {t("unblockContact", language)}
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-4 w-4 text-destructive" />
                <p className="text-sm text-muted-foreground">
                  {t("blockedByContact", language)}
                </p>
              </div>
            )}
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
