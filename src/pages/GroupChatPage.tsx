import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Send, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getGroupConversation, getGroupConversationMessages, markGroupConversationRead, sendGroupConversationMessage } from "@/services/groupChatService";
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
  const endRef = useRef<HTMLDivElement | null>(null);
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
    mutationFn: async () => sendGroupConversationMessage(conversationId!, messageText),
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

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    markGroupConversationRead(conversationId).catch(() => undefined);
    queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const participantNames = useMemo(() => {
    if (!conversation) {
      return "";
    }

    return conversation.participants
      .filter((participant) => participant.user_id !== user?.id)
      .map((participant) => participant.profile?.display_name || participant.profile?.username || (language === "ar" ? "عضو" : "Member"))
      .join(language === "ar" ? "، " : ", ");
  }, [conversation, language, user?.id]);

  const handleBack = () => {
    if (entrySource === "account") {
      navigate("/account?tab=social");
      return;
    }

    navigate("/contacts?tab=groups");
  };

  const handleSend = () => {
    if (!messageText.trim() || sendMutation.isPending) {
      return;
    }

    sendMutation.mutate();
  };

  if (loadingConversation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
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
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="outline" className="h-10 rounded-xl px-3 shrink-0" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === "ar" ? "رجوع" : "Back"}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold">{conversation.name}</h1>
              <Badge className="bg-[hsl(210_100%_55%)] text-white border-transparent">
                <Users className="h-3 w-3 mr-1" />
                {conversation.participants.length}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground mt-0.5">{participantNames}</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
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
                <p className="text-sm text-muted-foreground">{language === "ar" ? "هذه المجموعة جاهزة الآن للمحادثة" : "This group is ready to chat now"}</p>
              </CardContent>
            </Card>
          ) : (
            messages.map((message) => {
              const mine = message.sender_id === user?.id;
              const senderLabel = mine
                ? (language === "ar" ? "أنت" : "You")
                : message.sender?.display_name || message.sender?.username || (language === "ar" ? "عضو" : "Member");

              return (
                <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
                    {!mine && (
                      <div className="mb-1 flex items-center gap-2 px-1">
                        <Avatar className="h-7 w-7">
                          {message.sender?.avatar_url && <AvatarImage src={message.sender.avatar_url} />}
                          <AvatarFallback className="bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] text-white text-[10px] font-bold">
                            {senderLabel.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-muted-foreground">{senderLabel}</span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-3xl px-4 py-3 shadow-sm",
                        mine
                          ? "bg-[linear-gradient(135deg,hsl(210_100%_55%)_0%,hsl(195_100%_50%)_100%)] text-white"
                          : isDark
                            ? "bg-white/8 text-white border border-white/10"
                            : "bg-white border border-[#d9dee9] text-[#060541]"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                    </div>
                    <div className={cn("mt-1 px-1 text-[11px] text-muted-foreground", mine ? "text-right" : "text-left")}>
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border/60 bg-background/95 backdrop-blur p-4">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-3">
          <Textarea
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder={language === "ar" ? "اكتب رسالة للمجموعة" : "Write a message to the group"}
            className="min-h-[56px] max-h-36 rounded-2xl resize-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <Button className="h-14 rounded-2xl px-5" onClick={handleSend} disabled={sendMutation.isPending || !messageText.trim()}>
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
