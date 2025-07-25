
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function CustomQuoteManager() {
  const { user } = useAuth();
  const { language } = useTheme();
  const [quotes, setQuotes] = useState([]);
  const [newQuote, setNewQuote] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [loading, setLoading] = useState(false);

  const loadQuotes = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .single();

      const customQuotes = profile?.settings?.customQuotes || [];
      setQuotes(customQuotes);
    } catch (error) {
      console.error('Error loading quotes:', error);
      toast.error(t('errorLoadingQuotes', language));
    }
  };

  useEffect(() => {
    loadQuotes();
  }, [user]);

  const addQuote = async () => {
    if (!newQuote.trim() || !user) return;
    
    try {
      setLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .single();

      const currentSettings = profile?.settings || {};
      const currentQuotes = currentSettings.customQuotes || [];
      const updatedQuotes = [...currentQuotes, { id: Date.now(), text: newQuote.trim() }];

      await supabase
        .from('profiles')
        .update({ 
          settings: { 
            ...currentSettings, 
            customQuotes: updatedQuotes 
          } 
        })
        .eq('id', user.id);

      setQuotes(updatedQuotes);
      setNewQuote('');
      
      toast.success(t('quoteAdded', language));
    } catch (error) {
      console.error('Error adding quote:', error);
      toast.error(t('errorAddingQuote', language));
    } finally {
      setLoading(false);
    }
  };

  const deleteQuote = async (id) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .single();

      const currentSettings = profile?.settings || {};
      const currentQuotes = currentSettings.customQuotes || [];
      const updatedQuotes = currentQuotes.filter(quote => quote.id !== id);

      await supabase
        .from('profiles')
        .update({ 
          settings: { 
            ...currentSettings, 
            customQuotes: updatedQuotes 
          } 
        })
        .eq('id', user.id);

      setQuotes(updatedQuotes);
      
      toast.success(t('quoteDeleted', language));
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast.error(t('errorDeletingQuote', language));
    } finally {
      setLoading(false);
    }
  };

  const updateQuote = async (id, newText) => {
    if (!newText.trim() || !user) return;
    
    try {
      setLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .single();

      const currentSettings = profile?.settings || {};
      const currentQuotes = currentSettings.customQuotes || [];
      const updatedQuotes = currentQuotes.map(quote => 
        quote.id === id ? { ...quote, text: newText.trim() } : quote
      );

      await supabase
        .from('profiles')
        .update({ 
          settings: { 
            ...currentSettings, 
            customQuotes: updatedQuotes 
          } 
        })
        .eq('id', user.id);

      setQuotes(updatedQuotes);
      setEditingId(null);
      setEditingText('');
      
      toast.success(t('quoteUpdated', language));
    } catch (error) {
      console.error('Error updating quote:', error);
      toast.error(t('errorUpdatingQuote', language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('customQuotes', language)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={t('addNewQuote', language)}
            value={newQuote}
            onChange={(e) => setNewQuote(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addQuote()}
          />
          <Button onClick={addQuote} disabled={!newQuote.trim() || loading}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {quotes.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">{t('yourQuotes', language)}</h4>
            {quotes.map((quote) => (
              <div key={quote.id} className="flex items-center gap-2 p-2 border rounded">
                {editingId === quote.id ? (
                  <>
                    <Input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          updateQuote(quote.id, editingText);
                        }
                      }}
                    />
                    <Button 
                      size="sm" 
                      onClick={() => updateQuote(quote.id, editingText)}
                      disabled={loading}
                    >
                      {t('save', language)}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setEditingText('');
                      }}
                    >
                      {t('cancel', language)}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1">{quote.text}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(quote.id);
                        setEditingText(quote.text);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteQuote(quote.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {quotes.length === 0 && (
          <p className="text-muted-foreground text-center py-4">
            {t('noCustomQuotes', language)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
