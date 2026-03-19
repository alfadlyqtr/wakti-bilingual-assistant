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
      <div className="-mx-1.5 px-1.5 sm:mx-0 sm:px-0">
        {/* View toggle */}
        {sortedContacts.length > 0 && (
          <div className={`flex pb-2 ${language === 'ar' ? 'justify-start' : 'justify-end'}`}>
            <button
              onClick={() => setCompactView(v => !v)}
              aria-label={compactView ? 'Switch to card view' : 'Switch to compact view'}
              className="flex items-center gap-2 px-4 py-2 rounded-[1.1rem] text-xs font-semibold text-muted-foreground border border-[#e2d8cd] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(243,237,231,0.9))] dark:bg-[linear-gradient(180deg,rgba(24,28,38,0.94),rgba(16,19,27,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(0,0,0,0.26)] active:scale-95 transition-transform"
            >
              {compactView
                ? <><LayoutGrid className="h-3.5 w-3.5" />{language === 'ar' ? 'بطاقات' : 'Cards'}</>
                : <><LayoutList className="h-3.5 w-3.5" />{language === 'ar' ? 'مختصر' : 'Compact'}</>}
            </button>
          </div>
        )}
        
        <div className={compactView ? 'space-y-1.5' : 'space-y-2.5 sm:space-y-3'}>
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
              
              if (compactView) {
                return (
                  <div
                    key={contact.id}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[#d9dee9] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,240,0.98))] dark:bg-[linear-gradient(180deg,rgba(20,24,34,0.98),rgba(15,18,27,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),inset_0_12px_24px_rgba(255,255,255,0.16),inset_0_-10px_24px_rgba(148,163,184,0.05),0_10px_24px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-14px_28px_rgba(0,0,0,0.24)]`}
                  >
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
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate leading-tight">{emailOrName || `@${displayName}`}</p>
                      {emailOrName && <p className="text-[11px] text-muted-foreground truncate">@{displayName}</p>}
                    </div>
                    
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
                <Card key={contact.id} dir={language === 'ar' ? 'rtl' : 'ltr'} className="overflow-hidden rounded-[1.75rem] sm:rounded-[2rem] border border-[#e2e8f0] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(250,250,252,0.98))] dark:bg-[linear-gradient(180deg,rgba(20,24,34,0.98),rgba(15,18,27,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,1),inset_0_-20px_40px_rgba(148,163,184,0.08),0_20px_40px_rgba(15,23,42,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-20px_40px_rgba(0,0,0,0.28),0_18px_40px_rgba(0,0,0,0.34)]">
                  <CardContent className="p-2.5 sm:p-4 md:p-5">
                    <div className="rounded-[1.35rem] sm:rounded-[1.6rem] border border-[#dbe2ec] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(249,251,253,0.94))] dark:bg-[linear-gradient(180deg,rgba(24,28,38,0.95),rgba(16,19,27,0.94))] p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.98),inset_0_12px_24px_rgba(255,255,255,0.16),inset_0_-10px_24px_rgba(148,163,184,0.05),0_10px_24px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-14px_28px_rgba(0,0,0,0.24)]">
                      <div className={`flex items-start gap-2.5 sm:gap-3 ${language === 'ar' ? 'flex-row-reverse text-right' : ''}`}>
                        <div className={`relative shrink-0 rounded-full ${unreadCount > 0 ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background' : ''}`}>
                          <Avatar className="h-16 w-16 ring-1 ring-[#dbe2ec] dark:ring-white/10 shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
                            {shouldShowAvatar(contact.contact_id, avatarUrl) ? (
                              <AvatarImage src={avatarUrl} alt={displayName} onError={() => handleAvatarError(contact.contact_id)} />
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
                        
                        <div className="min-w-0 flex-1 pt-1">
                          {emailOrName && (
                            <p className="font-semibold text-base leading-tight truncate text-[#060541] dark:text-white">{emailOrName}</p>
                          )}
                          <p className="mt-1 text-sm text-muted-foreground truncate">@{displayName}</p>
                          {!isSupport && unreadCount > 0 && (
                            <div className="mt-3 inline-flex rounded-full border border-blue-200 dark:border-blue-400/20 bg-blue-500/10 dark:bg-blue-500/15 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                              {language === 'ar' ? `${unreadCount} غير مقروء` : `${unreadCount} unread`}
                            </div>
                          )}
                        </div>
                        
                        {!isSupport && (
                          <button
                            onClick={() => handleToggleFavorite(contact.id, isFavorite)}
                            disabled={favoriteMutation.isPending}
                            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                            className="shrink-0 rounded-full p-2.5 border border-[#c8d2e1] dark:border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,248,252,0.94))] dark:bg-[linear-gradient(180deg,rgba(34,39,52,0.96),rgba(25,29,40,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_8px_18px_rgba(15,23,42,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_18px_rgba(0,0,0,0.24)] active:scale-90 transition-transform"
                          >
                            <Star className={`h-5 w-5 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/55 dark:text-white/55'}`} />
                          </button>
                        )}
                      </div>
                      
                      <div className="mt-3 sm:mt-4 rounded-[1.2rem] sm:rounded-[1.35rem] border border-[#dbe2ec] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,253,0.86))] dark:bg-[linear-gradient(180deg,rgba(18,22,32,0.96),rgba(13,16,24,0.96))] p-2.5 sm:p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.96),inset_0_8px_18px_rgba(255,255,255,0.1),0_8px_20px_rgba(15,23,42,0.03)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_-10px_20px_rgba(0,0,0,0.35)]">
                        {isSupport ? (
                          <div className="flex items-center">
                            <button
                              onClick={() => handleOpenChat(contact.contact_id, displayName, avatarUrl)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[linear-gradient(135deg,hsl(210,100%,62%)_0%,hsl(260,70%,62%)_100%)] text-white shadow-[0_8px_18px_rgba(33,150,243,0.18)] active:scale-95 transition-transform"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              {language === 'ar' ? 'رسالة' : 'Message'}
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className={`flex items-center gap-2 flex-nowrap ${language === 'ar' ? 'justify-end' : ''}`}>
                              <button
                                onClick={() => handleOpenChat(contact.contact_id, displayName, avatarUrl)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold active:scale-95 transition-transform shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ${
                                  unreadCount > 0
                                    ? 'bg-[linear-gradient(135deg,#060541_0%,hsl(243,45%,34%)_100%)] dark:bg-[linear-gradient(135deg,hsl(210,100%,62%)_0%,hsl(260,70%,62%)_100%)] text-white shadow-[0_10px_22px_rgba(6,5,65,0.2)]'
                                    : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(243,246,251,0.88))] dark:bg-[linear-gradient(180deg,rgba(33,39,55,0.96),rgba(24,29,41,0.96))] text-[#060541] dark:text-white/90 border border-[#cfd8e6] dark:border-white/10'
                                }`}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                {language === 'ar' ? 'دردشة' : 'Chat'}
                                {unreadCount > 0 && (
                                  <span className="ml-1 bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                                )}
                              </button>
                              
                              <button
                                onClick={() => navigate(`/gallery/${contact.contact_id}`)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[linear-gradient(180deg,rgba(255,248,239,0.98),rgba(254,244,232,0.94))] dark:bg-[linear-gradient(180deg,rgba(52,36,22,0.78),rgba(36,24,14,0.76))] text-[hsl(25,95%,40%)] dark:text-[hsl(25,95%,72%)] border border-[rgba(251,146,60,0.32)] dark:border-[rgba(249,201,168,0.22)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(249,115,22,0.08)] active:scale-95 transition-transform"
                              >
                                <Images className="h-3.5 w-3.5" />
                                {language === 'ar' ? 'المعرض' : 'Gallery'}
                              </button>
                              
                              <button
                                onClick={() => navigate(`/wishlists?contact=${contact.contact_id}`)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[linear-gradient(180deg,rgba(253,242,248,0.98),rgba(252,231,243,0.94))] dark:bg-[linear-gradient(180deg,rgba(68,28,54,0.8),rgba(46,18,38,0.78))] text-[hsl(320,70%,45%)] dark:text-[hsl(320,70%,78%)] border border-[rgba(236,72,153,0.28)] dark:border-[rgba(240,182,220,0.22)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_8px_18px_rgba(219,39,119,0.06)] active:scale-95 transition-transform"
                              >
                                <Gift className="h-3.5 w-3.5" />
                                {language === 'ar' ? 'الهدايا' : 'Wishlist'}
                              </button>
                            </div>
                            
                            <div className={`mt-2 flex items-center gap-2 flex-wrap ${language === 'ar' ? 'justify-start' : ''}`}>
                              <div className={`flex items-center gap-2 rounded-full border border-[#dbe2ec] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,253,0.92))] dark:bg-[linear-gradient(180deg,rgba(20,24,35,0.98),rgba(14,17,26,0.98))] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_4px_14px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_6px_16px_rgba(0,0,0,0.16)] ${language === 'ar' ? '' : 'ml-auto'}`}>
                                <div className="text-[hsl(243,30%,55%)] dark:text-white/55 [&_svg]:h-4 [&_svg]:w-4">
                                  <ContactRelationshipIndicator status={relationshipStatus} />
                                </div>
                                <button
                                  onClick={() => handleBlock(contact.contact_id)}
                                  disabled={blockContactMutation.isPending}
                                  aria-label="Block"
                                  className="rounded-full p-2 text-[hsl(25,95%,48%)] dark:text-[hsl(25,95%,72%)] bg-[hsl(25,95%,53%)]/12 dark:bg-[hsl(25,95%,53%)]/14 hover:bg-[hsl(25,95%,53%)]/18 active:scale-90 transition-all"
                                >
                                  <UserX className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(contact, displayName)}
                                  disabled={deleteContactMutation.isPending}
                                  aria-label="Remove"
                                  className="rounded-full p-2 text-[hsl(0,75%,54%)] dark:text-[hsl(0,85%,72%)] bg-red-500/12 dark:bg-red-500/14 hover:bg-red-500/18 active:scale-90 transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </>  
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
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
