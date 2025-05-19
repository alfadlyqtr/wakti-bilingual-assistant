
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getContacts } from "@/services/contactsService";
import { createConversation } from "@/services/messageService";
import { LoadingSpinner } from "@/components/ui/loading";

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contactId: string) => void;
}

export function NewMessageModal({ isOpen, onClose, onSelectContact }: NewMessageModalProps) {
  const { language } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  
  // Get contacts list
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedContactId(null);
    }
  }, [isOpen]);

  // Filter contacts based on search query
  const filteredContacts = contacts?.filter(contact => {
    const profile = contact.profile || {};
    const displayName = (profile.display_name as string) || (profile.username as string) || "";
    const username = (profile.username as string) || "";
    
    return !searchQuery || 
      displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelectContact = async (contactId: string) => {
    setSelectedContactId(contactId);
    setIsCreatingConversation(true);
    
    try {
      // Create or get conversation with this contact
      const conversationId = await createConversation(contactId);
      onSelectContact(conversationId);
      onClose();
    } catch (error) {
      console.error("Error creating conversation:", error);
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newMessage", language)}</DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchContacts", language)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute right-1 top-1 h-8 w-8 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="space-y-1">
              {!filteredContacts || filteredContacts.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p>{t("noContactsFound", language)}</p>
                </div>
              ) : (
                filteredContacts.map(contact => {
                  const profile = contact.profile || {};
                  const displayName = (profile.display_name as string) || (profile.username as string) || "Unknown User";
                  
                  return (
                    <Button
                      key={contact.contact_id}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => handleSelectContact(contact.contact_id)}
                      disabled={isCreatingConversation}
                    >
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarImage src={(profile.avatar_url as string) || ""} alt={displayName} />
                        <AvatarFallback>
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      {displayName}
                    </Button>
                  );
                })
              )}
            </div>
          )}
        </ScrollArea>
        
        {isCreatingConversation && (
          <div className="flex justify-center items-center pt-2">
            <LoadingSpinner size="sm" />
            <span className="ml-2 text-sm text-muted-foreground">{t("creatingConversation", language)}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
