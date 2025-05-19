
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MessageSquare, Star, UserX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContacts, blockContact } from "@/services/contactsService";
import { createConversation } from "@/services/messageService";
import { LoadingSpinner } from "@/components/ui/loading";

export function ContactList() {
  const { toast } = useToast();
  const { language } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

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
      toast({
        title: t("error", language),
        description: t("errorCreatingConversation", language),
        variant: "destructive"
      });
    }
  });

  // Block contact mutation
  const blockContactMutation = useMutation({
    mutationFn: (contactId: string) => blockContact(contactId),
    onSuccess: () => {
      toast({
        title: t("contactBlocked", language),
        description: t("userBlockedDescription", language)
      });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['blockedContacts'] });
    },
    onError: (error) => {
      console.error("Error blocking contact:", error);
      toast({
        title: t("error", language),
        description: t("errorBlockingContact", language),
        variant: "destructive"
      });
    }
  });

  const handleMessage = (contactId: string, name: string) => {
    createConversationMutation.mutate(contactId);
    
    toast({
      title: t("messageStarted", language),
      description: t("chattingWithUser", language) + " " + name
    });
  };

  const handleToggleFavorite = (id: string, name: string) => {
    const isFavorite = !!favorites[id];
    setFavorites({
      ...favorites,
      [id]: !isFavorite
    });
    
    toast({
      title: isFavorite ? t("removedFromFavorites", language) : t("addedToFavorites", language),
      description: ""
    });
  };

  const handleBlock = (contactId: string) => {
    blockContactMutation.mutate(contactId);
  };

  const getInitials = (name: string) => {
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
    <div className="space-y-3">
      {!contacts || contacts.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          <p>{t("noContacts", language)}</p>
          <p className="text-sm mt-2">{t("searchToAddContacts", language)}</p>
        </Card>
      ) : (
        contacts.map(contact => {
          const contactProfile = contact.profile || {};
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
                  <div className="flex items-center gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleToggleFavorite(contact.id, displayName)}
                    >
                      <Star className={`h-4 w-4 ${favorites[contact.id] ? 'text-yellow-500' : 'text-muted-foreground'}`} />
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
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
