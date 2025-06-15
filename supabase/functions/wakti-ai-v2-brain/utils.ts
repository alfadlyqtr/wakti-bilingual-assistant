/**
 * Shared helpers and constants for Wakti Edge Function
 */

export const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
export const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
export const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
export const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") || "yzJMWPrRdkJcge2q0yjSOwTGvlhMeOy1";

export function generateNaturalFollowUp(userMessage: string, aiResponse: string, language: string = 'en'): string {
  const followUps = language === 'ar' ? [
    'هل تريد معرفة المزيد عن هذا؟',
    'ما رأيك في هذا؟',
    'هل هذا يساعدك؟',
    'هل لديك أسئلة أخرى؟',
    'ما الذي تريد معرفته أيضا؟'
  ] : [
    'What do you think about this?',
    'Would you like to know more?',
    'Is this helpful for you?',
    'Do you have any other questions?',
    'What else would you like to explore?'
  ];
  
  return followUps[Math.floor(Math.random() * followUps.length)];
}

export function generateModeSuggestion(suggestedMode: string, language: string = 'en'): string {
  if (language === 'ar') {
    switch (suggestedMode) {
      case 'search':
        return "أنا حالياً في وضع المحادثة! للمعلومات الأحدث أو النتائج الفورية، اضغط على زر البحث بالأسفل 🔍";
      case 'image':
        return "محادثتنا الآن نصية، لكن إذا أردت صورة لهذا، جرّب زر الصور بالأسفل 🎨";
      case 'chat':
        return "هذه إجابة مباشرة منّي. إذا أردت دردشة أعمق أو معرفة أكثر، استمر في الحديث هنا! 😊";
      default:
        return "جرّب الوضع المناسب من الأزرار بالأسفل لتحصل على أفضل تجربة!";
    }
  } else {
    switch (suggestedMode) {
      case 'search':
        return "I'm in chat mode! For up-to-date scores or info, just hit the search button below! 🔍";
      case 'image':
        return "We're chatting here—if you want an image for this, tap the image button below! 🎨";
      case 'chat':
        return "That’s a quick answer from me. If you want to chat more, just keep talking! 😊";
      default:
        return "Try the buttons below for the best experience for your request!";
    }
  }
}

export function generateSearchFollowUp(language: string = 'en'): string {
  const followUps = language === 'ar' ? [
    '\n\n🔍 هل تريد البحث عن تفاصيل أكثر؟',
    '\n\n💭 ما الذي يثير اهتمامك في هذا الموضوع؟',
    '\n\n📚 هل تريد معرفة معلومات ذات صلة؟'
  ] : [
    '\n\n🔍 Would you like me to search for more details?',
    '\n\n💭 What interests you most about this topic?',
    '\n\n📚 Want to explore related information?'
  ];
  
  return followUps[Math.floor(Math.random() * followUps.length)];
}

export function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// If you want to share the supabase client:
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
export const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
