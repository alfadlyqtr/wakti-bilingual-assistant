import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageSquarePlus, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getEligibleGroupContacts, getMyGroupConversations, createGroupConversation } from "@/services/groupChatService";

interface GroupChatTabProps {
  embedded?: boolean;
}

export function GroupChatTab({ embedded = false }: GroupChatTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useTheme();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groupConversations"],
    queryFn: getMyGroupConversations,
    staleTime: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: eligibleContacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["groupChatEligibleContacts"],
    queryFn: getEligibleGroupContacts,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const createMutation = useMutation({
    mutationFn: async () => createGroupConversation(groupName, selectedMemberIds),
    onSuccess: (conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["groupConversations"] });
      setCreateOpen(false);
      setGroupName("");
      setSelectedMemberIds([]);
      toast.success(language === "ar" ? "تم إنشاء المجموعة" : "Group created");
      navigate(getConversationRoute(conversationId));
    },
    onError: (error: any) => {
      toast.error(error?.message || (language === "ar" ? "تعذر إنشاء المجموعة" : "Failed to create group"));
    },
  });

  const selectedContacts = useMemo(
    () => eligibleContacts.filter((contact: any) => selectedMemberIds.includes(contact.contact_id)),
    [eligibleContacts, selectedMemberIds]
  );

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
  };

  const getConversationRoute = (conversationId: string) => {
    return embedded ? `/group-chats/${conversationId}?from=account` : `/group-chats/${conversationId}?from=contacts`;
  };

  return (
    <div className="space-y-4 mt-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {language === "ar" ? "كل المجموعات" : "All group chats"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {language === "ar" ? "أنشئ مجموعة جديدة من جهات الاتصال المتبادلة فقط" : "Create a new group from mutual approved contacts only"}
          </p>
        </div>
        <Button className="rounded-xl" onClick={() => setCreateOpen(true)}>
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          {language === "ar" ? "مجموعة جديدة" : "New Group"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="border border-border/60 rounded-2xl bg-card/80">
          <CardContent className="py-10 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] shadow-[0_0_30px_hsla(210,100%,65%,0.25)]">
              <Users className="h-7 w-7 text-white" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-base">{language === "ar" ? "لا توجد مجموعات بعد" : "No group chats yet"}</p>
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "ابدأ أول مجموعة مثل واتساب مع جهات الاتصال الموثوقة" : "Start your first WhatsApp-style group with trusted contacts"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const otherParticipants = group.participants.filter((participant) => participant.user_id !== user?.id);
            const memberPreview = otherParticipants
              .slice(0, 3)
              .map((participant) => participant.profile?.display_name || participant.profile?.username || "User")
              .join(language === "ar" ? "، " : ", ");

            return (
              <Card
                key={group.id}
                className="cursor-pointer rounded-2xl border border-border/60 bg-card/80 transition-all active:scale-[0.99]"
                onClick={() => navigate(getConversationRoute(group.id))}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative flex -space-x-3 rtl:space-x-reverse shrink-0 pt-0.5">
                      {otherParticipants.slice(0, 3).map((participant) => {
                        const label = participant.profile?.display_name || participant.profile?.username || "?";
                        return (
                          <Avatar key={participant.user_id} className="h-10 w-10 border-2 border-background shadow-sm">
                            {participant.profile?.avatar_url && <AvatarImage src={participant.profile.avatar_url} />}
                            <AvatarFallback className="bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] text-white font-bold">
                              {label.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold truncate">{group.name}</h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {memberPreview || (language === "ar" ? "مجموعة خاصة" : "Private group")}
                          </p>
                        </div>
                        {group.unread && (
                          <Badge className="bg-[hsl(210_100%_55%)] text-white border-transparent shrink-0">
                            {language === "ar" ? "جديد" : "New"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="truncate">{group.last_message_text || (language === "ar" ? "لا توجد رسائل بعد" : "No messages yet")}</span>
                        <span className="shrink-0">
                          {group.last_message_at
                            ? formatDistanceToNow(new Date(group.last_message_at), { addSuffix: true })
                            : (language === "ar" ? "الآن" : "Now")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {group.participants.length} {language === "ar" ? "أعضاء" : "members"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إنشاء مجموعة جديدة" : "Create new group"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "يمكنك إضافة جهات الاتصال المتبادلة فقط" : "You can only add mutual approved contacts"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{language === "ar" ? "اسم المجموعة" : "Group name"}</label>
              <Input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder={language === "ar" ? "مثلاً: العائلة، الرحلة، فريق العمل" : "For example: Family, Trip, Team"}
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium">{language === "ar" ? "الأعضاء" : "Members"}</label>
                <span className="text-xs text-muted-foreground">
                  {selectedMemberIds.length} {language === "ar" ? "محدد" : "selected"}
                </span>
              </div>

              {selectedContacts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedContacts.map((contact: any) => {
                    const label = contact.profile?.display_name || contact.profile?.username || "User";
                    return (
                      <Badge key={contact.contact_id} variant="outline" className="px-3 py-1 rounded-full">
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div className="max-h-72 overflow-y-auto rounded-2xl border border-border/60 divide-y divide-border/50">
                {loadingContacts ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : eligibleContacts.length === 0 ? (
                  <div className="py-8 px-4 text-center text-sm text-muted-foreground">
                    {language === "ar" ? "لا توجد جهات اتصال متبادلة متاحة" : "No mutual contacts available"}
                  </div>
                ) : (
                  eligibleContacts.map((contact: any) => {
                    const label = contact.profile?.display_name || contact.profile?.username || "User";
                    const username = contact.profile?.username ? `@${contact.profile.username}` : "";
                    const checked = selectedMemberIds.includes(contact.contact_id);
                    return (
                      <label key={contact.contact_id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                        <Checkbox checked={checked} onCheckedChange={() => toggleMember(contact.contact_id)} />
                        <Avatar className="h-10 w-10">
                          {contact.profile?.avatar_url && <AvatarImage src={contact.profile.avatar_url} />}
                          <AvatarFallback className="bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] text-white font-bold">
                            {label.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{label}</p>
                          <p className="text-xs text-muted-foreground truncate">{username}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {language === "ar" ? "يجب اختيار شخصين على الأقل غيرك لإنشاء مجموعة حقيقية" : "Pick at least 2 contacts besides yourself to create a real group"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || groupName.trim().length === 0 || selectedMemberIds.length < 2}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {language === "ar" ? "إنشاء المجموعة" : "Create group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
