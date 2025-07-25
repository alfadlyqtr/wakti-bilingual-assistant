
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Star, StarOff, MoreVertical, MessageCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  getContacts, 
  deleteContact, 
  blockContact, 
  toggleContactFavorite 
} from "@/services/contactsService";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/utils/translations";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ContactRelationshipIndicator } from "./ContactRelationshipIndicator";
import { ChatPopup } from "./ChatPopup";
import { toast } from "sonner";

interface ContactListProps {
  onContactClick?: (contactId: string) => void;
}

export function ContactList({ onContactClick }: ContactListProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [showChat, setShowChat] = useState(false);

  const fetchContacts = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const contactsData = await getContacts(user.id);
      setContacts(contactsData);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error(t("contacts.errorLoadingContacts"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [user?.id]);

  const handleDeleteContact = async (contactId: string) => {
    try {
      await deleteContact(contactId);
      toast.success(t("contacts.contactDeleted"));
      fetchContacts();
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error(t("contacts.errorDeletingContact"));
    }
  };

  const handleBlockContact = async (contactId: string) => {
    if (!user?.id) return;

    try {
      await blockContact(contactId, user.id);
      toast.success(t("contacts.contactBlocked"));
      fetchContacts();
    } catch (error) {
      console.error("Error blocking contact:", error);
      toast.error(t("contacts.errorBlockingContact"));
    }
  };

  const handleToggleFavorite = async (contactId: string, isFavorite: boolean) => {
    try {
      await toggleContactFavorite(contactId, !isFavorite);
      toast.success(isFavorite ? t("contacts.removedFromFavorites") : t("contacts.addedToFavorites"));
      fetchContacts();
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const handleChatClick = (contact: any) => {
    setSelectedContact(contact);
    setShowChat(true);
  };

  const filteredContacts = contacts.filter((contact: any) =>
    contact.profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.profile?.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const favoriteContacts = filteredContacts.filter((contact: any) => contact.is_favorite);
  const regularContacts = filteredContacts.filter((contact: any) => !contact.is_favorite);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("contacts.searchContacts")}
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Contacts List */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">{t("contacts.noContacts")}</p>
          <p className="text-sm text-muted-foreground mt-2">{t("contacts.searchToAddContacts")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Favorite Contacts */}
          {favoriteContacts.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                المفضلة
              </h3>
              <div className="space-y-2">
                {favoriteContacts.map((contact: any) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onDelete={handleDeleteContact}
                    onBlock={handleBlockContact}
                    onToggleFavorite={handleToggleFavorite}
                    onChatClick={handleChatClick}
                    onContactClick={onContactClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Contacts */}
          {regularContacts.length > 0 && (
            <div>
              {favoriteContacts.length > 0 && (
                <h3 className="font-semibold mb-3 mt-6">جهات الاتصال</h3>
              )}
              <div className="space-y-2">
                {regularContacts.map((contact: any) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onDelete={handleDeleteContact}
                    onBlock={handleBlockContact}
                    onToggleFavorite={handleToggleFavorite}
                    onChatClick={handleChatClick}
                    onContactClick={onContactClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Popup */}
      {showChat && selectedContact && (
        <ChatPopup
          contact={selectedContact}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}

function ContactCard({ contact, onDelete, onBlock, onToggleFavorite, onChatClick, onContactClick }: any) {
  const { t } = useTranslation();
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center space-x-3 cursor-pointer flex-1"
            onClick={() => onContactClick?.(contact.contact_id)}
          >
            <Avatar className="h-12 w-12">
              <AvatarImage src={contact.profile?.avatar_url} alt={contact.profile?.display_name} />
              <AvatarFallback>
                {contact.profile?.display_name?.charAt(0)?.toUpperCase() || contact.profile?.username?.charAt(0)?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">
                  {contact.profile?.display_name || contact.profile?.username || "Unknown User"}
                </h3>
                <ContactRelationshipIndicator status={contact.relationshipStatus} />
              </div>
              <p className="text-xs text-muted-foreground">@{contact.profile?.username || "unknown"}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Chat Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onChatClick(contact);
              }}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>

            {/* Favorite Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(contact.id, contact.is_favorite);
              }}
            >
              {contact.is_favorite ? (
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </Button>

            {/* Options Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onBlock(contact.contact_id)}>
                  {t("contacts.blockUser")}
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      {t("contacts.deleteContact")}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("contacts.deleteContact")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("contacts.deleteContactConfirmation")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(contact.id)}>
                        {t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
