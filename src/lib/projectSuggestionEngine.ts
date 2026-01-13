/**
 * Smart Suggestion Engine for AI Coder
 * Generates contextual suggestions based on project state and AI responses
 */

export type SuggestionCategory = 'design' | 'features' | 'security' | 'mobile' | 'backend';

export interface SmartSuggestion {
  id: string;
  label: string;
  labelAr: string;
  prompt: string;
  category: SuggestionCategory;
  priority: number; // Higher = more important
  icon?: string;
}

interface ProjectContext {
  hasAuth?: boolean;
  hasDatabase?: boolean;
  hasForms?: boolean;
  hasNavigation?: boolean;
  hasDashboard?: boolean;
  hasAnimations?: boolean;
  isMobileOptimized?: boolean;
  projectType?: 'portfolio' | 'dashboard' | 'ecommerce' | 'blog' | 'app' | 'landing' | 'unknown';
  recentChanges?: string[];
  fileCount?: number;
}

// Category metadata
const CATEGORY_META: Record<SuggestionCategory, { icon: string; color: string }> = {
  design: { icon: '🎨', color: 'purple' },
  features: { icon: '⚡', color: 'blue' },
  security: { icon: '🔐', color: 'green' },
  mobile: { icon: '📱', color: 'orange' },
  backend: { icon: '🗄️', color: 'cyan' },
};

// Base suggestions pool
const SUGGESTION_POOL: SmartSuggestion[] = [
  // Design
  { id: 'dark-mode', label: 'Add Dark Mode', labelAr: 'إضافة الوضع الداكن', prompt: 'Add dark mode support with a theme toggle', category: 'design', priority: 8 },
  { id: 'animations', label: 'Add Animations', labelAr: 'إضافة حركات', prompt: 'Add smooth entrance animations using framer-motion', category: 'design', priority: 3 },
  { id: 'improve-spacing', label: 'Improve Spacing', labelAr: 'تحسين المسافات', prompt: 'Improve the spacing and visual hierarchy throughout the app', category: 'design', priority: 5 },
  { id: 'typography', label: 'Improve Typography', labelAr: 'تحسين الخطوط', prompt: 'Improve typography with better font sizes and weights', category: 'design', priority: 4 },
  { id: 'color-scheme', label: 'Enhance Colors', labelAr: 'تحسين الألوان', prompt: 'Enhance the color scheme for better visual appeal', category: 'design', priority: 4 },
  
  // Features
  { id: 'search', label: 'Add Search', labelAr: 'إضافة بحث', prompt: 'Add a search functionality', category: 'features', priority: 8 },
  { id: 'filtering', label: 'Add Filtering', labelAr: 'إضافة تصفية', prompt: 'Add filtering options to filter content', category: 'features', priority: 7 },
  { id: 'sorting', label: 'Add Sorting', labelAr: 'إضافة ترتيب', prompt: 'Add sorting functionality', category: 'features', priority: 6 },
  { id: 'export', label: 'Add Export', labelAr: 'إضافة تصدير', prompt: 'Add ability to export data as PDF or CSV', category: 'features', priority: 5 },
  { id: 'pagination', label: 'Add Pagination', labelAr: 'إضافة ترقيم', prompt: 'Add pagination for better data navigation', category: 'features', priority: 5 },
  { id: 'notifications', label: 'Add Notifications', labelAr: 'إضافة إشعارات', prompt: 'Add in-app notification system', category: 'features', priority: 6 },
  
  // Security
  { id: 'auth', label: 'Add Authentication', labelAr: 'إضافة مصادقة', prompt: 'Add user authentication with login and signup', category: 'security', priority: 9 },
  { id: 'validation', label: 'Add Validation', labelAr: 'إضافة تحقق', prompt: 'Add form validation with error handling', category: 'security', priority: 7 },
  { id: 'rate-limiting', label: 'Add Rate Limiting', labelAr: 'إضافة حد معدل', prompt: 'Add rate limiting to prevent abuse', category: 'security', priority: 5 },
  { id: 'input-sanitization', label: 'Sanitize Inputs', labelAr: 'تنظيف المدخلات', prompt: 'Add input sanitization to prevent XSS', category: 'security', priority: 6 },
  
  // Mobile
  { id: 'responsive', label: 'Make Responsive', labelAr: 'جعله متجاوب', prompt: 'Make all components fully responsive', category: 'mobile', priority: 9 },
  { id: 'mobile-menu', label: 'Add Mobile Menu', labelAr: 'إضافة قائمة الجوال', prompt: 'Add a responsive mobile hamburger menu', category: 'mobile', priority: 8 },
  { id: 'touch-friendly', label: 'Optimize Touch', labelAr: 'تحسين اللمس', prompt: 'Make buttons and interactions touch-friendly', category: 'mobile', priority: 6 },
  { id: 'gestures', label: 'Add Gestures', labelAr: 'إضافة إيماءات', prompt: 'Add swipe gestures for mobile interactions', category: 'mobile', priority: 4 },
  
  // Backend
  { id: 'database', label: 'Add Database', labelAr: 'إضافة قاعدة بيانات', prompt: 'Set up Supabase database with tables', category: 'backend', priority: 9 },
  { id: 'api', label: 'Connect API', labelAr: 'ربط API', prompt: 'Create API endpoints for data operations', category: 'backend', priority: 8 },
  { id: 'caching', label: 'Add Caching', labelAr: 'إضافة تخزين مؤقت', prompt: 'Add caching for better performance', category: 'backend', priority: 5 },
  { id: 'error-handling', label: 'Error Handling', labelAr: 'معالجة الأخطاء', prompt: 'Add comprehensive error handling', category: 'backend', priority: 7 },
];

/**
 * Analyze AI response content to determine relevant suggestions
 */
function analyzeResponseContent(content: string): string[] {
  const relevantIds: string[] = [];
  const lowerContent = content.toLowerCase();

  // Check what was just created/modified
  if (lowerContent.includes('navigation') || lowerContent.includes('nav') || lowerContent.includes('menu')) {
    relevantIds.push('mobile-menu', 'search', 'dark-mode');
  }
  if (lowerContent.includes('form') || lowerContent.includes('input')) {
    relevantIds.push('validation', 'input-sanitization');
  }
  if (lowerContent.includes('list') || lowerContent.includes('table') || lowerContent.includes('data')) {
    relevantIds.push('filtering', 'sorting', 'pagination', 'search');
  }
  if (lowerContent.includes('component') || lowerContent.includes('card')) {
    relevantIds.push('animations', 'responsive');
  }
  if (lowerContent.includes('backend') || lowerContent.includes('api') || lowerContent.includes('database')) {
    relevantIds.push('error-handling', 'caching');
  }
  if (lowerContent.includes('auth') || lowerContent.includes('login')) {
    relevantIds.push('validation', 'rate-limiting');
  }

  return relevantIds;
}

/**
 * Determine what features the project might be missing
 */
function getMissingSuggestions(context: ProjectContext): string[] {
  const missing: string[] = [];

  if (!context.hasAuth) missing.push('auth');
  if (!context.hasDatabase) missing.push('database');
  if (!context.hasAnimations) missing.push('animations');
  if (!context.isMobileOptimized) missing.push('responsive', 'mobile-menu');
  if (!context.hasNavigation) missing.push('mobile-menu');

  return missing;
}

/**
 * Get project-type specific suggestions
 */
function getProjectTypeSuggestions(type: ProjectContext['projectType']): string[] {
  switch (type) {
    case 'dashboard':
      return ['filtering', 'sorting', 'export', 'dark-mode'];
    case 'ecommerce':
      return ['search', 'filtering', 'pagination'];
    case 'blog':
      return ['search', 'pagination', 'dark-mode'];
    case 'portfolio':
      return ['animations', 'responsive', 'dark-mode'];
    case 'app':
      return ['auth', 'notifications', 'responsive'];
    case 'landing':
      return ['animations', 'responsive', 'typography'];
    default:
      return [];
  }
}

/**
 * Generate smart suggestions based on context
 */
export function generateSmartSuggestions(
  responseContent: string,
  context: ProjectContext = {},
  maxSuggestions: number = 6
): SmartSuggestion[] {
  const scoreMap = new Map<string, number>();

  // Score based on response content
  const responseRelevant = analyzeResponseContent(responseContent);
  responseRelevant.forEach(id => {
    scoreMap.set(id, (scoreMap.get(id) || 0) + 30);
  });

  // Score based on missing features
  const missing = getMissingSuggestions(context);
  missing.forEach(id => {
    scoreMap.set(id, (scoreMap.get(id) || 0) + 20);
  });

  // Score based on project type
  const typeSpecific = getProjectTypeSuggestions(context.projectType);
  typeSpecific.forEach(id => {
    scoreMap.set(id, (scoreMap.get(id) || 0) + 15);
  });

  // Add base priority scores
  SUGGESTION_POOL.forEach(suggestion => {
    const currentScore = scoreMap.get(suggestion.id) || 0;
    scoreMap.set(suggestion.id, currentScore + suggestion.priority);
  });

  // Sort and select top suggestions
  const sortedIds = Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxSuggestions)
    .map(([id]) => id);

  // Return the full suggestion objects
  return sortedIds
    .map(id => SUGGESTION_POOL.find(s => s.id === id))
    .filter((s): s is SmartSuggestion => s !== undefined);
}

/**
 * Get initial suggestions for a new/empty project
 */
export function getInitialSuggestions(): SmartSuggestion[] {
  // Only return truly essential initial suggestions - NO static "animations"
  return [
    SUGGESTION_POOL.find(s => s.id === 'responsive')!,
    SUGGESTION_POOL.find(s => s.id === 'dark-mode')!,
  ].filter(Boolean);
}

/**
 * Get category-grouped suggestions
 */
export function getSuggestionsByCategory(): Record<SuggestionCategory, SmartSuggestion[]> {
  const grouped: Record<SuggestionCategory, SmartSuggestion[]> = {
    design: [],
    features: [],
    security: [],
    mobile: [],
    backend: [],
  };

  SUGGESTION_POOL.forEach(suggestion => {
    grouped[suggestion.category].push(suggestion);
  });

  // Sort each category by priority
  Object.keys(grouped).forEach(key => {
    grouped[key as SuggestionCategory].sort((a, b) => b.priority - a.priority);
  });

  return grouped;
}

/**
 * Get category metadata
 */
export function getCategoryMeta(category: SuggestionCategory) {
  return CATEGORY_META[category];
}
