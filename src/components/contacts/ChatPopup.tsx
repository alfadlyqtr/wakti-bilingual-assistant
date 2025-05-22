
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Image, X, Shield } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMessages, sendMessage, markAsRead, getBlockStatus } from "@/services/messageService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

interface ChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  contactAvatar?: string;
}

// Maximum character limit for text messages
const MAX_CHARS = 300;

export function ChatPopup({ isOpen, onClose, contactId, contactName, contactAvatar }: ChatPopupProps) {
  const { language } = useTheme();
  const [messageText, setMessageText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [blockStatus, setBlockStatus] = useState<{
    isBlocked: boolean;
    isBlockedBy: boolean;
  }>({ isBlocked: false, isBlockedBy: false });

  // Character count display
  const charCount = messageText.length;
  const isOverLimit = charCount > MAX_CHARS;

  // Get current user ID
  useEffect(() => {
    async function getUserId() {
      const { data } = await supabase.auth.getSession();
      setCurrentUserId(data.session?.user.id || null);
    }
    getUserId();
  }, []);

  // Get messages for this contact
  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['directMessages', contactId],
    queryFn: () => getMessages(contactId),
    refetchInterval: 5000, // Refetch every 5 seconds
    enabled: !!contactId && isOpen,
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
    
    if (contactId && isOpen) {
      checkBlockStatus();
    }
  }, [contactId, isOpen]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: any) => sendMessage(contactId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast.error(t("errorSendingMessage", language));
    }
  });

  // Setup realtime subscription
  useEffect(() => {
    if (!isOpen || !contactId || !currentUserId) return;

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
          
          // Mark messages as read if they're from this contact
          if (currentUserId) {
            markAsRead(contactId);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, currentUserId, queryClient, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current && messages) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  // Handle image selection
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("imageTooLarge", language));
      return;
    }

    try {
      setIsUploading(true);
      // Upload the image to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message_media')
        .upload(`images/${fileName}`, file);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        throw uploadError;
      }

      const { data: urlData } = await supabase.storage
        .from('message_media')
        .getPublicUrl(`images/${fileName}`);

      // Send the image message
      sendMessageMutation.mutate({
        message_type: "image",
        media_url: urlData.publicUrl,
        media_type: file.type,
        content: "📷 Image"
      });
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error(t("errorUploadingImage", language));
    } finally {
      setIsUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Send text message
  const sendTextMessage = () => {
    if (messageText.trim() && !isOverLimit) {
      sendMessageMutation.mutate({
        message_type: "text",
        content: messageText.trim(),
      });
      setMessageText("");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.substring(0, 2).toUpperCase();
  };

  // Format message timestamp
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12;
      hours = hours ? hours : 12; // Handle midnight (0 hours)
      return `${hours}:${minutes} ${ampm}`;
    } catch (error) {
      return "";
    }
  };

  // Render the actual message bubble
  const MessageBubble = ({ message, isSelf }: { message: any, isSelf: boolean }) => {
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    
    // Determine message styles based on sender
    const bubbleStyle = isSelf
      ? "bg-blue-500 text-white ml-auto rounded-2xl rounded-br-none"
      : "bg-muted text-foreground mr-auto rounded-2xl rounded-bl-none";
    
    // Render different message types
    const renderMessageContent = () => {
      switch (message.message_type) {
        case 'image':
          return (
            <div className="relative">
              {!isImageLoaded && <div className="h-40 w-40 bg-muted animate-pulse rounded"></div>}
              <img 
                src={message.media_url} 
                alt="Image message" 
                className={`max-h-60 max-w-60 rounded-lg object-contain ${!isImageLoaded ? 'hidden' : ''}`}
                onLoad={() => setIsImageLoaded(true)}
              />
            </div>
          );
        default:
          return <p className="break-words">{message.content}</p>;
      }
    };
    
    return (
      <div className={`flex flex-col max-w-[80%] ${isSelf ? 'ml-auto' : 'mr-auto'}`}>
        <div className={`px-4 py-2 ${bubbleStyle}`}>
          {renderMessageContent()}
        </div>
        <div className={`text-xs text-muted-foreground mt-1 ${isSelf ? 'text-right mr-2' : 'ml-2'}`}>
          {formatTime(message.created_at)}
        </div>
      </div>
    );
  };

  // Check if messaging is blocked
  const isMessagingBlocked = blockStatus.isBlocked || blockStatus.isBlockedBy;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center border-b pb-2">
          <Avatar className="h-8 w-8 mr-2">
            <AvatarImage src={contactAvatar || ""} />
            <AvatarFallback>{getInitials(contactName)}</AvatarFallback>
          </Avatar>
          <DialogTitle className="flex-1">{contactName}</DialogTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="ml-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        {/* Messages area */}
        <ScrollArea 
          className="flex-1 py-4"
          ref={scrollAreaRef}
        >
          {isLoadingMessages ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4 px-4">
              {messages.map((message) => (
                <MessageBubble 
                  key={message.id}
                  message={message}
                  isSelf={message.sender_id === currentUserId}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center h-40 px-4 text-center">
              <p className="text-lg font-medium text-muted-foreground mb-2">{t("startConversation", language)}</p>
              <p className="text-sm text-muted-foreground">{t("sayHelloPrompt", language)}</p>
            </div>
          )}
        </ScrollArea>
        
        {/* Input area */}
        <div className="border-t mt-auto pt-2">
          {isMessagingBlocked ? (
            <div className="p-2 text-center">
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-4 w-4 text-destructive" />
                <p className="text-sm text-muted-foreground">
                  {blockStatus.isBlocked 
                    ? t("contactBlocked", language) 
                    : t("blockedByContact", language)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={sendMessageMutation.isPending || isUploading}
              >
                <Image className="h-4 w-4" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelected}
                />
              </Button>
              
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={t("typeMessage", language)}
                className="flex-1 h-10"
                disabled={sendMessageMutation.isPending || isUploading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendTextMessage();
                  }
                }}
              />
              
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-blue-500"
                onClick={sendTextMessage}
                disabled={!messageText.trim() || isOverLimit || sendMessageMutation.isPending || isUploading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Character count */}
          {messageText && (
            <div className={`text-xs px-3 pb-1 text-right ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
              {charCount}/{MAX_CHARS}
            </div>
          )}
          
          {/* Uploading indicator */}
          {isUploading && (
            <div className="mt-1 flex items-center justify-center pb-1">
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-full text-xs">
                <span className="animate-pulse">{t("uploading", language)}...</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
