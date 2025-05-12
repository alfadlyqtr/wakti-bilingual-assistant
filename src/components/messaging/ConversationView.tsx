
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { ArrowLeft, Mic, Image, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { MessageInputBar } from "./MessageInputBar";

// Mock data for messages - would be replaced with API calls
const mockMessages = [
  {
    id: "1",
    senderId: "user123", // current user
    text: "Hey, how are you doing today?",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    type: "text",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 20), // expires in 20 hours
  },
  {
    id: "2",
    senderId: "contact456", // other contact
    text: "I'm good thanks! Just finished the project we were working on.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5), // 1.5 hours ago
    type: "text",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 20.5), // expires in 20.5 hours
  },
  {
    id: "3",
    senderId: "user123", // current user
    text: "",
    audioUrl: "/path-to-audio.mp3",
    transcript: "I wanted to let you know that I'm going to be a bit late for our meeting tomorrow.",
    duration: 12, // seconds
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1), // 1 hour ago
    type: "voice",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 21), // expires in 21 hours
  },
  {
    id: "4",
    senderId: "contact456", // other contact
    text: "No problem, thanks for letting me know. What time do you think you'll be there?",
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    type: "text",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 22), // expires in 22 hours
  },
  {
    id: "5",
    senderId: "user123", // current user
    text: "",
    imageUrl: "/path-to-image.jpg",
    timestamp: new Date(Date.now() - 1000 * 60 * 20), // 20 minutes ago
    type: "image",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 23), // expires in 23 hours
  },
  {
    id: "6",
    senderId: "user123", // current user
    text: "Here's the location for our meeting.",
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    type: "text",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 23.5), // expires in 23.5 hours
  },
  {
    id: "7",
    senderId: "contact456", // other contact
    text: "Perfect, I'll see you there!",
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    type: "text",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 23.8), // expires in 23.8 hours
  },
];

// Mock contact details - would be replaced with API calls
const mockContactDetails = {
  id: "contact456",
  name: "Sarah Johnson",
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
  const [contact, setContact] = useState(mockContactDetails);
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

  // Group messages by sender for consecutive messages
  const groupedMessages = messages.reduce((acc: any[], message, index) => {
    const prevMessage = index > 0 ? messages[index - 1] : null;
    
    // Start a new group if:
    // 1. It's the first message
    // 2. The sender changed
    // 3. More than 5 minutes passed since the previous message
    const shouldStartNewGroup = 
      !prevMessage || 
      prevMessage.senderId !== message.senderId ||
      message.timestamp.getTime() - prevMessage.timestamp.getTime() > 5 * 60 * 1000;
    
    if (shouldStartNewGroup) {
      acc.push({
        senderId: message.senderId,
        isSelf: message.senderId === currentUserId,
        senderName: message.senderId === currentUserId ? "You" : contact.name,
        messages: [message]
      });
    } else {
      // Add to the last group
      acc[acc.length - 1].messages.push(message);
    }
    
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <Avatar className="h-10 w-10">
          <AvatarImage src={contact.avatarUrl} alt={contact.name} />
          <AvatarFallback>
            {contact.name.split(" ").map(n => n[0]).join("")}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <h3 className="font-medium">{contact.name}</h3>
          <p className="text-xs text-muted-foreground">
            {t("onlineNow", language)}
          </p>
        </div>
      </div>
      
      {/* Messages */}
      <ScrollArea 
        className="flex-1 p-4"
        ref={scrollAreaRef}
      >
        <div className="space-y-6">
          {groupedMessages.map((group, groupIndex) => (
            <div 
              key={groupIndex} 
              className={`flex flex-col ${group.isSelf ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                {!group.isSelf && (
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                    <AvatarFallback className="text-xs">
                      {contact.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="text-xs text-muted-foreground">
                  {group.senderName}
                </span>
                {group.isSelf && (
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">You</AvatarFallback>
                  </Avatar>
                )}
              </div>
              
              <div className={`space-y-1 max-w-[75%] ${group.isSelf ? "items-end" : "items-start"}`}>
                {group.messages.map((message: any) => (
                  <MessageBubble 
                    key={message.id}
                    message={message}
                    isSelf={group.isSelf}
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
        <div className="p-4 text-center border-t bg-muted/30">
          <p className="text-sm text-muted-foreground mb-2">
            {t("contactBlocked", language)}
          </p>
          <Button variant="outline" size="sm">
            {t("unblockContact", language)}
          </Button>
        </div>
      ) : (
        <MessageInputBar onSendMessage={handleSendMessage} />
      )}
    </div>
  );
}
