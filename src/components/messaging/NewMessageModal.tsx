
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, X } from "lucide-react";

// Mock contacts data - would be replaced with API calls
const mockContacts = [
  {
    id: "1",
    name: "Sarah Johnson",
    avatarUrl: "",
  },
  {
    id: "2",
    name: "Mohammed Al-Farsi",
    avatarUrl: "",
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    avatarUrl: "",
  },
  {
    id: "4",
    name: "Ahmad Khalid",
    avatarUrl: "",
  },
  {
    id: "5",
    name: "Michael Chen",
    avatarUrl: "",
  },
  {
    id: "6",
    name: "Fatima Al-Zahra",
    avatarUrl: "",
  },
];

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contactId: string) => void;
}

export function NewMessageModal({ isOpen, onClose, onSelectContact }: NewMessageModalProps) {
  const { language } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState(mockContacts);

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="space-y-1">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>{t("noContactsFound", language)}</p>
              </div>
            ) : (
              filteredContacts.map(contact => (
                <Button
                  key={contact.id}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => onSelectContact(contact.id)}
                >
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                    <AvatarFallback>
                      {contact.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  {contact.name}
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
