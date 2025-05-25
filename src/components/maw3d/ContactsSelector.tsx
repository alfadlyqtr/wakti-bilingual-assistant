
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Contact {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
}

interface ContactsSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContacts: string[];
  onContactsChange: (contacts: string[]) => void;
}

export const ContactsSelector: React.FC<ContactsSelectorProps> = ({
  isOpen,
  onClose,
  selectedContacts,
  onContactsChange
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
    }
  }, [isOpen]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          contact_id,
          profiles!contacts_contact_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('status', 'approved');

      if (error) throw error;

      const contactsData: Contact[] = data?.map(item => ({
        id: item.profiles?.id || '',
        username: item.profiles?.username || '',
        display_name: item.profiles?.display_name || '',
        avatar_url: item.profiles?.avatar_url
      })).filter(contact => contact.id) || [];

      setContacts(contactsData);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleContactToggle = (contactId: string) => {
    const newSelection = selectedContacts.includes(contactId)
      ? selectedContacts.filter(id => id !== contactId)
      : [...selectedContacts, contactId];
    
    onContactsChange(newSelection);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Select Contacts to Invite
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="text-center py-4 text-gray-500">Loading contacts...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                {searchTerm ? 'No contacts found' : 'No contacts available'}
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div key={contact.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50">
                  <Checkbox
                    id={contact.id}
                    checked={selectedContacts.includes(contact.id)}
                    onCheckedChange={() => handleContactToggle(contact.id)}
                  />
                  <div className="flex items-center space-x-2 flex-1">
                    {contact.avatar_url ? (
                      <img
                        src={contact.avatar_url}
                        alt={contact.display_name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {contact.display_name?.charAt(0) || contact.username?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                    <Label htmlFor={contact.id} className="cursor-pointer">
                      <div className="font-medium">{contact.display_name || contact.username}</div>
                      {contact.display_name && contact.username && (
                        <div className="text-xs text-gray-500">@{contact.username}</div>
                      )}
                    </Label>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between">
            <span className="text-sm text-gray-500">
              {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
            </span>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
