
import { useState, useEffect } from "react";
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
  
  // Fetch contact requests with refetch enabled and staleTime set to 0 to always fetch fresh data
  const { data: requests, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['contactRequests'],
    queryFn: getContactRequests,
    staleTime: 0, // Consider data immediately stale to force refetch
    refetchOnMount: true, // Always refetch on mount
  });

  // Force refetch on mount to ensure we have fresh data
  useEffect(() => {
    console.log("ContactRequests mounted - forcing data refresh");
    refetch();
  }, [refetch]);

  // Debug log the requests data whenever it changes
  useEffect(() => {
    console.log("Current requests data:", requests);
    if (requests?.length) {
      requests.forEach((req, index) => {
        console.log(`Request ${index + 1}:`, {
          id: req.id, 
          user_id: req.user_id,
          status: req.status,
          created_at: req.created_at,
          profiles: req.profiles
        });
      });
    }
  }, [requests]);

  // Accept contact request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: (requestId: string) => {
      // Add validation and debug logging
      if (!requestId) {
        console.error("Attempted to accept with undefined requestId");
        throw new Error("Request ID is undefined");
      }
      
      console.log("Accepting request with ID:", requestId);
      return acceptContactRequest(requestId);
    },
    onSuccess: (data) => {
      console.log("Accept request succeeded:", data);
      
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
      toast.error(`${t("errorAcceptingRequest", language)}: ${error.message || 'Unknown error'}`);
    }
  });

  // Reject contact request mutation
  const rejectRequestMutation = useMutation({
    mutationFn: (requestId: string) => {
      if (!requestId) {
        console.error("Attempted to reject with undefined requestId");
        throw new Error("Request ID is undefined");
      }
      
      console.log("Rejecting request with ID:", requestId);
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
      toast.error(`${t("errorRejectingRequest", language)}: ${error.message || 'Unknown error'}`);
    }
  });

  // Block user mutation
  const blockUserMutation = useMutation({
    mutationFn: (userId: string) => {
      if (!userId) {
        console.error("Attempted to block with undefined userId");
        throw new Error("User ID is undefined");
      }
      
      console.log("Blocking user with ID:", userId);
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
      toast.error(`${t("errorBlockingUser", language)}: ${error.message || 'Unknown error'}`);
    }
  });

  const handleAccept = (requestId: string | undefined) => {
    // Added safety check
    if (!requestId) {
      console.error("Cannot accept request: requestId is undefined");
      toast.error(t("errorAcceptingRequest", language));
      return;
    }

    console.log("Accept button clicked with requestId:", requestId);
    acceptRequestMutation.mutate(requestId);
  };

  const handleReject = (requestId: string | undefined) => {
    // Added safety check
    if (!requestId) {
      console.error("Cannot reject request: requestId is undefined");
      toast.error(t("errorRejectingRequest", language));
      return;
    }

    console.log("Reject button clicked with requestId:", requestId);
    rejectRequestMutation.mutate(requestId);
  };

  const handleBlock = (userId: string | undefined) => {
    // Added safety check
    if (!userId) {
      console.error("Cannot block user: userId is undefined");
      toast.error(t("errorBlockingUser", language));
      return;
    }

    console.log("Block button clicked with userId:", userId);
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
          console.log("Rendering request card for request:", request);
          
          const userProfile = request.profiles || {};
          const displayName = ((userProfile as any).display_name as string) || ((userProfile as any).username as string) || "Unknown User";
          const username = ((userProfile as any).username as string) || "user";
          
          return (
            <Card key={request.id || `request-${Math.random()}`} className="overflow-hidden">
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
                      <p className="text-xs text-muted-foreground mt-1">
                        Request ID: {request.id ? request.id.substring(0, 8) + '...' : 'missing'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="icon" 
                      variant="outline"
                      className="h-8 w-8 rounded-full border-green-500/50 hover:border-green-500 hover:bg-green-500/10"
                      onClick={() => handleAccept(request.id)}
                      disabled={acceptRequestMutation.isPending || !request.id}
                    >
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="outline"
                      className="h-8 w-8 rounded-full border-red-500/50 hover:border-red-500 hover:bg-red-500/10"
                      onClick={() => handleReject(request.id)}
                      disabled={rejectRequestMutation.isPending || !request.id}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleBlock(request.user_id)}
                      disabled={blockUserMutation.isPending || !request.user_id}
                    >
                      <User className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {request.created_at ? (
                    <Badge variant="secondary">
                      {formatTime(request.created_at)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Unknown date</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
