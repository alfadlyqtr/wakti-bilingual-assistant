
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight } from "lucide-react";

// Mock conversation data - would be replaced with API calls
const mockConversations = [
  {
    id: "QNB",
    contactName: "QNB",
    lastMessage: "Dear Customer, your login to QNB Mobile Banking was successful on 12/05/2025 2...",
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    avatarUrl: "",
    unread: 0,
    isVoiceMessage: false,
    isImageMessage: false,
  },
  {
    id: "Apple",
    contactName: "Apple",
    lastMessage: "Your Apple Account Code is: 675554. Don't share it with anyone.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    avatarUrl: "",
    unread: 0,
    isVoiceMessage: false,
    isImageMessage: false,
  },
  {
    id: "AlKhor Sch",
    contactName: "AlKhor Sch",
    lastMessage: "روضه ومدرسه الخور الابتدائية للبنات... أطيب تحية",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    avatarUrl: "",
    unread: 0,
    isVoiceMessage: false,
    isImageMessage: false,
  },
  {
    id: "Doha Fair",
    contactName: "Doha Fair",
    lastMessage: "غدا الثلاثاء اليوم الاخير",
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    avatarUrl: "",
    unread: 2,
    isVoiceMessage: false,
    isImageMessage: false,
  }
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

  // Format time in a more iOS Messages style
  const formatTime = (date: Date) => {
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
      return date.toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", { 
        weekday: "short"
      });
    }
  };

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-zinc-800">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-10 text-zinc-500">
            <p>{t("noConversations", language)}</p>
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className="flex items-center py-3 px-4 cursor-pointer"
              onClick={() => onSelectConversation(conversation.id)}
            >
              <Avatar className="h-12 w-12 bg-zinc-700 mr-3 flex-shrink-0">
                <AvatarFallback className="bg-zinc-700 text-white">
                  {conversation.contactName[0]}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-medium text-white truncate">{conversation.contactName}</h3>
                  <div className="flex items-center">
                    <span className="text-xs text-zinc-500 ml-2">
                      {formatTime(conversation.timestamp)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-zinc-500 ml-1" />
                  </div>
                </div>
                
                <div className="flex items-center">
                  {conversation.isVoiceMessage && (
                    <span className="mr-1">🎤</span>
                  )}
                  {conversation.isImageMessage && (
                    <span className="mr-1">📷</span>
                  )}
                  <p className="text-sm text-zinc-400 truncate">
                    {conversation.lastMessage}
                  </p>
                  {conversation.unread > 0 && (
                    <span className="ml-2 bg-blue-500 text-white text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                      {conversation.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
