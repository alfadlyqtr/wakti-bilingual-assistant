/**
 * Smart Intent Detection for AI Coder
 * Detects complex requests and determines if clarifying questions are needed
 */

export type IntentType = 
  | 'authentication'
  | 'dashboard'
  | 'forms'
  | 'admin'
  | 'notifications'
  | 'database'
  | 'api'
  | 'ui'
  | 'simple';

export interface DetectedIntent {
  type: IntentType;
  confidence: number; // 0-1
  keywords: string[];
  shouldAskQuestions: boolean;
  suggestedQuestionTemplates: string[];
}

interface IntentPattern {
  type: IntentType;
  keywords: string[];
  patterns: RegExp[];
  minConfidenceForQuestions: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    type: 'authentication',
    keywords: ['auth', 'login', 'signup', 'sign up', 'sign in', 'register', 'password', 'oauth', 'sso', 'authentication'],
    patterns: [
      /add\s+(user\s+)?auth(entication)?/i,
      /login\s+(page|form|system)/i,
      /sign\s*(up|in)\s+(page|form|system)/i,
      /user\s+registration/i,
      /password\s+reset/i,
    ],
    minConfidenceForQuestions: 0.6,
  },
  {
    type: 'dashboard',
    keywords: ['dashboard', 'admin panel', 'control panel', 'analytics', 'stats', 'metrics', 'overview'],
    patterns: [
      /create\s+(a\s+)?dashboard/i,
      /admin\s+panel/i,
      /control\s+panel/i,
      /analytics\s+(page|dashboard)/i,
      /user\s+dashboard/i,
    ],
    minConfidenceForQuestions: 0.5,
  },
  {
    type: 'forms',
    keywords: ['form', 'input', 'validation', 'submit', 'fields', 'contact form', 'survey'],
    patterns: [
      /create\s+(a\s+)?form/i,
      /contact\s+form/i,
      /form\s+validation/i,
      /input\s+fields/i,
      /multi-step\s+form/i,
    ],
    minConfidenceForQuestions: 0.5,
  },
  {
    type: 'admin',
    keywords: ['admin', 'roles', 'permissions', 'access control', 'rbac', 'user management', 'moderator'],
    patterns: [
      /admin\s+(system|panel|access)/i,
      /role\s+based\s+access/i,
      /user\s+roles/i,
      /permission\s+(system|management)/i,
      /access\s+control/i,
    ],
    minConfidenceForQuestions: 0.7,
  },
  {
    type: 'notifications',
    keywords: ['notification', 'notify', 'alert', 'push', 'email', 'sms', 'toast'],
    patterns: [
      /add\s+notifications?/i,
      /push\s+notifications?/i,
      /email\s+notifications?/i,
      /notification\s+system/i,
      /alert\s+system/i,
    ],
    minConfidenceForQuestions: 0.5,
  },
  {
    type: 'database',
    keywords: ['database', 'supabase', 'table', 'schema', 'migration', 'crud', 'data'],
    patterns: [
      /create\s+(a\s+)?table/i,
      /database\s+schema/i,
      /add\s+crud/i,
      /supabase\s+integration/i,
      /data\s+model/i,
    ],
    minConfidenceForQuestions: 0.4,
  },
  {
    type: 'api',
    keywords: ['api', 'endpoint', 'rest', 'fetch', 'backend', 'server', 'edge function'],
    patterns: [
      /create\s+(an?\s+)?api/i,
      /rest\s+api/i,
      /edge\s+function/i,
      /api\s+endpoint/i,
      /backend\s+logic/i,
    ],
    minConfidenceForQuestions: 0.4,
  },
  {
    type: 'ui',
    keywords: ['button', 'component', 'style', 'design', 'layout', 'responsive', 'animation'],
    patterns: [
      /add\s+(a\s+)?button/i,
      /create\s+(a\s+)?component/i,
      /style\s+the/i,
      /make\s+it\s+responsive/i,
      /add\s+animation/i,
    ],
    minConfidenceForQuestions: 0.2, // UI changes usually don't need questions
  },
];

/**
 * Calculate confidence score for an intent based on keyword and pattern matches
 */
function calculateConfidence(
  prompt: string,
  pattern: IntentPattern
): { confidence: number; matchedKeywords: string[] } {
  const lowerPrompt = prompt.toLowerCase();
  let score = 0;
  const matchedKeywords: string[] = [];

  // Check keyword matches (each keyword adds 0.15)
  for (const keyword of pattern.keywords) {
    if (lowerPrompt.includes(keyword.toLowerCase())) {
      score += 0.15;
      matchedKeywords.push(keyword);
    }
  }

  // Check pattern matches (each pattern adds 0.25)
  for (const regex of pattern.patterns) {
    if (regex.test(prompt)) {
      score += 0.25;
    }
  }

  // Cap at 1.0
  return {
    confidence: Math.min(score, 1.0),
    matchedKeywords,
  };
}

/**
 * Detect the primary intent from a user prompt
 */
export function detectIntent(prompt: string): DetectedIntent {
  const results: Array<{
    type: IntentType;
    confidence: number;
    keywords: string[];
    minConfidence: number;
  }> = [];

  for (const pattern of INTENT_PATTERNS) {
    const { confidence, matchedKeywords } = calculateConfidence(prompt, pattern);
    if (confidence > 0) {
      results.push({
        type: pattern.type,
        confidence,
        keywords: matchedKeywords,
        minConfidence: pattern.minConfidenceForQuestions,
      });
    }
  }

  // Sort by confidence
  results.sort((a, b) => b.confidence - a.confidence);

  if (results.length === 0) {
    return {
      type: 'simple',
      confidence: 1.0,
      keywords: [],
      shouldAskQuestions: false,
      suggestedQuestionTemplates: [],
    };
  }

  const topResult = results[0];
  const shouldAskQuestions = topResult.confidence >= topResult.minConfidence;

  // Map intent types to question templates
  const templateMap: Record<IntentType, string[]> = {
    authentication: ['authentication'],
    dashboard: ['dashboard'],
    forms: ['forms'],
    admin: ['admin'],
    notifications: ['notifications'],
    database: [],
    api: [],
    ui: [],
    simple: [],
  };

  return {
    type: topResult.type,
    confidence: topResult.confidence,
    keywords: topResult.keywords,
    shouldAskQuestions,
    suggestedQuestionTemplates: templateMap[topResult.type] || [],
  };
}

/**
 * Detect multiple intents (for complex prompts)
 */
export function detectMultipleIntents(prompt: string): DetectedIntent[] {
  const results: DetectedIntent[] = [];

  for (const pattern of INTENT_PATTERNS) {
    const { confidence, matchedKeywords } = calculateConfidence(prompt, pattern);
    if (confidence >= 0.3) { // Only include if somewhat confident
      results.push({
        type: pattern.type,
        confidence,
        keywords: matchedKeywords,
        shouldAskQuestions: confidence >= pattern.minConfidenceForQuestions,
        suggestedQuestionTemplates: confidence >= pattern.minConfidenceForQuestions 
          ? [pattern.type] 
          : [],
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if a prompt likely needs database changes
 */
export function mightNeedDatabaseChanges(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  const databaseKeywords = [
    'database', 'table', 'schema', 'migration', 'supabase',
    'store', 'save', 'persist', 'crud', 'data model',
    'user data', 'backend', 'authentication', 'auth',
    'roles', 'permissions', 'records',
  ];

  return databaseKeywords.some(keyword => lowerPrompt.includes(keyword));
}

/**
 * Get a human-readable description of the detected intent
 */
export function getIntentDescription(intent: DetectedIntent, isArabic: boolean = false): string {
  const descriptions: Record<IntentType, { en: string; ar: string }> = {
    authentication: { en: 'User Authentication', ar: 'مصادقة المستخدم' },
    dashboard: { en: 'Dashboard/Panel', ar: 'لوحة التحكم' },
    forms: { en: 'Form Creation', ar: 'إنشاء نموذج' },
    admin: { en: 'Admin System', ar: 'نظام الإدارة' },
    notifications: { en: 'Notifications', ar: 'الإشعارات' },
    database: { en: 'Database Changes', ar: 'تغييرات قاعدة البيانات' },
    api: { en: 'API/Backend', ar: 'API/الخلفية' },
    ui: { en: 'UI Component', ar: 'مكون واجهة' },
    simple: { en: 'Simple Request', ar: 'طلب بسيط' },
  };

  return isArabic ? descriptions[intent.type].ar : descriptions[intent.type].en;
}
