
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Users, Info } from 'lucide-react';
import { getContacts } from '@/services/contactsService';

// Use the exact type that matches what getContacts() returns
interface ContactFromService {
  id: string;
  contact_id: string;
  profile: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  } | null;
}

interface ContactsSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContacts: string[];
  onContactsChange: (contacts: string[]) => void;
  previouslyInvitedContacts?: string[]; // List of contact IDs that were previously invited
  isEditMode?: boolean; // Whether this is for editing an existing event
}

export const ContactsSelector: React.FC<ContactsSelectorProps> = ({
  isOpen,
  onClose,
  selectedContacts,
  onContactsChange,
  previouslyInvitedContacts = [],
  isEditMode = false
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
      
      // Transform the data to match our expected structure
      // The getContacts() service returns data with 'profile' property that is an array
      const transformedContacts: ContactFromService[] = contactsData.map(contact => ({
        id: contact.id,
        contact_id: contact.contact_id,
        profile: Array.isArray(contact.profile) && contact.profile.length > 0 ? contact.profile[0] : null
      }));
      
      setContacts(transformedContacts);
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

  const isContactPreviouslyInvited = (contactId: string) => {
    return previouslyInvitedContacts.includes(contactId);
  };

  const isContactSelected = (contactId: string) => {
    return selectedContacts.includes(contactId);
  };

  const getCheckboxColor = (contactId: string) => {
    if (!isEditMode) {
      // For new events, all contacts use primary color
      return isContactSelected(contactId) ? 'text-primary' : 'text-muted-foreground';
    }
    
    // For edit mode, show different colors based on invitation status
    if (isContactPreviouslyInvited(contactId)) {
      return isContactSelected(contactId) ? 'text-muted-foreground' : 'text-muted-foreground';
    } else {
      return isContactSelected(contactId) ? 'text-primary' : 'text-muted-foreground';
    }
  };

  const newInviteCount = selectedContacts.filter(id => !previouslyInvitedContacts.includes(id)).length;
  const removedInviteCount = previouslyInvitedContacts.filter(id => !selectedContacts.includes(id)).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {isEditMode ? 'Edit Event Invitations' : 'Select Contacts to Invite'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 min-h-0">
          {/* Legend for edit mode */}
          {isEditMode && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Color Legend</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-primary rounded-sm bg-primary"></div>
                  <span>New invite</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-muted-foreground rounded-sm bg-muted-foreground"></div>
                  <span>Already invited</span>
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
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
                const isPreviouslyInvited = isContactPreviouslyInvited(contact.contact_id);
                const isSelected = isContactSelected(contact.contact_id);
                
                return (
                  <div 
                    key={contact.contact_id} 
                    className={`flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 ${
                      isPreviouslyInvited && isEditMode ? 'bg-muted/30' : ''
                    }`}
                  >
                    <Checkbox
                      id={contact.contact_id}
                      checked={isSelected}
                      onCheckedChange={() => handleContactToggle(contact.contact_id)}
                      className={`${
                        isPreviouslyInvited && isEditMode 
                          ? 'data-[state=checked]:bg-muted-foreground data-[state=checked]:border-muted-foreground' 
                          : 'data-[state=checked]:bg-primary data-[state=checked]:border-primary'
                      }`}
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
                      <Label htmlFor={contact.contact_id} className="cursor-pointer flex-1">
                        <div className="font-medium">{displayName}</div>
                        {username && (
                          <div className="text-xs text-gray-500">@{username}</div>
                        )}
                        {isPreviouslyInvited && isEditMode && (
                          <div className="text-xs text-muted-foreground">Previously invited</div>
                        )}
                      </Label>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>
                {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
              </span>
              {isEditMode && (
                <div className="space-x-2">
                  {newInviteCount > 0 && (
                    <span className="text-primary">+{newInviteCount} new</span>
                  )}
                  {removedInviteCount > 0 && (
                    <span className="text-destructive">-{removedInviteCount} removed</span>
                  )}
                </div>
              )}
            </div>
            <Button onClick={onClose} className="w-full">Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
