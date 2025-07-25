import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { contactsService } from '@/services/contactsService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CustomQuote {
  id: string;
  text: string;
  author: string;
  category: string;
  created_at: string;
}

export function CustomQuoteManager() {
  const { user } = useAuth();
  const [customQuotes, setCustomQuotes] = useState<CustomQuote[]>([]);
  const [newQuote, setNewQuote] = useState({ text: '', author: '', category: 'personal' });
  const [editingQuote, setEditingQuote] = useState<CustomQuote | null>(null);
  const [loading, setLoading] = useState(false);

  // Fix the React Query usage
  const { data: profileData } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('No user ID');
      return await contactsService.getProfile(user.id);
    },
    enabled: !!user?.id,
  });

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
      setCustomQuotes(data || []);
    } catch (error) {
      console.error('Error fetching custom quotes:', error);
      toast.error('Failed to load custom quotes');
    }
  };

  const handleAddQuote = async () => {
    if (!user || !newQuote.text.trim()) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('custom_quotes')
        .insert({
          user_id: user.id,
          text: newQuote.text.trim(),
          author: newQuote.author.trim() || 'Unknown',
          category: newQuote.category
        });

      if (error) throw error;

      setNewQuote({ text: '', author: '', category: 'personal' });
      fetchCustomQuotes();
      toast.success('Quote added successfully');
    } catch (error) {
      console.error('Error adding quote:', error);
      toast.error('Failed to add quote');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuote = async (quote: CustomQuote) => {
    if (!user) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('custom_quotes')
        .update({
          text: quote.text.trim(),
          author: quote.author.trim() || 'Unknown',
          category: quote.category
        })
        .eq('id', quote.id);

      if (error) throw error;

      setEditingQuote(null);
      fetchCustomQuotes();
      toast.success('Quote updated successfully');
    } catch (error) {
      console.error('Error updating quote:', error);
      toast.error('Failed to update quote');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('custom_quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;

      fetchCustomQuotes();
      toast.success('Quote deleted successfully');
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast.error('Failed to delete quote');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Quote */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Custom Quote
          </CardTitle>
          <CardDescription>
            Create your own inspirational quotes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your quote..."
              value={newQuote.text}
              onChange={(e) => setNewQuote(prev => ({ ...prev, text: e.target.value }))}
              className="min-h-[100px]"
            />
            <div className="flex gap-4">
              <Input
                placeholder="Author (optional)"
                value={newQuote.author}
                onChange={(e) => setNewQuote(prev => ({ ...prev, author: e.target.value }))}
                className="flex-1"
              />
              <select
                value={newQuote.category}
                onChange={(e) => setNewQuote(prev => ({ ...prev, category: e.target.value }))}
                className="px-3 py-2 border rounded-md"
              >
                <option value="personal">Personal</option>
                <option value="motivational">Motivational</option>
                <option value="inspirational">Inspirational</option>
                <option value="wisdom">Wisdom</option>
              </select>
            </div>
            <Button
              onClick={handleAddQuote}
              disabled={!newQuote.text.trim() || loading}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Quote
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Quotes */}
      <Card>
        <CardHeader>
          <CardTitle>Your Custom Quotes</CardTitle>
          <CardDescription>
            {customQuotes.length} custom quotes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customQuotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No custom quotes yet. Add one above!
            </div>
          ) : (
            <div className="space-y-4">
              {customQuotes.map((quote) => (
                <div key={quote.id} className="p-4 border rounded-lg">
                  {editingQuote?.id === quote.id ? (
                    <div className="space-y-4">
                      <Textarea
                        value={editingQuote.text}
                        onChange={(e) => setEditingQuote(prev => prev ? ({ ...prev, text: e.target.value }) : null)}
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-4">
                        <Input
                          value={editingQuote.author}
                          onChange={(e) => setEditingQuote(prev => prev ? ({ ...prev, author: e.target.value }) : null)}
                          placeholder="Author"
                          className="flex-1"
                        />
                        <select
                          value={editingQuote.category}
                          onChange={(e) => setEditingQuote(prev => prev ? ({ ...prev, category: e.target.value }) : null)}
                          className="px-3 py-2 border rounded-md"
                        >
                          <option value="personal">Personal</option>
                          <option value="motivational">Motivational</option>
                          <option value="inspirational">Inspirational</option>
                          <option value="wisdom">Wisdom</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleUpdateQuote(editingQuote)}
                          disabled={loading}
                          size="sm"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setEditingQuote(null)}
                          size="sm"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <blockquote className="text-lg font-medium">
                        "{quote.text}"
                      </blockquote>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            — {quote.author}
                          </span>
                          <Badge variant="secondary">{quote.category}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingQuote(quote)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteQuote(quote.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
