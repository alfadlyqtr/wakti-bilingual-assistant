import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MessageSquare, Star, UserX, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContacts, blockContact, deleteContact } from "@/services/contactsService";
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

export function ContactList() {
  const { language } = useTheme();
  const queryClient = useQueryClient();
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<{id: string, name: string} | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{id: string, name: string, avatar?: string} | null>(null);

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
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 60000, // Refetch every minute
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

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

  // Handle opening chat popup with a contact
  const handleOpenChat = (contactId: string, name: string, avatar?: string) => {
    setSelectedContact({ id: contactId, name, avatar });
    setChatOpen(true);
  };

  const handleToggleFavorite = (id: string, name: string) => {
    const isFavorite = !!favorites[id];
    setFavorites({
      ...favorites,
      [id]: !isFavorite
    });
    
    toast(isFavorite ? t("removedFromFavorites", language) : t("addedToFavorites", language));
  };

  const handleBlock = (contactId: string) => {
    blockContactMutation.mutate(contactId);
  };

  // Using the contact relationship ID for deletion
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
          contacts.map((contact: ContactType) => {
            const contactProfile = contact.profile || {} as UserProfile;
            const displayName = contactProfile.display_name || contactProfile.username || "Unknown User";
            const username = contactProfile.username || "user";
            
            return (
              <Card key={contact.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={contactProfile.avatar_url || ""} />
                        <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{displayName}</p>
                        <p className="text-sm text-muted-foreground">@{username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleToggleFavorite(contact.id, displayName)}
                        className="h-10 w-10 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
                      >
                        <Star className={`h-5 w-5 ${favorites[contact.id] ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'}`} />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleOpenChat(contact.contact_id, displayName, contactProfile.avatar_url)}
                        className="h-10 w-10 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <MessageSquare className="h-5 w-5 text-blue-600" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleBlock(contact.contact_id)}
                        disabled={blockContactMutation.isPending}
                        className="h-10 w-10 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                      >
                        <UserX className="h-5 w-5 text-orange-600" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleDeleteClick(contact, displayName)}
                        disabled={deleteContactMutation.isPending}
                        className="h-10 w-10 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-5 w-5 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Chat popup */}
      {selectedContact && (
        <ChatPopup 
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          contactId={selectedContact.id}
          contactName={selectedContact.name}
          contactAvatar={selectedContact.avatar}
        />
      )}

      {/* Delete confirmation dialog */}
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
