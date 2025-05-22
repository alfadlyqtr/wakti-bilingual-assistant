
import { useState } from "react";
import { Check, X, User, UserCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getContactRequests, acceptContactRequest, rejectContactRequest, blockContact } from "@/services/contactsService";
import { LoadingSpinner } from "@/components/ui/loading";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import { toast } from "sonner";

export function ContactRequests() {
  const { language } = useTheme();
  const queryClient = useQueryClient();
  
  // Fetch contact requests
  const { data: requests, isLoading, isError, error } = useQuery({
    queryKey: ['contactRequests'],
    queryFn: getContactRequests,
  });

  // Accept contact request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: (requestId: string) => {
      if (!requestId) {
        throw new Error("Request ID is undefined");
      }
      return acceptContactRequest(requestId);
    },
    onSuccess: () => {
      // Show a success toast with auto-dismiss after 2 seconds
      toast.success(t("requestAccepted", language), { 
        duration: 2000,
        position: 'bottom-center'
      });
      
      // Invalidate queries to refresh the contacts list and requests list
      queryClient.invalidateQueries({ queryKey: ['contactRequests'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error) => {
      console.error("Error accepting request:", error);
      toast.error(t("errorAcceptingRequest", language));
    }
  });

  // Reject contact request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: (requestId: string) => {
      if (!requestId) {
        throw new Error("Request ID is undefined");
      }
      return rejectContactRequest(requestId);
    },
    onSuccess: () => {
      toast.success(t("requestRejected", language), { 
        duration: 2000,
        position: 'bottom-center'
      });
      queryClient.invalidateQueries({ queryKey: ['contactRequests'] });
    },
    onError: (error) => {
      console.error("Error rejecting request:", error);
      toast.error(t("errorRejectingRequest", language));
    }
  });

  // Block user mutation
  const blockUserMutation = useMutation({
    mutationFn: (userId: string) => {
      if (!userId) {
        throw new Error("User ID is undefined");
      }
      return blockContact(userId);
    },
    onSuccess: () => {
      toast.success(t("contactBlocked", language), { 
        duration: 2000,
        position: 'bottom-center'
      });
      queryClient.invalidateQueries({ queryKey: ['contactRequests'] });
      queryClient.invalidateQueries({ queryKey: ['blockedContacts'] });
    },
    onError: (error) => {
      console.error("Error blocking user:", error);
      toast.error(t("errorBlockingUser", language));
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
    if (!name) return "??";
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
        <Card className="p-6">
          <div className="text-center flex flex-col items-center gap-3 text-muted-foreground">
            <UserCog className="h-12 w-12 opacity-50" />
            <p className="font-medium text-lg">{t("noContactRequests", language)}</p>
            <p className="text-sm">{t("waitingForRequests", language)}</p>
          </div>
        </Card>
      ) : (
        requests.map(request => {
          const userProfile = request.profiles || {};
          const displayName = ((userProfile as any).display_name as string) || ((userProfile as any).username as string) || "Unknown User";
          const username = ((userProfile as any).username as string) || "user";
          
          return (
            <Card key={request.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={((userProfile as any).avatar_url as string) || ""} />
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
                      variant="outline"
                      className="h-8 w-8 rounded-full border-green-500/50 hover:border-green-500 hover:bg-green-500/10"
                      onClick={() => handleAccept(request.id)}
                      disabled={acceptRequestMutation.isPending}
                    >
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="outline"
                      className="h-8 w-8 rounded-full border-red-500/50 hover:border-red-500 hover:bg-red-500/10"
                      onClick={() => handleReject(request.id)}
                      disabled={rejectRequestMutation.isPending}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleBlock(request.user_id)}
                      disabled={blockUserMutation.isPending}
                    >
                      <User className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
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
