
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";

// Mock conversation data - would be replaced with API calls
const mockConversations = [
  {
    id: "1",
    contactName: "Sarah Johnson",
    lastMessage: "Can you send me the report?",
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    avatarUrl: "",
    unread: 2,
  },
  {
    id: "2",
    contactName: "Mohammed Al-Farsi",
    lastMessage: "See you tomorrow at the meeting",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    avatarUrl: "",
    unread: 0,
  },
  {
    id: "3",
    contactName: "Elena Rodriguez",
    lastMessage: "Thanks for the help!",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    avatarUrl: "",
    unread: 0,
  },
  {
    id: "4",
    contactName: "Ahmad Khalid",
    lastMessage: "Let me check and get back to you",
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    avatarUrl: "",
    unread: 1,
  },
];

interface ConversationsListProps {
  onSelectConversation: (id: string) => void;
  activeConversationId: string | null;
}

export function ConversationsList({ onSelectConversation, activeConversationId }: ConversationsListProps) {
  const { language } = useTheme();
  const [conversations, setConversations] = useState(mockConversations);

  // Format timestamp based on language
  const formatTime = (date: Date) => {
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: language === "ar" ? arSA : enUS,
    });
  };

  return (
    <ScrollArea className="flex-1 px-1">
      <div className="space-y-1 p-2">
        {conversations.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>{t("noConversations", language)}</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
              ${activeConversationId === conversation.id
                ? "bg-secondary/20"
                : "hover:bg-secondary/10"
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <Avatar className="h-12 w-12 border">
                <AvatarImage src={conversation.avatarUrl} alt={conversation.contactName} />
                <AvatarFallback>
                  {conversation.contactName.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-medium truncate">{conversation.contactName}</h3>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(conversation.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{conversation.lastMessage}</p>
              </div>
              {conversation.unread > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                  {conversation.unread}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
