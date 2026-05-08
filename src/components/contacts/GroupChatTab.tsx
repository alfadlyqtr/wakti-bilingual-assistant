import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  source?: "contacts" | "social";
}

export function GroupChatTab({ embedded = false, source = "contacts" }: GroupChatTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useTheme();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [membersDialogGroup, setMembersDialogGroup] = useState<any | null>(null);
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
    return `/group-chats/${conversationId}?from=${source}`;
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
            const creator = group.participants.find((participant) => participant.user_id === group.created_by);
            const creatorName = creator?.profile?.display_name || creator?.profile?.username || (language === "ar" ? "غير معروف" : "Unknown");

            return (
              <Card
                key={group.id}
                className="cursor-pointer rounded-2xl border border-border/60 bg-card/80 transition-all active:scale-[0.99]"
                onClick={() => navigate(getConversationRoute(group.id))}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-base truncate text-[#060541] dark:text-white">{group.name}</h4>
                      <p className="mt-1 text-sm text-muted-foreground truncate">
                        {language === "ar" ? `المنشئ: ${creatorName}` : `Creator: ${creatorName}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMembersDialogGroup(group);
                      }}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#dbe2ec] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,253,0.92))] dark:bg-[linear-gradient(180deg,rgba(20,24,35,0.98),rgba(14,17,26,0.98))] px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_4px_14px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_6px_16px_rgba(0,0,0,0.16)] active:scale-95 transition-transform"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>
                        {group.participants.length} {language === "ar" ? "أعضاء" : "members"}
                      </span>
                    </button>
                  </div>
                  {group.unread && (
                    <div className="mt-3">
                      <Badge className="bg-[hsl(210_100%_55%)] text-white border-transparent">
                        {language === "ar" ? "جديد" : "New"}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(membersDialogGroup)} onOpenChange={(open) => !open && setMembersDialogGroup(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "أعضاء المجموعة" : "Group members"}
            </DialogTitle>
            <DialogDescription>
              {membersDialogGroup?.name || (language === "ar" ? "المجموعة" : "Group chat")}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-3">
            {(membersDialogGroup?.participants || []).map((participant: any) => {
              const participantIsCreator = participant.user_id === membersDialogGroup?.created_by;
              const isMe = participant.user_id === user?.id;
              const displayName = participant.profile?.display_name || participant.profile?.username || (language === "ar" ? "عضو" : "Member");

              return (
                <div key={participant.user_id} className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/40">
                  <Avatar className="h-10 w-10">
                    {participant.profile?.avatar_url && <AvatarImage src={participant.profile.avatar_url} />}
                    <AvatarFallback className="bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(280_70%_65%)_100%)] text-white text-xs font-bold">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {displayName}
                        {isMe && (
                          <span className="text-muted-foreground font-normal">
                            {language === "ar" ? " (أنت)" : " (You)"}
                          </span>
                        )}
                      </span>
                      {participantIsCreator && (
                        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0">
                          {language === "ar" ? "المؤسس" : "Creator"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

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
