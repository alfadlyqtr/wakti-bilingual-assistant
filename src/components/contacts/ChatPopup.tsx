
import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Image, FileText, X, Download, Play, Pause, Expand, Save, Bookmark, BookmarkCheck, CheckCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMessages, sendMessage, markAsRead, uploadMessageAttachment } from "@/services/messageService";
import { saveMessage, unsaveMessage, isMessageSaved as checkMessageSaved } from "@/services/savedMessagesService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VoiceRecorder } from "./VoiceRecorder";
import { motion, AnimatePresence } from "framer-motion";
import { usePresence } from "@/hooks/usePresence";

interface ChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  contactAvatar?: string;
}

const MAX_CHARS = 200;

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

  // Presence and typing indicators
  const { isOnline, isTyping, getLastSeen, setUserTyping, setExternalLastSeen } = usePresence(currentUserId);
  const [isContactTyping, setIsContactTyping] = useState(false);
  const [savedMessages, setSavedMessages] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const isContactOnline = isOnline(contactId);

  // Auto scroll to bottom on new messages
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Convert URLs in plain text into clickable links
  const linkifyText = (text: string, isSentByMe?: boolean) => {
    if (!text) return null;
    const urlRegex = /((https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?)/gi;
    // Split text by URLs and interleave with anchors
    const parts: Array<string> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    // Ensure global flag is respected
    const regex = new RegExp(urlRegex);
    (urlRegex as any).lastIndex = 0;
    while ((match = urlRegex.exec(text)) !== null) {
      const [full] = match;
      const start = match.index;
      if (start > lastIndex) parts.push(text.slice(lastIndex, start));
      parts.push(full);
      lastIndex = start + full.length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));

    return parts.map((part, i) => {
      const isUrl = /^(https?:\/\/)?([\w-]+\.)+[\w-]+/.test(part);
      if (!isUrl) return <span key={i}>{part}</span>;
      const href = part.startsWith('http') ? part : `https://${part}`;
      // Use high-contrast link colors depending on bubble background
      const linkClass = isSentByMe
        // Sent by me: blue bubble with white text -> use amber for strong contrast
        ? 'underline underline-offset-2 text-amber-200 hover:text-amber-100 visited:text-yellow-200'
        // Received: light surface -> deep blue for readability
        : 'underline underline-offset-2 text-blue-700 hover:text-blue-800 visited:text-purple-700 dark:text-sky-300 dark:hover:text-sky-200';
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkClass} break-words`}
        >
          {part}
        </a>
      );
    });
  // Seed last_seen for contact from profiles when dialog opens
  useEffect(() => {
    if (!contactId || !isOpen) return;
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('last_seen')
          .eq('id', contactId)
          .maybeSingle();
        if (!error && data?.last_seen && active) {
          setExternalLastSeen(contactId, data.last_seen as unknown as string);
        }
      } catch (_) {}
    })();
    return () => { active = false };
  }, [contactId, isOpen, setExternalLastSeen]);
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

  // Check saved status for messages
  useEffect(() => {
    const checkSavedStatuses = async () => {
      if (!currentUserId || !allMessages?.length) return;
      
      const savedSet = new Set<string>();
      for (const message of allMessages) {
        const isSaved = await checkMessageSaved(currentUserId, message.id);
        if (isSaved) {
          savedSet.add(message.id);
        }
      }
      setSavedMessages(savedSet);
    };
    
    checkSavedStatuses();
  }, [currentUserId, allMessages]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setMessageText(text);
    
    // Show typing indicator when user starts typing
    if (text.length === 1) {
      setUserTyping(true);
    }
    
    // Reset typing indicator after a delay
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setUserTyping(false);
    }, 2000);
  };
  
  // Clean up typing indicator on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setUserTyping(false);
    };
  }, []);
  
  // Toggle save message
  const toggleSaveMessage = async (messageId: string) => {
    if (!currentUserId) return;
    
    try {
      const isCurrentlySaved = savedMessages.has(messageId);
      
      if (isCurrentlySaved) {
        await unsaveMessage(currentUserId, messageId);
        setSavedMessages(prev => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
        toast.success("Message removed from saved");
      } else {
        await saveMessage(currentUserId, messageId, contactId);
        setSavedMessages(prev => new Set(prev).add(messageId));
        toast.success("Message saved");
      }
    } catch (error) {
      console.error("Error toggling save status:", error);
      toast.error("Error saving message");
    }
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: any) => sendMessage(contactId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
      scrollToBottom();
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast.error("Error sending message");
    }
  });

  // Realtime subscription for messages and typing indicators
  useEffect(() => {
    // ...
  }, []);

  // Handle file uploads
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large");
      return;
    }

    try {
      setIsUploading(true);
      // Upload image then send as image message
      const url = await uploadMessageAttachment(file, 'image');
      sendMessageMutation.mutate({
        message_type: 'image',
        media_url: url,
        media_type: file.type,
        file_size: file.size,
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Error uploading file");
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
      toast.error("PDF file is too large");
      return;
    }

    try {
      setIsUploading(true);
      const url = await uploadMessageAttachment(file, 'pdf');
      sendMessageMutation.mutate({
        message_type: 'pdf',
        content: file.name,
        media_url: url,
        media_type: file.type,
        file_size: file.size,
      });
    } catch (error) {
      console.error("Error uploading PDF:", error);
      toast.error("Error uploading file");
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
      // Use the real recording MIME type and matching extension to avoid mismatches
      const recordedType = (audioBlob as Blob).type || 'audio/webm';
      const ext = recordedType.includes('webm')
        ? 'webm'
        : recordedType.includes('ogg')
          ? 'ogg'
          : recordedType.includes('wav')
            ? 'wav'
            : (recordedType.includes('mpeg') || recordedType.includes('mp3'))
              ? 'mp3'
              : (recordedType.includes('mp4') || recordedType.includes('aac'))
                ? 'm4a'
                : 'webm';

      const file = new File([audioBlob], `voice-${Date.now()}.${ext}`, { type: recordedType });
      const url = await uploadMessageAttachment(file, 'voice');
      sendMessageMutation.mutate({
        message_type: 'voice',
        media_url: url,
        media_type: recordedType,
        voice_duration: Math.max(0, Math.round(duration || 0)),
        file_size: file.size,
      });
    } catch (error) {
      console.error("Error uploading voice:", error);
      toast.error("Error uploading file");
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
      // ...
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error(t("errorSavingImage", language));
    }
  };

  // Format message timestamp (local)
  const formatMessageTime = (dateString: string) => {
    try {
      const d = new Date(dateString);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      const timeStr = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      }).format(d);

      if (sameDay) return timeStr;
      if (isYesterday) return `Yesterday ${timeStr}`;

      const dateStr = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric'
      }).format(d);
      return `${dateStr} ${timeStr}`;
    } catch (error) {
      return '';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ago`;
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
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setExpandedImage(message.media_url)}
                      className="h-7 w-7 p-0 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                      title="Expand"
                    >
                      <Expand className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleImageDownload(message.media_url)}
                      className="h-7 w-7 p-0 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                      title="Download"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaveMessage(message.id);
                      }}
                      className={`h-7 w-7 p-0 rounded-full ${
                        savedMessages.has(message.id) 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-black/60 hover:bg-black/80 text-white'
                      } border-0`}
                      title={
                        savedMessages.has(message.id) 
                          ? "Unsave message"
                          : "Save message"
                      }
                    >
                      {savedMessages.has(message.id) ? (
                        <BookmarkCheck className="h-3 w-3" />
                      ) : (
                        <Bookmark className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : message.message_type === 'voice' ? (
                <div className="flex items-center justify-between gap-2">
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaveMessage(message.id);
                    }}
                    className={`h-7 w-7 p-0 rounded-full ${
                      savedMessages.has(message.id) 
                        ? 'text-green-500 hover:text-green-600' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title={
                      savedMessages.has(message.id) 
                        ? "Unsave message"
                        : "Save message"
                    }
                  >
                    {savedMessages.has(message.id) ? (
                      <BookmarkCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Bookmark className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ) : message.message_type === 'pdf' ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{message.content}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(message.media_url, '_blank')}
                      className="h-7 w-7 p-0 rounded-full text-gray-500 hover:text-gray-700"
                      title="Download"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaveMessage(message.id);
                      }}
                      className={`h-7 w-7 p-0 rounded-full ${
                        savedMessages.has(message.id) 
                          ? 'text-green-500 hover:text-green-600' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title={
                        savedMessages.has(message.id) 
                          ? "Unsave message"
                          : "Save message"
                      }
                    >
                      {savedMessages.has(message.id) ? (
                        <BookmarkCheck className="h-3.5 w-3.5" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {linkifyText(message.content, isSentByMe)}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleSaveMessage(message.id)}
                    className={`absolute -right-2 -top-2 h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                      savedMessages.has(message.id) 
                        ? 'text-green-500 hover:text-green-600' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title={
                      savedMessages.has(message.id) 
                        ? "Unsave message"
                        : "Save message"
                    }
                  >
                    {savedMessages.has(message.id) ? (
                      <BookmarkCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Bookmark className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </div>
            
            {/* Timestamp + saved indicator */}
            <div className={`text-[11px] mt-1 ${
              isSentByMe ? 'self-end mr-1' : 'self-start ml-1'
            } ${isDark ? 'text-gray-300' : 'text-gray-600'} flex items-center gap-1`}>
              <span>{formatMessageTime(message.created_at)}</span>
              {isSentByMe && (
                <span title={message.is_read ? 'Read' : 'Sent'} className="inline-flex items-center">
                  <CheckCheck className={`h-3.5 w-3.5 ${message.is_read ? 'text-green-500' : 'text-gray-400'}`} />
                </span>
              )}
              {savedMessages.has(message.id) && (
                <span title="Saved" className="inline-flex items-center">
                  <BookmarkCheck
                    className="h-3.5 w-3.5 text-green-500"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(34,197,94,0.8))' }}
                  />
                </span>
              )}
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
          className={`w-full max-w-sm md:max-w-md h-[80vh] p-0 gap-0 rounded-2xl overflow-hidden border-0 shadow-xl flex flex-col`}
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
          {/* Main content wrapper to ensure footer sticks to bottom */}
          <div className="flex flex-col flex-1 h-full">
          {/* Glassmorphic header */}
          <div 
            className="flex items-center justify-between p-1 h-10 border-b backdrop-blur-md sticky top-0 z-10"
            style={{
              borderColor: `${colors.secondary}30`,
              background: isDark ? 
                `linear-gradient(to bottom, ${colors.surfaceDark}, transparent)` : 
                `linear-gradient(to bottom, ${colors.surfaceLight}, transparent)`
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0 h-full">
              <Avatar className={`h-7 w-7 border-2 ${isDark ? 'border-dark-secondary' : 'border-light-secondary'}`}>
                <AvatarImage src={contactAvatar || ""} />
                <AvatarFallback className={`text-sm font-semibold ${isDark ? 'bg-dark-secondary text-white' : 'bg-light-secondary text-light-primary'}`}>
                  {contactName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold text-sm truncate leading-tight ${isDark ? 'text-white' : 'text-light-primary'}`}>
                  {contactName}
                </h3>
                <div className="flex items-center gap-1">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${isContactOnline ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ filter: isContactOnline ? 'drop-shadow(0 0 6px rgba(34,197,94,0.8))' : 'drop-shadow(0 0 6px rgba(239,68,68,0.7))' }}
                  ></span>
                  <p className={`text-[10px] ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {isContactTyping
                      ? 'Typing...'
                      : isContactOnline
                        ? 'Online • now'
                        : getLastSeen(contactId)}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClose}
                className={`h-7 w-7 rounded-full flex-none ${isDark ? 'hover:bg-dark-secondary/60 text-white' : 'hover:bg-light-secondary/50 text-light-primary'}`}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Message area */}
          <ScrollArea className="flex-1 min-h-0 px-1 pt-1 pb-1">
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

          {/* Floating composer (auto height) */}
          <div 
            className="p-1 border-t"
            style={{
              borderColor: `${colors.secondary}30`,
              background: isDark ? 
                `linear-gradient(to top, ${colors.surfaceDark}, transparent)` : 
                `linear-gradient(to top, ${colors.surfaceLight}, transparent)`
            }}
          >
            {/* single notice above input */}
            <div className="mb-1 text-center text-[11px] text-gray-500 dark:text-gray-400">
              {language === 'ar' ? 'الرسائل غير المحفوظة تُحذف بعد 72 ساعة' : 'Messages not saved are deleted after 72 hours'}
            </div>

            <div className="flex items-center gap-2">
              {/* Left: attach icons */}
              <div className="flex items-center gap-1 text-gray-500">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md text-gray-500 hover:text-gray-700"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sendMessageMutation.isPending || isUploading}
                >
                  <Image className="h-4 w-4" />
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md text-gray-500 hover:text-gray-700"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={sendMessageMutation.isPending || isUploading}
                >
                  <FileText className="h-4 w-4" />
                  <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePDFSelected} />
                </Button>
                <VoiceRecorder onRecordingComplete={handleVoiceRecording} disabled={sendMessageMutation.isPending || isUploading} />
              </div>

              {/* Middle: auto-expanding textarea */}
              <div className="flex-1 flex items-start">
                <Textarea
                  value={messageText}
                  onChange={(e) => {
                    // auto-expand
                    e.currentTarget.style.height = 'auto';
                    const nextH = Math.min(e.currentTarget.scrollHeight, 140);
                    e.currentTarget.style.height = `${nextH}px`;
                    handleInputChange(e as any);
                  }}
                  placeholder={t('typeMessage', language)}
                  maxLength={MAX_CHARS}
                  className={`min-h-[32px] max-h-[140px] h-auto px-2 py-1 text-sm rounded-md border border-gray-200 flex-1 resize-none overflow-y-auto ${isDark ? 'bg-transparent text-white placeholder:text-gray-400' : 'bg-white text-light-primary placeholder:text-gray-500'} focus-visible:ring-0 focus-visible:ring-offset-0`}
                  disabled={sendMessageMutation.isPending || isUploading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendTextMessage();
                    }
                  }}
                  onFocus={() => setUserTyping(true)}
                  onBlur={() => {
                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                    }
                    setUserTyping(false);
                  }}
                />
                {/* Inline tiny counter */}
                <span className={`ml-2 mt-1 text-[10px] ${isOverLimit ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>{charCount}/{MAX_CHARS}</span>
              </div>

              {/* Right: send */}
              <div className="flex items-center">
                <Button
                  type="button"
                  size="icon"
                  onClick={sendTextMessage}
                  disabled={!messageText.trim() || isOverLimit || sendMessageMutation.isPending || isUploading}
                  className={`rounded-md h-8 w-8 ${messageText.trim() && !isOverLimit && !sendMessageMutation.isPending && !isUploading ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'} transition-colors`}
                >
                  <Send className={`h-4 w-4 ${sendMessageMutation.isPending ? 'animate-pulse' : ''}`} />
                </Button>
              </div>
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
