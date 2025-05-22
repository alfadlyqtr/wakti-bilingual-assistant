
import { useState } from "react";
import { UserPlus, UserX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBlockedContacts, unblockContact, sendContactRequest } from "@/services/contactsService";
import { LoadingSpinner } from "@/components/ui/loading";
import { toast } from "sonner";

type UserProfile = {
  display_name?: string;
  username?: string;
  avatar_url?: string;
  [key: string]: any;
};

type BlockedUserType = {
  id: string;
  contact_id: string;
  profiles?: UserProfile;
  [key: string]: any;
};

interface BlockedUsersProps {
  onUnblockSuccess?: () => void;
}

export function BlockedUsers({ onUnblockSuccess }: BlockedUsersProps) {
  const { language } = useTheme();
  const queryClient = useQueryClient();
  
  // Fetch blocked contacts
  const { data: blockedUsers, isLoading, isError, error } = useQuery({
    queryKey: ['blockedContacts'],
    queryFn: getBlockedContacts,
  });

  // Unblock contact mutation
  const unblockContactMutation = useMutation({
    mutationFn: (contactId: string) => unblockContact(contactId),
    onSuccess: (result, contactId) => {
      // Show success message
      toast.success(t("contactUnblocked", language));
      
      // After unblocking, automatically send a contact request to add them back to contacts
      addToContactsMutation.mutate(contactId);
      
      // Invalidate both blocked contacts and regular contacts queries
      queryClient.invalidateQueries({ queryKey: ['blockedContacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error) => {
      console.error("Error unblocking contact:", error);
      toast.error(t("errorUnblockingContact", language));
    }
  });

  // Add to contacts mutation
  const addToContactsMutation = useMutation({
    mutationFn: (contactId: string) => sendContactRequest(contactId),
    onSuccess: () => {
      toast.success(t("userUnblockedDescription", language));
      
      // Invalidate contacts query to show the updated list
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      
      // Switch to contacts tab after successful unblock
      if (onUnblockSuccess) {
        onUnblockSuccess();
      }
    },
    onError: (error) => {
      console.error("Error adding contact after unblock:", error);
      // Even if adding back to contacts fails, we still switch tabs because the unblock was successful
      if (onUnblockSuccess) {
        onUnblockSuccess();
      }
    }
  });

  const handleUnblock = (contactId: string) => {
    unblockContactMutation.mutate(contactId);
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
        <p>{t("errorLoadingBlockedUsers", language)}</p>
        <p className="text-sm mt-2">{(error as Error)?.message}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {!blockedUsers || blockedUsers.length === 0 ? (
        <Card className="p-6">
          <div className="text-center flex flex-col items-center gap-3 text-muted-foreground">
            <UserX className="h-12 w-12 opacity-50" />
            <p className="font-medium text-lg">{t("noBlockedUsers", language)}</p>
            <p className="text-sm">{t("noBlockedUsersDescription", language)}</p>
          </div>
        </Card>
      ) : (
        blockedUsers.map((user: BlockedUserType) => {
          const userProfile = user.profiles || {} as UserProfile;
          const displayName = userProfile.display_name || userProfile.username || "Unknown User";
          const username = userProfile.username || "user";
          
          return (
            <Card key={user.id} className="overflow-hidden border-destructive/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={userProfile.avatar_url || ""} />
                      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{displayName}</p>
                      <p className="text-sm text-muted-foreground">@{username}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleUnblock(user.contact_id)}
                    disabled={unblockContactMutation.isPending || addToContactsMutation.isPending}
                    className="flex gap-1"
                  >
                    {(unblockContactMutation.isPending || addToContactsMutation.isPending) ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-1" />
                    )}
                    {t("unblock", language)}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
