
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { MessageInputBar } from "./MessageInputBar";
import { getMessagesWithContact, markMessagesAsRead, sendMessage, getBlockStatus } from "@/services/directMessageService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unblockContact } from "@/services/contactsService";

interface DirectMessageViewProps {
  contactId: string;
  onBack: () => void;
}

export function DirectMessageView({ contactId, onBack }: DirectMessageViewProps) {
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
  
  // Get contact's profile
  const { data: contactProfile } = useQuery({
    queryKey: ['contactProfile', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", contactId)
        .single();
      return data;
    },
    enabled: !!contactId,
  });
  
  // Get messages for this contact
  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['directMessages', contactId],
    queryFn: () => getMessagesWithContact(contactId),
    refetchInterval: 5000, // Refetch every 5 seconds
    enabled: !!contactId,
  });

  // Check if the contact is blocked
  useEffect(() => {
    async function checkBlockStatus() {
      try {
        const status = await getBlockStatus(contactId);
        setBlockStatus(status);
      } catch (error) {
        console.error("Error checking block status:", error);
      }
    }
    
    if (contactId) {
      checkBlockStatus();
    }
  }, [contactId]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: any) => sendMessage(contactId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contactsWithMessages'] });
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
      // Refetch contacts and block status
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
  const handleUnblock = () => {
    if (contactId) {
      unblockMutation.mutate(contactId);
    }
  };

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('public:direct_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `or(and(sender_id.eq.${currentUserId},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${currentUserId}))`
        },
        () => {
          // Refetch messages when new message is inserted
          queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
          queryClient.invalidateQueries({ queryKey: ['contactsWithMessages'] });
          
          // Mark messages as read if they're from this contact
          if (currentUserId) {
            markMessagesAsRead(contactId);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, currentUserId, queryClient]);

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

  if (isLoadingMessages) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">{t("loadingMessages", language)}</p>
      </div>
    );
  }

  // Get contact name for display
  const contactName = contactProfile?.display_name || contactProfile?.username || "";

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
                    contactName={contactName}
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
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
