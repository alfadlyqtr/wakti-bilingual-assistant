
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Check, X, Shield } from "lucide-react";
import { 
  getContactRequests, 
  acceptContactRequest, 
  rejectContactRequest, 
  blockContact 
} from "@/services/contactsService";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/utils/translations";
import { toast } from "sonner";

export function ContactRequests() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const requestsData = await getContactRequests(user.id);
      setRequests(requestsData);
    } catch (error) {
      console.error("Error fetching contact requests:", error);
      toast.error(t("contacts.errorLoadingRequests"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user?.id]);

  const handleAcceptRequest = async (requestId: string) => {
    if (!user?.id) return;

    try {
      await acceptContactRequest(requestId, user.id);
      toast.success(t("contacts.requestAccepted"));
      fetchRequests();
    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error(t("contacts.errorAcceptingRequest"));
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectContactRequest(requestId);
      toast.success(t("contacts.requestRejected"));
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error(t("contacts.errorRejectingRequest"));
    }
  };

  const handleBlockUser = async (requestId: string, userId: string) => {
    if (!user?.id) return;

    try {
      await rejectContactRequest(requestId);
      await blockContact(userId, user.id);
      toast.success(t("contacts.userBlocked"));
      fetchRequests();
    } catch (error) {
      console.error("Error blocking user:", error);
      toast.error(t("contacts.errorBlockingUser"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <h2 className="text-xl font-semibold">{t("contacts.contactRequests")}</h2>
        {requests.length > 0 && (
          <Badge variant="secondary">{requests.length}</Badge>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">{t("contacts.noContactRequests")}</p>
          <p className="text-sm text-muted-foreground mt-2">{t("contacts.waitingForRequests")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request: any) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={request.profiles?.avatar_url} alt={request.profiles?.display_name} />
                      <AvatarFallback>
                        {request.profiles?.display_name?.charAt(0)?.toUpperCase() || request.profiles?.username?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-sm">
                        {request.profiles?.display_name || request.profiles?.username || "Unknown User"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        @{request.profiles?.username || "unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAcceptRequest(request.id)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {t("common.accept")}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejectRequest(request.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t("common.reject")}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBlockUser(request.id, request.user_id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      {t("contacts.blockUser")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
