import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getContacts } from '@/services/contactsService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search, Users, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Contact {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

interface ContactsSelectorProps {
  selectedContacts: string[];
  onContactsChange: (contacts: string[]) => void;
  maxContacts?: number;
  title?: string;
}

export function ContactsSelector({
  selectedContacts,
  onContactsChange,
  maxContacts = 50,
  title = "Select Contacts"
}: ContactsSelectorProps) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const contactsData = await getContacts(user.id);
      setContacts(contactsData);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleContactToggle = (contactId: string) => {
    const isSelected = selectedContacts.includes(contactId);
    
    if (isSelected) {
      onContactsChange(selectedContacts.filter(id => id !== contactId));
    } else {
      if (selectedContacts.length < maxContacts) {
        onContactsChange([...selectedContacts, contactId]);
      }
    }
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      onContactsChange([]);
    } else {
      const allIds = filteredContacts.slice(0, maxContacts).map(c => c.id);
      onContactsChange(allIds);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading contacts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title}
        </CardTitle>
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            {selectedContacts.length} / {maxContacts} selected
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={filteredContacts.length === 0}
          >
            {selectedContacts.length === filteredContacts.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No contacts match your search' : 'No contacts available'}
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedContacts.includes(contact.id)
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleContactToggle(contact.id)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={contact.avatar_url} />
                      <AvatarFallback>
                        {contact.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{contact.display_name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        @{contact.username}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {selectedContacts.includes(contact.id) ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <div className="h-4 w-4 border border-muted-foreground rounded" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
