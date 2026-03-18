import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MessageSquare, Star, UserX, Trash2, Gift, Images, User, LayoutList, LayoutGrid } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContacts, blockContact, deleteContact, toggleContactFavorite } from "@/services/contactsService";
import { LoadingSpinner } from "@/components/ui/loading";
import { toast } from "sonner";
import { ChatPopup } from "./ChatPopup";
import { useIsMobile, useIsTablet } from "@/hooks/use-mobile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContactRelationshipIndicator } from "./ContactRelationshipIndicator";
import { UnreadBadge } from "@/components/UnreadBadge";
import { useAuth } from "@/contexts/AuthContext";

type UserProfile = {
  display_name?: string;
  username?: string;
  avatar_url?: string;
  email?: string;
  [key: string]: any;
};

type ContactType = {
  id: string;
  contact_id: string;
  profile?: UserProfile;
  [key: string]: any;
};

interface ContactListProps {
  perContactUnread?: Record<string, number>;
  refetchUnreadCounts?: () => void;
  openChatUserId?: string | null;
  clearOpenChat?: () => void;
}

export function ContactList({ 
  perContactUnread = {}, 
  refetchUnreadCounts = () => {},
  openChatUserId = null,
  clearOpenChat = () => {}
}: ContactListProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const useFullPageChat = isMobile || isTablet; // Full page on mobile/tablet, popup on desktop
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<{id: string, name: string} | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{id: string, name: string, avatar?: string} | null>(null);
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});
  const [compactView, setCompactView] = useState(false);
  
  // Debug logging for user and unread data
  useEffect(() => {
    console.log('🔍 ContactList - Current user:', user?.id);
    console.log('🔍 ContactList - Per-contact unread counts:', perContactUnread);
  }, [user, perContactUnread]);

  // Fetch contacts with improved configuration
  const { 
    data: contacts, 
    isLoading, 
    isError, 
    error,
    refetch: refetchContacts 
  } = useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  // Debug logging for contacts data
  useEffect(() => {
    if (contacts) {
      console.log('🔍 ContactList - Contacts data:', contacts);
      contacts.forEach((contact: any) => {
        const unreadCount = perContactUnread[contact.contact_id] || 0;
        console.log(`🔍 Contact ${contact.contact_id} (${contact.profile?.username || 'unknown'}) has ${unreadCount} unread messages`);
      });
    }
  }, [contacts, perContactUnread]);

  // Handle deep link from push notification - auto-open chat
  useEffect(() => {
    if (openChatUserId && contacts && contacts.length > 0) {
      // Find the contact that matches the openChatUserId
      const contact = contacts.find((c: any) => c.contact_id === openChatUserId);
      if (contact) {
        const contactProfile = (contact.profile || {}) as UserProfile;
        const displayName = contactProfile.username || contactProfile.display_name || "Unknown";
        const avatarUrl = contactProfile.avatar_url;
        
        console.log('🔔 Opening chat from push notification for:', displayName);
        clearOpenChat(); // Clear the URL param so it doesn't re-open on refresh
        
        if (useFullPageChat) {
          // Mobile/tablet: navigate to full-page chat
          navigate(`/contacts/${openChatUserId}`);
        } else {
          // Desktop: use popup
          setSelectedContact({ id: openChatUserId, name: displayName, avatar: avatarUrl });
          setChatOpen(true);
        }
      }
    }
  }, [openChatUserId, contacts, clearOpenChat, useFullPageChat, navigate]);

  // Block contact mutation
  const blockContactMutation = useMutation({
    mutationFn: blockContact,
    onSuccess: () => {
      toast.success(t("contactBlocked", language));
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error) => {
      console.error("Error blocking contact:", error);
      toast.error(t("errorBlockingContact", language));
    }
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      toast.success(t("contactDeleted", language));
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error deleting contact:", error);
      toast.error(t("errorDeletingContact", language));
    }
  });

  // Favorites mutation for toggle with optimistic update
  const favoriteMutation = useMutation({
    mutationFn: ({ contactId, currentVal }: { contactId: string, currentVal: boolean }) =>
      toggleContactFavorite(contactId, !currentVal),
    onMutate: async ({ contactId, currentVal }) => {
      await queryClient.cancelQueries({ queryKey: ['contacts'] });
      const previousContacts = queryClient.getQueryData<any[]>(['contacts']);
      queryClient.setQueryData(['contacts'], (old: any[] = []) =>
        old.map(c =>
          c.id === contactId ? { ...c, is_favorite: !currentVal } : c
        )
      );
      return { previousContacts };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['contacts'], context?.previousContacts || []);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    }
  });

  const handleOpenChat = (contactId: string, name: string, avatar?: string) => {
    if (useFullPageChat) {
      // Mobile/tablet: navigate to full-page chat
      navigate(`/contacts/${contactId}`);
    } else {
      // Desktop: use popup
      setSelectedContact({ id: contactId, name, avatar });
      setChatOpen(true);
    }
  };

  const handleToggleFavorite = (contactId: string, isCurrentlyFavorite: boolean) => {
    favoriteMutation.mutate({ contactId, currentVal: isCurrentlyFavorite });
  };

  const handleBlock = (contactId: string) => {
    blockContactMutation.mutate(contactId);
  };

  const handleDeleteClick = (contact: ContactType, name: string) => {
    console.log('Preparing to delete contact:', contact);
    setContactToDelete({ id: contact.id, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (contactToDelete) {
      console.log('Confirming deletion of contact ID:', contactToDelete.id);
      deleteContactMutation.mutate(contactToDelete.id);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.substring(0, 2).toUpperCase();
  };

  const handleAvatarError = (contactId: string) => {
    console.log(`Avatar failed to load for contact: ${contactId}`);
    setAvatarErrors(prev => ({ ...prev, [contactId]: true }));
  };

  const shouldShowAvatar = (contactId: string, avatarUrl?: string) => {
    return avatarUrl && !avatarErrors[contactId];
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <p>{t("errorLoadingContacts", language)}</p>
        <p className="text-sm mt-2">{(error as Error)?.message}</p>
        <Button className="mt-4" onClick={() => refetchContacts()}>
          {t("loading", language)}
        </Button>
      </Card>
    );
  }

  // Sort: favorites first, then by display name
  const sortedContacts = contacts
    ? [...contacts].sort((a: any, b: any) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        const aName = (a.profile?.display_name || a.profile?.username || '').toLowerCase();
        const bName = (b.profile?.display_name || b.profile?.username || '').toLowerCase();
        return aName.localeCompare(bName);
      })
    : [];

  return (
    <>
      {/* View toggle */}
      {sortedContacts.length > 0 && (
        <div className="flex justify-end pb-2">
          <button
            onClick={() => setCompactView(v => !v)}
            aria-label={compactView ? 'Switch to card view' : 'Switch to compact view'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground bg-muted active:scale-95 transition-transform"
          >
            {compactView
              ? <><LayoutGrid className="h-3.5 w-3.5" />{language === 'ar' ? 'بطاقات' : 'Cards'}</>
              : <><LayoutList className="h-3.5 w-3.5" />{language === 'ar' ? 'مضغوط' : 'Compact'}</>}
          </button>
        </div>
      )}

      <div className={compactView ? 'space-y-1' : 'space-y-3'}>
        {!contacts || contacts.length === 0 ? (
          <Card className="p-6">
            <div className="text-center flex flex-col items-center gap-3 text-muted-foreground">
              <UserX className="h-12 w-12 opacity-50" />
              <p className="font-medium text-lg">{t("noContacts", language)}</p>
              <p className="text-sm">{t("searchToAddContacts", language)}</p>
            </div>
          </Card>
        ) : (
          sortedContacts.map((contact: any) => {
            const contactProfile = contact.profile || {};
            const displayName = contactProfile.username || "unknown";
            const emailOrName = contactProfile.display_name || contactProfile.email || "";
            const unreadCount = perContactUnread[contact.contact_id] || 0;
            const avatarUrl = contactProfile.avatar_url;
            const isFavorite = contact.is_favorite === true;
            const relationshipStatus: "mutual" | "you-added-them" | "they-added-you" = contact.relationshipStatus || "you-added-them";

            const isSupport = contact.contact_id === '00000000-0000-0000-0000-000000000001';

            // ── COMPACT VIEW ──
            if (compactView) {
              return (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border active:scale-[0.98] transition-transform"
                >
                  {/* Avatar */}
                  <div className={`relative shrink-0 rounded-full ${unreadCount > 0 ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-background' : ''}`}>
                    <Avatar className="h-10 w-10">
                      {shouldShowAvatar(contact.contact_id, avatarUrl) ? (
                        <AvatarImage src={avatarUrl} alt={displayName} onError={() => handleAvatarError(contact.contact_id)} />
                      ) : null}
                      <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate leading-tight">{emailOrName || `@${displayName}`}</p>
                    {emailOrName && <p className="text-[11px] text-muted-foreground truncate">@{displayName}</p>}
                  </div>

                  {/* Compact actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!isSupport && (
                      <button onClick={() => handleToggleFavorite(contact.id, isFavorite)} aria-label="Favorite" className="active:scale-90 transition-transform">
                        <Star className={`h-4 w-4 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`} />
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenChat(contact.contact_id, displayName, avatarUrl)}
                      aria-label="Chat"
                      className={`w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-transform ${unreadCount > 0 ? 'bg-blue-500' : 'bg-blue-500/20 dark:bg-blue-500/15'}`}
                    >
                      <MessageSquare className={`h-4 w-4 ${unreadCount > 0 ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`} />
                    </button>
                    {!isSupport && (
                      <>
                        <button onClick={() => navigate(`/gallery/${contact.contact_id}`)} aria-label="Gallery" className="w-8 h-8 rounded-xl bg-orange-500/20 dark:bg-orange-500/15 flex items-center justify-center active:scale-90 transition-transform">
                          <Images className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                        </button>
                        <button onClick={() => navigate(`/wishlists?contact=${contact.contact_id}`)} aria-label="Wishlist" className="w-8 h-8 rounded-xl bg-pink-500/20 dark:bg-pink-500/15 flex items-center justify-center active:scale-90 transition-transform">
                          <Gift className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            }
            
            return (
              <div key={contact.id} className="rounded-2xl bg-muted/50 dark:bg-muted/30">
                  {/* Top: avatar + name + relationship */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    {/* Avatar — bigger, with unread ring */}
                    <div className={`relative shrink-0 rounded-full ${unreadCount > 0 ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background' : ''}`}>
                      <Avatar className="h-14 w-14">
                        {shouldShowAvatar(contact.contact_id, avatarUrl) ? (
                          <AvatarImage
                            src={avatarUrl}
                            alt={displayName}
                            onError={() => handleAvatarError(contact.contact_id)}
                          />
                        ) : null}
                        <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-[hsl(210,100%,55%)] to-[hsl(180,85%,50%)] text-white">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Name + username + relationship */}
                    <div className="flex-1 min-w-0">
                      {emailOrName && (
                        <p className="font-semibold text-sm truncate leading-tight">{emailOrName}</p>
                      )}
                      <p className="text-xs text-muted-foreground truncate">@{displayName}</p>
                      {!isSupport && (
                        <div className="mt-1">
                          <ContactRelationshipIndicator status={relationshipStatus} />
                        </div>
                      )}
                    </div>

                    {/* Favorite star — top right */}
                    {!isSupport && (
                      <button
                        onClick={() => handleToggleFavorite(contact.id, isFavorite)}
                        disabled={favoriteMutation.isPending}
                        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        className="shrink-0 active:scale-90 transition-transform"
                      >
                        <Star className={`h-5 w-5 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/40'}`} />
                      </button>
                    )}
                  </div>

                  {/* Action pill buttons row */}
                  <div className="px-4 pb-3 pt-2 flex items-center gap-2 flex-wrap">
                    {isSupport ? (
                      <button
                        onClick={() => handleOpenChat(contact.contact_id, displayName, avatarUrl)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-[hsl(210,100%,55%)] text-white active:scale-95 transition-transform"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {language === 'ar' ? 'رسالة' : 'Message'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleOpenChat(contact.contact_id, displayName, avatarUrl)}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform ${
                            unreadCount > 0
                              ? 'bg-[#060541] dark:bg-[hsl(210,100%,55%)] text-white'
                              : 'bg-[#060541]/10 dark:bg-white/10 text-[#060541] dark:text-white/80'
                          }`}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {language === 'ar' ? 'رسالة' : 'Chat'}
                          {unreadCount > 0 && (
                            <span className="ml-1 bg-white/30 text-white text-[10px] font-bold px-1 rounded-full">{unreadCount}</span>
                          )}
                        </button>

                        <button
                          onClick={() => navigate(`/gallery/${contact.contact_id}`)}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-[hsl(25,95%,53%)]/15 dark:bg-[hsl(25,95%,55%)]/20 text-[hsl(25,95%,38%)] dark:text-[hsl(25,95%,70%)] active:scale-95 transition-transform"
                        >
                          <Images className="h-3.5 w-3.5" />
                          {language === 'ar' ? 'معرض' : 'Gallery'}
                        </button>

                        <button
                          onClick={() => navigate(`/wishlists?contact=${contact.contact_id}`)}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-[hsl(320,70%,55%)]/15 dark:bg-[hsl(320,70%,55%)]/20 text-[hsl(320,70%,42%)] dark:text-[hsl(320,70%,75%)] active:scale-95 transition-transform"
                        >
                          <Gift className="h-3.5 w-3.5" />
                          {language === 'ar' ? 'رغبات' : 'Wishlist'}
                        </button>

                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => handleBlock(contact.contact_id)}
                            disabled={blockContactMutation.isPending}
                            aria-label="Block"
                            className="p-1.5 rounded-full text-muted-foreground/40 hover:text-orange-500 active:scale-90 transition-all"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(contact, displayName)}
                            disabled={deleteContactMutation.isPending}
                            aria-label="Remove"
                            className="p-1.5 rounded-full text-muted-foreground/40 hover:text-red-500 active:scale-90 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
              </div>
            );
          })
        )}
      </div>

      {selectedContact && (
        <ChatPopup 
          isOpen={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setTimeout(() => refetchUnreadCounts(), 1000);
          }}
          contactId={selectedContact.id}
          contactName={selectedContact.name}
          contactAvatar={selectedContact.avatar}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteContact", language)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteContactConfirmation", language)} {contactToDelete?.name}?
              {t("thisActionCannotBeUndone", language)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel", language)}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteContactMutation.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : null}
              {t("delete", language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
