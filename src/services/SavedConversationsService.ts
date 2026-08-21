import { supabase } from '@/integrations/supabase/client';
import { smartConversationTitle } from '@/utils/conversationTopics';

export const MAX_CONVERSATIONS = 15;

const CONVERSATION_LIMIT_ERROR_CODE = 'CONVERSATION_LIMIT_REACHED';

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
  is_saved?: boolean;
  is_custom_title?: boolean;
}

export interface ConversationListItem {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string;
  is_active: boolean;
  conversation_id: string | null;
  is_saved: boolean;
  is_custom_title: boolean;
}

export interface ConversationRetentionStatus {
  limit: number;
  total: number;
  saved: number;
  deletable: number;
  available: number;
  canCreate: boolean;
}

export interface ConversationMetaUpdate {
  title?: string;
  is_saved?: boolean;
}

export function normalizeConversationTitle(value: unknown, fallback = 'Conversation'): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const words = text.split(/\s+/).filter(Boolean).slice(0, 2);
  if (words.length === 0) return fallback;
  return words.join(' ');
}

function buildLimitError() {
  const error = new Error(CONVERSATION_LIMIT_ERROR_CODE) as Error & { code?: string };
  error.code = CONVERSATION_LIMIT_ERROR_CODE;
  return error;
}

function normalizeMessages(messages: any[]): any[] {
  const safe = Array.isArray(messages) ? messages.filter(Boolean) : [];
  return safe.slice(-50).map((m: any) => {
    const base: any = {
      id: m?.id,
      role: m?.role || 'assistant',
      content: typeof m?.content === 'string' ? m.content : '',
      timestamp: typeof m?.timestamp === 'string' ? m.timestamp : (m?.timestamp instanceof Date ? m.timestamp.toISOString() : new Date().toISOString()),
      intent: m?.intent,
      imageUrl: typeof m?.imageUrl === 'string' ? m.imageUrl : undefined,
      browsingUsed: m?.browsingUsed === true ? true : undefined,
    };
    // Preserve UI-critical metadata so cards, vision results, tool calls and timing
    // survive save/reload. Size-guarded to avoid bloating saved_conversations rows.
    const src = m?.metadata || {};
    const kept: any = {};
    if (src.searchConfirmation) kept.searchConfirmation = src.searchConfirmation;
    if (src.reminderScheduled)  kept.reminderScheduled  = src.reminderScheduled;
    if (src.visionJson)         kept.visionJson         = src.visionJson;
    if (Array.isArray(src.toolCalls)) kept.toolCalls = src.toolCalls;
    if (typeof src.toolsUsed === 'number') kept.toolsUsed = src.toolsUsed;
    if (typeof src.thinkingDuration === 'number') kept.thinkingDuration = src.thinkingDuration;
    if (src.browsingUsed === true) kept.browsingUsed = true;
    if (src.browsingData) kept.browsingData = src.browsingData;
    if (Object.keys(kept).length > 0) {
      base.metadata = kept;
    }
    return base;
  });
}

function generateTitle(messages: any[]): string {
  const msgs = Array.isArray(messages) ? messages : [];
  const userMsg = msgs.find((m: any) => m?.role === 'user');
  const first = userMsg || msgs.find(Boolean) || {};
  const text = typeof first?.content === 'string' ? first.content.trim() : '';
  return smartConversationTitle(text, 'Conversation');
}

export const SavedConversationsService = {
  isConversationLimitError(error: unknown): boolean {
    return (error as { code?: string; message?: string } | null)?.code === CONVERSATION_LIMIT_ERROR_CODE
      || (error as { message?: string } | null)?.message === CONVERSATION_LIMIT_ERROR_CODE;
  },

  async getRetentionStatus(): Promise<ConversationRetentionStatus> {
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user;
    if (error || !user) throw new Error('Not authenticated');
    return SavedConversationsService.getRetentionStatusForUser(user.id);
  },

  async getRetentionStatusForUser(userId: string): Promise<ConversationRetentionStatus> {
    const { data, error } = await supabase
      .from('ai_saved_conversations')
      .select('id, is_saved')
      .eq('user_id', userId);

    if (error) throw error;

    const total = Array.isArray(data) ? data.length : 0;
    const saved = (data || []).filter((row: any) => row.is_saved === true).length;
    const deletable = Math.max(0, total - saved);
    const available = Math.max(0, MAX_CONVERSATIONS - total);

    return {
      limit: MAX_CONVERSATIONS,
      total,
      saved,
      deletable,
      available,
      canCreate: total < MAX_CONVERSATIONS || deletable > 0,
    };
  },

  async upsertActiveConversation(messages: any[], conversationId: string): Promise<string> {
    const { data: { session }, error: userErr } = await supabase.auth.getSession();
    const user = session?.user;
    if (userErr || !user) throw new Error('Not authenticated');

    const normalized = normalizeMessages(messages);
    if (normalized.length === 0) return conversationId;

    const title = generateTitle(normalized);
    const lastMessageAt = normalized[normalized.length - 1]?.timestamp || new Date().toISOString();
    const now = new Date().toISOString();

    const db = supabase as any;
    const { data: existing } = await db
      .from('ai_saved_conversations')
      .select('id, title, is_saved, is_custom_title')
      .eq('user_id', user.id)
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (!existing) {
      const status = await SavedConversationsService.getRetentionStatusForUser(user.id);
      if (status.total >= MAX_CONVERSATIONS && status.deletable <= 0) {
        throw buildLimitError();
      }
    }

    const { data, error } = await db
      .from('ai_saved_conversations')
      .upsert(
        {
          user_id: user.id,
          conversation_id: conversationId,
          title: existing?.is_custom_title ? normalizeConversationTitle(existing.title, 'Conversation') : title,
          messages: normalized,
          message_count: normalized.length,
          last_message_at: lastMessageAt,
          updated_at: now,
          is_active: true,
          is_saved: existing?.is_saved === true,
          is_custom_title: existing?.is_custom_title === true,
        },
        {
          onConflict: 'user_id,conversation_id',
          ignoreDuplicates: false,
        }
      )
      .select('id')
      .single();

    if (error) throw error;

    await db
      .from('ai_saved_conversations')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .neq('id', data.id);

    if (!existing) {
      await SavedConversationsService.pruneOldest(user.id);
    }

    return data.id;
  },

  // Mark a conversation as no longer active (when starting new chat)
  async deactivateConversation(conversationId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const user = session.user;
    await (supabase as any)
      .from('ai_saved_conversations')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .or(`conversation_id.eq.${conversationId},id.eq.${conversationId}`);
  },

  // Prune oldest conversations beyond MAX_CONVERSATIONS
  async pruneOldest(userId: string): Promise<void> {
    const status = await SavedConversationsService.getRetentionStatusForUser(userId);
    if (status.total <= MAX_CONVERSATIONS) return;

    const overage = status.total - MAX_CONVERSATIONS;
    const { data, error } = await supabase
      .from('ai_saved_conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('is_saved', false)
      .order('is_active', { ascending: true })
      .order('last_message_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length < overage) throw buildLimitError();

    const toDelete = data.slice(0, overage).map((row: any) => row.id);
    if (toDelete.length === 0) throw buildLimitError();

    const { error: deleteError } = await supabase
      .from('ai_saved_conversations')
      .delete()
      .in('id', toDelete);

    if (deleteError) throw deleteError;
  },

  async listConversations(): Promise<ConversationListItem[]> {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await (supabase as any)
      .from('ai_saved_conversations')
      .select('id, title, message_count, last_message_at, is_active, conversation_id, is_saved, is_custom_title')
      .eq('user_id', user.id)
      .order('is_active', { ascending: false })
      .order('is_saved', { ascending: false })
      .order('last_message_at', { ascending: false })
      .limit(MAX_CONVERSATIONS * 3);
    if (error) throw error;
    const ordered = (data || []).map((r: any) => ({
      id: r.id,
      title: normalizeConversationTitle(r.title, 'Conversation'),
      message_count: r.message_count,
      last_message_at: r.last_message_at,
      is_active: r.is_active === true,
      conversation_id: r.conversation_id || null,
      is_saved: r.is_saved === true,
      is_custom_title: r.is_custom_title === true,
    }));
    const deduped = new Map<string, ConversationListItem>();
    for (const conversation of ordered) {
      const canonicalId = conversation.conversation_id || conversation.id;
      if (!deduped.has(canonicalId)) {
        deduped.set(canonicalId, conversation);
      }
    }
    return Array.from(deduped.values()).slice(0, MAX_CONVERSATIONS);
  },

  async loadConversation(id: string): Promise<SavedConversationRow | null> {
    const { data, error } = await supabase
      .from('ai_saved_conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? {
      ...(data as SavedConversationRow),
      title: normalizeConversationTitle((data as any).title, 'Conversation'),
      is_saved: (data as any).is_saved === true,
      is_custom_title: (data as any).is_custom_title === true,
    } : null;
  },

  async updateTitle(id: string, title: string): Promise<boolean> {
    const nextTitle = normalizeConversationTitle(title, 'Conversation');
    if (!nextTitle) throw new Error('Title is required');
    const { error } = await supabase
      .from('ai_saved_conversations')
      .update({ title: nextTitle, is_custom_title: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  async updateConversationMeta(id: string, updates: ConversationMetaUpdate): Promise<boolean> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof updates.title === 'string') {
      const nextTitle = normalizeConversationTitle(updates.title, 'Conversation');
      if (!nextTitle) throw new Error('Title is required');
      payload.title = nextTitle;
      payload.is_custom_title = true;
    }

    if (typeof updates.is_saved === 'boolean') {
      payload.is_saved = updates.is_saved;
    }

    const { error } = await supabase
      .from('ai_saved_conversations')
      .update(payload)
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  async deleteConversation(id: string): Promise<boolean> {
    const { data: { session }, error: userErr } = await supabase.auth.getSession();
    const user = session?.user;
    if (userErr || !user) throw new Error('Not authenticated');

    const db = supabase as any;
    const { data: existing, error: existingError } = await db
      .from('ai_saved_conversations')
      .select('id, conversation_id')
      .eq('user_id', user.id)
      .eq('id', id)
      .maybeSingle();

    if (existingError) throw existingError;

    let query = db
      .from('ai_saved_conversations')
      .delete()
      .eq('user_id', user.id);

    if (existing?.conversation_id) {
      query = query.or(`conversation_id.eq.${existing.conversation_id},id.eq.${id}`);
    } else {
      query = query.eq('id', id);
    }

    const { error } = await query;
    if (error) throw error;
    return true;
  },

  // Full-text search across every saved conversation (titles + message contents).
  // Scale-safe: users hold at most MAX_CONVERSATIONS rows, so client-side matching
  // on a single fetch is fast and avoids any DB schema/RPC work.
  async searchConversations(query: string): Promise<Array<{
    id: string;
    conversationId: string | null;
    title: string;
    snippet: string;
    messageCount: number;
    lastMessageAt: string;
    isSaved: boolean;
  }>> {
    const q = (query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return [];
    const { data, error } = await (supabase as any)
      .from('ai_saved_conversations')
      .select('id, title, messages, message_count, last_message_at, is_saved, conversation_id')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(50);
    if (error || !Array.isArray(data)) return [];

    const results: Array<{ id: string; conversationId: string | null; title: string; snippet: string; messageCount: number; lastMessageAt: string; isSaved: boolean }> = [];
    for (const row of data) {
      const title = typeof row.title === 'string' ? row.title : '';
      const msgs = Array.isArray(row.messages) ? row.messages : [];
      const titleHit = title.toLowerCase().includes(q);
      let snippet = '';
      for (const m of msgs) {
        const content = typeof m?.content === 'string' ? m.content : '';
        const idx = content.toLowerCase().indexOf(q);
        if (idx !== -1) {
          snippet = content.slice(Math.max(0, idx - 40), idx + 80).replace(/\s+/g, ' ').trim();
          break;
        }
      }
      if (titleHit || snippet) {
        results.push({
          id: row.id,
          conversationId: row.conversation_id || null,
          title: title || 'Conversation',
          snippet,
          messageCount: row.message_count || msgs.length,
          lastMessageAt: row.last_message_at,
          isSaved: row.is_saved === true,
        });
      }
    }
    return results.slice(0, 10);
  },

  // Set (or clear) the public share token for a conversation row.
  // Accepts either the DB row id or the frontend conversation_id.
  async setShareToken(conversationKey: string, shareToken: string | null): Promise<void> {
    const db = supabase as any;
    const { error } = await db
      .from('ai_saved_conversations')
      .update({ share_token: shareToken, updated_at: new Date().toISOString() })
      .or(`conversation_id.eq.${conversationKey},id.eq.${conversationKey}`);
    if (error) throw error;
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
