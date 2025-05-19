
import { useState } from "react";
import { Check, X, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContactRequests, acceptContactRequest, rejectContactRequest, blockContact } from "@/services/contactsService";
import { LoadingSpinner } from "@/components/ui/loading";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

export function ContactRequests() {
  const { toast } = useToast();
  const { language } = useTheme();
  const queryClient = useQueryClient();
  
  // Fetch contact requests
  const { data: requests, isLoading, isError, error } = useQuery({
    queryKey: ['contactRequests'],
    queryFn: getContactRequests,
  });

  // Accept contact request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: (requestId: string) => acceptContactRequest(requestId),
    onSuccess: () => {
      toast({
        title: t("requestAccepted", language),
        description: t("contactAddedDescription", language)
      });
      queryClient.invalidateQueries({ queryKey: ['contactRequests'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error) => {
      console.error("Error accepting request:", error);
      toast({
        title: t("error", language),
        description: t("errorAcceptingRequest", language),
        variant: "destructive"
      });
    }
  });

  // Reject contact request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: (requestId: string) => rejectContactRequest(requestId),
    onSuccess: () => {
      toast({
        title: t("requestRejected", language),
        description: t("contactRejectedDescription", language)
      });
      queryClient.invalidateQueries({ queryKey: ['contactRequests'] });
    },
    onError: (error) => {
      console.error("Error rejecting request:", error);
      toast({
        title: t("error", language),
        description: t("errorRejectingRequest", language),
        variant: "destructive"
      });
    }
  });

  // Block user mutation
  const blockUserMutation = useMutation({
    mutationFn: (userId: string) => blockContact(userId),
    onSuccess: () => {
      toast({
        title: t("contactBlocked", language),
        description: t("blockedUserDescription", language)
      });
      queryClient.invalidateQueries({ queryKey: ['contactRequests'] });
      queryClient.invalidateQueries({ queryKey: ['blockedContacts'] });
    },
    onError: (error) => {
      console.error("Error blocking user:", error);
      toast({
        title: t("error", language),
        description: t("errorBlockingUser", language),
        variant: "destructive"
      });
    }
  });

  const handleAccept = (requestId: string) => {
    acceptRequestMutation.mutate(requestId);
  };

  const handleReject = (requestId: string) => {
    rejectRequestMutation.mutate(requestId);
  };

  const handleBlock = (userId: string) => {
    blockUserMutation.mutate(userId);
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { 
        addSuffix: true,
        locale: language === 'ar' ? ar : enUS
      });
    } catch (error) {
      return dateString;
    }
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
        <p>{t("errorLoadingRequests", language)}</p>
        <p className="text-sm mt-2">{(error as Error)?.message}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {!requests || requests.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          {t("noContactRequests", language)}
        </Card>
      ) : (
        requests.map(request => {
          const userProfile = request.profiles || {};
          const displayName = userProfile.display_name || userProfile.username || "Unknown User";
          const username = userProfile.username || "user";
          
          return (
            <Card key={request.id} className="overflow-hidden">
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
                  <div className="flex items-center gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleAccept(request.id)}
                      disabled={acceptRequestMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleReject(request.id)}
                      disabled={rejectRequestMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleBlock(request.user_id)}
                      disabled={blockUserMutation.isPending}
                    >
                      <User className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  <Badge variant="secondary">
                    {formatTime(request.created_at)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
