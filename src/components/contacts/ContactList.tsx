import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { emitEvent } from "@/utils/eventBus";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import type { WaktiOperatorRoutePayload } from "@/utils/waktiOperator";
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
  /**
   * When true, pressing Chat always opens the in-place ChatPopup modal instead
   * of navigating to `/contacts/:id`. Used when this list is embedded inside
   * another page (e.g. Account → Social), so the user doesn't get pulled out
   * of the Account context. Default: false (preserves existing behaviour on
   * the standalone /contacts route).
   */
  embedded?: boolean;
  source?: "contacts" | "social";
  viewMode?: "contacts" | "cards";
  showViewToggle?: boolean;
  operatorPayload?: WaktiOperatorRoutePayload | null;
  operatorPayloadId?: string | null;
}

export function ContactList({ 
  perContactUnread = {}, 
  refetchUnreadCounts = () => {},
  openChatUserId = null,
  clearOpenChat = () => {},
  embedded = false,
  source = "contacts",
  viewMode,
  showViewToggle = true,
  operatorPayload = null,
  operatorPayloadId = null,
}: ContactListProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  // Embedded mode forces the popup path so we never navigate the host page away.
  const useFullPageChat = !embedded && (isMobile || isTablet);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<{id: string, name: string} | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{id: string, name: string, avatar?: string} | null>(null);
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});
  const [internalViewMode, setInternalViewMode] = useState<"contacts" | "cards">("contacts");
  const compactView = (viewMode ?? internalViewMode) === "contacts";
  
  // Long-press context menu state
  const [contextMenu, setContextMenu] = useState<{ contact: ContactType; x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressedContactId, setPressedContactId] = useState<string | null>(null);
  
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
          navigate(`/contacts/${openChatUserId}?from=${source}`);
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
    // If an operator chat request is still waiting for the user to pick the
    // contact, carry the operator payload along so the draft is still placed
    // and the operator step completes after sending.
    const pendingOperatorChat = Boolean(operatorPayloadId && operatorPayload?.chat);

    if (useFullPageChat) {
      // Mobile/tablet: navigate to full-page chat
      const operatorSuffix = pendingOperatorChat ? `&waktiOperator=${operatorPayloadId}` : '';
      navigate(`/contacts/${contactId}?from=${pendingOperatorChat ? 'operator' : source}${operatorSuffix}`);
    } else if (pendingOperatorChat) {
      // Desktop with a pending operator request: use the full-page chat so the
      // operator draft + step handoff work end to end.
      navigate(`/contacts/${contactId}?from=operator&waktiOperator=${operatorPayloadId}`);
    } else {
      // Desktop: use popup
      setSelectedContact({ id: contactId, name, avatar });
      setChatOpen(true);
    }
  };

  // Tracks which operator payload we already attempted to resolve, so the
  // matcher runs once per request and never loops.
  const operatorMatchHandledRef = useRef<string | null>(null);

  // When we cannot confidently resolve the requested contact, we must NOT hang
  // on "Open the right chat". Instead we pause the operator step and tell the
  // user clearly so they can tap the contact themselves.
  const reportOperatorChatUnresolved = (requestedName?: string) => {
    if (operatorPayload?.runId && operatorPayload.stepRefs?.openStepId) {
      emitEvent('wakti-operator-status', {
        runId: operatorPayload.runId,
        stepId: operatorPayload.stepRefs.openStepId,
        status: 'paused',
      });
    }
    if (requestedName) {
      toast.message(
        language === 'ar'
          ? `لم أتأكد من جهة الاتصال "${requestedName}". اختر الشخص من القائمة وسأكمل.`
          : `I couldn't confirm the contact "${requestedName}". Pick the person from the list and I'll continue.`
      );
    } else {
      toast.message(
        language === 'ar'
          ? 'لم أفهم اسم جهة الاتصال. اختر الشخص من القائمة.'
          : "I couldn't read the contact name. Pick the person from the list."
      );
    }
  };

  useEffect(() => {
    const targetName = operatorPayload?.chat?.targetContactName?.trim();
    if (!operatorPayloadId || !targetName) return;
    if (!contacts || contacts.length === 0) return;
    // Only attempt the operator match once per payload to avoid loops/re-triggers.
    if (operatorMatchHandledRef.current === operatorPayloadId) return;
    operatorMatchHandledRef.current = operatorPayloadId;

    // Normalize text: lowercase, drop brackets/punctuation, collapse spaces.
    const normalize = (value: string) =>
      (value || '')
        .toLowerCase()
        .replace(/[()\[\]{}<>]/g, ' ')
        .replace(/[^\p{L}\p{N}\s@._-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizedTarget = normalize(targetName);
    if (!normalizedTarget) {
      reportOperatorChatUnresolved();
      return;
    }

    const targetTokens = normalizedTarget.split(' ').filter(Boolean);

    // Levenshtein distance for small typo / transcription tolerance.
    const editDistance = (a: string, b: string): number => {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      const prev = new Array(b.length + 1);
      const curr = new Array(b.length + 1);
      for (let j = 0; j <= b.length; j++) prev[j] = j;
      for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
      }
      return prev[b.length];
    };

    // Fuzzy word match tolerant of short spelling/transcription differences.
    const fuzzyWordMatch = (a: string, b: string) => {
      if (!a || !b) return false;
      if (a === b) return true;
      if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return true;
      const maxLen = Math.max(a.length, b.length);
      const tolerance = maxLen <= 4 ? 1 : maxLen <= 7 ? 2 : 3;
      return editDistance(a, b) <= tolerance;
    };

    const scoreCandidate = (candidate: string) => {
      const normalizedCandidate = normalize(candidate);
      if (!normalizedCandidate) return 0;
      if (normalizedCandidate === normalizedTarget) return 100;
      if (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate)) return 90;

      const candidateTokens = normalizedCandidate.split(' ').filter(Boolean);
      if (targetTokens.length === 0 || candidateTokens.length === 0) return 0;

      let matchedTokens = 0;
      for (const targetToken of targetTokens) {
        if (candidateTokens.some((candidateToken) => fuzzyWordMatch(candidateToken, targetToken))) {
          matchedTokens += 1;
        }
      }
      if (matchedTokens === 0) return 0;
      // Reward how much of the requested name was matched.
      const coverage = matchedTokens / targetTokens.length;
      return Math.round(40 + coverage * 45);
    };

    const scoredContacts = contacts
      .map((contact: any) => {
        const profile = contact.profile || {};
        const displayScore = scoreCandidate(profile.display_name || '');
        const usernameScore = scoreCandidate(profile.username || '');
        return { contact, score: Math.max(displayScore, usernameScore) };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = scoredContacts[0];
    const second = scoredContacts[1];

    // Confident match: strong score, and clearly ahead of the runner-up.
    const isConfident = Boolean(
      best &&
      best.score >= 70 &&
      (!second || best.score - second.score >= 10 || best.score >= 90)
    );

    if (best && isConfident && best.contact?.contact_id) {
      navigate(`/contacts/${best.contact.contact_id}?waktiOperator=${operatorPayloadId}&from=operator`, { replace: true });
      return;
    }

    // No confident match — never hang. Tell the user clearly and pause the step.
    reportOperatorChatUnresolved(targetName);
  }, [contacts, navigate, operatorPayload?.chat?.targetContactName, operatorPayload?.runId, operatorPayload?.stepRefs?.openStepId, operatorPayloadId]);

  const handleToggleFavorite = (favoriteRecordId: string | null | undefined, isCurrentlyFavorite: boolean) => {
    if (!favoriteRecordId) {
      toast.error(language === 'ar' ? 'لا يمكنك تعديل المفضلة لهذا الاتصال بعد' : 'You cannot change favorite for this contact yet');
      return;
    }

    favoriteMutation.mutate({ contactId: favoriteRecordId, currentVal: isCurrentlyFavorite });
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

  // Long-press handlers
  const handleLongPressStart = (contact: ContactType, e: React.MouseEvent | React.TouchEvent) => {
    setPressedContactId(contact.id);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    longPressTimerRef.current = setTimeout(() => {
      setPressedContactId(null);
      setContextMenu({ contact, x: clientX, y: clientY });
    }, 500);
  };

  const handleLongPressEnd = () => {
    setPressedContactId(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

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

  // Sort order (highest priority first):
  //   1. Contacts with unread messages (more unread = higher)
  //   2. Favorites
  //   3. Alphabetical by display name
  // This ensures a user who messaged you always rises to the top, even if they're
  // not starred. See user feedback: "Messages should be up top."
  const sortedContacts = contacts
    ? [...contacts].sort((a: any, b: any) => {
        const aUnread = perContactUnread[a.contact_id] || 0;
        const bUnread = perContactUnread[b.contact_id] || 0;
        // 1. Unread-bearing contacts above zero-unread contacts
        if (aUnread > 0 && bUnread === 0) return -1;
        if (aUnread === 0 && bUnread > 0) return 1;
        // If both have unread messages, higher unread count first
        if (aUnread !== bUnread && aUnread > 0 && bUnread > 0) return bUnread - aUnread;
        // 2. Favorites next
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        // 3. Alphabetical
        const aName = (a.profile?.display_name || a.profile?.username || '').toLowerCase();
        const bName = (b.profile?.display_name || b.profile?.username || '').toLowerCase();
        return aName.localeCompare(bName);
      })
    : [];

  return (
    <>
      <div className="-mx-1.5 px-1.5 sm:mx-0 sm:px-0">
        {/* View toggle */}
        {showViewToggle && sortedContacts.length > 0 && (
          <div className={`flex pb-2 ${language === 'ar' ? 'justify-start' : 'justify-end'}`}>
            <button
              onClick={() => setInternalViewMode((current) => current === "contacts" ? "cards" : "contacts")}
              aria-label={compactView ? 'Switch to card view' : 'Switch to contacts view'}
              className="flex items-center gap-2 px-4 py-2 rounded-[1.1rem] text-xs font-semibold text-muted-foreground border border-[#e2d8cd] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(243,237,231,0.9))] dark:bg-[linear-gradient(180deg,rgba(24,28,38,0.94),rgba(16,19,27,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(0,0,0,0.26)] active:scale-95 transition-transform"
            >
              {compactView
                ? <><LayoutGrid className="h-3.5 w-3.5" />{language === 'ar' ? 'بطاقات' : 'Cards'}</>
                : <><LayoutList className="h-3.5 w-3.5" />{language === 'ar' ? 'جهات الاتصال' : 'Contacts'}</>}
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
              const favoriteRecordId = contact.favorite_record_id || contact.id;
              const relationshipStatus: "mutual" | "you-added-them" | "they-added-you" = contact.relationshipStatus || "you-added-them";
              const isSupport = contact.contact_id === '00000000-0000-0000-0000-000000000001';
              
              return (
                  <div
                    key={contact.id}
                    className={`relative flex items-center justify-between gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#d9dee9] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,240,0.98))] dark:bg-[linear-gradient(180deg,rgba(20,24,34,0.98),rgba(15,18,27,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),inset_0_12px_24px_rgba(255,255,255,0.16),inset_0_-10px_24px_rgba(148,163,184,0.05),0_10px_24px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-14px_28px_rgba(0,0,0,0.24)] select-none transition-transform duration-150 ${pressedContactId === contact.id ? 'scale-[1.03]' : ''}`}
                    onMouseDown={(e) => handleLongPressStart(contact, e)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={(e) => handleLongPressStart(contact, e)}
                    onTouchMove={handleLongPressEnd}
                    onTouchEnd={handleLongPressEnd}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {!isSupport && (
                      <button
                        onClick={() => handleToggleFavorite(favoriteRecordId, isFavorite)}
                        aria-label="Favorite"
                        className="absolute top-1.5 left-1.5 z-10 active:scale-90 transition-transform"
                      >
                        <Star className={`h-4 w-4 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`} />
                      </button>
                    )}

                    <div className="flex items-center gap-1.5 min-w-0">
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
                      
                      <div className="min-w-0 text-start">
                        <p className="font-semibold text-sm truncate leading-tight">{emailOrName || `@${displayName}`}</p>
                        {emailOrName && <p className="text-[11px] text-muted-foreground truncate">@{displayName}</p>}
                        {!isSupport && (
                          <div className="mt-0.5">
                            <ContactRelationshipIndicator status={relationshipStatus} />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenChat(contact.contact_id, displayName, avatarUrl)}
                        aria-label="Chat"
                        className={`relative h-8 px-4 rounded-xl inline-flex items-center gap-1.5 active:scale-90 transition-transform ${unreadCount > 0 ? 'bg-blue-500' : 'bg-blue-500/20 dark:bg-blue-500/15'}`}
                        style={unreadCount > 0 ? { boxShadow: '0 0 15px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.3)' } : undefined}
                      >
                        <MessageSquare className={`h-4 w-4 ${unreadCount > 0 ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`} />
                        <span className={`text-[11px] font-semibold leading-none ${unreadCount > 0 ? 'text-white' : 'text-blue-600 dark:text-blue-300'}`}>
                          {language === 'ar' ? 'دردشة' : 'Chat'}
                        </span>
                        {unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#0c0f14]">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                      {!isSupport && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => navigate(`/gallery/${contact.contact_id}`)} aria-label="Gallery" className="w-9 h-9 rounded-xl bg-orange-500/20 dark:bg-orange-500/15 flex items-center justify-center active:scale-90 transition-transform">
                            <Images className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                          </button>
                          <button onClick={() => navigate(`/wishlists?contact=${contact.contact_id}`)} aria-label="Wishlist" className="w-9 h-9 rounded-xl bg-pink-500/20 dark:bg-pink-500/15 flex items-center justify-center active:scale-90 transition-transform">
                            <Gift className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
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
      
      {/* Long-press context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-[#1a1d27] rounded-xl shadow-lg border border-[#e2e8f0] dark:border-white/10 py-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-150"
          style={{ top: contextMenu.y - 10, left: contextMenu.x - 70 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleBlock(contextMenu.contact.contact_id);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2.5 text-left flex items-center gap-2 text-[hsl(25,95%,48%)] dark:text-[hsl(25,95%,72%)] hover:bg-[hsl(25,95%,53%)]/10 transition-colors"
          >
            <UserX className="h-4 w-4" />
            <span className="text-sm font-medium">{language === 'ar' ? 'حظر' : 'Block'}</span>
          </button>
          <div className="mx-3 h-px bg-[#e2e8f0] dark:bg-white/10" />
          <button
            onClick={() => {
              handleDeleteClick(contextMenu.contact, contextMenu.contact.profile?.username || contextMenu.contact.profile?.display_name || '');
              setContextMenu(null);
            }}
            className="w-full px-4 py-2.5 text-left flex items-center gap-2 text-[hsl(0,75%,54%)] dark:text-[hsl(0,85%,72%)] hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-medium">{language === 'ar' ? 'حذف' : 'Delete'}</span>
          </button>
        </div>
      )}
    </>
  );
}
