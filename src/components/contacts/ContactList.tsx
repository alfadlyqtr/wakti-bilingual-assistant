import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MessageSquare, Star, UserX, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContacts, blockContact, deleteContact } from "@/services/contactsService";
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

  // Handle message directly by navigating to the messages page with the contact ID
  const handleMessage = (contactId: string, name: string) => {
    navigate(`/messages?contact=${contactId}`);
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
                        onClick={() => handleDeleteClick(contact, displayName)}
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
