
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Users } from 'lucide-react';
import { getContacts } from '@/services/contactsService';

// Use the proper contact type that matches what getContacts() returns
interface ContactFromService {
  id: string;
  contact_id: string;
  profile?: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
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
  const [contacts, setContacts] = useState<ContactFromService[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchContacts();
    }
  }, [isOpen]);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching contacts for selector...');
      
      // Use the same service as the Contacts page
      const contactsData = await getContacts();
      console.log('Contacts fetched:', contactsData);
      
      setContacts(contactsData || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const profile = contact.profile;
    if (!profile) return false;
    
    const displayName = profile.display_name || '';
    const username = profile.username || '';
    
    return displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           username.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleContactToggle = (contactId: string) => {
    const newSelection = selectedContacts.includes(contactId)
      ? selectedContacts.filter(id => id !== contactId)
      : [...selectedContacts, contactId];
    
    onContactsChange(newSelection);
  };

  const getContactDisplayName = (contact: ContactFromService) => {
    return contact.profile?.display_name || contact.profile?.username || 'Unknown';
  };

  const getContactUsername = (contact: ContactFromService) => {
    return contact.profile?.username || '';
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
                {searchTerm ? 'No contacts found' : contacts.length === 0 ? 'No contacts available' : 'No matching contacts'}
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const displayName = getContactDisplayName(contact);
                const username = getContactUsername(contact);
                
                return (
                  <div key={contact.contact_id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50">
                    <Checkbox
                      id={contact.contact_id}
                      checked={selectedContacts.includes(contact.contact_id)}
                      onCheckedChange={() => handleContactToggle(contact.contact_id)}
                    />
                    <div className="flex items-center space-x-2 flex-1">
                      {contact.profile?.avatar_url ? (
                        <img
                          src={contact.profile.avatar_url}
                          alt={displayName}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <Label htmlFor={contact.contact_id} className="cursor-pointer">
                        <div className="font-medium">{displayName}</div>
                        {username && (
                          <div className="text-xs text-gray-500">@{username}</div>
                        )}
                      </Label>
                    </div>
                  </div>
                );
              })
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
