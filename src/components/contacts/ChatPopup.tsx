import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Image, FileText, X, Shield, Download, Play, Pause } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMessages, sendMessage, markAsRead, getBlockStatus, uploadMessageAttachment } from "@/services/messageService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VoiceRecorder } from "./VoiceRecorder";

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
  const [activeTab, setActiveTab] = useState("inbox");
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
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
  const { data: allMessages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['directMessages', contactId],
    queryFn: () => getMessages(contactId),
    refetchInterval: 5000,
    enabled: !!contactId && isOpen,
  });

  // Separate messages into inbox (unread) and previous (read)
  const inboxMessages = allMessages?.filter(msg => 
    msg.recipient_id === currentUserId && !msg.is_read
  ) || [];
  
  const previousMessages = allMessages?.filter(msg => 
    msg.recipient_id !== currentUserId || msg.is_read
  ) || [];

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
      setActiveTab("previous"); // Switch to previous tab after sending
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

  // Handle file uploads
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("imageTooLarge", language));
      return;
    }

    try {
      setIsUploading(true);
      const mediaUrl = await uploadMessageAttachment(file, 'voice');

      sendMessageMutation.mutate({
        message_type: "image",
        media_url: mediaUrl,
        media_type: file.type,
        content: "📷 Image",
        file_size: file.size
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(t("errorUploadingImage", language));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePDFSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("PDF file size must be under 5MB");
      return;
    }

    try {
      setIsUploading(true);
      const mediaUrl = await uploadMessageAttachment(file, 'pdf');

      sendMessageMutation.mutate({
        message_type: "pdf",
        media_url: mediaUrl,
        media_type: file.type,
        content: `📄 ${file.name}`,
        file_size: file.size
      });
    } catch (error) {
      console.error("Error uploading PDF:", error);
      toast.error("Error uploading PDF");
    } finally {
      setIsUploading(false);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = "";
      }
    }
  };

  const handleVoiceRecording = async (audioBlob: Blob, duration: number) => {
    try {
      setIsUploading(true);
      const file = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      const mediaUrl = await uploadMessageAttachment(file, 'voice');

      sendMessageMutation.mutate({
        message_type: "voice",
        media_url: mediaUrl,
        media_type: "audio/webm",
        content: "🎵 Voice message",
        voice_duration: duration,
        file_size: audioBlob.size
      });
    } catch (error) {
      console.error("Error uploading voice:", error);
      toast.error("Error sending voice message");
    } finally {
      setIsUploading(false);
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

  // Audio playback functions
  const toggleAudioPlayback = (messageId: string, audioUrl: string) => {
    if (playingAudio === messageId) {
      // Pause current audio
      audioRefs.current[messageId]?.pause();
      setPlayingAudio(null);
    } else {
      // Stop any currently playing audio
      if (playingAudio) {
        audioRefs.current[playingAudio]?.pause();
      }

      // Play new audio
      if (!audioRefs.current[messageId]) {
        audioRefs.current[messageId] = new Audio(audioUrl);
        audioRefs.current[messageId].onended = () => setPlayingAudio(null);
      }
      
      audioRefs.current[messageId].play();
      setPlayingAudio(messageId);
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const renderMessage = (message: any) => {
    const senderDisplayName = message.sender?.display_name || message.sender?.username || "Unknown User";
    
    return (
      <div 
        key={message.id}
        className={`flex flex-col ${message.sender_id === currentUserId ? 'items-end' : 'items-start'} mb-3`}
      >
        <div 
          className={`max-w-[85%] px-3 py-2 rounded-2xl ${
            message.sender_id === currentUserId
              ? 'bg-blue-500 text-white rounded-br-md'
              : `${theme === 'dark' ? 'bg-dark-secondary text-white' : 'bg-gray-100 text-gray-900'} rounded-bl-md`
          }`}
        >
          {message.message_type === 'image' ? (
            <img 
              src={message.media_url} 
              alt="Image message" 
              className="max-w-full h-auto rounded-lg"
            />
          ) : message.message_type === 'voice' ? (
            <div className="flex items-center gap-2 min-w-[120px]">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleAudioPlayback(message.id, message.media_url)}
                className="h-7 w-7 p-0 hover:bg-white/20"
              >
                {playingAudio === message.id ? 
                  <Pause className="h-3 w-3" /> : 
                  <Play className="h-3 w-3" />
                }
              </Button>
              <span className="text-xs font-mono">
                {formatDuration(message.voice_duration || 0)}
              </span>
            </div>
          ) : message.message_type === 'pdf' ? (
            <div className="flex items-center gap-2 min-w-[100px]">
              <FileText className="h-3 w-3" />
              <span className="text-xs flex-1 truncate">{message.content?.replace('📄 ', '')}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(message.media_url, '_blank')}
                className="h-6 w-6 p-0 hover:bg-white/20"
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <p className="text-sm leading-relaxed break-words">{message.content}</p>
          )}
        </div>
        <span className={`text-xs mt-1 px-1 ${textSecondary}`}>
          {formatTime(message.created_at)}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={`w-full max-w-md mx-4 h-[75vh] max-h-[600px] p-0 gap-0 rounded-2xl overflow-hidden ${containerClass}`}
        hideCloseButton
      >
        {/* Enhanced Header with minimal padding */}
        <div className={`flex items-center justify-between p-3 border-b ${headerClass}`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-9 w-9 border border-gray-200 dark:border-dark-secondary">
              <AvatarImage src={contactAvatar || ""} />
              <AvatarFallback className={`text-xs font-semibold ${theme === 'dark' ? 'bg-dark-secondary text-white' : 'bg-light-secondary text-light-primary'}`}>
                {contactName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold text-sm truncate ${textPrimary}`}>
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
            className={`h-8 w-8 rounded-full ${theme === 'dark' ? 'hover:bg-dark-secondary text-white' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Enhanced Tabs with compact design */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mx-3 mt-2 mb-0 h-8">
            <TabsTrigger value="inbox" className="text-xs h-7 px-2">
              Inbox {inboxMessages.length > 0 && `(${inboxMessages.length})`}
            </TabsTrigger>
            <TabsTrigger value="previous" className="text-xs h-7 px-2">Previous</TabsTrigger>
          </TabsList>

          {/* Inbox Tab */}
          <TabsContent value="inbox" className="flex-1 flex flex-col mt-2">
            <ScrollArea className="flex-1 px-3" ref={scrollAreaRef}>
              {isLoadingMessages ? (
                <div className="flex justify-center items-center h-32">
                  <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${theme === 'dark' ? 'border-white' : 'border-light-primary'}`}></div>
                </div>
              ) : inboxMessages.length > 0 ? (
                <div className="space-y-1 py-2">
                  {inboxMessages.map(renderMessage)}
                </div>
              ) : (
                <div className="flex flex-col justify-center items-center h-full text-center py-6">
                  <div className={`text-3xl mb-3 ${textSecondary}`}>📬</div>
                  <p className={`text-sm ${textSecondary}`}>No new messages</p>
                </div>
              )}
            </ScrollArea>

            {/* Enhanced Compose Area with minimal padding */}
            {!isMessagingBlocked && (
              <div className={`border-t p-3 ${headerClass}`}>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 rounded-full ${theme === 'dark' ? 'hover:bg-dark-secondary text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sendMessageMutation.isPending || isUploading}
                    >
                      <Image className="h-3.5 w-3.5" />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageSelected}
                      />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 rounded-full ${theme === 'dark' ? 'hover:bg-dark-secondary text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={sendMessageMutation.isPending || isUploading}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handlePDFSelected}
                      />
                    </Button>

                    <VoiceRecorder 
                      onRecordingComplete={handleVoiceRecording}
                      disabled={sendMessageMutation.isPending || isUploading}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder={t("typeMessage", language)}
                        className={`h-9 pr-10 rounded-full border-0 text-sm ${theme === 'dark' 
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
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={sendTextMessage}
                        disabled={!messageText.trim() || isOverLimit || sendMessageMutation.isPending || isUploading}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  {messageText && (
                    <div className={`text-xs text-right ${isOverLimit ? 'text-red-500' : textSecondary}`}>
                      {charCount}/{MAX_CHARS}
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Previous Tab */}
          <TabsContent value="previous" className="flex-1 flex flex-col mt-2">
            <ScrollArea className="flex-1 px-3" ref={scrollAreaRef}>
              {isLoadingMessages ? (
                <div className="flex justify-center items-center h-32">
                  <div className={`w-5 h-5 border-2 border-t-transparent rounded-full animate-spin ${theme === 'dark' ? 'border-white' : 'border-light-primary'}`}></div>
                </div>
              ) : previousMessages.length > 0 ? (
                <div className="space-y-1 py-2">
                  {previousMessages.map(renderMessage)}
                </div>
              ) : (
                <div className="flex flex-col justify-center items-center h-full text-center py-6">
                  <div className={`text-3xl mb-3 ${textSecondary}`}>📭</div>
                  <p className={`text-sm ${textSecondary}`}>No previous messages</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {isMessagingBlocked && (
          <div className="flex items-center justify-center gap-2 py-3 border-t">
            <Shield className="h-4 w-4 text-red-500" />
            <p className={`text-sm font-medium ${textSecondary}`}>
              {blockStatus.isBlocked 
                ? t("contactBlocked", language) 
                : t("blockedByContact", language)}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
