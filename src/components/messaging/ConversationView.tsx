
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { MessageInputBar } from "./MessageInputBar";

// Mock data for messages - would be replaced with API calls
const mockMessages = [
  {
    id: "1",
    senderId: "contact456", // other contact
    text: "Dear QNB First Plus Member, Purchase premium furniture at That's Living, Doha Festival City and earn 3x points with QNB First Life Rewards credit cards. Enjoy this offer at That's Living Design District showrooms, featuring Ralph Lauren, Baker McGuire, Caracole, Eclipse, Theodore Alexander, Bernhardt, and more.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    type: "text",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 19), // expires in 19 hours
  },
  {
    id: "2",
    senderId: "contact456", // other contact
    text: "Valid until 24 June. Find the full list of participating brands on QNB website. Terms and conditions apply. For more information, please call your dedicated Relationship Manager",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    type: "text",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 19), // expires in 19 hours
  },
  {
    id: "3",
    senderId: "contact456", // other contact
    text: "Dear Customer, your login to QNB Mobile Banking was successful on 12/05/2025 22:57:28",
    timestamp: new Date(), // now
    type: "text",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // expires in 24 hours
  }
];

// Mock contact details - would be replaced with API calls
const mockContactDetails = {
  id: "contact456",
  name: "QNB",
  avatarUrl: "",
  blocked: false,
};

interface ConversationViewProps {
  conversationId: string;
  onBack: () => void;
}

export function ConversationView({ conversationId, onBack }: ConversationViewProps) {
  const { language } = useTheme();
  const [messages, setMessages] = useState(mockMessages);
  const [contact, setContact] = useState({...mockContactDetails, name: conversationId});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const currentUserId = "user123"; // This would come from auth context in a real app

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  // Fetch conversation details - would be replaced with an API call
  useEffect(() => {
    // In a real app, fetch messages for this conversation ID
    console.log(`Fetching messages for conversation: ${conversationId}`);
  }, [conversationId]);

  // Send a new message
  const handleSendMessage = (message: any) => {
    const newMessage = {
      id: Date.now().toString(),
      senderId: currentUserId,
      ...message,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
    };
    
    setMessages((prev) => [...prev, newMessage]);
  };

  // Group messages by date
  const groupedByDate = messages.reduce((acc: any, message) => {
    const date = new Date(message.timestamp);
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

  // Format time for message timestamp in iOS Messages style
  const formatMessageTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12; // Handle midnight (0 hours)
    return `${hours}:${minutes} ${ampm}`;
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Messages */}
      <ScrollArea 
        className="flex-1"
        ref={scrollAreaRef}
      >
        <div className="py-4">
          {Object.entries(groupedByDate).map(([date, dateMessages]: [string, any]) => (
            <div key={date} className="mb-4">
              <div className="flex justify-center mb-4">
                <div className="text-center text-xs text-zinc-500">
                  {formatDateHeader(date)} {formatMessageTime(new Date(date))}
                </div>
              </div>
              
              <div className="space-y-2 px-4">
                {dateMessages.map((message: any) => (
                  <MessageBubble 
                    key={message.id}
                    message={message}
                    isSelf={message.senderId === currentUserId}
                    contactName={contact.name}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      {/* Input Area */}
      {contact.blocked ? (
        <div className="p-4 text-center border-t border-zinc-800 bg-zinc-900">
          <p className="text-sm text-zinc-400 mb-2">
            {t("contactBlocked", language)}
          </p>
          <button className="px-4 py-2 bg-transparent text-blue-500 border border-blue-500 rounded-full text-sm">
            {t("unblockContact", language)}
          </button>
        </div>
      ) : (
        <MessageInputBar onSendMessage={handleSendMessage} />
      )}
    </div>
  );
}
