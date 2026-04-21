import { supabase } from '@/integrations/supabase/client';

export type HelpfulMemoryScope = 'all_chats' | 'this_chat';
export type HelpfulMemoryCategory = 'preference' | 'project' | 'goal' | 'saved_context';
export type HelpfulMemorySource = 'user_added' | 'auto_saved' | 'user_confirmed' | 'conversation';
export type HelpfulMemoryStatus = 'active' | 'disabled' | 'deleted' | 'replaced';
export type HelpfulMemorySensitivity = 'normal' | 'careful';

export interface HelpfulMemorySettings {
  helpfulMemoryEnabled: boolean;
}

export interface HelpfulMemoryRecord {
  id: string;
  userId: string;
  scope: HelpfulMemoryScope;
  conversationId: string | null;
  category: HelpfulMemoryCategory;
  memoryText: string;
  source: HelpfulMemorySource;
  status: HelpfulMemoryStatus;
  sensitivity: HelpfulMemorySensitivity;
  confidence: 'high' | 'medium';
  evidenceCount: number;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  lastConfirmedAt: string | null;
}

export interface HelpfulMemoryInput {
  scope: HelpfulMemoryScope;
  conversationId?: string | null;
  category: HelpfulMemoryCategory;
  memoryText: string;
}

const normalizeHelpfulMemoryText = (input: unknown, maxLength = 180): string => {
  if (typeof input !== 'string') return '';
  return input.replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

const extractHelpfulMemoryKeywords = (...inputs: string[]): string[] => {
  const stopwords = new Set([
    'about', 'after', 'again', 'being', 'could', 'doing', 'from', 'have', 'just', 'like', 'make', 'more', 'need',
    'only', 'really', 'should', 'that', 'their', 'them', 'then', 'they', 'this', 'want', 'with', 'would', 'your',
    'there', 'while', 'into', 'over', 'under', 'plain', 'english', 'stage', 'stages', 'audit', 'report'
  ]);

  return Array.from(new Set(
    inputs
      .join(' ')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((word) => word.trim())
      .filter((word) => word.length >= 4 && !stopwords.has(word))
  )).slice(0, 8);
};

const classifySensitivity = (text: string): HelpfulMemorySensitivity => {
  const value = normalizeHelpfulMemoryText(text, 220).toLowerCase();
  if (!value) return 'normal';
  if (/\bwife\b|\bhusband\b|\bson\b|\bdaughter\b|\bfamily\b|\bhealth\b|\bmedical\b|\bdoctor\b|\bbank\b|\bsalary\b|\bdebt\b|\bprayer\b|\breligion\b|زوجتي|زوجي|أطفالي|عائلتي|صحتي|طبيب|راتب|دين|صلاة|دين/i.test(value)) {
    return 'careful';
  }
  return 'normal';
};

const parseRecord = (row: any): HelpfulMemoryRecord => ({
  id: String(row.id),
  userId: String(row.user_id),
  scope: row.scope === 'this_chat' ? 'this_chat' : 'all_chats',
  conversationId: typeof row.conversation_id === 'string' && row.conversation_id.trim() ? row.conversation_id : null,
  category: row.category === 'project' || row.category === 'goal' || row.category === 'saved_context' ? row.category : 'preference',
  memoryText: normalizeHelpfulMemoryText(row.memory_text, 180),
  source: row.source === 'auto_saved' || row.source === 'user_confirmed' || row.source === 'conversation' ? row.source : 'user_added',
  status: row.status === 'disabled' || row.status === 'deleted' || row.status === 'replaced' ? row.status : 'active',
  sensitivity: row.sensitivity === 'careful' ? 'careful' : 'normal',
  confidence: row.confidence === 'high' ? 'high' : 'medium',
  evidenceCount: typeof row.evidence_count === 'number' ? Math.max(1, Math.round(row.evidence_count)) : 1,
  keywords: Array.isArray(row.keywords) ? row.keywords.filter((value: unknown) => typeof value === 'string').slice(0, 8) : [],
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.updated_at || new Date().toISOString(),
  lastUsedAt: row.last_used_at || null,
  lastConfirmedAt: row.last_confirmed_at || null
});

const getUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Not authenticated');
  return userId;
};

export const HelpfulMemoryService = {
  async getSettings(): Promise<HelpfulMemorySettings> {
    const userId = await getUserId();
    const db = supabase as any;
    const { data, error } = await db
      .from('user_helpful_memory_settings')
      .select('helpful_memory_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    return {
      helpfulMemoryEnabled: data?.helpful_memory_enabled !== false
    };
  },

  async updateSettings(helpfulMemoryEnabled: boolean): Promise<HelpfulMemorySettings> {
    const userId = await getUserId();
    const db = supabase as any;
    const now = new Date().toISOString();
    const { error } = await db
      .from('user_helpful_memory_settings')
      .upsert({
        user_id: userId,
        helpful_memory_enabled: helpfulMemoryEnabled,
        updated_at: now
      });

    if (error) throw error;

    return { helpfulMemoryEnabled };
  },

  async listMemories(scope?: HelpfulMemoryScope, conversationId?: string | null): Promise<HelpfulMemoryRecord[]> {
    const userId = await getUserId();
    const db = supabase as any;
    const { data, error } = await db
      .from('user_helpful_memory')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (Array.isArray(data) ? data : [])
      .map(parseRecord)
      .filter((item) => item.status !== 'deleted' && item.status !== 'replaced')
      .filter((item) => {
        if (!scope) return true;
        if (scope === 'all_chats') return item.scope === 'all_chats';
        return item.scope === 'this_chat' && !!conversationId && item.conversationId === conversationId;
      });
  },

  async saveMemory(input: HelpfulMemoryInput): Promise<HelpfulMemoryRecord> {
    const userId = await getUserId();
    const db = supabase as any;
    const scope = input.scope === 'this_chat' ? 'this_chat' : 'all_chats';
    const conversationId = scope === 'this_chat'
      ? normalizeHelpfulMemoryText(input.conversationId || '', 120)
      : null;
    const category = input.category;
    const memoryText = normalizeHelpfulMemoryText(input.memoryText, 180);

    if (!memoryText) throw new Error('Memory text is required');
    if (scope === 'this_chat' && !conversationId) throw new Error('Open a conversation first to save This Chat memory');

    const now = new Date().toISOString();
    const keywords = extractHelpfulMemoryKeywords(memoryText, category, scope);
    const sensitivity = classifySensitivity(memoryText);

    const { data: existing, error: existingError } = await db
      .from('user_helpful_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('scope', scope)
      .eq('category', category)
      .eq('memory_text', memoryText)
      .eq('status', 'active')
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { data, error } = await db
        .from('user_helpful_memory')
        .update({
          conversation_id: scope === 'this_chat' ? conversationId : null,
          source: existing.source || 'user_added',
          keywords,
          sensitivity,
          updated_at: now,
          last_confirmed_at: now
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      return parseRecord(data);
    }

    const { data, error } = await db
      .from('user_helpful_memory')
      .insert({
        user_id: userId,
        scope,
        conversation_id: scope === 'this_chat' ? conversationId : null,
        category,
        memory_text: memoryText,
        source: 'user_added',
        status: 'active',
        sensitivity,
        confidence: 'high',
        evidence_count: 1,
        keywords,
        updated_at: now,
        last_confirmed_at: now
      })
      .select('*')
      .single();

    if (error) throw error;
    return parseRecord(data);
  },

  async updateMemory(id: string, input: HelpfulMemoryInput): Promise<HelpfulMemoryRecord> {
    const userId = await getUserId();
    const db = supabase as any;
    const scope = input.scope === 'this_chat' ? 'this_chat' : 'all_chats';
    const conversationId = scope === 'this_chat'
      ? normalizeHelpfulMemoryText(input.conversationId || '', 120)
      : null;
    const memoryText = normalizeHelpfulMemoryText(input.memoryText, 180);

    if (!memoryText) throw new Error('Memory text is required');
    if (scope === 'this_chat' && !conversationId) throw new Error('Open a conversation first to save This Chat memory');

    const { data, error } = await db
      .from('user_helpful_memory')
      .update({
        scope,
        conversation_id: scope === 'this_chat' ? conversationId : null,
        category: input.category,
        memory_text: memoryText,
        sensitivity: classifySensitivity(memoryText),
        keywords: extractHelpfulMemoryKeywords(memoryText, input.category, scope),
        updated_at: new Date().toISOString(),
        last_confirmed_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return parseRecord(data);
  },

  async deleteMemory(id: string): Promise<void> {
    const userId = await getUserId();
    const db = supabase as any;
    const { error } = await db
      .from('user_helpful_memory')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }
};
