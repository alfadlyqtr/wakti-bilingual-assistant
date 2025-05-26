
import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Task, useTaskReminder } from '@/contexts/TaskReminderContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { supabase } from '@/integrations/supabase/client';

interface ShareTaskDialogProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
}

const ShareTaskDialog: React.FC<ShareTaskDialogProps> = ({ 
  task, isOpen, onClose 
}) => {
  const { language } = useTheme();
  const { shareTask } = useTaskReminder();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sharedUsers, setSharedUsers] = useState<string[]>([]);

  useEffect(() => {
    const fetchContacts = async () => {
      setLoading(true);
      try {
        const mockContacts = [
          { id: '1', name: 'John Doe', email: 'john@example.com' },
          { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
          { id: '3', name: 'Bob Johnson', email: 'bob@example.com' },
        ];
        setContacts(mockContacts);
        
        if (task) {
          const { data } = await supabase
            .from('task_shares')
            .select('shared_with')
            .eq('task_id', task.id);
            
          if (data) {
            setSharedUsers(data.map(item => item.shared_with));
          }
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && task) {
      fetchContacts();
    }
  }, [isOpen, task]);

  const handleShare = async () => {
    if (!task || !selectedContact) return;
    
    setLoading(true);
    try {
      const success = await shareTask(task.id, selectedContact);
      if (success) {
        setSelectedContact('');
        setSharedUsers([...sharedUsers, selectedContact]);
      }
    } catch (error) {
      console.error('Error sharing task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('shareWith', language)}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Select
            value={selectedContact}
            onValueChange={setSelectedContact}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectContact', language)} />
            </SelectTrigger>
            <SelectContent>
              {contacts
                .filter(contact => !sharedUsers.includes(contact.id))
                .map(contact => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.name} {contact.email ? `(${contact.email})` : ''}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          
          {sharedUsers.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">{t('shareWith', language)}:</h4>
              <ul className="space-y-2">
                {sharedUsers.map(userId => {
                  const contact = contacts.find(c => c.id === userId);
                  return (
                    <li key={userId} className="text-sm flex items-center justify-between bg-muted/50 p-2 rounded-md">
                      <span>{contact?.name || userId}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
          >
            {t('cancel', language)}
          </Button>
          <Button 
            onClick={handleShare}
            disabled={!selectedContact || loading}
          >
            {t('share', language)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareTaskDialog;
