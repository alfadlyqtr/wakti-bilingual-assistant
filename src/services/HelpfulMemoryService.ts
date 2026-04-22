import { supabase } from '@/integrations/supabase/client';

export type HelpfulMemoryScope = 'all_chats' | 'this_chat';
export type HelpfulMemoryCategory = 'preference' | 'project' | 'goal' | 'saved_context';
export type HelpfulMemorySource = 'user_added' | 'auto_saved' | 'user_confirmed' | 'conversation';
export type HelpfulMemoryStatus = 'active' | 'disabled' | 'deleted' | 'replaced';
export type HelpfulMemorySensitivity = 'normal' | 'careful';
export type HelpfulMemoryLayer = 'always_use' | 'routine' | 'project' | 'candidate';

export interface HelpfulMemorySettings {
  helpfulMemoryEnabled: boolean;
  capturePaused: boolean;
}

export interface HelpfulMemoryRecord {
  id: string;
  userId: string;
  scope: HelpfulMemoryScope;
  conversationId: string | null;
  category: HelpfulMemoryCategory;
  layer: HelpfulMemoryLayer;
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
  scope?: HelpfulMemoryScope;
  conversationId?: string | null;
  category?: HelpfulMemoryCategory;
  layer?: HelpfulMemoryLayer;
  memoryText: string;
}

// Translate the new user-facing layer into legacy (scope, category) for backward compat on the row.
const layerToScopeCategory = (layer: HelpfulMemoryLayer): { scope: HelpfulMemoryScope; category: HelpfulMemoryCategory } => {
  switch (layer) {
    case 'routine': return { scope: 'all_chats', category: 'goal' };
    case 'project': return { scope: 'all_chats', category: 'project' };
    case 'candidate': return { scope: 'all_chats', category: 'saved_context' };
    case 'always_use':
    default: return { scope: 'all_chats', category: 'saved_context' };
  }
};

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
  layer: row.layer === 'routine' || row.layer === 'project' || row.layer === 'candidate' ? row.layer : 'always_use',
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
      .select('helpful_memory_enabled, capture_paused')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    return {
      helpfulMemoryEnabled: data?.helpful_memory_enabled !== false,
      capturePaused: data?.capture_paused === true,
    };
  },

  async updateSettings(patch: boolean | { helpfulMemoryEnabled?: boolean; capturePaused?: boolean }): Promise<HelpfulMemorySettings> {
    const userId = await getUserId();
    const db = supabase as any;
    const now = new Date().toISOString();
    const current = await HelpfulMemoryService.getSettings();
    const next: HelpfulMemorySettings = typeof patch === 'boolean'
      ? { ...current, helpfulMemoryEnabled: patch }
      : {
          helpfulMemoryEnabled: patch.helpfulMemoryEnabled ?? current.helpfulMemoryEnabled,
          capturePaused: patch.capturePaused ?? current.capturePaused,
        };
    const { error } = await db
      .from('user_helpful_memory_settings')
      .upsert({
        user_id: userId,
        helpful_memory_enabled: next.helpfulMemoryEnabled,
        capture_paused: next.capturePaused,
        updated_at: now
      });

    if (error) throw error;
    console.info('[helpful-memory] settings updated', next);
    return next;
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

  async saveMemory(input: HelpfulMemoryInput & { layer?: HelpfulMemoryLayer }): Promise<HelpfulMemoryRecord> {
    const userId = await getUserId();
    const db = supabase as any;
    const layer: HelpfulMemoryLayer = input.layer || 'always_use';
    const { scope, category } = layerToScopeCategory(layer);
    const memoryText = normalizeHelpfulMemoryText(input.memoryText, 180);

    if (!memoryText) throw new Error('Memory text is required');

    const now = new Date().toISOString();
    const keywords = extractHelpfulMemoryKeywords(memoryText, category, layer);
    const sensitivity = classifySensitivity(memoryText);

    const { data: existing, error: existingError } = await db
      .from('user_helpful_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('memory_text', memoryText)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { data, error } = await db
        .from('user_helpful_memory')
        .update({
          layer,
          scope,
          category,
          conversation_id: null,
          source: 'user_added',
          status: 'active',
          sensitivity,
          sensitivity_reviewed: true,
          keywords,
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
        conversation_id: null,
        category,
        layer,
        memory_text: memoryText,
        source: 'user_added',
        status: 'active',
        sensitivity,
        sensitivity_reviewed: true,
        confidence: 'high',
        evidence_count: 1,
        keywords,
        updated_at: now,
        last_confirmed_at: now
      })
      .select('*')
      .single();

    if (error) throw error;
    HelpfulMemoryService.enforceLayerLimit(layer).catch(() => {});
    console.info('[helpful-memory] saved', { id: (data as any)?.id, layer });
    return parseRecord(data);
  },

  async approveCandidate(id: string, targetLayer: HelpfulMemoryLayer = 'always_use'): Promise<HelpfulMemoryRecord> {
    const userId = await getUserId();
    const db = supabase as any;
    const now = new Date().toISOString();
    const { scope, category } = layerToScopeCategory(targetLayer);
    const { data, error } = await db
      .from('user_helpful_memory')
      .update({
        layer: targetLayer,
        scope,
        category,
        source: 'user_confirmed',
        sensitivity_reviewed: true,
        status: 'active',
        updated_at: now,
        last_confirmed_at: now
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error) throw error;
    return parseRecord(data);
  },

  async dismissCandidate(id: string): Promise<void> {
    const userId = await getUserId();
    const db = supabase as any;
    const { error } = await db
      .from('user_helpful_memory')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async updateMemory(id: string, input: HelpfulMemoryInput & { layer?: HelpfulMemoryLayer }): Promise<HelpfulMemoryRecord> {
    const userId = await getUserId();
    const db = supabase as any;
    const layer: HelpfulMemoryLayer = input.layer || 'always_use';
    const { scope, category } = layerToScopeCategory(layer);
    const memoryText = normalizeHelpfulMemoryText(input.memoryText, 180);

    if (!memoryText) throw new Error('Memory text is required');

    const { data, error } = await db
      .from('user_helpful_memory')
      .update({
        layer,
        scope,
        category,
        conversation_id: null,
        memory_text: memoryText,
        sensitivity: classifySensitivity(memoryText),
        sensitivity_reviewed: true,
        keywords: extractHelpfulMemoryKeywords(memoryText, category, layer),
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
    console.info('[helpful-memory] deleted', { id });
  },

  // Per-layer caps (soft enforcement: older low-evidence rows get archived when exceeded).
  async enforceLayerLimit(layer: HelpfulMemoryLayer): Promise<void> {
    const limits: Record<HelpfulMemoryLayer, number> = {
      always_use: 40,
      routine: 20,
      project: 30,
      candidate: 15,
    };
    const cap = limits[layer];
    const userId = await getUserId();
    const db = supabase as any;
    const { data, error } = await db
      .from('user_helpful_memory')
      .select('id, evidence_count, last_used_at, updated_at')
      .eq('user_id', userId)
      .eq('layer', layer)
      .eq('status', 'active')
      .order('evidence_count', { ascending: true })
      .order('last_used_at', { ascending: true, nullsFirst: true });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length <= cap) return;
    const toArchive = rows.slice(0, rows.length - cap).map((r: any) => r.id);
    if (toArchive.length === 0) return;
    await db
      .from('user_helpful_memory')
      .update({ status: 'disabled', updated_at: new Date().toISOString() })
      .in('id', toArchive);
    console.info('[helpful-memory] layer limit enforced', { layer, archived: toArchive.length });
  },

  async exportAll(): Promise<{ exportedAt: string; settings: HelpfulMemorySettings; memories: HelpfulMemoryRecord[] }> {
    const [settings, memories] = await Promise.all([
      HelpfulMemoryService.getSettings(),
      HelpfulMemoryService.listMemories(),
    ]);
    console.info('[helpful-memory] exported', { count: memories.length });
    return {
      exportedAt: new Date().toISOString(),
      settings,
      memories,
    };
  },

  async resetAll(): Promise<number> {
    const userId = await getUserId();
    const db = supabase as any;
    const { data, error } = await db
      .from('user_helpful_memory')
      .delete()
      .eq('user_id', userId)
      .select('id');
    if (error) throw error;
    const count = Array.isArray(data) ? data.length : 0;
    console.info('[helpful-memory] reset all', { count });
    return count;
  }
};
