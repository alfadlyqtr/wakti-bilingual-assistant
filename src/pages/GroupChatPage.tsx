import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AtSign, ChevronDown, Crown, Expand, FileText, Image, Loader2, LogOut, Mic, MicOff, Pause, Pencil, Play, Reply, Send, Sparkles, Trash2, UserPlus, Users, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { addGroupMembers, addGroupReaction, addWaktiToGroup, deleteGroupMessage, getEligibleGroupContacts, getGroupConversation, getGroupConversationMessages, isWaktiInGroup, leaveGroupConversation, markGroupConversationRead, removeGroupReaction, removeWaktiFromGroup, renameGroupConversation, sendGroupConversationMessage, triggerWaktiAI, updateGroupAiSettings, uploadGroupMessageAttachment, type GroupChatMessage } from "@/services/groupChatService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { ImageModal } from "@/components/wakti-ai-v2/ImageModal";

export default function GroupChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language, theme } = useTheme();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [messageText, setMessageText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showAiSettingsModal, setShowAiSettingsModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [aiTone, setAiTone] = useState("friendly");
  const [aiLength, setAiLength] = useState("medium");
  const [aiStyle, setAiStyle] = useState("natural");
  const [aiSearchEnabled, setAiSearchEnabled] = useState(true);
  const [attachedImage, setAttachedImage] = useState<{ url: string; type: string; size: number } | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [waktiTyping, setWaktiTyping] = useState(false);
  const [pendingWaktiSince, setPendingWaktiSince] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const [replyingTo, setReplyingTo] = useState<GroupChatMessage | null>(null);
  const [selectedActionMessage, setSelectedActionMessage] = useState<GroupChatMessage | null>(null);
  const [selectedActionIsSentByMe, setSelectedActionIsSentByMe] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [selectedMessageRect, setSelectedMessageRect] = useState<{ top: number; left: number; width: number; height: number; right: number; } | null>(null);
  const [entryLastReadAt, setEntryLastReadAt] = useState<string | null | undefined>(undefined);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToUnreadRef = useRef(false);
  const unreadDividerRef = useCallback((node: HTMLDivElement | null) => {
    if (node && !hasScrolledToUnreadRef.current) {
      node.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
      hasScrolledToUnreadRef.current = true;
    }
  }, []);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialScrollDoneRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  const suppressNextImageTapRef = useRef(false);
  const ignoreNextImageClickRef = useRef(false);
  const messageBubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const entryReadCapturedRef = useRef(false);
  const isDark = theme === "dark";
  const entrySource = searchParams.get("from");

  const { data: conversation, isLoading: loadingConversation } = useQuery({
    queryKey: ["groupConversation", conversationId],
    queryFn: () => getGroupConversation(conversationId!),
    enabled: !!conversationId,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["groupConversationMessages", conversationId],
    queryFn: () => getGroupConversationMessages(conversationId!),
    enabled: !!conversationId,
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof sendGroupConversationMessage>[1]) =>
      sendGroupConversationMessage(conversationId!, payload),
    onSuccess: () => {
      setMessageText("");
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ["groupConversationMessages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["groupConversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || (language === "ar" ? "تعذر إرسال الرسالة" : "Failed to send message"));
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveGroupConversation(conversationId!),
    onSuccess: () => {
      toast.success(language === "ar" ? "غادرت المجموعة" : "You left the group");
      queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
      navigate(entrySource === "social" ? "/social?section=contacts&tab=groups" : "/contacts?tab=groups");
    },
    onError: (error: any) => {
      toast.error(error?.message || (language === "ar" ? "تعذر مغادرة المجموعة" : "Failed to leave group"));
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ name }: { name: string }) => renameGroupConversation(conversationId!, name),
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تغيير اسم المجموعة" : "Group name updated");
      setShowRenameModal(false);
      queryClient.invalidateQueries({ queryKey: ["groupConversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || (language === "ar" ? "تعذر تغيير الاسم" : "Failed to rename group"));
    },
  });

  const addMembersMutation = useMutation({
    mutationFn: (memberIds: string[]) => addGroupMembers(conversationId!, memberIds),
    onSuccess: () => {
      toast.success(language === "ar" ? "تمت إضافة الأعضاء" : "Members added");
      setShowAddMembersModal(false);
      setSelectedNewMembers([]);
      queryClient.invalidateQueries({ queryKey: ["groupConversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || (language === "ar" ? "تعذر إضافة الأعضاء" : "Failed to add members"));
    },
  });

  const { data: eligibleContacts = [] } = useQuery({
    queryKey: ["eligibleGroupContacts"],
    queryFn: getEligibleGroupContacts,
    enabled: showAddMembersModal,
  });

  const { data: waktiInGroup, refetch: refetchWaktiStatus } = useQuery({
    queryKey: ["waktiInGroup", conversationId],
    queryFn: () => isWaktiInGroup(conversationId!),
    enabled: !!conversationId,
  });

  const addWaktiMutation = useMutation({
    mutationFn: () => addWaktiToGroup(conversationId!),
    onSuccess: () => {
      toast.success(language === "ar" ? "تمت إضافة وكتي للمجموعة" : "Wakti joined the group");
      refetchWaktiStatus();
      queryClient.invalidateQueries({ queryKey: ["groupConversation", conversationId] });
    },
    onError: (error: any) => {
      toast.error(error?.message || (language === "ar" ? "تعذر إضافة وكتي" : "Failed to add Wakti"));
    },
  });

  const removeWaktiMutation = useMutation({
    mutationFn: () => removeWaktiFromGroup(conversationId!),
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إزالة وكتي من المجموعة" : "Wakti left the group");
      refetchWaktiStatus();
      queryClient.invalidateQueries({ queryKey: ["groupConversation", conversationId] });
    },
    onError: (error: any) => {
      toast.error(error?.message || (language === "ar" ? "تعذر إزالة وكتي" : "Failed to remove Wakti"));
    },
  });

  const isCreator = conversation?.created_by === user?.id;
  const WAKTI_AI_ID = "00000000-0000-0000-0000-000000000002";

  useLayoutEffect(() => {
    if (!conversationId) return;
    initialScrollDoneRef.current = false;
    hasScrolledToUnreadRef.current = false;
    entryReadCapturedRef.current = false;
    setEntryLastReadAt(undefined);
    setWaktiTyping(false);
    setPendingWaktiSince(null);
    setTypingUserIds(new Set());
    typingTimeoutsRef.current = {};
    lastTypingSentRef.current = 0;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !conversation || !user?.id || entryReadCapturedRef.current) return;

    const myParticipant = conversation.participants.find((participant) => participant.user_id === user.id);
    setEntryLastReadAt(myParticipant?.last_read_at || null);
    entryReadCapturedRef.current = true;

    markGroupConversationRead(conversationId).catch(() => undefined);
    queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
  }, [conversation, conversationId, queryClient, user?.id]);

  const unreadSeparatorMessageId = useMemo(() => {
    if (!messages.length || !user?.id || entryLastReadAt === undefined) return null;

    if (!entryLastReadAt) {
      const firstUnread = messages.find((message) => message.sender_id !== user.id);
      return firstUnread?.id || null;
    }

    const entryReadMs = new Date(entryLastReadAt).getTime();
    const firstUnread = messages.find((message) => (
      message.sender_id !== user.id &&
      new Date(message.created_at).getTime() > entryReadMs
    ));

    return firstUnread?.id || null;
  }, [entryLastReadAt, messages, user?.id]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`group-conversation:${conversationId}`)
      .on("postgres_changes" as any, {
        event: "*",
        schema: "public",
        table: "conversation_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["groupConversationMessages", conversationId] });
        queryClient.invalidateQueries({ queryKey: ["groupConversation", conversationId] });
        queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
        markGroupConversationRead(conversationId).catch(() => undefined);
      })
      .on("postgres_changes" as any, {
        event: "*",
        schema: "public",
        table: "conversation_message_reactions",
      }, (payload: any) => {
        const row = payload?.new || payload?.old;
        const messageId = row?.conversation_message_id;
        if (!messageId) return;
        const cachedMessages = queryClient.getQueryData<GroupChatMessage[]>(["groupConversationMessages", conversationId]) || [];
        if (!cachedMessages.some((message) => message.id === messageId)) return;
        queryClient.invalidateQueries({ queryKey: ["groupConversationMessages", conversationId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  // Fallback: scroll to bottom on first load when there are no unread messages
  useLayoutEffect(() => {
    if (messages.length === 0) return;
    if (entryLastReadAt === undefined) return;
    const end = endRef.current;
    if (!end) return;

    if (!initialScrollDoneRef.current && !unreadSeparatorMessageId) {
      end.scrollIntoView({ behavior: "auto" });
      initialScrollDoneRef.current = true;
    } else if (initialScrollDoneRef.current && isNearBottomRef.current) {
      // New message arrived while user is already at bottom — smooth scroll
      end.scrollIntoView({ behavior: "smooth" });
    }
  }, [entryLastReadAt, messages, unreadSeparatorMessageId]);

  // Scroll to bottom when Wakti starts typing so the indicator is visible
  useEffect(() => {
    if (waktiTyping && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
      setShowScrollToBottom(false);
    }
  }, [waktiTyping]);

  // Detect if user has scrolled away from bottom
  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10;
    isNearBottomRef.current = isNearBottom;
    setShowScrollToBottom(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollToBottom(false);
  }, []);

  // Turn off Wakti typing indicator when a new Wakti message arrives
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg?.sender_id === WAKTI_AI_ID &&
      waktiTyping &&
      (!pendingWaktiSince || new Date(lastMsg.created_at).getTime() >= new Date(pendingWaktiSince).getTime())
    ) {
      setWaktiTyping(false);
      setPendingWaktiSince(null);
    }
  }, [messages, pendingWaktiSince, waktiTyping]);

  // Group typing indicator: shared broadcast channel
  useEffect(() => {
    if (!conversationId || !user?.id) return;
    const channelName = `group-typing-${conversationId}`;
    const channel = supabase.channel(channelName);
    typingChannelRef.current = channel;
    channel
      .on('broadcast', { event: 'typing' }, (event: any) => {
        const payload = event.payload;
        if (!payload?.user_id || payload.user_id === user.id) return;
        if (payload.typing) {
          setTypingUserIds((prev) => {
            if (prev.has(payload.user_id)) return prev;
            const next = new Set(prev);
            next.add(payload.user_id);
            return next;
          });
          // Clear previous safety timeout for this user
          if (typingTimeoutsRef.current[payload.user_id]) {
            clearTimeout(typingTimeoutsRef.current[payload.user_id]);
          }
          // Safety: auto-clear after 5s if no stop event
          typingTimeoutsRef.current[payload.user_id] = setTimeout(() => {
            setTypingUserIds((prev) => {
              if (!prev.has(payload.user_id)) return prev;
              const next = new Set(prev);
              next.delete(payload.user_id);
              return next;
            });
          }, 5000);
        } else {
          setTypingUserIds((prev) => {
            if (!prev.has(payload.user_id)) return prev;
            const next = new Set(prev);
            next.delete(payload.user_id);
            return next;
          });
          if (typingTimeoutsRef.current[payload.user_id]) {
            clearTimeout(typingTimeoutsRef.current[payload.user_id]);
            delete typingTimeoutsRef.current[payload.user_id];
          }
        }
      })
      .subscribe();
    return () => {
      typingChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);

  // Welcome back summary after long absence
  useEffect(() => {
    if (!conversationId || !waktiInGroup || !messages.length) return;

    const storageKey = `group_visit_${conversationId}`;
    const lastVisit = localStorage.getItem(storageKey);
    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;

    if (lastVisit && now - parseInt(lastVisit, 10) > twoHours) {
      setWaktiTyping(true);
      triggerWaktiAI(conversationId, {
        trigger_type: "welcome_back",
        language,
        sender_id: user?.id,
      }).catch(() => setWaktiTyping(false));
    }

    localStorage.setItem(storageKey, String(now));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, waktiInGroup]);

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const participantNames = useMemo(() => {
    if (!conversation) return "";
    return conversation.participants
      .filter((p) => p.user_id !== user?.id)
      .map((p) => p.profile?.display_name || p.profile?.username || (language === "ar" ? "عضو" : "Member"))
      .join(language === "ar" ? "، " : ", ");
  }, [conversation, language, user?.id]);

  const handleBack = () => {
    navigate(entrySource === "social" ? "/social?section=contacts&tab=groups" : "/contacts?tab=groups");
  };

  // Get device GPS location — fast timeout so it doesn't block
  const getDeviceLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 300000, enableHighAccuracy: true }
      );
    });
  };

  // Only request GPS when the message is actually about location
  const needsLocationContext = (text: string): boolean => {
    const lower = text.toLowerCase();
    const locationKeywords = [
      // Location / Navigation
      "where", "location", "near", "nearby", "here", "meet", "coming", "address",
      "place", "direction", "map", "gps", "coordinates", "distance", "route",
      "navigate", "closest", "nearest", "around me", "near me", "how to get to",
      // Weather
      "weather", "forecast", "temperature", "rain", "sunny", "cloud", "hot", "cold",
      "humid", "wind", "storm", "snow", "climate",
      // Places / Services
      "gas station", "petrol", "fuel", "restaurant", "food", "eat", "cafe",
      "coffee", "pharmacy", "hospital", "clinic", "atm", "bank", "supermarket",
      "grocery", "mall", "shop", "store", "parking",
      // Sports / Live info
      "score", "match", "game", "result", "live", "league", "team", "player",
      "played", "won", "lost", "standing", "fixture",
      // Traffic
      "traffic", "jam", "blocked", "road", "highway",
      // Arabic
      "أين", "وين", "مكان", "موقع", "قريب", "هنا", "نلتقي", "تجي", "عنوان",
      "خريطة", "إحداثيات", "مسافة", "طريق", "وينك", "وينكم", "قريب مني",
      "أقرب", "جو", "طقس", "حرارة", "مطر", "غائم", "مشمس", "رياح",
      "محطة بنزين", "بنزينة", "مطعم", "أكل", "قهوة", "صيدلية", "مستشفى",
      "نتيجة", "مباراة", "فريق", "دوري", "لاعب",
    ];
    return locationKeywords.some((kw) => lower.includes(kw.toLowerCase()));
  };

  // Broadcast typing status to group channel
  const broadcastTyping = useCallback((typing: boolean) => {
    const ch = typingChannelRef.current;
    if (!ch || !user?.id) return;
    try {
      ch.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, typing } });
    } catch {}
  }, [user?.id]);

  const handleSendText = async () => {
    if (sendMutation.isPending) return;
    const text = messageText.trim();

    // Must have text OR attached image
    if (!text && !attachedImage) return;

    // Stop typing broadcast when sending
    broadcastTyping(false);

    const hasMention = text.toLowerCase().includes("@wakti");
    const needsGps = hasMention && needsLocationContext(text);

    let payload: Parameters<typeof sendGroupConversationMessage>[1];
    if (attachedImage) {
      // Send image with optional text caption
      payload = {
        message_type: "image",
        content: text || undefined,
        media_url: attachedImage.url,
        media_type: attachedImage.type,
        file_size: attachedImage.size,
        reply_to_id: replyingTo?.id || null,
      };
    } else if (replyingTo) {
      payload = {
        message_type: "text",
        content: text,
        reply_to_id: replyingTo.id,
      };
    } else {
      payload = text;
    }

    // If @wakti mentioned but Wakti is not in the group, warn the user
    if (hasMention && !waktiInGroup) {
      toast.info(language === "ar"
        ? "وكتي مش موجود في المجموعة. اطلب من منشئ المجموعة يضيفه."
        : "Wakti is not in this group. Ask the creator to add Wakti.");
    }

    sendMutation.mutate(payload, {
      onSuccess: async (data: any) => {
        setAttachedImage(null);
        setReplyingTo(null);
        // If @wakti was mentioned and Wakti IS in the group, trigger AI response
        if (hasMention && waktiInGroup && data?.id) {
          const typingStartedAt = new Date().toISOString();
          setWaktiTyping(true);
          setPendingWaktiSince(typingStartedAt);
          const triggerPayload: any = {
            trigger_type: "mention",
            message_id: data.id,
            language,
            sender_id: user?.id,
          };
          // Only send GPS when the message is location-related
          if (needsGps) {
            const senderLoc = await getDeviceLocation();
            if (senderLoc) triggerPayload.sender_location = senderLoc;
          }
          triggerWaktiAI(conversationId!, triggerPayload)
            .then(async () => {
              const startTime = Date.now();
              const maxWaitMs = 30000;
              const pollIntervalMs = 1500;

              while (Date.now() - startTime < maxWaitMs) {
                await queryClient.invalidateQueries({ queryKey: ["groupConversationMessages", conversationId] });
                await queryClient.refetchQueries({ queryKey: ["groupConversationMessages", conversationId], exact: true });

                const refreshedMessages = (queryClient.getQueryData(["groupConversationMessages", conversationId]) as any[]) || [];
                const refreshedLastWakti = [...refreshedMessages].reverse().find((message: any) => message.sender_id === WAKTI_AI_ID);

                if (
                  refreshedLastWakti?.created_at &&
                  new Date(refreshedLastWakti.created_at).getTime() >= new Date(typingStartedAt).getTime()
                ) {
                  setWaktiTyping(false);
                  setPendingWaktiSince(null);
                  return;
                }

                await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
              }

              setWaktiTyping(false);
              setPendingWaktiSince(null);
            })
            .catch((err: any) => {
              console.error("Wakti AI trigger failed:", err);
              setWaktiTyping(false);
              setPendingWaktiSince(null);
            });
        }
      },
    });
  };

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const url = await uploadGroupMessageAttachment(file, "image");
      setAttachedImage({ url, type: file.type, size: file.size });
    } catch (err: any) {
      toast.error(err?.message || (language === "ar" ? "تعذر رفع الصورة" : "Failed to upload image"));
    } finally {
      setUploading(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const duration = recordingSeconds;
        setRecordingSeconds(0);
        if (blob.size < 1000) return;
        setUploading(true);
        try {
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
          const url = await uploadGroupMessageAttachment(file, "voice");
          await sendGroupConversationMessage(conversationId!, {
            message_type: "voice",
            media_url: url,
            media_type: "audio/webm",
            voice_duration: duration,
            file_size: blob.size,
            reply_to_id: replyingTo?.id || null,
          });
          setReplyingTo(null);
          queryClient.invalidateQueries({ queryKey: ["groupConversationMessages", conversationId] });
          queryClient.invalidateQueries({ queryKey: ["groupConversation", conversationId] });
          queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
        } catch (err: any) {
          toast.error(err?.message || (language === "ar" ? "تعذر إرسال الصوت" : "Failed to send voice"));
        } finally {
          setUploading(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast.error(language === "ar" ? "لا يمكن الوصول إلى الميكروفون" : "Cannot access microphone");
    }
  }, [conversationId, language, queryClient, recordingSeconds]);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const formatSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    const message = messages.find((entry) => entry.id === messageId);
    if (!message || message.is_deleted) return;
    const hasReacted = message.reactions?.some((reaction) => reaction.user_id === user.id && reaction.emoji === emoji);
    try {
      if (hasReacted) {
        await removeGroupReaction(messageId, emoji);
      } else {
        await addGroupReaction(messageId, emoji);
      }
      queryClient.invalidateQueries({ queryKey: ["groupConversationMessages", conversationId] });
    } catch (error) {
      console.error("Group reaction error:", error);
    }
    closeMessageActions();
  };

  const handleReplyTo = (message: GroupChatMessage) => {
    setReplyingTo(message);
    closeMessageActions();
  };

  const cancelReply = () => setReplyingTo(null);
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const closeMessageActions = useCallback(() => {
    setReactionPickerFor(null);
    setSelectedActionMessage(null);
    setSelectedActionIsSentByMe(false);
    setSelectedMessageRect(null);
    longPressTriggeredRef.current = false;
    longPressStartPointRef.current = null;
    suppressNextImageTapRef.current = false;
    ignoreNextImageClickRef.current = false;
  }, []);

  const openMessageActions = useCallback((message: GroupChatMessage, isSentByMe: boolean) => {
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
    setSelectedActionMessage(message);
    setSelectedActionIsSentByMe(isSentByMe);
    setReactionPickerFor(message.id);
  }, []);

  const handleDeleteSelectedMessage = async (message: GroupChatMessage) => {
    if (message.sender_id !== user?.id) {
      toast.error(language === "ar" ? "يمكنك حذف رسائلك فقط" : "You can delete only your own message");
      return;
    }
    try {
      await deleteGroupMessage(message.id);
      toast.success(language === "ar" ? "تم حذف الرسالة" : "Message deleted");
      closeMessageActions();
      queryClient.invalidateQueries({ queryKey: ["groupConversationMessages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["groupConversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
    } catch (error) {
      console.error("Error deleting group message:", error);
      toast.error(language === "ar" ? "تعذر حذف الرسالة" : "Could not delete message");
    }
  };

  const startLongPress = (message: GroupChatMessage, isSentByMe: boolean) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTriggeredRef.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      suppressNextImageTapRef.current = true;
      openMessageActions(message, isSentByMe);
    }, 300);
  };

  const endLongPress = () => {
    const didTriggerLongPress = longPressTriggeredRef.current;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressStartPointRef.current = null;

    if (didTriggerLongPress) {
      window.setTimeout(() => {
        suppressNextImageTapRef.current = false;
        longPressTriggeredRef.current = false;
      }, 250);
      return;
    }

    suppressNextImageTapRef.current = false;
    longPressTriggeredRef.current = false;
  };

  const cleanMediaUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    return url.trim().replace(/^(%20|\s)+/, "").replace(/(%20|\s)+$/, "");
  };

  const handleTouchStart = (event: React.TouchEvent, message: GroupChatMessage, isSentByMe: boolean) => {
    if (message.is_deleted || event.touches.length !== 1) return;
    const touch = event.touches[0];
    longPressStartPointRef.current = { x: touch.clientX, y: touch.clientY };
    startLongPress(message, isSentByMe);
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    const startPoint = longPressStartPointRef.current;
    if (!startPoint || event.touches.length !== 1) {
      endLongPress();
      return;
    }

    const touch = event.touches[0];
    const moveDistance = Math.hypot(touch.clientX - startPoint.x, touch.clientY - startPoint.y);

    if (moveDistance > 14) {
      endLongPress();
    }
  };

  const handleImageTouchEnd = (event: React.TouchEvent<HTMLImageElement>, imageUrl: string) => {
    event.stopPropagation();
    const didTriggerLongPress = longPressTriggeredRef.current;
    endLongPress();

    if (didTriggerLongPress || suppressNextImageTapRef.current) {
      return;
    }

    ignoreNextImageClickRef.current = true;
    setExpandedImage(imageUrl);
  };

  const handleImageExpand = (event: React.MouseEvent<HTMLElement>, imageUrl: string) => {
    event.stopPropagation();
    if (ignoreNextImageClickRef.current) {
      ignoreNextImageClickRef.current = false;
      return;
    }
    if (suppressNextImageTapRef.current) return;
    setExpandedImage(imageUrl);
  };

  const toggleAudioPlayback = (messageId: string, audioUrl: string) => {
    if (playingAudio === messageId) {
      audioRefs.current[messageId]?.pause();
      setPlayingAudio(null);
      return;
    }

    if (playingAudio) {
      audioRefs.current[playingAudio]?.pause();
    }

    if (!audioRefs.current[messageId]) {
      audioRefs.current[messageId] = new Audio(audioUrl);
      audioRefs.current[messageId].onended = () => setPlayingAudio(null);
    }

    audioRefs.current[messageId].play();
    setPlayingAudio(messageId);
  };

  const renderReplySnippet = (message: GroupChatMessage, isSentByMe: boolean) => {
    if (!message.reply_to || message.is_deleted) return null;

    return (
      <div className={cn(
        "mb-2 rounded-lg px-2 py-1 text-xs border-l-2",
        isSentByMe
          ? "bg-white/20 border-white/40 text-white/90"
          : isDark ? "bg-black/20 border-gray-400 text-gray-300" : "bg-black/5 border-gray-400 text-gray-600"
      )}>
        <div className="truncate">
          {message.reply_to.is_deleted
            ? (language === "ar" ? "تم حذف هذه الرسالة" : "This message was deleted")
            : message.reply_to.message_type === "image"
              ? "📷 Image"
              : message.reply_to.message_type === "voice"
                ? "🎤 Voice"
                : message.reply_to.message_type === "pdf"
                  ? "📄 PDF"
                  : message.reply_to.content || "..."}
        </div>
      </div>
    );
  };

  const renderMessageContent = (message: GroupChatMessage, isSentByMe: boolean, compact = false) => {
    if (message.is_deleted) {
      return (
        <div className={cn("text-sm italic", isDark ? "text-gray-300" : "text-gray-500")}>
          {language === "ar" ? "تم حذف هذه الرسالة" : "This message was deleted"}
        </div>
      );
    }

    if (message.message_type === "image" && message.media_url) {
      const imageUrl = cleanMediaUrl(message.media_url);

      return (
        <div className="flex max-w-full flex-col gap-2">
          <div className={cn("relative max-w-full overflow-hidden rounded-lg", !compact && "group w-full max-w-[260px]")}>
            <img
              src={imageUrl}
              alt="sent image"
              className={cn(
                "block h-auto w-full max-w-full cursor-pointer rounded-lg object-contain",
                compact ? "max-h-[260px]" : "max-h-[320px]"
              )}
              loading="lazy"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onClick={(event) => handleImageExpand(event, imageUrl)}
              onTouchEnd={(event) => handleImageTouchEnd(event, imageUrl)}
            />
            {!compact && (
              <div className="absolute top-2 right-2 hidden flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover:flex group-hover:opacity-100 sm:flex">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(event) => handleImageExpand(event, imageUrl)}
                  className="h-7 w-7 rounded-full border-0 bg-black/60 p-0 text-white hover:bg-black/80"
                >
                  <Expand className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {message.content && (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
          )}
        </div>
      );
    }

    if (message.message_type === "voice" && message.media_url) {
      return (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isSentByMe ? "ghost" : "secondary"}
              onClick={() => toggleAudioPlayback(message.id, cleanMediaUrl(message.media_url))}
              className={cn("h-8 w-8 p-0 rounded-full", isSentByMe ? "hover:bg-white/20" : "hover:bg-black/10")}
            >
              {playingAudio === message.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <span className="text-sm">{formatSeconds(message.voice_duration || 0)}</span>
          </div>
        </div>
      );
    }

    if (message.message_type === "pdf") {
      return (
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm truncate">{message.content || (language === "ar" ? "ملف PDF" : "PDF")}</span>
        </div>
      );
    }

    return (
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
    );
  };

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 390;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 844;
  const reactionBarWidth = Math.min(312, Math.max(252, viewportWidth - 32));
  const actionMenuWidth = Math.min(220, Math.max(180, viewportWidth - 32));
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

  const renderPopupMessagePreview = (message: GroupChatMessage, isSentByMe: boolean) => (
    <div
      className={cn(
        "select-none px-4 py-3 rounded-2xl backdrop-blur-sm shadow-2xl",
        isSentByMe
          ? "bg-[linear-gradient(135deg,hsl(210_100%_55%)_0%,hsl(195_100%_50%)_100%)] text-white rounded-br-sm"
          : isDark ? "bg-[#1b202b]/95 text-white rounded-bl-sm" : "bg-white text-[#060541] rounded-bl-sm"
      )}
      style={{ width: messagePreviewWidth, WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}
    >
      {renderReplySnippet(message, isSentByMe)}
      {renderMessageContent(message, isSentByMe, true)}
    </div>
  );

  if (loadingConversation) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md rounded-3xl border border-border/60">
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-lg font-semibold">{language === "ar" ? "المجموعة غير موجودة" : "Group not found"}</p>
            <Button onClick={handleBack}>{language === "ar" ? "العودة" : "Back"}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 flex w-full max-w-full flex-col overflow-x-hidden overscroll-x-none bg-background" style={{ top: 'var(--app-header-h, 64px)', touchAction: 'pan-y' }}>
      {/* ── Fixed Header ── */}
      <div className="shrink-0 border-b border-border/60 bg-background/95 backdrop-blur z-20">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="outline" className="h-10 rounded-xl px-3 shrink-0" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === "ar" ? "رجوع" : "Back"}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold">{conversation.name}</h1>
              <Badge
                className="bg-[hsl(210_100%_55%)] text-white border-transparent shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
                onClick={() => setShowMembersModal(true)}
              >
                <Users className="h-3 w-3 mr-1" />
                {conversation.participants.length}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable Messages ── */}
      <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto px-4 py-4" style={{ touchAction: 'pan-y' }}>
        <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-3 overflow-x-hidden">
          {loadingMessages ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <Card className="rounded-3xl border border-border/60 bg-card/70">
              <CardContent className="py-12 text-center space-y-3">
                <div className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] shadow-[0_0_30px_hsla(210,100%,65%,0.25)]">
                  <Users className="h-7 w-7 text-white" />
                </div>
                <p className="text-lg font-semibold">{language === "ar" ? "ابدأ أول رسالة" : "Start the first message"}</p>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "هذه المجموعة جاهزة الآن للمحادثة" : "This group is ready to chat"}</p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {messages.map((message) => {
                const mine = message.sender_id === user?.id;
                const isWakti = message.sender_id === WAKTI_AI_ID;
                const showUnreadDivider = unreadSeparatorMessageId === message.id;
                const senderLabel = mine
                  ? (language === "ar" ? "أنت" : "You")
                  : isWakti
                    ? "Wakti"
                    : message.sender?.display_name || message.sender?.username || (language === "ar" ? "عضو" : "Member");
                const displayedReaction = !message.is_deleted && message.reactions && message.reactions.length > 0
                  ? [...message.reactions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                  : null;

                return (
                  <Fragment key={message.id}>
                    {showUnreadDivider && (
                      <div ref={unreadDividerRef} className="my-2 flex items-center gap-3 px-1">
                        <div className="h-px flex-1 bg-border/80" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(210_100%_55%)]">
                          {language === "ar" ? "رسائل غير مقروءة" : "Unread messages"}
                        </span>
                        <div className="h-px flex-1 bg-border/80" />
                      </div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={cn("flex w-full min-w-0 select-none", mine ? "justify-end" : "justify-start")}
                      onContextMenu={(event) => {
                        if (message.is_deleted) return;
                        event.preventDefault();
                        openMessageActions(message, mine);
                      }}
                      onTouchStart={(event) => handleTouchStart(event, message, mine)}
                      onTouchEnd={endLongPress}
                      onTouchMove={handleTouchMove}
                      onTouchCancel={endLongPress}
                      onMouseDown={(event) => {
                        if (message.is_deleted || event.button !== 0) return;
                        event.preventDefault();
                        startLongPress(message, mine);
                      }}
                      onMouseUp={endLongPress}
                      onMouseLeave={endLongPress}
                      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
                    >
                      <div className={cn("flex min-w-0 max-w-[85%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
                        {!mine && (
                          <div className="mb-1 flex items-center gap-2 px-1">
                            <Avatar className="h-7 w-7">
                              {message.sender?.avatar_url && <AvatarImage src={message.sender.avatar_url} />}
                              <AvatarFallback className={cn(
                                "text-white text-[10px] font-bold",
                                isWakti
                                  ? "bg-[linear-gradient(135deg,hsl(280_70%_65%)_0%,hsl(210_100%_65%)_100%)]"
                                  : "bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)]"
                              )}>
                                {isWakti ? "WA" : senderLabel.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-muted-foreground">{senderLabel}</span>
                            {isWakti && (
                              <Badge className="bg-[hsl(280_60%_65%)]/20 text-[hsl(280_60%_65%)] border-[hsl(280_60%_65%)]/30 text-[10px] px-1.5 py-0">
                                <Sparkles className="h-2 w-2 mr-0.5" />
                                AI
                              </Badge>
                            )}
                          </div>
                        )}

                        <div className={cn("relative inline-block max-w-full", displayedReaction && "pb-4")}>
                          <div
                            ref={(element) => {
                              messageBubbleRefs.current[message.id] = element;
                            }}
                            className={cn(
                              "max-w-full overflow-hidden select-none rounded-3xl px-4 shadow-sm",
                              displayedReaction ? "pt-5 pb-3" : "py-3",
                              mine
                                ? "bg-[linear-gradient(135deg,hsl(210_100%_55%)_0%,hsl(195_100%_50%)_100%)] text-white"
                                : isWakti
                                  ? "bg-[linear-gradient(135deg,hsl(280_60%_65%)/10_0%,hsl(210_100%_65%)/10_100%)] border border-[hsl(280_60%_65%)]/20 text-foreground"
                                  : isDark ? "bg-white/8 text-white border border-white/10" : "bg-white border border-[#d9dee9] text-[#060541]"
                            )}
                            style={{ WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" }}
                          >
                            {renderReplySnippet(message, mine)}
                            {renderMessageContent(message, mine)}
                          </div>

                          {displayedReaction && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleReaction(message.id, displayedReaction.emoji);
                              }}
                              className={cn(
                                "absolute -top-2 right-2 z-10 flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-sm shadow-md",
                                isDark ? "border-white/10 bg-[#1f1f1f] text-white" : "border-black/10 bg-white text-gray-900"
                              )}
                            >
                              <span>{displayedReaction.emoji}</span>
                            </button>
                          )}
                        </div>

                        <div className={cn("mt-1 px-1 text-[11px] text-muted-foreground", mine ? "text-right" : "text-left")}>
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </motion.div>
                  </Fragment>
                );
              })}
            </AnimatePresence>
          )}
          {/* Wakti typing indicator */}
          {waktiTyping && (
            <div className="flex justify-start">
              <div className="max-w-[85%] sm:max-w-[70%] flex flex-col items-start">
                <div className="mb-1 flex items-center gap-2 px-1">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-[linear-gradient(135deg,hsl(280_70%_65%)_0%,hsl(210_100%_65%)_100%)] text-white text-[10px] font-bold">
                      WA
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-muted-foreground">Wakti</span>
                  <Badge className="bg-[hsl(280_60%_65%)]/20 text-[hsl(280_60%_65%)] border-[hsl(280_60%_65%)]/30 text-[10px] px-1.5 py-0">
                    <Sparkles className="h-2 w-2 mr-0.5" />
                    AI
                  </Badge>
                </div>
                <div className="rounded-3xl px-4 py-3 shadow-sm bg-[linear-gradient(135deg,hsl(280_60%_65%)/10_0%,hsl(210_100%_65%)/10_100%)] border border-[hsl(280_60%_65%)]/30 text-foreground animate-pulse">
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1.5 items-center h-5">
                      <span className="w-2 h-2 rounded-full bg-[hsl(280_60%_65%)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[hsl(280_60%_65%)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-[hsl(280_60%_65%)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm font-medium text-[hsl(280_60%_65%)]">
                      {language === "ar" ? "وكتي يفكر..." : "Wakti is thinking..."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Members typing indicator */}
          {(() => {
            const activeTypingIds = Array.from(typingUserIds).filter(
              (id) => id !== user?.id && id !== WAKTI_AI_ID
            );
            if (activeTypingIds.length === 0) return null;

            const getName = (uid: string) => {
              const p = conversation?.participants.find((pt) => pt.user_id === uid);
              return p?.profile?.display_name || p?.profile?.username || (language === "ar" ? "عضو" : "Member");
            };
            const getAvatar = (uid: string) => {
              const p = conversation?.participants.find((pt) => pt.user_id === uid);
              return p?.profile?.avatar_url;
            };
            const getInitials = (uid: string) => {
              const p = conversation?.participants.find((pt) => pt.user_id === uid);
              const name = p?.profile?.display_name || p?.profile?.username || "M";
              return name.slice(0, 2).toUpperCase();
            };

            const names = activeTypingIds.map(getName);
            let label: string;
            if (names.length === 1) {
              label = language === "ar" ? `${names[0]} يكتب...` : `${names[0]} is typing...`;
            } else if (names.length === 2) {
              label = language === "ar" ? `${names[0]} و ${names[1]} يكتبان...` : `${names[0]} and ${names[1]} are typing...`;
            } else {
              label = language === "ar" ? "أشخاص عدة يكتبون..." : "Several people are typing...";
            }

            return (
              <div className="flex justify-start">
                <div className="max-w-[85%] sm:max-w-[70%] flex flex-col items-start">
                  <div className="mb-1 flex items-center gap-2 px-1">
                    {activeTypingIds.slice(0, 2).map((uid) => (
                      <Avatar key={uid} className="h-7 w-7">
                        {getAvatar(uid) && <AvatarImage src={getAvatar(uid)} />}
                        <AvatarFallback className="bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] text-white text-[10px] font-bold">
                          {getInitials(uid)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  </div>
                  <div className={`rounded-3xl px-4 py-3 shadow-sm border text-foreground ${
                    isDark
                      ? 'bg-dark-secondary/60 border-white/10'
                      : 'bg-light-secondary/40 border-black/10'
                  }`}>
                    <div className="flex gap-1.5 items-center h-5">
                      <span className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-gray-400' : 'bg-gray-500'}`} style={{ animationDelay: '0ms' }} />
                      <span className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-gray-400' : 'bg-gray-500'}`} style={{ animationDelay: '150ms' }} />
                      <span className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-gray-400' : 'bg-gray-500'}`} style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div ref={endRef} />
        </div>

      </div>

      {/* Scroll-to-bottom button */}
      {showScrollToBottom && messages.length > 0 && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "fixed bottom-24 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 border",
            isDark
              ? "bg-[hsl(240_1%_38%)]/90 text-[#f2f2f2] shadow-[0_4px_16px_rgba(0,0,0,0.5)] border-white/30"
              : "bg-white/95 text-[#060541] shadow-[0_4px_16px_rgba(0,0,0,0.2)] border-[#060541]/15"
          )}
          aria-label={language === "ar" ? "الرسالة الأخيرة" : "Last message"}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      )}

      {/* ── Fixed Input Bar ── */}
      <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur px-4 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">

          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span>{language === "ar" ? "جارٍ التسجيل" : "Recording"} {formatSeconds(recordingSeconds)}</span>
              <button onClick={stopRecording} className="ml-auto" aria-label={language === "ar" ? "إلغاء التسجيل" : "Cancel recording"}>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {replyingTo && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-xs",
              isDark ? "bg-white/8 text-gray-300 border border-white/10" : "bg-card text-muted-foreground border border-border/40"
            )}>
              <Reply className="h-3 w-3 flex-shrink-0" />
              <span className="truncate flex-1">
                {replyingTo.is_deleted
                  ? (language === "ar" ? "تم حذف هذه الرسالة" : "This message was deleted")
                  : replyingTo.message_type === "image"
                    ? "📷 Image"
                    : replyingTo.message_type === "voice"
                      ? "🎤 Voice"
                      : replyingTo.message_type === "pdf"
                        ? "📄 PDF"
                        : replyingTo.content || "..."}
              </span>
              <button onClick={cancelReply} className="flex-shrink-0 hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Attached image preview */}
          {attachedImage && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/40">
              <img src={attachedImage.url} alt="attached" className="h-12 w-12 rounded-lg object-cover" />
              <span className="text-sm text-muted-foreground flex-1 truncate">
                {language === "ar" ? "صورة مرفقة" : "Image attached"}
              </span>
              <button
                onClick={() => setAttachedImage(null)}
                className="ml-auto p-1 rounded-full hover:bg-white/10"
                aria-label={language === "ar" ? "إزالة الصورة" : "Remove image"}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Left side: Image + Mic stacked vertically */}
            <div className="flex flex-col gap-1 shrink-0">
              {/* Image picker */}
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} aria-label={language === "ar" ? "اختر صورة" : "Choose image"} />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl shrink-0 text-muted-foreground hover:text-foreground"
                disabled={uploading || sendMutation.isPending || isRecording || !!attachedImage}
                onClick={() => imageInputRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
              </Button>

              {/* Mic */}
              <Button
                variant={isRecording ? "destructive" : "ghost"}
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-xl shrink-0",
                  !isRecording && "text-muted-foreground hover:text-foreground"
                )}
                onPointerDown={startRecording}
                onPointerUp={stopRecording}
                onPointerLeave={stopRecording}
                disabled={uploading || sendMutation.isPending}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>

            {/* Text input */}
            <Textarea
              value={messageText}
              onChange={(e) => {
                const text = e.target.value;
                setMessageText(text);
                if (text.length >= 1) {
                  const now = Date.now();
                  if (now - lastTypingSentRef.current > 800) {
                    broadcastTyping(true);
                    lastTypingSentRef.current = now;
                  }
                }
              }}
              onFocus={() => broadcastTyping(true)}
              onBlur={() => broadcastTyping(false)}
              placeholder={attachedImage
                ? (language === "ar" ? "أضف تعليق... (اختياري)" : "Add a caption... (optional)")
                : (language === "ar" ? "اكتب رسالة للمجموعة" : "Write a message to the group")
              }
              className="min-h-[88px] max-h-32 rounded-2xl resize-none flex-1"
              disabled={isRecording || uploading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); }
              }}
            />

            {/* Right side: @ button + Send */}
            <div className="flex flex-col gap-1 shrink-0">
              {/* @wakti button */}
              {waktiInGroup && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl shrink-0 text-[hsl(280_60%_65%)] hover:bg-[hsl(280_60%_65%)]/10"
                  onClick={() => setMessageText((prev) => prev + "@wakti ")}
                  disabled={isRecording || uploading}
                  title="@wakti"
                >
                  <AtSign className="h-4 w-4" />
                </Button>
              )}

              {/* Send */}
              <Button
                className="h-10 w-10 rounded-xl shrink-0 p-0"
                onClick={handleSendText}
                disabled={(!messageText.trim() && !attachedImage) || sendMutation.isPending || uploading}
              >
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
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
                background: "rgba(28,28,30,0.98)",
                boxShadow: "0 14px 40px rgba(0,0,0,0.38)",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {reactionPickerFor === selectedActionMessage.id && ["👍","❤️","😂","😮","😢","🙏"].map((emoji) => (
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
                background: "rgba(36,36,38,0.98)",
                boxShadow: "0 14px 40px rgba(0,0,0,0.42)",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => handleReplyTo(selectedActionMessage)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-base text-white hover:bg-white/5"
              >
                <Reply className="h-4 w-4" />
                <span>{language === "ar" ? "رد" : "Reply"}</span>
              </button>
              {selectedActionIsSentByMe && (
                <button
                  onClick={() => handleDeleteSelectedMessage(selectedActionMessage)}
                  className="flex w-full items-center gap-3 border-t border-white/10 px-5 py-4 text-left text-base text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{language === "ar" ? "حذف" : "Delete"}</span>
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {expandedImage && (
        <ImageModal
          isOpen={!!expandedImage}
          onClose={() => setExpandedImage(null)}
          imageUrl={expandedImage}
        />
      )}

      {/* ── Members Modal ── */}
      <Dialog open={showMembersModal} onOpenChange={setShowMembersModal}>
        <DialogContent className="rounded-2xl border border-border/60 max-w-sm p-0 overflow-hidden">
          <div className="p-5 pb-3">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-[hsl(210_100%_55%)]" />
                {language === "ar" ? "أعضاء المجموعة" : "Group Members"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {language === "ar" ? "قائمة بجميع أعضاء هذه المجموعة" : "List of all members in this group"}
              </DialogDescription>
            </DialogHeader>

            {/* Creator actions */}
            {isCreator && (
              <div className="flex flex-col gap-2 mt-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl text-xs"
                    onClick={() => { setShowMembersModal(false); setNewGroupName(conversation?.name || ""); setShowRenameModal(true); }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {language === "ar" ? "تغيير الاسم" : "Rename"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl text-xs"
                    onClick={() => { setShowMembersModal(false); setSelectedNewMembers([]); setShowAddMembersModal(true); }}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    {language === "ar" ? "إضافة أعضاء" : "Add Members"}
                  </Button>
                </div>
                {/* Wakti AI toggle */}
                {waktiInGroup ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-xs text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                    onClick={() => removeWaktiMutation.mutate()}
                    disabled={removeWaktiMutation.isPending}
                  >
                    {removeWaktiMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                    {language === "ar" ? "إزالة وكتي من المجموعة" : "Remove Wakti from Group"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-xs"
                    onClick={() => addWaktiMutation.mutate()}
                    disabled={addWaktiMutation.isPending}
                  >
                    {addWaktiMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                    {language === "ar" ? "إضافة وكتي للمجموعة" : "Add Wakti to Group"}
                  </Button>
                )}
                {/* AI Settings button — only when Wakti is in group */}
                {waktiInGroup && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl text-xs text-[hsl(280_60%_65%)] border-[hsl(280_60%_65%)]/30 hover:bg-[hsl(280_60%_65%)]/10"
                    onClick={() => {
                      setShowMembersModal(false);
                      setAiTone(conversation?.ai_tone || "friendly");
                      setAiLength(conversation?.ai_response_length || "medium");
                      setAiStyle(conversation?.ai_response_style || "natural");
                      setAiSearchEnabled(conversation?.ai_search_enabled ?? true);
                      setShowAiSettingsModal(true);
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {language === "ar" ? "إعدادات وكتي" : "Wakti AI Settings"}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-5 pb-5 space-y-3">
            {conversation?.participants.map((participant) => {
              const participantIsCreator = participant.user_id === conversation.created_by;
              const isMe = participant.user_id === user?.id;
              const displayName = participant.profile?.display_name || participant.profile?.username || (language === "ar" ? "عضو" : "Member");
              return (
                <div key={participant.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/40">
                  <Avatar className="h-10 w-10">
                    {participant.profile?.avatar_url && (
                      <AvatarImage src={participant.profile.avatar_url} />
                    )}
                    <AvatarFallback className="bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] text-white text-xs font-bold">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">
                        {displayName}
                        {isMe && (
                          <span className="text-muted-foreground font-normal">
                            {language === "ar" ? " (أنت)" : " (You)"}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {participantIsCreator && (
                        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0">
                          <Crown className="h-2.5 w-2.5 mr-0.5" />
                          {language === "ar" ? "المؤسس" : "Creator"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leave group button (non-creators only) */}
          {!isCreator && (
            <div className="px-5 pb-5 pt-2">
              <Button
                variant="destructive"
                className="w-full rounded-xl"
                onClick={() => {
                  if (window.confirm(language === "ar" ? "هل أنت متأكد من مغادرة المجموعة؟" : "Are you sure you want to leave this group?")) {
                    leaveMutation.mutate();
                  }
                }}
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                {language === "ar" ? "مغادرة المجموعة" : "Leave Group"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Rename Modal ── */}
      <Dialog open={showRenameModal} onOpenChange={setShowRenameModal}>
        <DialogContent className="rounded-2xl border border-border/60 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {language === "ar" ? "تغيير اسم المجموعة" : "Rename Group"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {language === "ar" ? "اكتب اسم المجموعة الجديد" : "Enter the new group name"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={language === "ar" ? "اسم المجموعة الجديد" : "New group name"}
              className="min-h-[44px] rounded-xl resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); renameMutation.mutate({ name: newGroupName }); }
              }}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowRenameModal(false)}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={() => renameMutation.mutate({ name: newGroupName })}
                disabled={renameMutation.isPending || !newGroupName.trim() || newGroupName.trim() === conversation?.name}
              >
                {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── AI Settings Modal ── */}
      <Dialog open={showAiSettingsModal} onOpenChange={setShowAiSettingsModal}>
        <DialogContent className="rounded-2xl border border-border/60 max-w-sm p-0 overflow-hidden">
          <div className="p-5 pb-3">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[hsl(280_60%_65%)]" />
                {language === "ar" ? "إعدادات وكتي" : "Wakti AI Settings"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {language === "ar" ? "تحكم في شخصية وكتي في هذه المجموعة" : "Control Wakti's personality in this group"}
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mt-2">
              {language === "ar"
                ? "غيّر كيف يتصرف وكتي ويرد في هذه المجموعة"
                : "Change how Wakti behaves and replies in this group"}
            </p>
          </div>
          <div className="px-5 pb-5 space-y-4">
            {/* Tone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {language === "ar" ? "النبرة" : "Tone"}
              </label>
              <select
                value={aiTone}
                onChange={(e) => setAiTone(e.target.value)}
                aria-label={language === "ar" ? "نبرة وكتي" : "Wakti tone"}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(210_100%_55%)]"
              >
                <option value="friendly">{language === "ar" ? "ودود" : "Friendly"}</option>
                <option value="formal">{language === "ar" ? "رسمي" : "Formal"}</option>
                <option value="sarcastic">{language === "ar" ? "ساخر" : "Sarcastic"}</option>
                <option value="chill">{language === "ar" ? "هادئ" : "Chill"}</option>
                <option value="professional">{language === "ar" ? "احترافي" : "Professional"}</option>
                <option value="enthusiastic">{language === "ar" ? "متحمس" : "Enthusiastic"}</option>
              </select>
            </div>

            {/* Response Length */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {language === "ar" ? "طول الرد" : "Response Length"}
              </label>
              <select
                value={aiLength}
                onChange={(e) => setAiLength(e.target.value)}
                aria-label={language === "ar" ? "طول رد وكتي" : "Wakti response length"}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(210_100%_55%)]"
              >
                <option value="short">{language === "ar" ? "قصير — 1-2 أسطر" : "Short — 1-2 lines"}</option>
                <option value="medium">{language === "ar" ? "متوسط — 3-5 أسطر" : "Medium — 3-5 lines"}</option>
                <option value="long">{language === "ar" ? "مفصل — 6-10 أسطر" : "Long — 6-10 lines"}</option>
              </select>
            </div>

            {/* Response Style */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {language === "ar" ? "أسلوب الرد" : "Response Style"}
              </label>
              <select
                value={aiStyle}
                onChange={(e) => setAiStyle(e.target.value)}
                aria-label={language === "ar" ? "أسلوب رد وكتي" : "Wakti response style"}
                className="w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(210_100%_55%)]"
              >
                <option value="natural">{language === "ar" ? "طبيعي" : "Natural"}</option>
                <option value="concise">{language === "ar" ? "مختصر" : "Concise"}</option>
                <option value="detailed">{language === "ar" ? "مفصل" : "Detailed"}</option>
                <option value="funny">{language === "ar" ? "فكاهي" : "Funny"}</option>
                <option value="educational">{language === "ar" ? "تعليمي" : "Educational"}</option>
                <option value="encouraging">{language === "ar" ? "محفز" : "Encouraging"}</option>
              </select>
            </div>

            {/* Search Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-card/50">
              <div>
                <p className="text-sm font-medium">
                  {language === "ar" ? "بحث Google" : "Google Search"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "يسمح لوكتي بالبحث في الإنترنت" : "Allow Wakti to search the web"}
                </p>
              </div>
              <button
                onClick={() => setAiSearchEnabled((prev) => !prev)}
                className={cn(
                  "relative h-7 w-12 rounded-full transition-colors",
                  aiSearchEnabled ? "bg-[hsl(210_100%_55%)]" : "bg-muted"
                )}
                aria-label={language === "ar" ? "تبديل البحث" : "Toggle search"}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                    aiSearchEnabled ? "left-[26px]" : "left-0.5"
                  )}
                />
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowAiSettingsModal(false)}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                className="flex-1 rounded-xl"
                onClick={async () => {
                  try {
                    await updateGroupAiSettings(conversationId!, {
                      tone: aiTone,
                      responseLength: aiLength,
                      responseStyle: aiStyle,
                      searchEnabled: aiSearchEnabled,
                    });
                    queryClient.invalidateQueries({ queryKey: ["groupConversation", conversationId] });
                    toast.success(language === "ar" ? "تم تحديث إعدادات وكتي" : "Wakti settings updated");
                    setShowAiSettingsModal(false);
                  } catch (err: any) {
                    toast.error(err?.message || (language === "ar" ? "تعذر التحديث" : "Update failed"));
                  }
                }}
              >
                {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Members Modal ── */}
      <Dialog open={showAddMembersModal} onOpenChange={setShowAddMembersModal}>
        <DialogContent className="rounded-2xl border border-border/60 max-w-sm p-0 overflow-hidden">
          <div className="p-5 pb-3">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[hsl(210_100%_55%)]" />
                {language === "ar" ? "إضافة أعضاء" : "Add Members"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {language === "ar" ? "اختر جهات الاتصال لإضافتها للمجموعة" : "Select contacts to add to the group"}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[50vh] overflow-y-auto px-5 pb-3 space-y-2">
            {eligibleContacts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {language === "ar" ? "لا يوجد جهات اتصال متاحة" : "No contacts available"}
              </p>
            )}
            {eligibleContacts.map((contact: any) => {
              const profile = contact.profile;
              const contactId = contact.contact_id;
              const alreadyMember = conversation?.participants.some((p: any) => p.user_id === contactId);
              const selected = selectedNewMembers.includes(contactId);
              const displayName = profile?.display_name || profile?.username || (language === "ar" ? "جهة اتصال" : "Contact");
              return (
                <button
                  key={contactId}
                  disabled={alreadyMember}
                  onClick={() => {
                    if (alreadyMember) return;
                    setSelectedNewMembers((prev) =>
                      selected ? prev.filter((id) => id !== contactId) : [...prev, contactId]
                    );
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                    alreadyMember
                      ? "opacity-50 cursor-not-allowed"
                      : selected
                        ? "bg-[hsl(210_100%_55%)]/10 border border-[hsl(210_100%_55%)]/30"
                        : "bg-card/50 border border-border/40 hover:bg-card/80"
                  }`}
                >
                  <Avatar className="h-9 w-9">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                    <AvatarFallback className="bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] text-white text-xs font-bold">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm truncate">
                      {displayName}
                    </span>
                    {alreadyMember && (
                      <span className="text-[10px] text-muted-foreground block">
                        {language === "ar" ? "عضو بالفعل" : "Already a member"}
                      </span>
                    )}
                  </div>
                  {selected && !alreadyMember && (
                    <div className="h-5 w-5 rounded-full bg-[hsl(210_100%_55%)] flex items-center justify-center text-white text-xs font-bold">✓</div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-5 pb-5 pt-2 flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowAddMembersModal(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={() => addMembersMutation.mutate(selectedNewMembers)}
              disabled={addMembersMutation.isPending || selectedNewMembers.length === 0}
            >
              {addMembersMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              {language === "ar" ? `إضافة (${selectedNewMembers.length})` : `Add (${selectedNewMembers.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
