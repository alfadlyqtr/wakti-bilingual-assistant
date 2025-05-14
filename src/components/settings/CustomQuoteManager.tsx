
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { getCustomQuotes, saveCustomQuotes } from '@/utils/quoteService';
import { toast } from 'sonner';

interface CustomQuoteManagerProps {
  onUpdate?: () => void;
}

export const CustomQuoteManager: React.FC<CustomQuoteManagerProps> = ({ onUpdate }) => {
  const { language } = useTheme();
  const [customQuotes, setCustomQuotes] = useState<string[]>(getCustomQuotes() || []);
  const [newQuote, setNewQuote] = useState('');
  const [username, setUsername] = useState('');
  const MAX_QUOTES = 5;

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
    
    const formattedQuote = `${newQuote.trim()} - @${username.trim() || 'user'}`;
    const updatedQuotes = [...customQuotes, formattedQuote];
    
    setCustomQuotes(updatedQuotes);
    saveCustomQuotes(updatedQuotes);
    setNewQuote('');
    setUsername('');
    
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

  return (
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
          />
          <Input
            placeholder={language === 'ar' ? 'اسم المستخدم (اختياري)' : 'Username (optional)'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-2"
          />
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
};
