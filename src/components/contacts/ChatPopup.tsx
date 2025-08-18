
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Image, FileText, X, Download, Play, Pause, Expand, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMessages, sendMessage, markAsRead, uploadMessageAttachment } from "@/services/messageService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VoiceRecorder } from "./VoiceRecorder";
import { motion, AnimatePresence } from "framer-motion";

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
  const messageEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const charCount = messageText.length;
  const isOverLimit = charCount > MAX_CHARS;

  // Auto scroll to bottom on new messages
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
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

  // Auto scroll when messages change or on open
  useEffect(() => {
    if (allMessages && allMessages.length > 0) {
      setTimeout(scrollToBottom, 100); // Small delay to ensure content is rendered
    }
  }, [allMessages, isOpen]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: any) => sendMessage(contactId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
      scrollToBottom();
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
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
          if (currentUserId) {
            markAsRead(contactId);
          }
          scrollToBottom();
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
      console.log("📷 Uploading image file:", file.name, file.type);
      const mediaUrl = await uploadMessageAttachment(file, 'image');

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
      console.log("📄 Uploading PDF file:", file.name, file.type);
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
      console.log("🎵 Uploading voice recording:", duration, "seconds");
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

  // Handle image download
  const handleImageDownload = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(t("imageSaved", language) || "Image saved!");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error(t("errorSavingImage", language) || "Error saving image");
    }
  };

  // Format message timestamp
  const formatMessageTime = (dateString: string) => {
    try {
      const messageDate = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - messageDate.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 1) {
        return t("justNow", language);
      } else if (diffMins < 60) {
        return `${diffMins}${t("minsAgo", language)}`;
      } else if (diffHours < 24) {
        const hours = messageDate.getHours() % 12 || 12;
        const minutes = messageDate.getMinutes().toString().padStart(2, "0");
        const ampm = messageDate.getHours() >= 12 ? "pm" : "am";
        return `${t("today", language)} ${hours}:${minutes} ${ampm}`;
      } else if (diffDays === 1) {
        return t("yesterday", language);
      } else {
        // For older messages, show the date
        return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
          month: 'short',
          day: 'numeric',
        }).format(messageDate);
      }
    } catch (error) {
      return "";
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Theme-based styles
  const isDark = theme === 'dark';
  
  // Colors based on theme and app colors
  const colors = {
    primary: isDark ? '#fcfefd' : '#060541',
    secondary: isDark ? '#606062' : '#e9ceb0',
    tertiary: isDark ? '#858384' : '#d3b89d',
    background: isDark ? '#0c0f14' : '#fcfefd',
    surfaceLight: isDark ? 'rgba(96, 96, 98, 0.2)' : 'rgba(233, 206, 176, 0.2)',
    surfaceDark: isDark ? 'rgba(12, 15, 20, 0.9)' : 'rgba(6, 5, 65, 0.05)',
  };

  // Render message bubble
  const renderMessage = (message: any, index: number, messages: any[]) => {
    const senderDisplayName = message.sender?.display_name || message.sender?.username || "Unknown User";
    const isSentByMe = message.sender_id === currentUserId;
    const showAvatar = !isSentByMe && (index === 0 || messages[index - 1]?.sender_id !== message.sender_id);
    const isLastOfGroup = index === messages.length - 1 || messages[index + 1]?.sender_id !== message.sender_id;
    
    return (
      <motion.div 
        key={message.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex mb-2 ${isSentByMe ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`flex ${isSentByMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 max-w-[80%]`}>
          {/* Avatar for other user messages */}
          {!isSentByMe && showAvatar && (
            <Avatar className="h-8 w-8 mb-1 flex-shrink-0">
              <AvatarImage src={contactAvatar || ""} />
              <AvatarFallback className={`text-xs font-semibold ${isDark ? 'bg-dark-secondary text-white' : 'bg-light-secondary text-light-primary'}`}>
                {contactName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          
          {/* Invisible placeholder to align sent messages */}
          {!isSentByMe && !showAvatar && <div className="w-8 flex-shrink-0"></div>}
          
          <div className="flex flex-col">
            {/* Message bubble */}
            <div 
              className={`px-4 py-3 rounded-2xl ${
                isSentByMe
                  ? `bg-gradient-to-br from-blue-500 to-blue-600 text-white ${isLastOfGroup ? 'rounded-br-sm' : ''}`
                  : `${isDark ? 'bg-dark-secondary/60 text-white' : 'bg-light-secondary/40 text-light-primary'} ${isLastOfGroup ? 'rounded-bl-sm' : ''}`
              } backdrop-blur-sm shadow-sm`}
            >
              {message.message_type === 'image' ? (
                <div className="relative group">
                  <img 
                    src={message.media_url} 
                    alt="Image message" 
                    className="max-w-full h-auto rounded-lg cursor-pointer"
                    loading="lazy"
                    onClick={() => setExpandedImage(message.media_url)}
                  />
                  {/* Image overlay buttons */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setExpandedImage(message.media_url)}
                      className="h-7 w-7 p-0 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                    >
                      <Expand className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleImageDownload(message.media_url)}
                      className="h-7 w-7 p-0 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : message.message_type === 'voice' ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isSentByMe ? "ghost" : "secondary"}
                    onClick={() => toggleAudioPlayback(message.id, message.media_url)}
                    className={`h-8 w-8 p-0 rounded-full ${isSentByMe ? 'hover:bg-white/20' : 'hover:bg-black/10'}`}
                  >
                    {playingAudio === message.id ? 
                      <Pause className="h-4 w-4" /> : 
                      <Play className="h-4 w-4" />
                    }
                  </Button>
                  <span className="text-sm">
                    {formatDuration(message.voice_duration || 0)}
                  </span>
                </div>
              ) : message.message_type === 'pdf' ? (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm flex-1">{message.content}</span>
                  <Button
                    size="sm"
                    variant={isSentByMe ? "ghost" : "secondary"}
                    onClick={() => window.open(message.media_url, '_blank')}
                    className={`h-7 w-7 p-0 rounded-full ${isSentByMe ? 'hover:bg-white/20' : 'hover:bg-black/10'}`}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.content}</p>
              )}
            </div>
            
            {/* Timestamp */}
            <div className={`text-xs mt-1 ${
              isSentByMe ? 'self-end mr-1' : 'self-start ml-1'
            } ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {formatMessageTime(message.created_at)}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className={`w-full max-w-sm md:max-w-md mx-auto h-[80vh] p-0 gap-0 rounded-2xl overflow-hidden border-0 shadow-xl`}
          style={{
            background: colors.background,
            boxShadow: `0 10px 25px -5px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'}`,
          }}
          hideCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {language === 'ar' ? `محادثة مع ${contactName}` : `Chat with ${contactName}`}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? 'الرسائل تُحذف تلقائياً بعد 3 أيام للخصوصية' 
                : 'Messages auto-delete after 3 days for privacy'}
            </DialogDescription>
          </DialogHeader>
          {/* Glassmorphic header */}
          <div 
            className="flex items-center justify-between p-4 border-b backdrop-blur-md sticky top-0 z-10"
            style={{
              borderColor: `${colors.secondary}30`,
              background: isDark ? 
                `linear-gradient(to bottom, ${colors.surfaceDark}, transparent)` : 
                `linear-gradient(to bottom, ${colors.surfaceLight}, transparent)`
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <Avatar className={`h-10 w-10 border-2 ${isDark ? 'border-dark-secondary' : 'border-light-secondary'}`}>
                <AvatarImage src={contactAvatar || ""} />
                <AvatarFallback className={`text-sm font-semibold ${isDark ? 'bg-dark-secondary text-white' : 'bg-light-secondary text-light-primary'}`}>
                  {contactName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-base truncate ${isDark ? 'text-white' : 'text-light-primary'}`}>
                  {contactName}
                </h3>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t("activeNow", language)}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
              className={`h-9 w-9 rounded-full ${isDark ? 'hover:bg-dark-secondary/60 text-white' : 'hover:bg-light-secondary/50 text-light-primary'}`}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Message area */}
          <ScrollArea className="flex-1 px-4 pt-4 pb-2">
            {isLoadingMessages ? (
              <div className="flex flex-col gap-3 p-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <div className={`h-8 w-8 rounded-full ${isDark ? 'bg-dark-secondary/60' : 'bg-light-secondary/40'} animate-pulse`}></div>
                    <div className="flex-1">
                      <div className={`h-20 ${isDark ? 'bg-dark-secondary/60' : 'bg-light-secondary/40'} rounded-xl animate-pulse`}></div>
                      <div className={`h-3 w-16 mt-1 ml-1 ${isDark ? 'bg-dark-secondary/40' : 'bg-light-secondary/30'} rounded animate-pulse`}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : allMessages && allMessages.length > 0 ? (
              <div className="space-y-1 py-2">
                <AnimatePresence>
                  {allMessages.map((message, index) => (
                    renderMessage(message, index, allMessages)
                  ))}
                </AnimatePresence>
                <div ref={messageEndRef} />
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center h-48 text-center py-8">
                <div className={`text-4xl mb-4 ${isDark ? 'text-dark-tertiary' : 'text-light-secondary'}`}>👋</div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t("startConversation", language)}
                </p>
              </div>
            )}
          </ScrollArea>

          {/* Floating compose area */}
          <div 
            className="p-4 pt-2 border-t"
            style={{
              borderColor: `${colors.secondary}30`,
              background: isDark ? 
                `linear-gradient(to top, ${colors.surfaceDark}, transparent)` : 
                `linear-gradient(to top, ${colors.surfaceLight}, transparent)`
            }}
          >
            <div className="space-y-3">
              {/* Auto-delete notification */}
              <div className="text-center">
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} leading-relaxed`}>
                  {language === 'ar' 
                    ? 'الرسائل تُحذف تلقائياً بعد 3 أيام للخصوصية'
                    : 'Messages auto-delete after 3 days for privacy'
                  }
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full ${isDark ? 'hover:bg-dark-secondary/60 text-white' : 'hover:bg-light-secondary/50 text-light-primary'}`}
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

                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-full ${isDark ? 'hover:bg-dark-secondary/60 text-white' : 'hover:bg-light-secondary/50 text-light-primary'}`}
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={sendMessageMutation.isPending || isUploading}
                >
                  <FileText className="h-4 w-4" />
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

              <div className="relative">
                <div 
                  className={`p-1 rounded-2xl backdrop-blur-sm ${isDark ? 'bg-dark-secondary/30' : 'bg-light-secondary/20'}`}
                  style={{
                    boxShadow: `0 4px 12px ${isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)'}`
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={t("typeMessage", language)}
                      className={`h-10 border-0 bg-transparent text-sm flex-1 ${isDark ? 'text-white placeholder:text-gray-400' : 'text-light-primary placeholder:text-gray-500'} focus-visible:ring-0 focus-visible:ring-offset-0`}
                      disabled={sendMessageMutation.isPending || isUploading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendTextMessage();
                        }
                      }}
                    />
                    <Button
                      type="button" 
                      size="icon"
                      onClick={sendTextMessage}
                      disabled={!messageText.trim() || isOverLimit || sendMessageMutation.isPending || isUploading}
                      className={`rounded-full h-9 w-9 ${
                        messageText.trim() && !isOverLimit && !sendMessageMutation.isPending && !isUploading
                          ? 'bg-blue-500 hover:bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                      } transition-colors`}
                    >
                      <Send className={`h-4 w-4 ${sendMessageMutation.isPending ? 'animate-pulse' : ''}`} />
                    </Button>
                  </div>
                </div>
                
                {/* Character counter */}
                {messageText && (
                  <div 
                    className={`absolute right-14 bottom-3 text-xs ${
                      isOverLimit ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-500'
                    } transition-colors`}
                  >
                    {charCount}/{MAX_CHARS}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image expansion modal */}
      {expandedImage && (
        <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-4" hideCloseButton>
            <DialogHeader className="sr-only">
              <DialogTitle>{t("image", language) || "Image"}</DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'عرض موسع للصورة' : 'Expanded image preview'}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t("image", language) || "Image"}</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImageDownload(expandedImage)}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {t("save", language) || "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedImage(null)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative bg-muted rounded-lg overflow-hidden">
              <img
                src={expandedImage}
                alt="Expanded image"
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
