
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MessageSquare, Star, UserX, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContacts, blockContact, deleteContact } from "@/services/contactsService";
import { createConversation } from "@/services/messageService";
import { LoadingSpinner } from "@/components/ui/loading";
import { toast } from "sonner";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<{id: string, name: string} | null>(null);

  // Fetch contacts
  const { data: contacts, isLoading, isError, error } = useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: (contactId: string) => createConversation(contactId),
    onSuccess: (conversationId) => {
      navigate(`/messages?conversation=${conversationId}`);
    },
    onError: (error) => {
      console.error("Error creating conversation:", error);
      toast.error(t("errorCreatingConversation", language));
    }
  });

  // Block contact mutation
  const blockContactMutation = useMutation({
    mutationFn: (contactId: string) => blockContact(contactId),
    onSuccess: () => {
      toast.success(t("contactBlocked", language));
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['blockedContacts'] });
    },
    onError: (error) => {
      console.error("Error blocking contact:", error);
      toast.error(t("errorBlockingContact", language));
    }
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => deleteContact(contactId),
    onSuccess: () => {
      toast.success(t("contactDeleted", language));
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    },
    onError: (error) => {
      console.error("Error deleting contact:", error);
      toast.error(t("errorDeletingContact", language));
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
  });

  const handleMessage = (contactId: string, name: string) => {
    createConversationMutation.mutate(contactId);
    toast(t("messageStarted", language) + " " + name);
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

  const handleDeleteClick = (contactId: string, name: string) => {
    setContactToDelete({ id: contactId, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (contactToDelete) {
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
                    <div className="flex items-center gap-1 pr-1">
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleToggleFavorite(contact.id, displayName)}
                      >
                        <Star className={`h-4 w-4 ${favorites[contact.id] ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleMessage(contact.contact_id, displayName)}
                        disabled={createConversationMutation.isPending}
                      >
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleBlock(contact.contact_id)}
                        disabled={blockContactMutation.isPending}
                      >
                        <UserX className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => handleDeleteClick(contact.contact_id, displayName)}
                        disabled={deleteContactMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

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
