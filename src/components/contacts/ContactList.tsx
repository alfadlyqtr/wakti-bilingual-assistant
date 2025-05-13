import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { MessageSquare, Star, UserX } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Mock data for demonstration
const initialContacts = [
  { id: 1, username: "ahmed_ibrahim", name: "Ahmed Ibrahim", avatar: "", favorite: true },
  { id: 2, username: "sara_khalid", name: "Sara Khalid", avatar: "", favorite: false },
  { id: 3, username: "mohammed_ali", name: "Mohammed Ali", avatar: "", favorite: false },
];

export function ContactList() {
  const { toast } = useToast();
  const { language } = useTheme();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState(initialContacts);

  const handleMessage = (id: number, name: string) => {
    // In a real app, this would navigate to a chat with this contact
    navigate(`/messages/${id}`);
    toast({
      title: t("messageStarted", language),
      description: t("chattingWithUser", language, { username: name })
    });
  };

  const handleToggleFavorite = (id: number, isFavorite: boolean) => {
    setContacts(contacts.map(contact => 
      contact.id === id ? {...contact, favorite: !isFavorite} : contact
    ));
    
    toast({
      title: isFavorite ? t("removedFromFavorites", language) : t("addedToFavorites", language),
      description: ""
    });
  };

  const handleBlock = (id: number, name: string) => {
    setContacts(contacts.filter(contact => contact.id !== id));
    
    toast({
      title: t("contactBlocked", language),
      description: t("userBlockedDescription", language, { username: name })
    });
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-3">
      {contacts.map(contact => (
        <Card key={contact.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={contact.avatar} />
                  <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">@{contact.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => handleToggleFavorite(contact.id, contact.favorite)}
                >
                  <Star className={`h-4 w-4 ${contact.favorite ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => handleMessage(contact.id, contact.name)}
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => handleBlock(contact.id, contact.name)}
                >
                  <UserX className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
