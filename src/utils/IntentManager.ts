/**
 * IntentManager.ts
 * 
 * Unified Intent Detection System for Wakti AI Coder
 * 
 * This is the SINGLE SOURCE OF TRUTH for all intent detection.
 * It consolidates patterns from:
 * - chatIntents.ts (view/chat intents)
 * - requestAnalyzer.ts (build/feature detection)
 * - wizards/index.ts (wizard type detection)
 * - ProjectDetail.tsx (scattered patterns)
 * 
 * Priority Order (highest to lowest):
 * 1. VIEW - Show existing content (images, products, orders)
 * 2. CUSTOMIZE - Style/modify existing elements
 * 3. BUILD - Create new features/components
 * 4. INFO - General questions (fallback to AI chat)
 */

// ============================================================================
// TYPES
// ============================================================================

export type IntentCategory = 'VIEW' | 'CUSTOMIZE' | 'BUILD' | 'INFO';

export type IntentType = 
  // VIEW intents
  | 'view_images'
  | 'view_products'
  | 'view_orders'
  | 'view_bookings'
  // CUSTOMIZE intents
  | 'customize_style'
  | 'customize_color'
  | 'customize_layout'
  // BUILD intents
  | 'build_booking'
  | 'build_contact'
  | 'build_product'
  | 'build_auth'
  | 'build_media'
  | 'build_landing'
  | 'build_ecommerce'
  // INFO intents
  | 'info_question'
  | 'info_help'
  | 'none';

export type ActionType = 
  | 'OPEN_MODAL'
  | 'SHOW_WIZARD'
  | 'NAVIGATE'
  | 'CHAT_RESPONSE'
  | 'CALL_AI';

export interface IntentResult {
  category: IntentCategory;
  intent: IntentType;
  action: ActionType;
  confidence: 'high' | 'medium' | 'low';
  payload: {
    modalType?: string;
    modalProps?: Record<string, any>;
    wizardType?: string;
    navigateTo?: string;
    response?: {
      en: string;
      ar: string;
    };
  };
  matchedPattern?: string;
}

interface PatternConfig {
  patterns: RegExp[];
  category: IntentCategory;
  intent: IntentType;
  action: ActionType;
  priority: number; // Lower = higher priority
  payload: IntentResult['payload'];
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

const INTENT_PATTERNS: PatternConfig[] = [
  // -------------------------------------------------------------------------
  // PRIORITY 1: VIEW INTENTS (Show existing content)
  // -------------------------------------------------------------------------
  {
    patterns: [
      /\b(show|see|view|list|what)\s*(me\s*)?(all\s*)?(the\s*)?(images?|photos?|pictures?|gallery)\b/i,
      /\b(images?|photos?|pictures?|gallery)\s*(on|in|of)\s*(the|this)?\s*(site|page|website)\b/i,
    ],
    category: 'VIEW',
    intent: 'view_images',
    action: 'OPEN_MODAL',
    priority: 1,
    payload: {
      modalType: 'SmartMediaManager',
      modalProps: { initialTab: 'site' },
      response: {
        en: '🖼️ Here are all the images on your site!\n\nYou can:\n• Click any image to view full size\n• Download or copy the URL\n• Replace with stock photos or upload new ones',
        ar: '🖼️ إليك جميع الصور في موقعك!\n\nيمكنك:\n• النقر على أي صورة لعرضها بالحجم الكامل\n• تحميل أو نسخ الرابط\n• استبدالها بصور مجانية أو رفع صور جديدة'
      }
    }
  },
  {
    patterns: [
      /\b(search|find|look\s*for|browse)\s*(stock\s*)?(photos?|images?|pictures?)\b/i,
      /\b(freepik|stock)\s*(photos?|images?|pictures?)\b/i,
    ],
    category: 'VIEW',
    intent: 'view_images',
    action: 'OPEN_MODAL',
    priority: 1,
    payload: {
      modalType: 'SmartMediaManager',
      modalProps: { initialTab: 'stock' },
      response: {
        en: '🔍 Opening stock photo search! Browse millions of free images from Freepik.',
        ar: '🔍 جاري فتح البحث عن الصور! تصفح ملايين الصور المجانية من Freepik.'
      }
    }
  },
  {
    patterns: [
      /\b(upload|add)\s*(my\s*)?(own\s*)?(photos?|images?|pictures?|files?)\b/i,
    ],
    category: 'VIEW',
    intent: 'view_images',
    action: 'OPEN_MODAL',
    priority: 1,
    payload: {
      modalType: 'SmartMediaManager',
      modalProps: { initialTab: 'upload' },
      response: {
        en: '📤 Ready to upload! Drag and drop your images or click to browse.',
        ar: '📤 جاهز للرفع! اسحب وأفلت صورك أو انقر للتصفح.'
      }
    }
  },
  {
    patterns: [
      /\b(show|see|view|list|what)\s*(me\s*)?(all\s*)?(the\s*)?(products?|items?|inventory)\b/i,
      /\b(my|our|the|all)\s*(products?|items?|inventory)\b/i,
    ],
    category: 'VIEW',
    intent: 'view_products',
    action: 'NAVIGATE',
    priority: 1,
    payload: {
      navigateTo: '/products',
      response: {
        en: '🛍️ Here are all your products! You can:\n• Edit details\n• Update prices\n• Manage inventory',
        ar: '🛍️ إليك جميع منتجاتك! يمكنك:\n• تعديل التفاصيل\n• تحديث الأسعار\n• إدارة المخزون'
      }
    }
  },
  {
    patterns: [
      /\b(show|see|view|list|what)\s*(me\s*)?(all\s*)?(the\s*)?(orders?|purchases?|sales?)\b/i,
      /\b(my|our|the|all)\s*(orders?|purchases?|sales?)\b/i,
    ],
    category: 'VIEW',
    intent: 'view_orders',
    action: 'NAVIGATE',
    priority: 1,
    payload: {
      navigateTo: '/orders',
      response: {
        en: '📦 Here are all your orders! You can:\n• View order details\n• Track status\n• Manage fulfillment',
        ar: '📦 إليك جميع طلباتك! يمكنك:\n• عرض تفاصيل الطلب\n• تتبع الحالة\n• إدارة التنفيذ'
      }
    }
  },
  {
    patterns: [
      /\b(show|see|view|list|what)\s*(all\s*)?(the\s*)?(bookings?|appointments?|reservations?)\b/i,
      /\b(my|our|the|all)\s*(bookings?|appointments?|reservations?)\b/i,
    ],
    category: 'VIEW',
    intent: 'view_bookings',
    action: 'NAVIGATE',
    priority: 1,
    payload: {
      navigateTo: '/bookings',
      response: {
        en: '📅 Here are all your bookings! You can:\n• View details\n• Manage schedule\n• Handle changes',
        ar: '📅 إليك جميع حجوزاتك! يمكنك:\n• عرض التفاصيل\n• إدارة الجدول\n• التعامل مع التغييرات'
      }
    }
  },

  // -------------------------------------------------------------------------
  // PRIORITY 2: CUSTOMIZE INTENTS (Modify existing elements)
  // -------------------------------------------------------------------------
  {
    patterns: [
      /\b(change|make|set|update)\s*(the\s*)?(color|colour)\s*(of|for|to)?\b/i,
      /\b(blue|red|green|yellow|purple|orange|pink|black|white|gray|grey)\s*(color|colour|background|text)?\b/i,
    ],
    category: 'CUSTOMIZE',
    intent: 'customize_color',
    action: 'CALL_AI',
    priority: 2,
    payload: {
      response: {
        en: "I'll help you change the color. Let me update that for you.",
        ar: "سأساعدك في تغيير اللون. دعني أحدث ذلك لك."
      }
    }
  },
  {
    patterns: [
      /\b(change|make|set|update)\s*(the\s*)?(style|appearance|look)\b/i,
      /\b(style|restyle|redesign)\s*(the|this)?\b/i,
    ],
    category: 'CUSTOMIZE',
    intent: 'customize_style',
    action: 'CALL_AI',
    priority: 2,
    payload: {
      response: {
        en: "I'll help you with the styling. Let me make those changes.",
        ar: "سأساعدك في التصميم. دعني أجري هذه التغييرات."
      }
    }
  },
  {
    patterns: [
      /\b(when\s*empty|when\s*full|has\s*items|no\s*items)\b/i,
      /\b(badge|indicator|counter|number)\s*(on|for|with)?\b/i,
    ],
    category: 'CUSTOMIZE',
    intent: 'customize_style',
    action: 'CALL_AI',
    priority: 2,
    payload: {
      response: {
        en: "I understand you want to add conditional styling. Let me implement that.",
        ar: "أفهم أنك تريد إضافة تصميم شرطي. دعني أنفذ ذلك."
      }
    }
  },
  {
    patterns: [
      /\b(move|reposition|rearrange|layout)\s*(the)?\b/i,
      /\b(bigger|smaller|larger|wider|narrower|taller|shorter)\b/i,
    ],
    category: 'CUSTOMIZE',
    intent: 'customize_layout',
    action: 'CALL_AI',
    priority: 2,
    payload: {
      response: {
        en: "I'll adjust the layout for you.",
        ar: "سأعدل التخطيط لك."
      }
    }
  },

  // -------------------------------------------------------------------------
  // PRIORITY 3: BUILD INTENTS (Create new features - trigger wizards)
  // -------------------------------------------------------------------------
  {
    patterns: [
      /\b(add|create|build|make|need|want)\s*(a\s*)?(booking|appointment|reservation)\s*(system|form|page|feature)?\b/i,
      /\b(booking|appointment|reservation)\s*(system|form|page|feature)\b/i,
      /\bحجز|موعد|حجوزات\b/i,
    ],
    category: 'BUILD',
    intent: 'build_booking',
    action: 'SHOW_WIZARD',
    priority: 3,
    payload: {
      wizardType: 'booking',
      response: {
        en: "Let's set up your booking system! I'll guide you through the options.",
        ar: "لنقم بإعداد نظام الحجز الخاص بك! سأرشدك خلال الخيارات."
      }
    }
  },
  {
    patterns: [
      /\b(add|create|build|make|need|want)\s*(a\s*)?(contact|feedback|inquiry)\s*(form|page|section)?\b/i,
      /\b(contact\s*us|get\s*in\s*touch|reach\s*out)\s*(form|page|section)?\b/i,
      /\bتواصل|اتصل\s*بنا\b/i,
    ],
    category: 'BUILD',
    intent: 'build_contact',
    action: 'SHOW_WIZARD',
    priority: 3,
    payload: {
      wizardType: 'contact',
      response: {
        en: "Let's create your contact form! I'll help you configure the fields.",
        ar: "لننشئ نموذج الاتصال الخاص بك! سأساعدك في تكوين الحقول."
      }
    }
  },
  {
    patterns: [
      /\b(add|create|build|make|need|want)\s*(a\s*)?(product|shop|store|catalog)\s*(page|section|listing|gallery)?\b/i,
      /\b(e-?commerce|online\s*store|shopping)\b/i,
      /\bمنتجات|متجر\b/i,
    ],
    category: 'BUILD',
    intent: 'build_product',
    action: 'SHOW_WIZARD',
    priority: 3,
    payload: {
      wizardType: 'product',
      response: {
        en: "Let's set up your product catalog! I'll help you add products.",
        ar: "لنقم بإعداد كتالوج المنتجات! سأساعدك في إضافة المنتجات."
      }
    }
  },
  {
    patterns: [
      /\b(add|create|build|make|need|want)\s*(a\s*)?(login|signup|sign\s*up|register|auth)\s*(form|page|system)?\b/i,
      /\b(user\s*authentication|user\s*accounts?)\b/i,
      /\bتسجيل\s*(الدخول|خروج)|حساب\b/i,
    ],
    category: 'BUILD',
    intent: 'build_auth',
    action: 'SHOW_WIZARD',
    priority: 3,
    payload: {
      wizardType: 'auth',
      response: {
        en: "Let's set up authentication! I'll help you configure login options.",
        ar: "لنقم بإعداد المصادقة! سأساعدك في تكوين خيارات تسجيل الدخول."
      }
    }
  },
  {
    patterns: [
      /\b(add|create|build|make)\s*(a\s*)?(gallery|photo|image|picture)\s*(upload|section|page|component)\b/i,
      /\b(add|create|build|make)\s*(a\s*)?(upload|dropzone)\s*(component|section|area)\b/i,
      /\bرفع\s*(صور|ملف)\b/i,
    ],
    category: 'BUILD',
    intent: 'build_media',
    action: 'SHOW_WIZARD',
    priority: 3,
    payload: {
      wizardType: 'media',
      response: {
        en: "Let's create your media upload component! I'll help you configure it.",
        ar: "لننشئ مكون رفع الوسائط! سأساعدك في تكوينه."
      }
    }
  },
  {
    patterns: [
      /\b(add|create|build|make|need|want)\s*(a\s*)?(landing|home|main)\s*(page)?\b/i,
      /\b(hero\s*section|banner|header\s*section)\b/i,
    ],
    category: 'BUILD',
    intent: 'build_landing',
    action: 'CALL_AI',
    priority: 3,
    payload: {
      response: {
        en: "I'll help you create a landing page. Let me generate that for you.",
        ar: "سأساعدك في إنشاء صفحة هبوط. دعني أنشئها لك."
      }
    }
  },

  // -------------------------------------------------------------------------
  // PRIORITY 4: INFO INTENTS (Questions - fallback to AI)
  // -------------------------------------------------------------------------
  {
    patterns: [
      /\b(how\s*do\s*i|how\s*can\s*i|how\s*to|what\s*is|what\s*are|explain|tell\s*me)\b/i,
      /\b(help|assist|guide)\s*(me)?\s*(with|to|on)?\b/i,
    ],
    category: 'INFO',
    intent: 'info_question',
    action: 'CALL_AI',
    priority: 4,
    payload: {
      response: {
        en: "I'll help answer your question.",
        ar: "سأساعدك في الإجابة على سؤالك."
      }
    }
  },
];

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Analyzes a user message and returns the detected intent with action
 * This is the SINGLE entry point for all intent detection
 */
export function analyzeIntent(message: string): IntentResult {
  const lowerMessage = message.toLowerCase().trim();
  
  console.log('[IntentManager] Analyzing message:', lowerMessage);
  
  // Sort patterns by priority (lower = higher priority)
  const sortedPatterns = [...INTENT_PATTERNS].sort((a, b) => a.priority - b.priority);
  
  // Find the first matching pattern
  for (const config of sortedPatterns) {
    for (const pattern of config.patterns) {
      if (pattern.test(lowerMessage)) {
        const result: IntentResult = {
          category: config.category,
          intent: config.intent,
          action: config.action,
          confidence: config.priority === 1 ? 'high' : config.priority === 2 ? 'medium' : 'low',
          payload: config.payload,
          matchedPattern: pattern.toString(),
        };
        
        console.log('[IntentManager] MATCHED:', {
          category: result.category,
          intent: result.intent,
          action: result.action,
          confidence: result.confidence,
        });
        
        return result;
      }
    }
  }
  
  // No match - default to AI chat
  console.log('[IntentManager] No match - defaulting to AI chat');
  
  return {
    category: 'INFO',
    intent: 'none',
    action: 'CALL_AI',
    confidence: 'low',
    payload: {},
  };
}

/**
 * Helper to check if intent requires a wizard
 */
export function requiresWizard(result: IntentResult): boolean {
  return result.action === 'SHOW_WIZARD';
}

/**
 * Helper to check if intent should open a modal
 */
export function requiresModal(result: IntentResult): boolean {
  return result.action === 'OPEN_MODAL';
}

/**
 * Helper to check if intent should navigate
 */
export function requiresNavigation(result: IntentResult): boolean {
  return result.action === 'NAVIGATE';
}

/**
 * Helper to check if intent should call AI directly
 */
export function shouldCallAI(result: IntentResult): boolean {
  return result.action === 'CALL_AI';
}

/**
 * Get wizard type from intent result
 */
export function getWizardType(result: IntentResult): string | null {
  return result.payload.wizardType || null;
}

/**
 * Get modal type from intent result
 */
export function getModalType(result: IntentResult): string | null {
  return result.payload.modalType || null;
}

/**
 * Get response message based on language
 */
export function getResponse(result: IntentResult, isRTL: boolean): string {
  if (!result.payload.response) return '';
  return isRTL ? result.payload.response.ar : result.payload.response.en;
}
