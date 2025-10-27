import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MessageSquare, Star, UserX, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContacts, blockContact, deleteContact, toggleContactFavorite } from "@/services/contactsService";
import { LoadingSpinner } from "@/components/ui/loading";
import { toast } from "sonner";
import { ChatPopup } from "./ChatPopup";
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
}

export function ContactList({ 
  perContactUnread = {}, 
  refetchUnreadCounts = () => {} 
}: ContactListProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<{id: string, name: string} | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{id: string, name: string, avatar?: string} | null>(null);
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});
  
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
    setSelectedContact({ id: contactId, name, avatar });
    setChatOpen(true);
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

  return (
    <>
      <div className="space-y-3">
        {!contacts || contacts.length === 0 ? (
          <Card className="p-6">
            <div className="text-center flex flex-col items-center gap-3 text-muted-foreground">
              <UserX className="h-12 w-12 opacity-50" />
              <p className="font-medium text-lg">{t("noContacts", language)}</p>
              <p className="text-sm">{t("searchToAddContacts", language)}</p>
            </div>
          </Card>
        ) : (
          contacts.map((contact: any) => {
            const contactProfile = contact.profile || {};
            const displayName = contactProfile.username || "unknown";
            const emailOrName = contactProfile.display_name || contactProfile.email || "";
            const unreadCount = perContactUnread[contact.contact_id] || 0;
            const avatarUrl = contactProfile.avatar_url;
            const isFavorite = contact.is_favorite === true;
            const relationshipStatus: "mutual" | "you-added-them" | "they-added-you" = contact.relationshipStatus || "you-added-them";

            // Debug logging for each contact (moved outside JSX)
            console.log(`🔍 DETAILED ContactList - Rendering contact ${displayName}:`, {
              contact_id: contact.contact_id,
              unreadCount,
              shouldShowBadge: unreadCount > 0,
              perContactUnread: perContactUnread,
              contactData: contact
            });
            
            return (
              <Card key={contact.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        {shouldShowAvatar(contact.contact_id, avatarUrl) ? (
                          <AvatarImage 
                            src={avatarUrl} 
                            alt={displayName}
                            onError={() => handleAvatarError(contact.contact_id)}
                          />
                        ) : null}
                        <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-base truncate">@{displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{emailOrName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {contact.contact_id === '00000000-0000-0000-0000-000000000001' ? (
                        // WAKTI SUPPORT - only show message button with special styling
                        <div className="relative">
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => handleOpenChat(contact.contact_id, displayName, avatarUrl)}
                            className={`h-8 w-8 relative transition-colors bg-primary text-primary-foreground hover:bg-primary/90`}
                          >
                            <MessageSquare className="h-4 w-4 text-white" />
                            <UnreadBadge count={unreadCount} blink={!!unreadCount} />
                          </Button>
                        </div>
                      ) : (
                        // Regular contacts - show all actions
                        <>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => handleToggleFavorite(contact.id, isFavorite)}
                            disabled={favoriteMutation.isPending}
                            className="h-8 w-8 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
                            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                          >
                            <Star className={`h-4 w-4 ${isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`} />
                          </Button>
                          <ContactRelationshipIndicator status={relationshipStatus} />
                          <div className="relative">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => handleOpenChat(contact.contact_id, displayName, avatarUrl)}
                              className={`h-8 w-8 relative transition-colors ${
                                unreadCount > 0 
                                  ? 'bg-blue-500 text-white hover:bg-blue-600' 
                                  : 'hover:bg-blue-50 hover:text-blue-600'
                              }`}
                            >
                              <MessageSquare className={`h-4 w-4 ${unreadCount > 0 ? 'text-white' : 'text-blue-600'} ${unreadCount ? 'animate-blink' : ''}`} />
                              <UnreadBadge count={unreadCount} blink={!!unreadCount} />
                            </Button>
                          </div>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => handleBlock(contact.contact_id)}
                            disabled={blockContactMutation.isPending}
                            className="h-8 w-8 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                          >
                            <UserX className="h-4 w-4 text-orange-600" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost"
                            onClick={() => handleDeleteClick(contact, displayName)}
                            disabled={deleteContactMutation.isPending}
                            className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
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
