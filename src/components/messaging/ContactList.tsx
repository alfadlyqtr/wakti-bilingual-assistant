
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, MessageSquare } from "lucide-react";
import { getContactsWithMessages, searchContacts } from "@/services/directMessageService";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

interface ContactListProps {
  onSelectContact: (id: string) => void;
  activeContactId: string | null;
  searchQuery?: string;
}

export function ContactList({ onSelectContact, activeContactId, searchQuery = "" }: ContactListProps) {
  const { language } = useTheme();
  const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
  
  const { data: contacts, isLoading, isError, error } = useQuery({
    queryKey: ['contactsWithMessages'],
    queryFn: getContactsWithMessages,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Filter contacts based on search query
  useEffect(() => {
    async function filterContacts() {
      if (!contacts) {
        setFilteredContacts([]);
        return;
      }
      
      if (!searchQuery.trim()) {
        setFilteredContacts(contacts);
        return;
      }
      
      const filtered = await searchContacts(searchQuery);
      setFilteredContacts(filtered);
    }
    
    filterContacts();
  }, [searchQuery, contacts]);

  // Format time in a more iOS Messages style
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.getDate() === now.getDate() && 
                     date.getMonth() === now.getMonth() && 
                     date.getFullYear() === now.getFullYear();
      
      if (isToday) {
        // For today, show time like "10:57 pm"
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "pm" : "am";
        hours = hours % 12;
        hours = hours ? hours : 12; // Handle midnight (0 hours)
        return `${hours}:${minutes} ${ampm}`;
      } else {
        // For past dates, show day name
        return formatDistanceToNow(date, { 
          addSuffix: false,
          locale: language === "ar" ? ar : enUS 
        });
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">{t("errorLoadingContacts", language)}</p>
        <p className="text-sm text-red-500">{(error as Error)?.message}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <ScrollArea className="flex-1 w-full">
        <div className="w-full divide-y divide-border">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-10 px-4 text-muted-foreground">
              <div className="flex justify-center mb-4">
                <MessageSquare className="h-16 w-16 opacity-20" />
              </div>
              <p className="text-lg font-medium mb-2">{searchQuery ? t("noContactsFound", language) : t("noContacts", language)}</p>
              <p className="text-sm mt-2">{t("welcomeToMessages", language)}</p>
              <p className="text-sm mt-1">{t("addContactsPrompt", language)}</p>
            </div>
          ) : (
            filteredContacts.map((contact: any) => {
              const profile = contact.profile || {};
              const name = profile.display_name || profile.username || "Unknown";
              const lastMessage = contact.last_message;
              const isVoiceMessage = lastMessage?.content?.includes('🎤');
              const isImageMessage = lastMessage?.content?.includes('📷');
              
              return (
                <div
                  key={contact.contact_id}
                  className={`flex items-center py-3 px-4 cursor-pointer hover:bg-muted/30 w-full ${contact.contact_id === activeContactId ? 'bg-muted/50' : ''}`}
                  onClick={() => onSelectContact(contact.contact_id)}
                >
                  <Avatar className="h-12 w-12 bg-muted mr-3 flex-shrink-0">
                    <AvatarImage src={profile.avatar_url} alt={name} />
                    <AvatarFallback className="bg-muted text-foreground">
                      {name[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline w-full">
                      <h3 className="font-medium text-foreground truncate">{name}</h3>
                      {lastMessage && (
                        <div className="flex items-center flex-shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTime(lastMessage.created_at)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center w-full pr-6">
                      {isVoiceMessage && (
                        <span className="mr-1">🎤</span>
                      )}
                      {isImageMessage && (
                        <span className="mr-1">📷</span>
                      )}
                      <p className="text-sm text-muted-foreground truncate flex-1">
                        {lastMessage?.content || t("noMessages", language)}
                      </p>
                      {(contact.unread_count > 0) && (
                        <span className="ml-2 bg-blue-500 text-white text-xs rounded-full h-5 min-w-5 flex items-center justify-center px-1 flex-shrink-0">
                          {contact.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
