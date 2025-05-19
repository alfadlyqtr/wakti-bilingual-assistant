import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { toast } from "sonner";
import { searchUsers, sendContactRequest } from "@/services/contactsService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading";

export function ContactSearch() {
  const { language } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const queryClient = useQueryClient();

  // Search users query
  const { 
    data: searchResults, 
    refetch: performSearch, 
    isLoading: isSearchLoading
  } = useQuery({
    queryKey: ['searchUsers', searchQuery],
    queryFn: () => searchUsers(searchQuery),
    enabled: false,
  });

  // Send contact request mutation
  const sendRequestMutation = useMutation({
    mutationFn: (userId: string) => sendContactRequest(userId),
    onSuccess: () => {
      toast.success(t("requestSent", language));
      
      // Invalidate queries that might be affected
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contactRequests'] });
      
      // Clear search results
      setSearchQuery("");
      setIsSearching(false);
    },
    onError: (error) => {
      console.error("Error sending contact request:", error);
      toast.error(t("errorSendingRequest", language));
    }
  });

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (value.length >= 3) {
      setIsSearching(true);
      await performSearch();
    } else {
      setIsSearching(false);
    }
  };

  const handleSendRequest = (userId: string) => {
    sendRequestMutation.mutate(userId);
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchContacts", language)}
            className="pl-9"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
      </div>

      {isSearching && isSearchLoading && (
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner size="md" />
        </div>
      )}

      {isSearching && !isSearchLoading && searchResults && searchResults.length > 0 && (
        <div className="mt-4">
          <Separator className="my-2" />
          <p className="text-sm text-muted-foreground mb-2">{t("searchResults", language)}</p>
          <div className="space-y-2">
            {searchResults.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <Avatar>
                    <AvatarImage src={user.avatar_url || ""} />
                    <AvatarFallback>{getInitials(user.display_name || user.username)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => handleSendRequest(user.id)}
                  disabled={sendRequestMutation.isPending}
                  size="sm"
                >
                  {sendRequestMutation.isPending ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : null}
                  {t("sendRequest", language)}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSearching && !isSearchLoading && searchResults && searchResults.length === 0 && (
        <div className="mt-4 text-center text-muted-foreground p-4">
          <p>{t("noUsersFound", language)}</p>
        </div>
      )}
    </Card>
  );
}
