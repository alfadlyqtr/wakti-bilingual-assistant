import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AtSign, Crown, Image, Loader2, LogOut, Mic, MicOff, Pencil, Send, Sparkles, UserPlus, Users, X } from "lucide-react";
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
import { getGroupConversation, getGroupConversationMessages, markGroupConversationRead, sendGroupConversationMessage, uploadGroupMessageAttachment, leaveGroupConversation, renameGroupConversation, addGroupMembers, getEligibleGroupContacts, addWaktiToGroup, removeWaktiFromGroup, isWaktiInGroup, triggerWaktiAI } from "@/services/groupChatService";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [attachedImage, setAttachedImage] = useState<{ url: string; type: string; size: number } | null>(null);
  const [waktiTyping, setWaktiTyping] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialScrollDoneRef = useRef(false);
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

  useEffect(() => {
    if (!conversationId) return;
    initialScrollDoneRef.current = false; // reset when switching conversations
    markGroupConversationRead(conversationId).catch(() => undefined);
    queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
  }, [conversationId, queryClient]);

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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  // Scroll to bottom — instant on first load, smooth after that
  useEffect(() => {
    if (messages.length === 0) return;
    const container = messagesContainerRef.current;
    const end = endRef.current;
    if (!container || !end) return;

    if (!initialScrollDoneRef.current) {
      // First load — instant scroll to bottom
      end.scrollIntoView({ behavior: "auto" });
      initialScrollDoneRef.current = true;
    } else {
      // New message arrived while chatting — smooth scroll
      end.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Turn off Wakti typing indicator when a new Wakti message arrives
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.sender_id === WAKTI_AI_ID && waktiTyping) {
      setWaktiTyping(false);
    }
  }, [messages, waktiTyping]);

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
        { timeout: 1500, maximumAge: 300000 }
      );
    });
  };

  // Only request GPS when the message is actually about location
  const needsLocationContext = (text: string): boolean => {
    const lower = text.toLowerCase();
    const locationKeywords = [
      // English
      "where", "location", "near", "nearby", "here", "meet", "coming", "address",
      "place", "direction", "map", "gps", "coordinates", "distance", "route",
      // Arabic
      "أين", "وين", "مكان", "موقع", "قريب", "هنا", "نلتقي", "تجي", "عنوان",
      "خريطة", "إحداثيات", "مسافة", "طريق", "وينك", "وينكم",
    ];
    return locationKeywords.some((kw) => lower.includes(kw.toLowerCase()));
  };

  const handleSendText = async () => {
    if (sendMutation.isPending) return;
    const text = messageText.trim();

    // Must have text OR attached image
    if (!text && !attachedImage) return;

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
      };
    } else {
      payload = text;
    }

    sendMutation.mutate(payload, {
      onSuccess: async (data: any) => {
        setAttachedImage(null);
        // If @wakti was mentioned, trigger AI response
        if (hasMention && waktiInGroup && data?.id) {
          setWaktiTyping(true);
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
          triggerWaktiAI(conversationId!, triggerPayload).catch((err: any) => {
            console.error("Wakti AI trigger failed:", err);
            setWaktiTyping(false);
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
          });
          queryClient.invalidateQueries({ queryKey: ["groupConversationMessages", conversationId] });
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
    <div className="flex flex-col bg-background fixed inset-x-0 bottom-0" style={{ top: 'var(--app-header-h, 64px)' }}>
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
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
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
            messages.map((message) => {
              const mine = message.sender_id === user?.id;
              const isWakti = message.sender_id === WAKTI_AI_ID;
              const senderLabel = mine
                ? (language === "ar" ? "أنت" : "You")
                : isWakti
                  ? "Wakti"
                  : message.sender?.display_name || message.sender?.username || (language === "ar" ? "عضو" : "Member");

              return (
                <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] sm:max-w-[70%] flex flex-col", mine ? "items-end" : "items-start")}>
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

                    {message.message_type === "image" && message.media_url ? (
                      <div className="flex flex-col gap-1">
                        <div className={cn("rounded-2xl overflow-hidden shadow-sm border", mine ? "border-blue-400/30" : "border-border/40")}>
                          <img src={message.media_url} alt="sent image" className="max-w-[260px] max-h-[320px] object-cover block" />
                        </div>
                        {message.content && (
                          <div className={cn(
                            "rounded-3xl px-4 py-2 shadow-sm self-start",
                            mine
                              ? "bg-[linear-gradient(135deg,hsl(210_100%_55%)_0%,hsl(195_100%_50%)_100%)] text-white"
                              : isDark ? "bg-white/8 text-white border border-white/10" : "bg-white border border-[#d9dee9] text-[#060541]"
                          )}>
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                          </div>
                        )}
                      </div>
                    ) : message.message_type === "voice" && message.media_url ? (
                      <div className={cn(
                        "rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3",
                        mine
                          ? "bg-[linear-gradient(135deg,hsl(210_100%_55%)_0%,hsl(195_100%_50%)_100%)] text-white"
                          : isDark ? "bg-white/8 text-white border border-white/10" : "bg-white border border-[#d9dee9] text-[#060541]"
                      )}>
                        <Mic className="h-4 w-4 shrink-0" />
                        <audio controls src={message.media_url} className="max-w-[180px] h-8" />
                        {message.voice_duration && (
                          <span className="text-xs opacity-70">{formatSeconds(message.voice_duration)}</span>
                        )}
                      </div>
                    ) : (
                      <div className={cn(
                        "rounded-3xl px-4 py-3 shadow-sm",
                        mine
                          ? "bg-[linear-gradient(135deg,hsl(210_100%_55%)_0%,hsl(195_100%_50%)_100%)] text-white"
                          : isWakti
                            ? "bg-[linear-gradient(135deg,hsl(280_60%_65%)/10_0%,hsl(210_100%_65%)/10_100%)] border border-[hsl(280_60%_65%)]/20 text-foreground"
                            : isDark ? "bg-white/8 text-white border border-white/10" : "bg-white border border-[#d9dee9] text-[#060541]"
                      )}>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                      </div>
                    )}

                    <div className={cn("mt-1 px-1 text-[11px] text-muted-foreground", mine ? "text-right" : "text-left")}>
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              );
            })
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
                <div className="rounded-3xl px-4 py-3 shadow-sm bg-[linear-gradient(135deg,hsl(280_60%_65%)/10_0%,hsl(210_100%_65%)/10_100%)] border border-[hsl(280_60%_65%)]/20 text-foreground">
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1 items-center h-5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(280_60%_65%)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(280_60%_65%)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[hsl(280_60%_65%)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {language === "ar" ? "وكتي يفكر..." : "Wakti is thinking..."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

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
              onChange={(e) => setMessageText(e.target.value)}
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
