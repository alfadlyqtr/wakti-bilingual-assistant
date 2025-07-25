import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUserProfile } from '@/services/contactsService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Edit3, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CustomQuote {
  id: string;
  text: string;
  author?: string;
  category: string;
  created_at: string;
}

interface CustomQuoteManagerProps {
  onQuotesChange?: (quotes: CustomQuote[]) => void;
}

export function CustomQuoteManager({ onQuotesChange }: CustomQuoteManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<CustomQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuote, setNewQuote] = useState({ text: '', author: '', category: 'personal' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState({ text: '', author: '', category: 'personal' });

  useEffect(() => {
    if (user) {
      fetchCustomQuotes();
    }
  }, [user]);

  const fetchCustomQuotes = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const profile = await getCurrentUserProfile(user.id);
      const customQuotes = profile?.settings?.customQuotes || [];
      setQuotes(customQuotes);
      onQuotesChange?.(customQuotes);
    } catch (error) {
      console.error('Error fetching custom quotes:', error);
      toast({
        title: "Error",
        description: "Failed to load custom quotes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuote = async () => {
    if (!user || !newQuote.text.trim()) return;

    try {
      const quote: CustomQuote = {
        id: Date.now().toString(),
        text: newQuote.text.trim(),
        author: newQuote.author.trim() || undefined,
        category: newQuote.category,
        created_at: new Date().toISOString()
      };

      const updatedQuotes = [...quotes, quote];
      setQuotes(updatedQuotes);
      setNewQuote({ text: '', author: '', category: 'personal' });
      onQuotesChange?.(updatedQuotes);

      toast({
        title: "Success",
        description: "Quote added successfully"
      });
    } catch (error) {
      console.error('Error adding quote:', error);
      toast({
        title: "Error",
        description: "Failed to add quote",
        variant: "destructive"
      });
    }
  };

  const handleUpdateQuote = async (id: string) => {
    if (!editingQuote.text.trim()) return;

    try {
      const updatedQuotes = quotes.map(quote =>
        quote.id === id
          ? {
              ...quote,
              text: editingQuote.text.trim(),
              author: editingQuote.author.trim() || undefined,
              category: editingQuote.category
            }
          : quote
      );

      setQuotes(updatedQuotes);
      setEditingId(null);
      setEditingQuote({ text: '', author: '', category: 'personal' });
      onQuotesChange?.(updatedQuotes);

      toast({
        title: "Success",
        description: "Quote updated successfully"
      });
    } catch (error) {
      console.error('Error updating quote:', error);
      toast({
        title: "Error",
        description: "Failed to update quote",
        variant: "destructive"
      });
    }
  };

  const handleDeleteQuote = async (id: string) => {
    try {
      const updatedQuotes = quotes.filter(quote => quote.id !== id);
      setQuotes(updatedQuotes);
      onQuotesChange?.(updatedQuotes);

      toast({
        title: "Success",
        description: "Quote deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast({
        title: "Error",
        description: "Failed to delete quote",
        variant: "destructive"
      });
    }
  };

  const startEditing = (quote: CustomQuote) => {
    setEditingId(quote.id);
    setEditingQuote({
      text: quote.text,
      author: quote.author || '',
      category: quote.category
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingQuote({ text: '', author: '', category: 'personal' });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Custom Quotes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading quotes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Quotes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new quote form */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
          <Textarea
            placeholder="Enter your quote..."
            value={newQuote.text}
            onChange={(e) => setNewQuote({ ...newQuote, text: e.target.value })}
            className="min-h-[80px]"
          />
          <div className="flex gap-2">
            <Input
              placeholder="Author (optional)"
              value={newQuote.author}
              onChange={(e) => setNewQuote({ ...newQuote, author: e.target.value })}
              className="flex-1"
            />
            <select
              value={newQuote.category}
              onChange={(e) => setNewQuote({ ...newQuote, category: e.target.value })}
              className="px-3 py-2 border rounded-md"
            >
              <option value="personal">Personal</option>
              <option value="motivational">Motivational</option>
              <option value="wisdom">Wisdom</option>
              <option value="funny">Funny</option>
            </select>
          </div>
          <Button onClick={handleAddQuote} disabled={!newQuote.text.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Quote
          </Button>
        </div>

        {/* Quotes list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Your Quotes ({quotes.length})</h3>
          </div>
          
          {quotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No custom quotes yet. Add your first quote above!
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {quotes.map((quote) => (
                  <div key={quote.id} className="p-3 border rounded-lg">
                    {editingId === quote.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingQuote.text}
                          onChange={(e) => setEditingQuote({ ...editingQuote, text: e.target.value })}
                          className="min-h-[60px]"
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="Author (optional)"
                            value={editingQuote.author}
                            onChange={(e) => setEditingQuote({ ...editingQuote, author: e.target.value })}
                            className="flex-1"
                          />
                          <select
                            value={editingQuote.category}
                            onChange={(e) => setEditingQuote({ ...editingQuote, category: e.target.value })}
                            className="px-3 py-2 border rounded-md"
                          >
                            <option value="personal">Personal</option>
                            <option value="motivational">Motivational</option>
                            <option value="wisdom">Wisdom</option>
                            <option value="funny">Funny</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateQuote(quote.id)}
                            disabled={!editingQuote.text.trim()}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditing}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-2">
                          <p className="text-sm italic">"{quote.text}"</p>
                          {quote.author && (
                            <p className="text-xs text-muted-foreground mt-1">— {quote.author}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">
                            {quote.category}
                          </Badge>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditing(quote)}
                            >
                              <Edit3 className="h-3 w-3" />
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
                      </div>
                    )}
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
