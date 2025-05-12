
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
    id: "QNB",
    contactName: "QNB",
    lastMessage: "Dear Customer, your login to QNB Mobile Banking was successful on 12/05/2025 2...",
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    avatarUrl: "",
    unread: 0,
  },
  {
    id: "Apple",
    contactName: "Apple",
    lastMessage: "Your Apple Account Code is: 675554. Don't share it with anyone.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    avatarUrl: "",
    unread: 0,
  },
  {
    id: "AlKhor Sch",
    contactName: "AlKhor Sch",
    lastMessage: "روضه ومدرسه الخور الابتدائية للبنات... أطيب تحية",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    avatarUrl: "",
    unread: 0,
  },
  {
    id: "Doha Fair",
    contactName: "Doha Fair",
    lastMessage: "غدا الثلاثاء اليوم الاخير",
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    avatarUrl: "",
    unread: 0,
  },
  {
    id: "Family",
    contactName: "Family",
    lastMessage: "See you tomorrow at the meeting",
    timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
    avatarUrl: "",
    unread: 0,
  },
  {
    id: "Hasan",
    contactName: "Hasan",
    lastMessage: "Thanks for the help!",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
    avatarUrl: "",
    unread: 0,
  },
];

interface ConversationsListProps {
  onSelectConversation: (id: string) => void;
  activeConversationId: string | null;
  searchQuery?: string;
}

export function ConversationsList({ onSelectConversation, activeConversationId, searchQuery = "" }: ConversationsListProps) {
  const { language } = useTheme();
  const [conversations, setConversations] = useState(mockConversations);
  const [filteredConversations, setFilteredConversations] = useState(mockConversations);
  
  // Filter conversations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }
    
    const filtered = conversations.filter(conversation => 
      conversation.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setFilteredConversations(filtered);
  }, [searchQuery, conversations]);

  // Format time in a more WhatsApp style
  const formatTime = (date: Date) => {
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                   date.getMonth() === now.getMonth() && 
                   date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return date.toLocaleTimeString(language === "ar" ? "ar-SA" : "en-US", { 
        hour: "numeric", 
        minute: "2-digit",
        hour12: true 
      });
    } else {
      // For past dates, show day name
      return date.toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", { 
        weekday: "short"
      });
    }
  };

  return (
    <ScrollArea className="flex-1 px-1">
      <div className="space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-10 text-zinc-500">
            <p>{t("noConversations", language)}</p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`flex items-center gap-3 p-3 border-b border-zinc-800 cursor-pointer transition-colors
              ${activeConversationId === conversation.id
                ? "bg-zinc-900"
                : "hover:bg-zinc-900"
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <Avatar className="h-12 w-12 bg-zinc-700 border-0">
                <AvatarImage src={conversation.avatarUrl} alt={conversation.contactName} />
                <AvatarFallback className="bg-zinc-700 text-white">
                  {conversation.contactName.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-medium text-white truncate">{conversation.contactName}</h3>
                  <span className="text-xs text-zinc-500 whitespace-nowrap">
                    {formatTime(conversation.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 truncate">{conversation.lastMessage}</p>
              </div>
              {conversation.unread > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1">
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
