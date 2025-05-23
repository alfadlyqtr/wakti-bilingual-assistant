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

  // Theme-based styles
  const containerClass = theme === 'dark' 
    ? 'bg-dark-bg border-dark-secondary' 
    : 'bg-light-bg border-light-secondary';
  
  const headerClass = theme === 'dark' 
    ? 'border-dark-secondary bg-dark-bg' 
    : 'border-light-secondary bg-light-bg';
    
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-light-primary';
  const textSecondary = theme === 'dark' ? 'text-dark-tertiary' : 'text-gray-500';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={`w-full max-w-sm mx-4 h-[70vh] max-h-[600px] p-0 gap-0 rounded-2xl overflow-hidden ${containerClass}`}
        hideCloseButton
      >
        {/* Clean Header */}
        <div className={`flex items-center justify-between p-4 border-b ${headerClass}`}>
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-10 w-10 border-2 border-gray-200 dark:border-dark-secondary">
              <AvatarImage src={contactAvatar || ""} />
              <AvatarFallback className={`text-sm font-semibold ${theme === 'dark' ? 'bg-dark-secondary text-white' : 'bg-light-secondary text-light-primary'}`}>
                {contactName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold text-base truncate ${textPrimary}`}>
                {contactName}
              </h3>
              <p className={`text-xs ${textSecondary}`}>
                {isMessagingBlocked ? 'Blocked' : 'Active now'}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            className={`h-9 w-9 rounded-full ${theme === 'dark' ? 'hover:bg-dark-secondary text-white' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
          {isLoadingMessages ? (
            <div className="flex justify-center items-center h-40">
              <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin ${theme === 'dark' ? 'border-white' : 'border-light-primary'}`}></div>
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4 py-4">
              {messages.map((message) => {
                // Get sender display name from the foreign key relationship
                const senderDisplayName = message.sender?.display_name || message.sender?.username || "Unknown User";
                
                return (
                  <div 
                    key={message.id}
                    className={`flex flex-col ${message.sender_id === currentUserId ? 'items-end' : 'items-start'}`}
                  >
                    <div 
                      className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                        message.sender_id === currentUserId
                          ? 'bg-blue-500 text-white rounded-br-lg'
                          : `${theme === 'dark' ? 'bg-dark-secondary text-white' : 'bg-gray-100 text-gray-900'} rounded-bl-lg`
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
                        <p className="text-sm leading-relaxed break-words">{message.content}</p>
                      )}
                    </div>
                    <span className={`text-xs mt-1 px-2 ${textSecondary}`}>
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center h-full text-center py-8">
              <div className={`text-6xl mb-4 ${textSecondary}`}>💬</div>
              <p className={`text-base font-medium mb-2 ${textPrimary}`}>
                {t("startConversation", language)}
              </p>
              <p className={`text-sm ${textSecondary}`}>
                {t("sayHelloPrompt", language)}
              </p>
            </div>
          )}
        </ScrollArea>
        
        {/* Clean Input Area */}
        <div className={`border-t p-4 ${headerClass}`}>
          {isMessagingBlocked ? (
            <div className="flex items-center justify-center gap-2 py-3">
              <Shield className="h-5 w-5 text-red-500" />
              <p className={`text-sm font-medium ${textSecondary}`}>
                {blockStatus.isBlocked 
                  ? t("contactBlocked", language) 
                  : t("blockedByContact", language)}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-10 w-10 rounded-full ${theme === 'dark' ? 'hover:bg-dark-secondary text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sendMessageMutation.isPending || isUploading}
                >
                  <Image className="h-5 w-5" />
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
                    className={`h-10 pr-12 rounded-full border-0 ${theme === 'dark' 
                      ? 'bg-dark-secondary text-white placeholder:text-dark-tertiary focus:ring-1 focus:ring-white' 
                      : 'bg-gray-100 text-gray-900 placeholder:text-gray-500 focus:ring-1 focus:ring-light-primary'
                    }`}
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
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={sendTextMessage}
                    disabled={!messageText.trim() || isOverLimit || sendMessageMutation.isPending || isUploading}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Character count */}
              {messageText && (
                <div className={`text-xs text-right mt-2 ${isOverLimit ? 'text-red-500' : textSecondary}`}>
                  {charCount}/{MAX_CHARS}
                </div>
              )}
              
              {/* Clean uploading indicator */}
              {isUploading && (
                <div className="flex items-center justify-center mt-3">
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full text-sm">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
