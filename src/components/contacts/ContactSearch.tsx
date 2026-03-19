import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { toast } from "sonner";
import { searchUsers, sendContactRequest, getContactRelationshipStatus, ContactRelationshipStatus } from "@/services/contactsService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading";
import { Badge } from "@/components/ui/badge";

export function ContactSearch() {
  const { language } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [contactStatus, setContactStatus] = useState<Record<string, ContactRelationshipStatus>>({});

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
    onSuccess: (createdContact) => {
      toast.success(t("requestSent", language));
      
      // Invalidate queries that might be affected
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contactRequests'] });
      
      // Update contact status for this user based on created contact row
      setContactStatus(prev => {
        const updatedStatus = { ...prev };
        // Set the relationship status for the user that was just added
        if (searchResults) {
          searchResults.forEach(user => {
            if (sendRequestMutation.variables === user.id) {
              // Use status from backend (approved if auto-approve, otherwise pending)
              updatedStatus[user.id] = (createdContact?.status as ContactRelationshipStatus) ?? 'pending';
            }
          });
        }
        return updatedStatus;
      });
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

  const handleSearchSubmit = async () => {
    if (searchQuery.length >= 3) {
      setIsSearching(true);
      await performSearch();
      
      // Reset contact status
      setContactStatus({});
      
      // Check contact status for each search result
      if (searchResults) {
        const statusChecks = searchResults.map(async (user) => {
          try {
            const status = await getContactRelationshipStatus(user.id);
            setContactStatus(prev => ({
              ...prev,
              [user.id]: status
            }));
          } catch (err) {
            console.error(`Error checking contact status for ${user.id}:`, err);
          }
        });
        
        await Promise.all(statusChecks);
      }
    } else if (searchQuery.length > 0) {
      toast.info(t("enterAtLeastThreeCharacters", language));
    }
  };

  // When raw search results change (e.g. new search), refresh relationship status map
  useEffect(() => {
    const checkContactsStatus = async () => {
      if (!searchResults) return;
      for (const user of searchResults) {
        try {
          const status = await getContactRelationshipStatus(user.id);
          setContactStatus(prev => ({
            ...prev,
            [user.id]: status,
          }));
        } catch (err) {
          console.error(`Error checking contact status for ${user.id}:`, err);
        }
      }
    };

    if (searchResults && searchResults.length > 0) {
      checkContactsStatus();
    }
  }, [searchResults]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
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
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="-mx-1.5 px-1.5 pb-3 sm:mx-0 sm:px-1">
      <div className="rounded-[1.75rem] border border-[#d7dbe5] dark:border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,242,236,0.96))] dark:bg-[linear-gradient(180deg,rgba(12,15,20,0.96),rgba(18,22,30,0.94))] p-2.5 sm:p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_16px_32px_rgba(15,23,42,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_32px_rgba(0,0,0,0.35)]">
        <div className="rounded-[1.5rem] border border-[#e4d9cd] dark:border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,238,232,0.92))] dark:bg-[linear-gradient(180deg,rgba(24,28,38,0.95),rgba(16,19,27,0.95))] p-2 sm:p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-8px_20px_rgba(233,206,176,0.18)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-8px_20px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 rounded-[1.25rem] border border-[#d8d2ca] dark:border-white/10 bg-white/80 dark:bg-white/5 shadow-[inset_0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.35)]">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${language === 'ar' ? 'right-4' : 'left-4'}`} />
              <Input
                placeholder={language === 'ar' ? 'ابحث عن جهة اتصال' : t("searchContacts", language)}
                className={`bg-transparent border-0 rounded-[1.25rem] h-12 text-[15px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ${language === 'ar' ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'}`}
                value={searchQuery}
                onChange={handleSearch}
                onKeyPress={handleKeyPress}
                ref={inputRef}
              />
            </div>
            <Button 
              onClick={handleSearchSubmit}
              disabled={searchQuery.length < 1}
              size="sm"
              className="rounded-[1.25rem] h-12 px-5 bg-[linear-gradient(135deg,#060541_0%,hsl(243_40%_40%)_100%)] hover:opacity-95 dark:bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(260_70%_65%)_100%)] text-white border border-transparent shadow-[0_10px_24px_rgba(6,5,65,0.22)] dark:shadow-[0_10px_24px_rgba(33,150,243,0.18)] shrink-0"
            >
              {t("search", language)}
            </Button>
          </div>
        </div>

        <div className="px-1 pt-3 text-center">
          <p className="text-xs leading-5 text-muted-foreground/90">
            {language === 'ar' 
              ? 'يجب أن يكون كل منكما ضمن جهات اتصال الآخر لتبادل الرسائل وعرض المعارض وقوائم الأمنيات'
              : 'Both users must be in each other\'s contact list to exchange messages, view galleries and wishlists'
            }
          </p>
        </div>
      </div>

      {isSearching && isSearchLoading && (
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner size="md" />
        </div>
      )}

      {isSearching && !isSearchLoading && searchResults && searchResults.length > 0 && (
        <div className="mt-4 rounded-[1.5rem] border border-[#d7dbe5] dark:border-border bg-card/80 dark:bg-card/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_14px_28px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_14px_28px_rgba(0,0,0,0.28)]">
          <div className="px-1 pb-2">
            <Separator className="mb-3 opacity-60" />
            <p className="text-sm font-medium text-muted-foreground">{t("searchResults", language)}</p>
          </div>
          <div className="space-y-2">
            {searchResults.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-[#e1e5ee] dark:border-white/10 bg-white/70 dark:bg-white/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_6px_16px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_6px_16px_rgba(0,0,0,0.22)]">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar className="h-11 w-11 flex-shrink-0 ring-1 ring-[#d7dbe5] dark:ring-white/10 shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
                    <AvatarImage src={user.avatar_url || ""} />
                    <AvatarFallback className="bg-[linear-gradient(135deg,#060541_0%,hsl(210_100%_65%)_100%)] text-white">{getInitials(user.display_name || user.username)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold truncate text-foreground">{user.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                    {user.email && (
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {(() => {
                    const status = contactStatus[user.id];
                    if (status === 'approved') {
                      return (
                        <Badge variant="secondary" className="px-3 py-1 whitespace-nowrap rounded-full border border-[#d7dbe5] dark:border-white/10 bg-white/80 dark:bg-white/10">
                          {t("alreadyInContacts", language)}
                        </Badge>
                      );
                    }
                    if (status === 'pending') {
                      return (
                        <Badge variant="outline" className="px-3 py-1 text-xs whitespace-nowrap rounded-full border-[#d7dbe5] dark:border-white/10 bg-white/70 dark:bg-white/5">
                          {t("requestSent", language)}
                        </Badge>
                      );
                    }
                    if (status === 'blocked') {
                      return (
                        <Badge variant="destructive" className="px-3 py-1 text-xs whitespace-nowrap rounded-full">
                          {t("blocked", language)}
                        </Badge>
                      );
                    }
                    return (
                      <Button
                        onClick={() => handleSendRequest(user.id)}
                        disabled={sendRequestMutation.isPending && sendRequestMutation.variables === user.id}
                        size="sm"
                        className="whitespace-nowrap rounded-full px-4 bg-[linear-gradient(135deg,hsl(210_100%_65%)_0%,hsl(260_70%_65%)_100%)] hover:opacity-95 text-white border border-transparent shadow-[0_8px_18px_rgba(33,150,243,0.18)]"
                      >
                        {(sendRequestMutation.isPending && sendRequestMutation.variables === user.id) ? (
                          <LoadingSpinner size="sm" className="mr-2" />
                        ) : null}
                        {t("sendRequest", language)}
                      </Button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSearching && !isSearchLoading && searchResults && searchResults.length === 0 && (
        <div className="mt-4 rounded-[1.5rem] border border-[#d7dbe5] dark:border-border bg-card/80 dark:bg-card/90 p-6 text-center text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_14px_28px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_14px_28px_rgba(0,0,0,0.28)]">
          <p>{t("noUsersFound", language)}</p>
        </div>
      )}
    </div>
  );
}
