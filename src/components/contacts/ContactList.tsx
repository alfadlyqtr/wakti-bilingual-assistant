
import { useState } from "react";
import { MessageSquare, UserMinus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

// Mock data for demonstration
const initialContacts = [
  { id: 1, username: "abdullah_83", name: "Abdullah", avatar: "", lastActive: "2h ago" },
  { id: 2, username: "nora_travel", name: "Nora", avatar: "", lastActive: "1d ago" },
  { id: 3, username: "khalid_tech", name: "Khalid", avatar: "", lastActive: "3h ago" },
  { id: 4, username: "aisha_designs", name: "Aisha", avatar: "", lastActive: "Just now" },
  { id: 5, username: "omar_fitness", name: "Omar", avatar: "", lastActive: "5m ago" },
];

export function ContactList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contacts, setContacts] = useState(initialContacts);

  const handleMessage = (username: string) => {
    // In a real app, this would navigate to the message thread with this contact
    navigate(`/messages?contact=${username}`);
  };

  const handleRemove = (id: number) => {
    setContacts(contacts.filter(contact => contact.id !== id));
    toast({
      description: "Contact removed",
      duration: 3000,
    });
  };

  const handleBlock = (id: number, name: string) => {
    setContacts(contacts.filter(contact => contact.id !== id));
    toast({
      title: "Contact blocked",
      description: `${name} has been added to your blocked list`,
      duration: 3000,
    });
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase();
  };

  // Sort contacts alphabetically by name
  const sortedContacts = [...contacts].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      {sortedContacts.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          No contacts yet
        </Card>
      ) : (
        sortedContacts.map(contact => (
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
                    <p className="text-xs text-muted-foreground">{contact.lastActive}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleMessage(contact.username)}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleBlock(contact.id, contact.name)}
                    className="rounded-full h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleRemove(contact.id)}
                    className="rounded-full h-8 w-8 p-0 text-muted-foreground"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
