/**
 * Chat Intents - Detects when the user just wants to chat or use existing features
 * instead of always trying to build/plan something new
 */

export type ChatIntent = 
  | 'view_images'     // "Show me images"
  | 'search_images'   // "Find stock photos"
  | 'upload_images'   // "Upload my photos"
  | 'view_products'   // "Show me products"
  | 'view_orders'     // "Show my orders"
  | 'view_bookings'   // "Show appointments"
  | 'none';           // No chat intent detected

export interface ChatAction {
  type: 'navigate' | 'open_modal' | 'chat_response';
  payload?: any;
  response: {
    en: string;
    ar: string;
  };
}

// Chat intent detection patterns
const CHAT_PATTERNS: Record<Exclude<ChatIntent, 'none'>, {
  patterns: RegExp[];
  action: ChatAction;
}> = {
  view_images: {
    patterns: [
      /\b(show|see|view|list|what)\s*(me\s*)?(all\s*)?(the\s*)?(images?|photos?|pictures?|gallery)\b/i,
      /\b(images?|photos?|pictures?|gallery)\s*(on|in|of)\s*(the|this)?\s*(site|page|website)\b/i,
    ],
    action: {
      type: 'open_modal',
      payload: {
        component: 'SmartMediaManager',
        props: { initialTab: 'site' }
      },
      response: {
        en: '🖼️ Here are all the images on your site!\n\nYou can:\n• Click any image to view full size\n• Download or copy the URL\n• Replace with stock photos or upload new ones',
        ar: '🖼️ إليك جميع الصور في موقعك!\n\nيمكنك:\n• النقر على أي صورة لعرضها بالحجم الكامل\n• تحميل أو نسخ الرابط\n• استبدالها بصور مجانية أو رفع صور جديدة'
      }
    }
  },
  search_images: {
    patterns: [
      /\b(search|find|browse|get|freepik|stock)\s*(images?|photos?|pictures?)\b/i,
      /\b(add|insert|use)\s*(stock|freepik)\s*(images?|photos?)\b/i,
    ],
    action: {
      type: 'open_modal',
      payload: {
        component: 'SmartMediaManager',
        props: { initialTab: 'stock' }
      },
      response: {
        en: '🔍 Let\'s find some great stock photos! You can:\n• Search by keyword\n• Browse categories\n• Preview and insert',
        ar: '🔍 دعنا نبحث عن صور رائعة! يمكنك:\n• البحث بالكلمات\n• تصفح الفئات\n• معاينة وإدراج'
      }
    }
  },
  upload_images: {
    patterns: [
      /\b(upload|add\s*my|my\s*own)\s*(images?|photos?|pictures?|files?)\b/i,
    ],
    action: {
      type: 'open_modal',
      payload: {
        component: 'SmartMediaManager',
        props: { initialTab: 'upload' }
      },
      response: {
        en: '⬆️ Ready to upload! You can:\n• Drag & drop files\n• Select from device\n• Paste from clipboard',
        ar: '⬆️ جاهز للرفع! يمكنك:\n• سحب وإفلات الملفات\n• اختيار من جهازك\n• لصق من الحافظة'
      }
    }
  },
  view_products: {
    patterns: [
      /\b(show|see|view|list|what)\s*(all\s*)?(the\s*)?(products?|items?|inventory)\b/i,
      /\b(products?|items?|inventory)\s*(on|in|of)\s*(the|this)?\s*(site|page|store)\b/i,
    ],
    action: {
      type: 'navigate',
      payload: { path: '/products' },
      response: {
        en: '🛍️ Here are all your products! You can:\n• View details\n• Edit products\n• Manage inventory',
        ar: '🛍️ إليك جميع منتجاتك! يمكنك:\n• عرض التفاصيل\n• تعديل المنتجات\n• إدارة المخزون'
      }
    }
  },
  view_orders: {
    patterns: [
      /\b(show|see|view|list|what)\s*(all\s*)?(the\s*)?(orders?|sales?|purchases?)\b/i,
      /\b(my|our|the|all)\s*(orders?|sales?|purchase\s*history)\b/i,
    ],
    action: {
      type: 'navigate',
      payload: { path: '/orders' },
      response: {
        en: '📦 Here are all your orders! You can:\n• View order details\n• Track status\n• Manage fulfillment',
        ar: '📦 إليك جميع طلباتك! يمكنك:\n• عرض تفاصيل الطلب\n• تتبع الحالة\n• إدارة التنفيذ'
      }
    }
  },
  view_bookings: {
    patterns: [
      /\b(show|see|view|list|what)\s*(all\s*)?(the\s*)?(bookings?|appointments?|reservations?)\b/i,
      /\b(my|our|the|all)\s*(bookings?|appointments?|reservations?)\b/i,
    ],
    action: {
      type: 'navigate',
      payload: { path: '/bookings' },
      response: {
        en: '📅 Here are all your bookings! You can:\n• View details\n• Manage schedule\n• Handle changes',
        ar: '📅 إليك جميع حجوزاتك! يمكنك:\n• عرض التفاصيل\n• إدارة الجدول\n• معالجة التغييرات'
      }
    }
  }
};

/**
 * Detects if the user's message is a chat intent vs a build/plan request
 */
export function detectChatIntent(message: string): { 
  intent: ChatIntent; 
  action: ChatAction | null;
} {
  const lowerMessage = message.toLowerCase();
  console.log('[chatIntents] Checking message:', lowerMessage);

  // Check each chat intent
  for (const [intent, config] of Object.entries(CHAT_PATTERNS)) {
    for (const pattern of config.patterns) {
      const matches = pattern.test(lowerMessage);
      console.log('[chatIntents] Pattern:', pattern.toString(), 'matches:', matches);
      if (matches) {
        console.log('[chatIntents] MATCHED intent:', intent);
        return {
          intent: intent as ChatIntent,
          action: config.action
        };
      }
    }
  }

  console.log('[chatIntents] No intent matched');
  // No chat intent found
  return {
    intent: 'none',
    action: null
  };
}
