/**
 * ChatPage - Full-page conversation view for mobile/tablet
 * Route: /contacts/:contactId
 * Displays chat with a contact in full-screen with back navigation
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { emitEvent } from "@/utils/eventBus";
import { clearWaktiOperatorPayload, readWaktiOperatorPayload } from "@/utils/waktiOperator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Send, Image, FileText, Download, Play, Pause, Expand, Save, CheckCheck, X, Reply, Trash2 } from "lucide-react";
import type { DirectMessage } from "@/services/messageService";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMessages, sendMessage, markAsRead, uploadMessageAttachment, addReaction, removeReaction, deleteMessage } from "@/services/messageService";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VoiceRecorder } from "@/components/contacts/VoiceRecorder";
import { motion, AnimatePresence } from "framer-motion";
import { usePresence } from "@/hooks/usePresence";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const MAX_CHARS = 200;

export default function ChatPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language, theme } = useTheme();
  const operatorPayloadId = searchParams.get('waktiOperator');
  const operatorPayload = useMemo(() => readWaktiOperatorPayload(operatorPayloadId), [operatorPayloadId]);
  
  const [messageText, setMessageText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactAvatar, setContactAvatar] = useState<string | undefined>();
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [operatorDraftApplied, setOperatorDraftApplied] = useState(false);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedActionMessage, setSelectedActionMessage] = useState<DirectMessage | null>(null);
  const [selectedActionIsSentByMe, setSelectedActionIsSentByMe] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [selectedMessageRect, setSelectedMessageRect] = useState<{ top: number; left: number; width: number; height: number; right: number; } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const messageBubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const charCount = messageText.length;
  const isOverLimit = charCount > MAX_CHARS;

  // Presence and typing indicators
  const { isOnline, isTyping, getLastSeen, setUserTyping, setExternalLastSeen } = usePresence(currentUserId);
  const [isContactTyping, setIsContactTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const isContactOnline = contactId ? isOnline(contactId) : false;
  const entrySource = searchParams.get("from");

  const clearOperatorFlow = useCallback(() => {
    if (!operatorPayloadId) return;
    clearWaktiOperatorPayload(operatorPayloadId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('waktiOperator');
    setSearchParams(nextParams, { replace: true });
  }, [operatorPayloadId, searchParams, setSearchParams]);

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

  useEffect(() => {
    if (!operatorPayload?.runId || !operatorPayload.stepRefs?.openStepId) return;
    emitEvent('wakti-operator-status', {
      runId: operatorPayload.runId,
      stepId: operatorPayload.stepRefs.openStepId,
      status: 'completed',
    });
  }, [operatorPayload?.runId, operatorPayload?.stepRefs?.openStepId]);

  useEffect(() => {
    if (!operatorPayload?.chat?.draftMessage || operatorDraftApplied) return;
    setMessageText((current) => current || operatorPayload.chat?.draftMessage || '');
    setOperatorDraftApplied(true);
    if (operatorPayload.runId && operatorPayload.stepRefs?.handoffStepId) {
      emitEvent('wakti-operator-status', {
        runId: operatorPayload.runId,
        stepId: operatorPayload.stepRefs.handoffStepId,
        status: 'running',
      });
    }
  }, [operatorDraftApplied, operatorPayload]);

  useEffect(() => {
    if (!operatorPayload?.runId || !operatorPayload.stepRefs?.handoffStepId || operatorPayload?.chat?.draftMessage) return;
    emitEvent('wakti-operator-status', {
      runId: operatorPayload.runId,
      stepId: operatorPayload.stepRefs.handoffStepId,
      status: 'completed',
    });
    clearOperatorFlow();
  }, [clearOperatorFlow, operatorPayload]);

  useEffect(() => {
    emitEvent('wakti-operator-visual-mode', {
      mode: operatorPayload ? 'subtle' : 'default',
    });
    return () => {
      emitEvent('wakti-operator-visual-mode', {
        mode: 'default',
      });
    };
  }, [operatorPayload]);

  // Fetch contact profile
  useEffect(() => {
    if (!contactId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url, last_seen')
          .eq('id', contactId)
          .maybeSingle();
        if (!error && data) {
          setContactName(data.username || data.display_name || 'Unknown');
          setContactAvatar(data.avatar_url || undefined);
          if (data.last_seen) {
            setExternalLastSeen(contactId, data.last_seen);
          }
        }
      } catch (_) {}
    })();
  }, [contactId, setExternalLastSeen]);

  // Item #8 Batch B2: Realtime subscription replaces the old 5s polling.
  // The hook invalidates this query cache whenever a matching message
  // row is inserted/updated/deleted on the server.
  useRealtimeMessages(contactId, currentUserId);

  // Get messages for this contact
  const { data: allMessages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['directMessages', contactId],
    queryFn: () => getMessages(contactId!),
    enabled: !!contactId,
    // refetchInterval removed — realtime handles incremental updates now.
    // refetchOnWindowFocus stays default (true) as a safety net if realtime drops.
  });

  // Auto scroll when messages change
  useEffect(() => {
    if (allMessages && allMessages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [allMessages]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (contactId && currentUserId && allMessages && allMessages.length > 0) {
      markAsRead(contactId).catch(() => {});
    }
  }, [contactId, currentUserId, allMessages]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setMessageText(text);
    
    if (text.length === 1) {
      setUserTyping(true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setUserTyping(false);
    }, 2000);
  };
  
  // Reaction helpers
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;
    const msg = allMessages?.find(m => m.id === messageId);
    if (!msg || msg.is_deleted) return;
    const hasReacted = msg.reactions?.some(r => r.user_id === currentUserId && r.emoji === emoji);
    try {
      if (hasReacted) {
        await removeReaction(messageId, emoji);
      } else {
        await addReaction(messageId, emoji);
      }
      queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
    } catch (e) {
      console.error("Reaction error:", e);
    }
    closeMessageActions();
  };

  const handleReplyTo = (message: DirectMessage) => {
    setReplyingTo(message);
    closeMessageActions();
  };

  const cancelReply = () => setReplyingTo(null);
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const closeMessageActions = useCallback(() => {
    setReactionPickerFor(null);
    setSelectedMessageId(null);
    setSelectedActionMessage(null);
    setSelectedActionIsSentByMe(false);
    setSelectedMessageRect(null);
  }, []);

  const openMessageActions = useCallback((message: DirectMessage, isSentByMe: boolean) => {
    const bubble = messageBubbleRefs.current[message.id];
    if (!bubble) return;
    const rect = bubble.getBoundingClientRect();
    setSelectedMessageRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: rect.right,
    });
    setSelectedMessageId(message.id);
    setSelectedActionMessage(message);
    setSelectedActionIsSentByMe(isSentByMe);
    setReactionPickerFor(message.id);
  }, []);

  const handleDeleteSelectedMessage = async (message: DirectMessage) => {
    if (message.sender_id !== currentUserId) {
      toast.error(language === 'ar' ? 'يمكنك حذف رسائلك فقط' : 'You can delete only your own message');
      return;
    }
    try {
      await deleteMessage(message.id);
      toast.success(language === 'ar' ? 'تم حذف الرسالة' : 'Message deleted');
      closeMessageActions();
      queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error(language === 'ar' ? 'تعذر حذف الرسالة' : 'Could not delete message');
    }
  };

  // Long press handlers
  const startLongPress = (message: DirectMessage, isSentByMe: boolean) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      openMessageActions(message, isSentByMe);
    }, 500);
  };
  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: any) => sendMessage(contactId!, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directMessages', contactId] });
      scrollToBottom();
      if (operatorPayload?.runId && operatorPayload.stepRefs?.handoffStepId) {
        emitEvent('wakti-operator-status', {
          runId: operatorPayload.runId,
          stepId: operatorPayload.stepRefs.handoffStepId,
          status: 'completed',
        });
        clearOperatorFlow();
      }
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast.error("Error sending message");
    }
  });

  // Handle file uploads
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File is too large");
      return;
    }

    try {
      setIsUploading(true);
      const url = await uploadMessageAttachment(file, 'image');
      sendMessageMutation.mutate({
        message_type: 'image',
        media_url: url,
        media_type: file.type,
        file_size: file.size,
        reply_to_id: replyingTo?.id || null,
      });
      setReplyingTo(null);
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
        reply_to_id: replyingTo?.id || null,
      });
      setReplyingTo(null);
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
        reply_to_id: replyingTo?.id || null,
      });
      setReplyingTo(null);
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
        reply_to_id: replyingTo?.id || null,
      });
      setMessageText("");
      setReplyingTo(null);
    }
  };

  // Audio playback functions
  const toggleAudioPlayback = (messageId: string, audioUrl: string) => {
    if (playingAudio === messageId) {
      audioRefs.current[messageId]?.pause();
      setPlayingAudio(null);
    } else {
      if (playingAudio) {
        audioRefs.current[playingAudio]?.pause();
      }

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
      window.open(imageUrl, '_blank');
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error(t("errorSavingImage", language));
    }
  };

  // Format message timestamp
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
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Clean media URLs
  const cleanMediaUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    return url.trim().replace(/^(%20|\s)+/, '').replace(/(%20|\s)+$/, '');
  };

  // Theme-based styles
  const isDark = theme === 'dark';
  
  const colors = {
    primary: isDark ? '#fcfefd' : '#060541',
    secondary: isDark ? '#606062' : '#e9ceb0',
    tertiary: isDark ? '#858384' : '#d3b89d',
    background: isDark ? '#0c0f14' : '#fcfefd',
    surfaceLight: isDark ? 'rgba(96, 96, 98, 0.2)' : 'rgba(233, 206, 176, 0.2)',
    surfaceDark: isDark ? 'rgba(12, 15, 20, 0.9)' : 'rgba(6, 5, 65, 0.05)',
  };

  // Convert URLs in plain text into clickable links
  const linkifyText = (text: string, isSentByMe?: boolean) => {
    if (!text) return null;
    const urlRegex = /((https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?)/gi;
    const parts: Array<string> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
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
      const linkClass = isSentByMe
        ? 'underline underline-offset-2 text-amber-200 hover:text-amber-100 visited:text-yellow-200'
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
  };

  // Render message bubble
  const renderMessage = (message: any, index: number, messages: any[]) => {
    const isSentByMe = message.sender_id === currentUserId;
    const showAvatar = !isSentByMe && (index === 0 || messages[index - 1]?.sender_id !== message.sender_id);
    const isLastOfGroup = index === messages.length - 1 || messages[index + 1]?.sender_id !== message.sender_id;
    const displayedReaction = !message.is_deleted && message.reactions && message.reactions.length > 0
      ? [...message.reactions].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex select-none mb-2 ${isSentByMe ? 'justify-end' : 'justify-start'}`}
        onContextMenu={(e) => {
          if (message.is_deleted) return;
          e.preventDefault();
          openMessageActions(message, isSentByMe);
        }}
        onTouchStart={() => {
          if (message.is_deleted) return;
          startLongPress(message, isSentByMe);
        }}
        onTouchEnd={endLongPress}
        onTouchMove={endLongPress}
        onMouseDown={(e) => {
          if (message.is_deleted) return;
          if (e.button !== 0) return;
          e.preventDefault();
          startLongPress(message, isSentByMe);
        }}
        onMouseUp={endLongPress}
        onMouseLeave={endLongPress}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
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
          
          <div className={`flex flex-col ${displayedReaction ? 'pb-4' : ''}`}>
            {/* Message bubble */}
            <div className="relative inline-block">
              <div
                ref={(element) => {
                  messageBubbleRefs.current[message.id] = element;
                }}
                className={`select-none px-4 ${displayedReaction ? 'pt-5 pb-3' : 'py-3'} rounded-2xl ${
                  isSentByMe
                    ? `bg-gradient-to-br from-blue-500 to-blue-600 text-white ${isLastOfGroup ? 'rounded-br-sm' : ''}`
                    : `${isDark ? 'bg-dark-secondary/60 text-white' : 'bg-light-secondary/40 text-light-primary'} ${isLastOfGroup ? 'rounded-bl-sm' : ''}`
                } backdrop-blur-sm shadow-sm`}
                style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
              >
              {/* Quoted reply */}
              {message.is_deleted ? (
                <div className={`text-sm italic ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {language === 'ar' ? 'تم حذف هذه الرسالة' : 'This message was deleted'}
                </div>
              ) : message.reply_to && (
                <div className={`mb-2 rounded-lg px-2 py-1 text-xs border-l-2 ${
                  isSentByMe
                    ? 'bg-white/20 border-white/40 text-white/90'
                    : isDark ? 'bg-black/20 border-gray-400 text-gray-300' : 'bg-black/5 border-gray-400 text-gray-600'
                }`}>
                  <div className="truncate">
                    {message.reply_to.is_deleted ? (language === 'ar' ? 'تم حذف هذه الرسالة' : 'This message was deleted') : message.reply_to.message_type === 'image' ? '📷 Image' :
                     message.reply_to.message_type === 'voice' ? '🎤 Voice' :
                     message.reply_to.message_type === 'pdf' ? '📄 PDF' :
                     message.reply_to.content || '...'}
                  </div>
                </div>
              )}
              {!message.is_deleted && message.message_type === 'image' ? (
                <div className="relative group">
                  <img 
                    src={cleanMediaUrl(message.media_url)} 
                    alt="Image message" 
                    className="max-w-full h-auto rounded-lg cursor-pointer"
                    loading="lazy"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    onClick={() => setExpandedImage(cleanMediaUrl(message.media_url))}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setExpandedImage(cleanMediaUrl(message.media_url))}
                      className="h-7 w-7 p-0 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                    >
                      <Expand className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleImageDownload(cleanMediaUrl(message.media_url))}
                      className="h-7 w-7 p-0 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : !message.is_deleted && message.message_type === 'voice' ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isSentByMe ? "ghost" : "secondary"}
                      onClick={() => toggleAudioPlayback(message.id, cleanMediaUrl(message.media_url))}
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
                </div>
              ) : !message.is_deleted && message.message_type === 'pdf' ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{message.content}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(cleanMediaUrl(message.media_url), '_blank')}
                      className="h-7 w-7 p-0 rounded-full text-gray-500 hover:text-gray-700"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : !message.is_deleted ? (
                <div className="group relative">
                  <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {linkifyText(message.content, isSentByMe)}
                  </div>
                </div>
              ) : null}

              </div>

              {displayedReaction && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleReaction(message.id, displayedReaction.emoji); }}
                  className={`absolute -top-2 right-2 z-10 flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-sm shadow-md ${isDark ? 'border-white/10 bg-[#1f1f1f] text-white' : 'border-black/10 bg-white text-gray-900'}`}
                >
                  <span>{displayedReaction.emoji}</span>
                </button>
              )}
            </div>

            {/* Timestamp */}
            <div className={`text-[11px] mt-2 ${
              isSentByMe ? 'self-end mr-1' : 'self-start ml-1'
            } ${isDark ? 'text-gray-300' : 'text-gray-600'} flex items-center gap-1`}>
              <span>{formatMessageTime(message.created_at)}</span>
              {isSentByMe && (
                <span title={message.is_read ? 'Read' : 'Sent'} className="inline-flex items-center">
                  <CheckCheck className={`h-3.5 w-3.5 ${message.is_read ? 'text-green-500' : 'text-gray-400'}`} />
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 844;
  const reactionBarWidth = 312;
  const actionMenuWidth = 220;
  const messagePreviewWidth = selectedMessageRect ? Math.min(selectedMessageRect.width, viewportWidth - 32) : 0;
  const messagePreviewLeft = selectedMessageRect
    ? clamp(selectedActionIsSentByMe ? selectedMessageRect.right - messagePreviewWidth : selectedMessageRect.left, 16, Math.max(16, viewportWidth - messagePreviewWidth - 16))
    : 16;
  const reactionBarLeft = selectedMessageRect
    ? clamp(selectedMessageRect.left + (selectedMessageRect.width / 2) - (reactionBarWidth / 2), 16, Math.max(16, viewportWidth - reactionBarWidth - 16))
    : 16;
  const actionMenuLeft = selectedMessageRect
    ? clamp(selectedActionIsSentByMe ? selectedMessageRect.right - actionMenuWidth : selectedMessageRect.left, 16, Math.max(16, viewportWidth - actionMenuWidth - 16))
    : 16;
  const messagePreviewTop = selectedMessageRect ? clamp(selectedMessageRect.top, 96, Math.max(96, viewportHeight - selectedMessageRect.height - 210)) : 96;
  const reactionBarTop = selectedMessageRect ? Math.max(20, messagePreviewTop - 58) : 20;
  const actionMenuTop = selectedMessageRect ? Math.min(viewportHeight - (selectedActionIsSentByMe ? 136 : 84), messagePreviewTop + selectedMessageRect.height + 10) : 150;

  const renderPopupMessagePreview = (message: DirectMessage, isSentByMe: boolean) => (
    <div
      className={`select-none px-4 py-3 rounded-2xl ${
        isSentByMe
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm'
          : `${isDark ? 'bg-dark-secondary/95 text-white' : 'bg-light-secondary/95 text-light-primary'} rounded-bl-sm`
      } backdrop-blur-sm shadow-2xl`}
      style={{ width: messagePreviewWidth, WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      {message.is_deleted ? (
        <div className={`text-sm italic ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
          {language === 'ar' ? 'تم حذف هذه الرسالة' : 'This message was deleted'}
        </div>
      ) : message.reply_to && (
        <div className={`mb-2 rounded-lg px-2 py-1 text-xs border-l-2 ${
          isSentByMe
            ? 'bg-white/20 border-white/40 text-white/90'
            : isDark ? 'bg-black/20 border-gray-400 text-gray-300' : 'bg-black/5 border-gray-400 text-gray-600'
        }`}>
          <div className="truncate">
            {message.reply_to.is_deleted ? (language === 'ar' ? 'تم حذف هذه الرسالة' : 'This message was deleted') : message.reply_to.message_type === 'image' ? '📷 Image' :
             message.reply_to.message_type === 'voice' ? '🎤 Voice' :
             message.reply_to.message_type === 'pdf' ? '📄 PDF' :
             message.reply_to.content || '...'}
          </div>
        </div>
      )}
      {!message.is_deleted && message.message_type === 'image' ? (
        <img
          src={cleanMediaUrl(message.media_url)}
          alt="Image message"
          className="max-w-full h-auto rounded-lg"
          loading="lazy"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      ) : !message.is_deleted && message.message_type === 'voice' ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isSentByMe ? "ghost" : "secondary"}
              onClick={() => toggleAudioPlayback(message.id, cleanMediaUrl(message.media_url))}
              className={`h-8 w-8 p-0 rounded-full ${isSentByMe ? 'hover:bg-white/20' : 'hover:bg-black/10'}`}
            >
              {playingAudio === message.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <span className="text-sm">{formatDuration(message.voice_duration || 0)}</span>
          </div>
        </div>
      ) : !message.is_deleted && message.message_type === 'pdf' ? (
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm truncate">{message.content}</span>
        </div>
      ) : !message.is_deleted ? (
        <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">
          {linkifyText(message.content || '', isSentByMe)}
        </div>
      ) : null}
    </div>
  );

  if (!contactId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>No contact selected</p>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-full min-h-0"
      style={{ background: colors.background }}
    >
      {/* Header with back button */}
      <div 
        className="flex items-center gap-3 px-4 py-3 border-b backdrop-blur-md sticky top-0 z-10 safe-area-top"
        style={{
          borderColor: `${colors.secondary}30`,
          background: isDark ? 
            `linear-gradient(to bottom, ${colors.surfaceDark}, transparent)` : 
            `linear-gradient(to bottom, ${colors.surfaceLight}, transparent)`
        }}
      >
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(entrySource === 'social' ? '/social' : '/contacts')}
          className={`h-10 w-10 rounded-xl ${isDark ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600'} transition-all active:scale-95`}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        
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
          <div className="flex items-center gap-1">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${isContactOnline ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ filter: isContactOnline ? 'drop-shadow(0 0 6px rgba(34,197,94,0.8))' : 'drop-shadow(0 0 6px rgba(239,68,68,0.7))' }}
            ></span>
            <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              {isContactTyping
                ? 'Typing...'
                : isContactOnline
                  ? 'Online • now'
                  : getLastSeen(contactId)}
            </p>
          </div>
        </div>
      </div>

      {/* Message area */}
      <ScrollArea className="flex-1 min-h-0 px-3 py-2">
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
          <div className="min-h-full flex flex-col">
            <div className="mt-auto">
              <div className="space-y-1 py-2">
                <AnimatePresence>
                  {allMessages.map((message, index) => (
                    renderMessage(message, index, allMessages)
                  ))}
                </AnimatePresence>
                <div ref={messageEndRef} />
              </div>
            </div>
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

      {/* Composer area */}
      <div
        className="px-4 pt-2 pb-4 border-t"
        style={{
          borderColor: `${colors.secondary}30`,
          background: isDark ?
            `linear-gradient(to top, ${colors.surfaceDark}, transparent)` :
            `linear-gradient(to top, ${colors.surfaceLight}, transparent)`
        }}
      >
        <div className="space-y-1">
          {/* Reply preview */}
          {replyingTo && (
            <div className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${
              isDark ? 'bg-dark-secondary/40 text-gray-300' : 'bg-light-secondary/30 text-gray-600'
            }`}>
              <Reply className="h-3 w-3 flex-shrink-0" />
              <span className="truncate flex-1">
                {replyingTo.is_deleted ? (language === 'ar' ? 'تم حذف هذه الرسالة' : 'This message was deleted') : replyingTo.message_type === 'image' ? '📷 Image' :
                 replyingTo.message_type === 'voice' ? '🎤 Voice' :
                 replyingTo.message_type === 'pdf' ? '📄 PDF' :
                 replyingTo.content || '...'}
              </span>
              <button onClick={cancelReply} className="flex-shrink-0 hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Attachment buttons */}
          <div className="flex items-center gap-1 text-gray-500 px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-gray-500 hover:text-gray-700"
              onClick={() => fileInputRef.current?.click()}
              disabled={sendMessageMutation.isPending || isUploading}
            >
              <Image className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-gray-500 hover:text-gray-700"
              onClick={() => pdfInputRef.current?.click()}
              disabled={sendMessageMutation.isPending || isUploading}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <VoiceRecorder onRecordingComplete={handleVoiceRecording} disabled={sendMessageMutation.isPending || isUploading} />
          </div>

          {/* Hidden file inputs */}
          <input ref={fileInputRef} type="file" accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff" className="hidden" onChange={handleImageSelected} aria-label="Upload image" />
          <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePDFSelected} aria-label="Upload PDF" />

          {/* Text input + send button */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-start">
              <Textarea
                value={messageText}
                onChange={(e) => {
                  e.currentTarget.style.height = 'auto';
                  const nextH = Math.min(e.currentTarget.scrollHeight, 100);
                  e.currentTarget.style.height = `${nextH}px`;
                  handleInputChange(e);
                }}
                placeholder={t('typeMessage', language)}
                maxLength={MAX_CHARS}
                rows={1}
                className={`min-h-[36px] max-h-[100px] h-[36px] px-3 py-[6px] text-sm rounded-xl border border-gray-200 flex-1 resize-none overflow-y-auto leading-[1.35] ${isDark ? 'bg-transparent text-white placeholder:text-gray-400' : 'bg-white text-light-primary placeholder:text-gray-500'} focus-visible:ring-0 focus-visible:ring-offset-0`}
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
              <span className={`ml-2 mt-2 text-[10px] ${isOverLimit ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>{charCount}/{MAX_CHARS}</span>
            </div>

            <Button
              type="button"
              size="icon"
              onClick={sendTextMessage}
              disabled={!messageText.trim() || isOverLimit || sendMessageMutation.isPending || isUploading}
              className={`rounded-xl h-10 w-10 ${messageText.trim() && !isOverLimit && !sendMessageMutation.isPending && !isUploading ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'} transition-colors`}
            >
              <Send className={`h-5 w-5 ${sendMessageMutation.isPending ? 'animate-pulse' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedActionMessage && selectedMessageRect && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black/68 backdrop-blur-[1px]"
              onClick={closeMessageActions}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="fixed z-50"
              style={{
                top: messagePreviewTop,
                left: messagePreviewLeft,
              }}
            >
              {renderPopupMessagePreview(selectedActionMessage, !!selectedActionIsSentByMe)}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="fixed z-50 flex items-center justify-between gap-1 rounded-full px-3 py-2 shadow-2xl"
              style={{
                top: reactionBarTop,
                left: reactionBarLeft,
                width: reactionBarWidth,
                background: 'rgba(28,28,30,0.98)',
                boxShadow: '0 14px 40px rgba(0,0,0,0.38)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {reactionPickerFor === selectedActionMessage.id && ['👍','❤️','😂','😮','😢','🙏'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(selectedActionMessage.id, emoji)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[28px] leading-none transition-transform hover:scale-110 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="fixed z-50 overflow-hidden rounded-[28px] shadow-2xl"
              style={{
                top: actionMenuTop,
                left: actionMenuLeft,
                width: actionMenuWidth,
                background: 'rgba(36,36,38,0.98)',
                boxShadow: '0 14px 40px rgba(0,0,0,0.42)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => handleReplyTo(selectedActionMessage)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-base text-white hover:bg-white/5"
              >
                <Reply className="h-4 w-4" />
                <span>{language === 'ar' ? 'رد' : 'Reply'}</span>
              </button>
              <button
                onClick={() => handleDeleteSelectedMessage(selectedActionMessage)}
                className={`flex w-full items-center gap-3 border-t border-white/10 px-5 py-4 text-left text-base ${selectedActionIsSentByMe ? 'text-red-400 hover:bg-red-500/10' : 'text-red-300/75 hover:bg-white/5'}`}
              >
                <Trash2 className="h-4 w-4" />
                <span>{language === 'ar' ? 'حذف' : 'Delete'}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
    </div>
  );
}
