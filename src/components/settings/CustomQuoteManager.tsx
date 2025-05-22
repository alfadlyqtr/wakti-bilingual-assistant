
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { getCustomQuotes, saveCustomQuotes } from '@/utils/quoteService';
import { toast } from 'sonner';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUserProfile } from '@/services/contactsService';
import { useQuery } from '@tanstack/react-query';

interface CustomQuoteManagerProps {
  onUpdate?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const CustomQuoteManager: React.FC<CustomQuoteManagerProps> = ({ onUpdate, open, onOpenChange }) => {
  const { language } = useTheme();
  const { user } = useAuth();
  const [customQuotes, setCustomQuotes] = useState<string[]>(getCustomQuotes() || []);
  const [newQuote, setNewQuote] = useState('');
  const [username, setUsername] = useState('');
  const MAX_QUOTES = 5;
  const MAX_CHARS = 30;

  // Get user profile to display the correct username
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: getCurrentUserProfile,
    enabled: !!user
  });

  // Set username when profile is loaded
  useEffect(() => {
    if (userProfile?.username) {
      setUsername(userProfile.username);
    } else if (user?.email) {
      // Fallback to email username if profile username is not available
      setUsername(user.email.split('@')[0]);
    }
  }, [userProfile, user]);

  const handleAddQuote = () => {
    if (!newQuote.trim()) {
      toast.error(language === 'ar' ? 'الرجاء إدخال اقتباس صالح' : 'Please enter a valid quote');
      return;
    }
    
    if (customQuotes.length >= MAX_QUOTES) {
      toast.error(
        language === 'ar' 
          ? `يمكنك إضافة ${MAX_QUOTES} اقتباسات كحد أقصى. الرجاء حذف بعض الاقتباسات أولاً.`
          : `You can add maximum ${MAX_QUOTES} quotes. Please delete some quotes first.`
      );
      return;
    }
    
    const formattedQuote = `${newQuote.trim()} - @${username}`;
    const updatedQuotes = [...customQuotes, formattedQuote];
    
    setCustomQuotes(updatedQuotes);
    saveCustomQuotes(updatedQuotes);
    setNewQuote('');
    
    if (onUpdate) onUpdate();
    
    toast.success(
      language === 'ar' 
        ? 'تمت إضافة الاقتباس بنجاح'
        : 'Quote added successfully'
    );
  };

  const handleRemoveQuote = (index: number) => {
    const updatedQuotes = customQuotes.filter((_, i) => i !== index);
    setCustomQuotes(updatedQuotes);
    saveCustomQuotes(updatedQuotes);
    
    if (onUpdate) onUpdate();
    
    toast.success(
      language === 'ar' 
        ? 'تمت إزالة الاقتباس بنجاح'
        : 'Quote removed successfully'
    );
  };

  // Standalone component content (for Settings page)
  const quoteManagerContent = (
    <Card className="p-4">
      <h3 className="font-medium text-lg mb-4">
        {language === 'ar' ? 'الاقتباسات المخصصة' : 'Custom Quotes'}
      </h3>
      
      <div className="space-y-4">
        <div>
          <Textarea
            placeholder={language === 'ar' ? 'اكتب الاقتباس الخاص بك هنا' : 'Type your quote here'}
            value={newQuote}
            onChange={(e) => setNewQuote(e.target.value)}
            className="mb-2"
            maxLength={MAX_CHARS}
          />
          <div className="text-xs text-muted-foreground text-right mb-2">
            {newQuote.length}/{MAX_CHARS}
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'سيتم إضافة اقتباسك باسم:' : 'Your quote will be added as:'}
            </p>
            <div className="text-sm bg-muted/30 p-2 rounded-md">
              @{username}
            </div>
          </div>
          
          <Button 
            onClick={handleAddQuote}
            disabled={!newQuote.trim() || customQuotes.length >= MAX_QUOTES}
            className="w-full"
          >
            {language === 'ar' ? 'إضافة اقتباس' : 'Add Quote'}
          </Button>
          
          <p className="text-xs text-muted-foreground mt-2">
            {language === 'ar' 
              ? `${customQuotes.length}/${MAX_QUOTES} اقتباسات مضافة`
              : `${customQuotes.length}/${MAX_QUOTES} quotes added`}
          </p>
        </div>
        
        {customQuotes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              {language === 'ar' ? 'الاقتباسات المخصصة الحالية' : 'Current Custom Quotes'}
            </h4>
            {customQuotes.map((quote, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-secondary/20 rounded-md">
                <p className="text-sm">{quote}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveQuote(index)}
                  className="h-8 w-8 p-0"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );

  // If used as a dialog, wrap in Dialog components
  if (typeof open !== 'undefined') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'إدارة الاقتباسات المخصصة' : 'Manage Custom Quotes'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? 'أضف ما يصل إلى 5 اقتباسات مخصصة لعرضها في الاقتباس اليومي الخاص بك'
                : 'Add up to 5 custom quotes to display in your daily quote widget'}
            </DialogDescription>
          </DialogHeader>
          {quoteManagerContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Return standalone component
  return quoteManagerContent;
};
