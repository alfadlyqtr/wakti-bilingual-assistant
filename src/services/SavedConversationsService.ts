import { supabase } from '@/integrations/supabase/client';

export interface SavedConversationRow {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  message_count: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

function normalizeMessages(messages: any[]): any[] {
  const safe = Array.isArray(messages) ? messages.filter(Boolean) : [];
  return safe.slice(-50).map((m: any) => ({
    id: m?.id,
    role: m?.role || 'assistant',
    content: typeof m?.content === 'string' ? m.content : '',
    timestamp: typeof m?.timestamp === 'string' ? m.timestamp : (m?.timestamp instanceof Date ? m.timestamp.toISOString() : new Date().toISOString()),
    intent: m?.intent,
    imageUrl: typeof m?.imageUrl === 'string' ? m.imageUrl : undefined,
    browsingUsed: m?.browsingUsed === true ? true : undefined,
  }));
}

function generateTitle(messages: any[]): string {
  const first = (Array.isArray(messages) ? messages : []).find(Boolean) || {};
  const text = typeof first?.content === 'string' ? first.content.trim() : '';
  const base = text.length > 0 ? text : 'Conversation';
  return base.length > 50 ? base.slice(0, 47) + '...' : base;
}

export const SavedConversationsService = {
  async saveCurrentConversation(messages: any[], conversationId?: string | null): Promise<string> {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error('Not authenticated');

    const normalized = normalizeMessages(messages);
    if (normalized.length === 0) throw new Error('Nothing to save');

    const title = generateTitle(normalized);
    const lastMessageAt = normalized[normalized.length - 1]?.timestamp || new Date().toISOString();

    const { data, error } = await supabase
      .from('ai_saved_conversations')
      .insert({
        user_id: user.id,
        title,
        messages: normalized,
        message_count: normalized.length,
        last_message_at: lastMessageAt,
        // Optional: source_conversation_id could be added in schema later
      })
      .select('*')
      .single();

    if (error) throw error;
    return (data as SavedConversationRow).id;
  },

  async listSavedConversations(): Promise<Pick<SavedConversationRow, 'id' | 'title' | 'message_count' | 'last_message_at'>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('ai_saved_conversations')
      .select('id,title,message_count,last_message_at')
      .order('last_message_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data || []) as any;
  },

  async loadSavedConversation(id: string): Promise<SavedConversationRow | null> {
    const { data, error } = await supabase
      .from('ai_saved_conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as SavedConversationRow) || null;
  },

  async updateTitle(id: string, title: string): Promise<boolean> {
    const { error } = await supabase
      .from('ai_saved_conversations')
      .update({ title })
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  async deleteSavedConversation(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('ai_saved_conversations')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
