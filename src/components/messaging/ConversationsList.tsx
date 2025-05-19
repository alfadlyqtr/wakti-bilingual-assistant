
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight } from "lucide-react";
import { getConversations, searchConversations } from "@/services/messageService";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface ConversationsListProps {
  onSelectConversation: (id: string) => void;
  activeConversationId: string | null;
  searchQuery?: string;
}

type UserProfile = {
  display_name?: string;
  username?: string;
  avatar_url?: string;
  [key: string]: any;
};

type Participant = {
  user_id: string;
  profile?: UserProfile;
  [key: string]: any;
};

type ConversationType = {
  id: string;
  last_message_text?: string;
  last_message_at: string;
  unread_count?: number;
  participants?: Participant[];
  [key: string]: any;
};

export function ConversationsList({ onSelectConversation, activeConversationId, searchQuery = "" }: ConversationsListProps) {
  const { language, theme } = useTheme();
  const [filteredConversations, setFilteredConversations] = useState<ConversationType[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Get current user id
  useEffect(() => {
    async function getUserId() {
      const { data } = await supabase.auth.getSession();
      setCurrentUserId(data?.session?.user.id || null);
    }
    getUserId();
  }, []);
  
  const { data: conversations, isLoading, isError, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter conversations based on search query
  useEffect(() => {
    if (!conversations) {
      setFilteredConversations([]);
      return;
    }
    
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }
    
    const filtered = conversations.filter((conversation: ConversationType) => {
      // Check last message text
      if (conversation.last_message_text && 
          conversation.last_message_text.toLowerCase().includes(searchQuery.toLowerCase())) {
        return true;
      }
      
      // Check participant names
      if (conversation.participants) {
        for (const participant of conversation.participants || []) {
          if (participant.profile) {
            const { display_name, username } = participant.profile;
            if ((display_name && display_name.toLowerCase().includes(searchQuery.toLowerCase())) || 
                (username && username.toLowerCase().includes(searchQuery.toLowerCase()))) {
              return true;
            }
          }
        }
      }
      
      return false;
    });
    
    setFilteredConversations(filtered);
  }, [searchQuery, conversations]);

  // Format time in a more iOS Messages style
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.getDate() === now.getDate() && 
                     date.getMonth() === now.getMonth() && 
                     date.getFullYear() === now.getFullYear();
      
      if (isToday) {
        // For today, show time like "10:57 pm"
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "pm" : "am";
        hours = hours % 12;
        hours = hours ? hours : 12; // Handle midnight (0 hours)
        return `${hours}:${minutes} ${ampm}`;
      } else {
        // For past dates, show day name
        return formatDistanceToNow(date, { 
          addSuffix: false,
          locale: language === "ar" ? ar : enUS 
        });
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  };

  // Get other participant details for display
  const getConversationDisplayInfo = (conversation: ConversationType) => {
    if (!conversation) {
      return { name: "Unknown", avatar: "" };
    }
    
    // Handle participants missing from conversation type
    const participants = conversation.participants || [];
    if (participants.length === 0) {
      return { name: "Unknown", avatar: "" };
    }

    // Get other participants (exclude current user)
    const otherParticipants = participants.filter(
      (p: Participant) => p.user_id !== currentUserId
    );
    
    if (otherParticipants.length === 0) {
      return { name: "Unknown", avatar: "" };
    }
    
    const otherUser = otherParticipants[0];
    const profile = otherUser.profile || {} as UserProfile;
    
    return {
      name: profile.display_name || profile.username || "Unknown",
      avatar: profile.avatar_url || "",
    };
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">{t("errorLoadingConversations", language)}</p>
        <p className="text-sm text-red-500">{(error as Error)?.message}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <ScrollArea className="flex-1 w-full">
        <div className="w-full divide-y divide-border">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>{searchQuery ? t("noConversationsFound", language) : t("noConversations", language)}</p>
              <p className="text-sm mt-2">{t("startConversation", language)}</p>
            </div>
          ) : (
            filteredConversations.map((conversation: ConversationType) => {
              const { name, avatar } = getConversationDisplayInfo(conversation);
              const isVoiceMessage = conversation.last_message_text?.includes('🎤');
              const isImageMessage = conversation.last_message_text?.includes('📷');
              
              return (
                <div
                  key={conversation.id}
                  className="flex items-center py-3 px-4 cursor-pointer hover:bg-muted/30 w-full"
                  onClick={() => onSelectConversation(conversation.id)}
                >
                  <Avatar className="h-12 w-12 bg-muted mr-3 flex-shrink-0">
                    <AvatarImage src={avatar} alt={name} />
                    <AvatarFallback className="bg-muted text-foreground">
                      {name[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline w-full">
                      <h3 className="font-medium text-foreground truncate">{name}</h3>
                      <div className="flex items-center flex-shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(conversation.last_message_at)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
                      </div>
                    </div>
                    
                    <div className="flex items-center w-full pr-6">
                      {isVoiceMessage && (
                        <span className="mr-1">🎤</span>
                      )}
                      {isImageMessage && (
                        <span className="mr-1">📷</span>
                      )}
                      <p className="text-sm text-muted-foreground truncate flex-1">
                        {conversation.last_message_text || t("noMessages", language)}
                      </p>
                      {(conversation.unread_count > 0) && (
                        <span className="ml-2 bg-blue-500 text-white text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1 flex-shrink-0">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
