
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Quote, Plus, Trash2, Edit2 } from 'lucide-react';

interface CustomQuote {
  id: string;
  text: string;
  category: string;
  created_at: string;
}

export function CustomQuoteManager() {
  const { user } = useAuth();
  const { language } = useTheme();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<CustomQuote[]>([]);
  const [newQuote, setNewQuote] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editingQuote, setEditingQuote] = useState<CustomQuote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCustomQuotes();
    }
  }, [user]);

  const fetchCustomQuotes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('custom_quotes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Error fetching custom quotes:', error);
      toast({
        title: t('error', language),
        description: t('errorLoadingQuotes', language),
        variant: 'destructive'
      });
    }
  };

  const handleAddQuote = async () => {
    if (!user || !newQuote.trim()) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('custom_quotes')
        .insert({
          user_id: user.id,
          text: newQuote.trim(),
          category: newCategory.trim() || 'general'
        });

      if (error) throw error;

      toast({
        title: t('success', language),
        description: t('quoteAdded', language)
      });

      setNewQuote('');
      setNewCategory('');
      fetchCustomQuotes();
    } catch (error) {
      console.error('Error adding quote:', error);
      toast({
        title: t('error', language),
        description: t('errorAddingQuote', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('custom_quotes')
        .delete()
        .eq('id', quoteId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('success', language),
        description: t('quoteDeleted', language)
      });

      fetchCustomQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: t('error', language),
        description: t('errorDeletingQuote', language),
        variant: 'destructive'
      });
    }
  };

  const handleUpdateQuote = async () => {
    if (!user || !editingQuote) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('custom_quotes')
        .update({
          text: editingQuote.text,
          category: editingQuote.category
        })
        .eq('id', editingQuote.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('success', language),
        description: t('quoteUpdated', language)
      });

      setEditingQuote(null);
      fetchCustomQuotes();
    } catch (error) {
      console.error('Error updating quote:', error);
      toast({
        title: t('error', language),
        description: t('errorUpdatingQuote', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Quote className="h-5 w-5" />
          {t('customQuotes', language)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-quote">{t('addNewQuote', language)}</Label>
          <Input
            id="new-quote"
            value={newQuote}
            onChange={(e) => setNewQuote(e.target.value)}
            placeholder={t('enterQuoteText', language)}
          />
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder={t('category', language)}
              className="flex-1"
            />
            <Button
              onClick={handleAddQuote}
              disabled={!newQuote.trim() || loading}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('add', language)}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('yourQuotes', language)} ({quotes.length})</Label>
          {quotes.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('noCustomQuotes', language)}
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {quotes.map((quote) => (
                <div key={quote.id} className="p-3 border rounded-lg">
                  {editingQuote?.id === quote.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editingQuote.text}
                        onChange={(e) => setEditingQuote({ ...editingQuote, text: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Input
                          value={editingQuote.category}
                          onChange={(e) => setEditingQuote({ ...editingQuote, category: e.target.value })}
                          placeholder={t('category', language)}
                          className="flex-1"
                        />
                        <Button size="sm" onClick={handleUpdateQuote} disabled={loading}>
                          {t('save', language)}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingQuote(null)}>
                          {t('cancel', language)}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm">{quote.text}</p>
                        <Badge variant="outline" className="mt-1">
                          {quote.category}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingQuote(quote)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteQuote(quote.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
