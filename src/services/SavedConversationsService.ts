import { supabase } from '@/integrations/supabase/client';

export const MAX_CONVERSATIONS = 10;

export interface SavedConversationRow {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  message_count: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
  conversation_id?: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string;
  is_active: boolean;
  conversation_id: string | null;
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
  const msgs = Array.isArray(messages) ? messages : [];
  const userMsg = msgs.find((m: any) => m?.role === 'user');
  const first = userMsg || msgs.find(Boolean) || {};
  const text = typeof first?.content === 'string' ? first.content.trim() : '';
  const base = text.length > 0 ? text : 'Conversation';
  return base.length > 50 ? base.slice(0, 47) + '...' : base;
}

export const SavedConversationsService = {
  // Upsert the active conversation — creates or updates based on conversation_id
  async upsertActiveConversation(messages: any[], conversationId: string): Promise<string> {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error('Not authenticated');

    const normalized = normalizeMessages(messages);
    if (normalized.length === 0) return conversationId;

    const title = generateTitle(normalized);
    const lastMessageAt = normalized[normalized.length - 1]?.timestamp || new Date().toISOString();
    const now = new Date().toISOString();

    const db = supabase as any;

    // Find existing row for this conversation_id
    const { data: existing } = await db
      .from('ai_saved_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (existing?.id) {
      // Update existing
      await db
        .from('ai_saved_conversations')
        .update({
          title,
          messages: normalized,
          message_count: normalized.length,
          last_message_at: lastMessageAt,
          updated_at: now,
          is_active: true,
        })
        .eq('id', existing.id);
      return existing.id;
    }

    // Insert new — then prune if over limit
    const { data, error } = await db
      .from('ai_saved_conversations')
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        title,
        messages: normalized,
        message_count: normalized.length,
        last_message_at: lastMessageAt,
        updated_at: now,
        is_active: true,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Prune oldest beyond MAX_CONVERSATIONS
    await SavedConversationsService.pruneOldest(user.id);

    return data.id;
  },

  // Mark a conversation as no longer active (when starting new chat)
  async deactivateConversation(conversationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any)
      .from('ai_saved_conversations')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('conversation_id', conversationId);
  },

  // Prune oldest conversations beyond MAX_CONVERSATIONS
  async pruneOldest(userId: string): Promise<void> {
    try {
      const { data } = await supabase
        .from('ai_saved_conversations')
        .select('id')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: true });
      if (!data || data.length <= MAX_CONVERSATIONS) return;
      const toDelete = data.slice(0, data.length - MAX_CONVERSATIONS).map((r: any) => r.id);
      await supabase.from('ai_saved_conversations').delete().in('id', toDelete);
    } catch {}
  },

  // List all conversations for current user (active first, then recent)
  async listConversations(): Promise<ConversationListItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await (supabase as any)
      .from('ai_saved_conversations')
      .select('id, title, message_count, last_message_at, is_active, conversation_id')
      .eq('user_id', user.id)
      .order('is_active', { ascending: false })
      .order('last_message_at', { ascending: false })
      .limit(MAX_CONVERSATIONS);
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      message_count: r.message_count,
      last_message_at: r.last_message_at,
      is_active: r.is_active === true,
      conversation_id: r.conversation_id || null,
    }));
  },

  // Load full messages for a conversation
  async loadConversation(id: string): Promise<SavedConversationRow | null> {
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

  async deleteConversation(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('ai_saved_conversations')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  // Legacy compat wrappers
  async saveCurrentConversation(messages: any[], conversationId?: string | null): Promise<string> {
    const cid = conversationId || `frontend-conv-${Date.now()}`;
    return SavedConversationsService.upsertActiveConversation(messages, cid);
  },
  async listSavedConversations() { return SavedConversationsService.listConversations(); },
  async loadSavedConversation(id: string) { return SavedConversationsService.loadConversation(id); },
  async deleteSavedConversation(id: string) { return SavedConversationsService.deleteConversation(id); },
};
