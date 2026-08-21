// Chat Highlights — pinned "best answers" stored locally (local-first, like the
// rest of the app's conversation memory). Cap 50, newest first.

export interface HighlightItem {
  id: string;
  conversationId: string | null;
  conversationTitle: string;
  content: string;
  createdAt: string;
}

const STORAGE_KEY = 'wakti_chat_highlights';
const MAX_HIGHLIGHTS = 50;

function load(): HighlightItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(items: HighlightItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HIGHLIGHTS)));
  } catch { /* storage full/blocked — non-fatal */ }
}

export const HighlightsService = {
  list(): HighlightItem[] {
    return load();
  },

  add(item: Omit<HighlightItem, 'id' | 'createdAt'>): HighlightItem[] {
    const items = load();
    // No duplicates: same content in the same conversation pins once
    if (items.some((h) => h.conversationId === item.conversationId && h.content === item.content)) {
      return items;
    }
    items.unshift({
      ...item,
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    });
    persist(items);
    return items;
  },

  remove(id: string): HighlightItem[] {
    const items = load().filter((h) => h.id !== id);
    persist(items);
    return items;
  },
};
