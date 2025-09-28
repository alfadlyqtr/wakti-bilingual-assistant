import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { executeRegularSearch } from './search.ts'

{{ ... }}
    } else {
      if (recentMessages && recentMessages.length > 0) {
        const historyMessages = recentMessages.slice(-6);
        historyMessages.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({
              role: msg.role,
              content: msg.content
            });
          }
        });
        console.log(`🧠 STREAMING: Using ${historyMessages.length} messages from conversation history`);
      }
      
      // Inject web search context when in Search mode (non-vision)
      if (activeTrigger === 'search') {
        try {
          const s = await executeRegularSearch(message, responseLanguage);
          if (s?.success && s?.context) {
            // Emit metadata to the client with lightweight summary of search
            try {
              const metaPayload = {
                metadata: {
                  search: {
                    answer: s.data?.answer || null,
                    total: s.data?.total_results || 0,
                    results: Array.isArray(s.data?.results) ? s.data.results.slice(0, 5) : []
                  }
                }
              };
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(metaPayload)}\n\n`));
            } catch {}
            
            const ctxPrefix = responseLanguage === 'ar'
              ? 'سياق من بحث الويب (استخدمه للإجابة بدقيقة):\n'
              : 'Context from web search (use it to answer accurately):\n';
            messages.push({
              role: 'user',
              content: ctxPrefix + s.context
            });
            console.log('� STREAMING: Web search context injected');
          } else {
            console.log('🔎 STREAMING: No web search context available or search disabled');
          }
        } catch (e) {
          console.warn('� STREAMING: Web search injection failed:', e);
        }
      }
       
       // Add language enforcement directly in the user message
       const languagePrefix = responseLanguage === 'ar' 
         ? 'يرجى الرد باللغة العربية فقط. ' 
         : 'Please respond in English only. ';
       
       messages.push({
         role: 'user',
         content: languagePrefix + message
       });
    }
{{ ... }}