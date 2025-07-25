
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ShieldOff, Shield } from "lucide-react";
import { 
  getBlockedContacts, 
  unblockContact 
} from "@/services/contactsService";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/utils/translations";
import { toast } from "sonner";

export function BlockedUsers() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBlockedUsers = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const blockedData = await getBlockedContacts(user.id);
      setBlockedUsers(blockedData);
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      toast.error(t("contacts.errorLoadingBlockedUsers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [user?.id]);

  const handleUnblockUser = async (contactId: string) => {
    if (!user?.id) return;

    try {
      await unblockContact(contactId, user.id);
      toast.success(t("contacts.contactUnblocked"));
      fetchBlockedUsers();
    } catch (error) {
      console.error("Error unblocking contact:", error);
      toast.error(t("contacts.errorUnblockingContact"));
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
        <Shield className="h-5 w-5" />
        <h2 className="text-xl font-semibold">المستخدمون المحظورون</h2>
        {blockedUsers.length > 0 && (
          <Badge variant="destructive">{blockedUsers.length}</Badge>
        )}
      </div>

      {blockedUsers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">{t("contacts.noBlockedUsers")}</p>
          <p className="text-sm text-muted-foreground mt-2">{t("contacts.noBlockedUsersDescription")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {blockedUsers.map((user: any) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.profiles?.avatar_url} alt={user.profiles?.display_name} />
                      <AvatarFallback>
                        {user.profiles?.display_name?.charAt(0)?.toUpperCase() || user.profiles?.username?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-sm">
                        {user.profiles?.display_name || user.profiles?.username || "Unknown User"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        @{user.profiles?.username || "unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        محظور في {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnblockUser(user.contact_id)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <ShieldOff className="h-4 w-4 mr-1" />
                      {t("contacts.unblockUser")}
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
