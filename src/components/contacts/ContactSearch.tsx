
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, UserCheck } from "lucide-react";
import { 
  searchUsers, 
  checkIfUserInContacts, 
  sendContactRequest 
} from "@/services/contactsService";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/utils/translations";
import { toast } from "sonner";

export function ContactSearch() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contactStatuses, setContactStatuses] = useState<{[key: string]: boolean}>({});

  const handleSearch = async () => {
    if (!user?.id) return;
    
    if (searchQuery.trim().length < 3) {
      toast.error(t("contacts.enterAtLeastThreeCharacters"));
      return;
    }

    try {
      setLoading(true);
      const results = await searchUsers(searchQuery.trim(), user.id);
      setSearchResults(results);

      // Check contact status for each result
      const statuses: {[key: string]: boolean} = {};
      for (const result of results) {
        const isInContacts = await checkIfUserInContacts(result.id, user.id);
        statuses[result.id] = isInContacts;
      }
      setContactStatuses(statuses);
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error("خطأ في البحث");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    if (!user?.id) return;

    try {
      await sendContactRequest(userId, user.id);
      toast.success(t("contacts.requestSent"));
      
      // Update the contact status
      setContactStatuses(prev => ({
        ...prev,
        [userId]: true
      }));
    } catch (error) {
      console.error("Error sending contact request:", error);
      toast.error(t("contacts.errorSendingRequest"));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("contacts.searchContacts")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder={t("contacts.searchContacts")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">{t("contacts.searchResults")}</h3>
          {searchResults.map((user: any) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar_url} alt={user.display_name} />
                      <AvatarFallback>
                        {user.display_name?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-sm">
                        {user.display_name || user.username || "Unknown User"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        @{user.username || "unknown"}
                      </p>
                      {user.email && (
                        <p className="text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {contactStatuses[user.id] ? (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        {t("contacts.alreadyInContacts")}
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendRequest(user.id)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        {t("contacts.sendRequest")}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {searchQuery.trim().length >= 3 && searchResults.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">{t("contacts.noUsersFound")}</p>
        </div>
      )}
    </div>
  );
}
