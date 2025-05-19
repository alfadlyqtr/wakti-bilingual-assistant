
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBlockedContacts, unblockContact } from "@/services/contactsService";
import { LoadingSpinner } from "@/components/ui/loading";

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

export function BlockedUsers() {
  const { toast } = useToast();
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
    onSuccess: () => {
      toast({
        title: t("contactUnblocked", language),
        description: t("userUnblockedDescription", language)
      });
      queryClient.invalidateQueries({ queryKey: ['blockedContacts'] });
    },
    onError: (error) => {
      console.error("Error unblocking contact:", error);
      toast({
        title: t("error", language),
        description: t("errorUnblockingContact", language),
        variant: "destructive"
      });
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
        <Card className="p-6 text-center text-muted-foreground">
          <p>{t("noBlockedUsers", language)}</p>
          <p className="text-sm mt-2">{t("searchToAddContacts", language)}</p>
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
                    disabled={unblockContactMutation.isPending}
                    className="flex gap-1"
                  >
                    <UserPlus className="h-4 w-4" />
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
