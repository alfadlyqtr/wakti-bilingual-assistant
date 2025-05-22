
import { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, User, X, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getContacts, isUserBlocked, isBlockedByUser } from "@/services/contactsService";
import { createConversation } from "@/services/messageService";
import { LoadingSpinner } from "@/components/ui/loading";
import { toast } from "sonner";

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contactId: string) => void;
}

type UserProfile = {
  display_name?: string;
  username?: string;
  avatar_url?: string;
  [key: string]: any;
};

type ContactType = {
  id: string;
  contact_id: string;
  profile?: UserProfile;
  [key: string]: any;
};

export function NewMessageModal({ isOpen, onClose, onSelectContact }: NewMessageModalProps) {
  const { language } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [blockedContacts, setBlockedContacts] = useState<Record<string, boolean>>({});
  const [blockedByContacts, setBlockedByContacts] = useState<Record<string, boolean>>({});
  
  // Get contacts list
  const { data: contacts, isLoading, error } = useQuery({
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

  // Show error toast if contacts fail to load
  useEffect(() => {
    if (error) {
      toast.error(t("errorLoadingContacts", language));
    }
  }, [error, language]);

  // Check which contacts are blocked
  useEffect(() => {
    async function checkBlockStatuses() {
      if (!contacts || contacts.length === 0) return;
      
      const blocked: Record<string, boolean> = {};
      const blockedBy: Record<string, boolean> = {};
      
      await Promise.all(
        contacts.map(async (contact: ContactType) => {
          try {
            const [isBlocked, isBlockedByResult] = await Promise.all([
              isUserBlocked(contact.contact_id),
              isBlockedByUser(contact.contact_id)
            ]);
            
            blocked[contact.contact_id] = isBlocked;
            blockedBy[contact.contact_id] = isBlockedByResult;
          } catch (error) {
            console.error(`Error checking block status for ${contact.contact_id}:`, error);
          }
        })
      );
      
      setBlockedContacts(blocked);
      setBlockedByContacts(blockedBy);
    }
    
    if (contacts && contacts.length > 0) {
      checkBlockStatuses();
    }
  }, [contacts]);

  // Filter contacts based on search query
  const filteredContacts = contacts?.filter((contact: ContactType) => {
    const profile = contact.profile || {} as UserProfile;
    const displayName = profile.display_name || profile.username || "";
    const username = profile.username || "";
    
    return !searchQuery || 
      displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelectContact = async (contactId: string) => {
    // Check if contact is blocked or has blocked user
    if (blockedContacts[contactId]) {
      toast.warning(t("cantMessageBlockedContact", language));
      return;
    }
    
    if (blockedByContacts[contactId]) {
      toast.warning(t("blockedByContact", language));
      return;
    }
    
    setSelectedContactId(contactId);
    setIsCreatingConversation(true);
    
    try {
      // Create or get conversation with this contact
      const conversationId = await createConversation(contactId);
      onSelectContact(conversationId);
      onClose();
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error(t("errorCreatingConversation", language));
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
  };

  // Helper to render contact status indicator
  const renderContactStatus = (contactId: string) => {
    if (blockedContacts[contactId]) {
      return (
        <div className="flex items-center text-xs text-destructive ml-2">
          <Shield className="h-3 w-3 mr-1" />
          {t("blocked", language)}
        </div>
      );
    }
    
    if (blockedByContacts[contactId]) {
      return (
        <div className="flex items-center text-xs text-muted-foreground ml-2">
          <Shield className="h-3 w-3 mr-1" />
          {t("youAreBlocked", language)}
        </div>
      );
    }
    
    return null;
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
                <div className="text-center py-4 px-4 flex flex-col items-center">
                  <User className="h-16 w-16 opacity-20 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">{t("noContactsFound", language)}</p>
                  <p className="text-sm mt-1">{t("addContactsPrompt", language)}</p>
                  <p className="text-sm mt-1">{t("goToContactsPage", language)}</p>
                </div>
              ) : (
                filteredContacts.map((contact: ContactType) => {
                  const profile = contact.profile || {} as UserProfile;
                  const displayName = profile.display_name || profile.username || "Unknown User";
                  const isContactBlocked = blockedContacts[contact.contact_id];
                  const isBlockedByContact = blockedByContacts[contact.contact_id];
                  
                  return (
                    <Button
                      key={contact.contact_id}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => handleSelectContact(contact.contact_id)}
                      disabled={isCreatingConversation || 
                              selectedContactId === contact.contact_id || 
                              isContactBlocked || 
                              isBlockedByContact}
                    >
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarImage src={profile.avatar_url || ""} alt={displayName} />
                        <AvatarFallback>
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{displayName}</span>
                      {renderContactStatus(contact.contact_id)}
                      {isCreatingConversation && selectedContactId === contact.contact_id && (
                        <LoadingSpinner size="sm" className="ml-2" />
                      )}
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
