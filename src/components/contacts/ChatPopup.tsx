
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  const { language, theme } = useTheme();
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
    refetchInterval: 5000,
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

  // Realtime subscription
  useEffect(() => {
    if (!isOpen || !contactId || !currentUserId) return;

    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${currentUserId},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${currentUserId}))`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
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
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("imageTooLarge", language));
      return;
    }

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message_media')
        .upload(`images/${fileName}`, file);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('message_media')
        .getPublicUrl(`images/${fileName}`);

      sendMessageMutation.mutate({
        message_type: "image",
        media_url: data.publicUrl,
        media_type: file.type,
        content: "📷 Image"
      });
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error(t("errorUploadingImage", language));
    } finally {
      setIsUploading(false);
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

  // Format message timestamp
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    } catch (error) {
      return "";
    }
  };

  // Check if messaging is blocked
  const isMessagingBlocked = blockStatus.isBlocked || blockStatus.isBlockedBy;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={`
          w-full max-w-sm mx-4 h-[70vh] max-h-[600px] p-0 gap-0 rounded-2xl overflow-hidden
          ${theme === 'dark' ? 'bg-dark-bg border-dark-secondary' : 'bg-light-bg border-light-secondary'}
        `}
        hideCloseButton
      >
        {/* Header */}
        <div className={`
          flex items-center justify-between p-4 border-b
          ${theme === 'dark' ? 'border-dark-secondary bg-dark-bg' : 'border-light-secondary bg-light-bg'}
        `}>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={contactAvatar || ""} />
              <AvatarFallback className={`
                ${theme === 'dark' ? 'bg-dark-secondary text-white' : 'bg-light-secondary text-light-primary'}
              `}>
                {contactName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-light-primary'}`}>
                {contactName}
              </h3>
              <p className={`text-xs ${theme === 'dark' ? 'text-dark-tertiary' : 'text-gray-500'}`}>
                {isMessagingBlocked ? 'Blocked' : 'Active'}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            className={`h-8 w-8 rounded-full ${theme === 'dark' ? 'hover:bg-dark-secondary' : 'hover:bg-light-secondary'}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Messages area */}
        <ScrollArea 
          className="flex-1 px-4"
          ref={scrollAreaRef}
        >
          {isLoadingMessages ? (
            <div className="flex justify-center items-center h-40">
              <div className={`animate-spin rounded-full h-8 w-8 border-2 border-t-transparent ${
                theme === 'dark' ? 'border-white' : 'border-light-primary'
              }`}></div>
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-3 py-4">
              {messages.map((message) => (
                <div 
                  key={message.id}
                  className={`flex flex-col ${message.sender_id === currentUserId ? 'items-end' : 'items-start'}`}
                >
                  <div 
                    className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                      message.sender_id === currentUserId
                        ? `${theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'} text-white rounded-br-md`
                        : `${theme === 'dark' ? 'bg-dark-secondary text-white' : 'bg-gray-100 text-gray-900'} rounded-bl-md`
                    }`}
                  >
                    {message.message_type === 'image' ? (
                      <img 
                        src={message.media_url} 
                        alt="Image message" 
                        className="max-w-full h-auto rounded-lg"
                        onLoad={() => {
                          if (scrollAreaRef.current) {
                            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
                          }
                        }}
                      />
                    ) : (
                      <p className="text-sm break-words">{message.content}</p>
                    )}
                  </div>
                  <span className={`text-xs mt-1 px-1 ${
                    theme === 'dark' ? 'text-dark-tertiary' : 'text-gray-500'
                  }`}>
                    {formatTime(message.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center h-40 text-center">
              <div className={`text-4xl mb-2 ${theme === 'dark' ? 'text-dark-tertiary' : 'text-gray-300'}`}>💬</div>
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-light-primary'}`}>
                {t("startConversation", language)}
              </p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-dark-tertiary' : 'text-gray-500'}`}>
                {t("sayHelloPrompt", language)}
              </p>
            </div>
          )}
        </ScrollArea>
        
        {/* Input area */}
        <div className={`border-t p-4 ${theme === 'dark' ? 'border-dark-secondary bg-dark-bg' : 'border-light-secondary bg-light-bg'}`}>
          {isMessagingBlocked ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <Shield className="h-4 w-4 text-red-500" />
              <p className={`text-sm ${theme === 'dark' ? 'text-dark-tertiary' : 'text-gray-500'}`}>
                {blockStatus.isBlocked 
                  ? t("contactBlocked", language) 
                  : t("blockedByContact", language)}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 rounded-full ${theme === 'dark' ? 'hover:bg-dark-secondary' : 'hover:bg-light-secondary'}`}
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
                
                <div className="flex-1 relative">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={t("typeMessage", language)}
                    className={`
                      h-9 pr-10 rounded-full border-none
                      ${theme === 'dark' 
                        ? 'bg-dark-secondary text-white placeholder:text-dark-tertiary' 
                        : 'bg-gray-100 text-gray-900 placeholder:text-gray-500'
                      }
                    `}
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
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-blue-500 hover:bg-blue-50"
                    onClick={sendTextMessage}
                    disabled={!messageText.trim() || isOverLimit || sendMessageMutation.isPending || isUploading}
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Character count */}
              {messageText && (
                <div className={`text-xs text-right mt-1 ${
                  isOverLimit ? 'text-red-500' : (theme === 'dark' ? 'text-dark-tertiary' : 'text-gray-500')
                }`}>
                  {charCount}/{MAX_CHARS}
                </div>
              )}
              
              {/* Uploading indicator */}
              {isUploading && (
                <div className="flex items-center justify-center mt-2">
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-full text-xs">
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{t("uploading", language)}...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
