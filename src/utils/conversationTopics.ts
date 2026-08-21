// Conversation topics: keyword → emoji topic, used for smart titles and list chips.
// English + Arabic keywords; deterministic, zero cost, no AI call needed.

interface TopicRule {
  topic: string;
  emoji: string;
  pattern: RegExp;
}

const TOPIC_RULES: TopicRule[] = [
  { topic: 'cars', emoji: '🚗', pattern: /\b(car|cars|engine|motor|tire|tyre|patrol|land\s?cruiser|nissan|toyota|bmw|mercedes|porsche|lexus|hyundai|kia|oil change|horsepower)\b|سيار|محرك|باترول/i },
  { topic: 'study', emoji: '📚', pattern: /\b(study|exam|homework|math|algebra|physics|chemistry|learn|teach|quiz|university|school)\b|دراس|امتحان|واجب|رياضيات|مدرسة/i },
  { topic: 'food', emoji: '🍔', pattern: /\b(food|recipe|cook|restaurant|burger|pizza|coffee|dinner|lunch|breakfast)\b|مطعم|أكل|طبخ|قهوة|غداء/i },
  { topic: 'work', emoji: '💼', pattern: /\b(work|meeting|business|project|deadline|client|office|presentation|report)\b|عمل|اجتماع|مشروع|تقرير|دوام/i },
  { topic: 'travel', emoji: '✈️', pattern: /\b(flight|travel|trip|hotel|airport|visa|ticket|vacation)\b|سفر|طيران|فندق|رحلة|مطار/i },
  { topic: 'health', emoji: '💪', pattern: /\b(health|gym|workout|doctor|diet|medicine|fitness|hospital)\b|صحة|رياضة|دكتور|مستشفى|دايت/i },
  { topic: 'tech', emoji: '💻', pattern: /\b(code|app|software|computer|website|program|bug|api|laptop)\b|برمج|تطبيق|كمبيوتر|موقع|كود/i },
  { topic: 'money', emoji: '💰', pattern: /\b(money|price|salary|invest|crypto|bank|budget|loan)\b|فلوس|سعر|راتب|بنك|استثمار/i },
  { topic: 'fun', emoji: '🎬', pattern: /\b(movie|music|song|game|series|netflix|funny|joke)\b|فيلم|أغنية|موسيقى|لعبة|مسلسل/i },
];

export interface TopicInfo {
  topic: string;
  emoji: string;
}

export function deriveTopic(text: string): TopicInfo | null {
  const t = (text || '').trim();
  if (!t) return null;
  for (const rule of TOPIC_RULES) {
    if (rule.pattern.test(t)) return { topic: rule.topic, emoji: rule.emoji };
  }
  return null;
}

// Leading filler phrases that make titles boring ("Can you...", "Please tell me...")
const TITLE_FILLER = /^(please|can you|could you|help me|i need( to)?|i want( to)?|tell me( about)?|what is|what are|who is|how do i|how to|pls|plz)\b[:\s-]*/i;

// Smart title: first 5 meaningful words, capitalized, topic emoji prefix.
export function smartConversationTitle(firstMessage: string, fallback: string): string {
  let text = (firstMessage || '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  const stripped = text.replace(TITLE_FILLER, '').trim();
  if (stripped) text = stripped;
  const words = text.split(' ').filter(Boolean).slice(0, 5).join(' ');
  if (!words) return fallback;
  const title = words.charAt(0).toUpperCase() + words.slice(1);
  const topic = deriveTopic(text);
  const withEmoji = topic ? `${topic.emoji} ${title}` : title;
  return withEmoji.slice(0, 60) || fallback;
}
