import { supabase } from '@/integrations/supabase/client';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: boolean | null;
  inputType?: 'text' | 'voice' | 'vision';
  imageUrl?: string;
  browsingUsed?: boolean;
  browsingData?: any;
  attachedFiles?: any[];
  isTextGenerated?: boolean;
  metadata?: any;
}

export interface AIConversation {
  id: string;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
}

class WaktiAIV2ServiceClass {
  private personalTouchCache: any = null;
  private conversationStorage = new Map<string, AIMessage[]>();

  constructor() {
    console.log('🤖 WAKTI AI SERVICE: Initialized as Backend Worker (Frontend Boss mode)');
    this.loadConversationsFromStorage();
  }

  // Safely get user's personal touch preferences from cache or localStorage
  private getPersonalTouch(): any {
    try {
      if (this.personalTouchCache) return this.personalTouchCache;
      const raw = localStorage.getItem('wakti_personal_touch');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      this.personalTouchCache = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  // Enhanced message handling with session storage
  private getEnhancedMessages(recentMessages: AIMessage[]): AIMessage[] {
    // Combine session storage with current messages
    const storedMessages = this.loadStoredMessages();
    const allMessages = [...storedMessages, ...recentMessages];
    
    // Remove duplicates by ID
    const uniqueMessages = allMessages.filter((msg, index, arr) => 
      arr.findIndex(m => m.id === msg.id) === index
    );
    
    // Sort by timestamp
    uniqueMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Apply smart filtering and return last 20
    return this.smartFilterMessages(uniqueMessages).slice(-20);
  }

  private smartFilterMessages(messages: AIMessage[]): AIMessage[] {
    if (!messages || messages.length === 0) return [];
    
    // Filter out redundant acknowledgments and keep important context
    const redundantPatterns = [
      /^(thank you|thanks|ok|okay|yes|no|sure|alright)$/i,
      /^(شكرا|حسنا|نعم|لا|طيب|ممتاز)$/i
    ];
    
    return messages.filter((msg, index) => {
      // Always keep the last 15 messages to maintain recent context
      if (index >= messages.length - 15) return true;
      
      // Filter out very short redundant responses
      if (msg.content && msg.content.length < 20) {
        return !redundantPatterns.some(pattern => pattern.test(msg.content.trim()));
      }
      
      // Keep longer, meaningful messages
      return true;
    });
  }

  // Generate conversation summary for ultra-fast performance
  private generateConversationSummary(messages: AIMessage[]): string {
    if (!messages || messages.length < 10) return '';
    
    // Take messages except the last 10 for summary (keep last 10 as recent context)
    const summaryMessages = messages.slice(0, -10);
    if (summaryMessages.length === 0) return '';
    
    // Extract key topics and context
    const topics = new Set<string>();
    const userQuestions: string[] = [];
    const assistantActions: string[] = [];
    
    summaryMessages.forEach(msg => {
      if (msg.role === 'user' && msg.content.length > 30) {
        // Extract potential topics/keywords
        const words = msg.content.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4 && !['about', 'could', 'would', 'should', 'please'].includes(word)) {
            topics.add(word);
          }
        });
        
        if (msg.content.includes('?')) {
          userQuestions.push(msg.content.substring(0, 100));
        }
      } else if (msg.role === 'assistant' && msg.actionTaken) {
        assistantActions.push('Action taken');
      }
    });
    
    // Build concise summary
    let summary = '';
    if (topics.size > 0) {
      summary += `Topics discussed: ${Array.from(topics).slice(0, 5).join(', ')}. `;
    }
    if (userQuestions.length > 0) {
      summary += `User asked about: ${userQuestions[userQuestions.length - 1]}. `;
    }
    if (assistantActions.length > 0) {
      summary += `${assistantActions.length} actions performed. `;
    }
    
    return summary.trim();
  }

  private loadStoredMessages(): AIMessage[] {
    try {
      const stored = sessionStorage.getItem('wakti_conversation_memory');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load stored messages:', error);
    }
    return [];
  }

  private saveMessagesToStorage(messages: AIMessage[]) {
    try {
      // Keep only last 100 messages to prevent storage overflow
      const messagesToStore = messages.slice(-100);
      sessionStorage.setItem('wakti_conversation_memory', JSON.stringify(messagesToStore));
    } catch (error) {
      console.warn('Failed to save messages to storage:', error);
    }
  }

  private loadConversationsFromStorage() {
    try {
      const stored = sessionStorage.getItem('wakti_conversations');
      if (stored) {
        const conversations = JSON.parse(stored);
        Object.entries(conversations).forEach(([id, messages]) => {
          this.conversationStorage.set(id, messages as AIMessage[]);
        });
      }
    } catch (error) {
      console.warn('Failed to load conversations from storage:', error);
    }
  }

  private saveConversationsToStorage() {
    try {
      const conversations: Record<string, AIMessage[]> = {};
      this.conversationStorage.forEach((messages, id) => {
        conversations[id] = messages;
      });
      sessionStorage.setItem('wakti_conversations', JSON.stringify(conversations));
    } catch (error) {
      console.warn('Failed to save conversations to storage:', error);
    }
  }

  // Enhanced session management
  saveEnhancedChatSession(messages: AIMessage[], conversationId?: string | null) {
    this.saveMessagesToStorage(messages);
    
    if (conversationId) {
      this.conversationStorage.set(conversationId, messages);
      this.saveConversationsToStorage();
    }
  }

  loadEnhancedChatSession(conversationId?: string | null): AIMessage[] {
    if (conversationId && this.conversationStorage.has(conversationId)) {
      return this.conversationStorage.get(conversationId) || [];
    }
    return this.loadStoredMessages();
  }

  clearEnhancedChatSession(conversationId?: string | null) {
    if (conversationId) {
      this.conversationStorage.delete(conversationId);
      this.saveConversationsToStorage();
    } else {
      sessionStorage.removeItem('wakti_conversation_memory');
      sessionStorage.removeItem('wakti_conversations');
      this.conversationStorage.clear();
    }
  }

  // Allow UI to invalidate personal touch cache after saving settings
  clearPersonalTouchCache() {
    try {
      this.personalTouchCache = null;
    } catch {}
  }

  async sendStreamingMessage(
    message: string,
    userId?: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' | 'vision' = 'text',
    recentMessages: AIMessage[] = [],
    skipContextLoad: boolean = false,
    activeTrigger: string = 'chat',
    conversationSummary: string = '',
    attachedFiles: any[] = [],
    onToken?: (token: string) => void,
    onComplete?: (metadata: any) => void,
    onError?: (error: string) => void,
    signal?: AbortSignal
  ) {
    try {
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');
        userId = user.id;
      }

      // Generate a lightweight requestId for diagnostics across iOS/Safari
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      console.log(`🚀 FRONTEND BOSS: Starting streaming request for ${activeTrigger} mode [${requestId}]`);

      const personalTouch = this.getPersonalTouch();

      // Compute client local hour and welcome-back flag (gap >= 12h)
      const clientLocalHour = new Date().getHours();
      let isWelcomeBack = false;
      try {
        const lastSeenStr = localStorage.getItem('wakti_last_seen_at');
        if (lastSeenStr) {
          const gapMs = Date.now() - Number(lastSeenStr);
          isWelcomeBack = gapMs >= 12 * 60 * 60 * 1000; // 12 hours
        }
      } catch {}

      // Enhanced message handling with 20-message memory
      const enhancedMessages = this.getEnhancedMessages(recentMessages);
      const generatedSummary = this.generateConversationSummary(enhancedMessages);

      // Load stored rolling summary (Supabase by conversation UUID, else local fallback)
      let storedSummary: string | null = null;
      const uuidLike = typeof conversationId === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(conversationId);
      try {
        if (uuidLike) {
          const { data: row } = await supabase
            .from('ai_conversation_summaries')
            .select('summary_text')
            .eq('conversation_id', conversationId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          storedSummary = row?.summary_text || null;
        } else if (conversationId) {
          storedSummary = localStorage.getItem(`wakti_local_summary_${conversationId}`) || null;
        }
      } catch {}

      // Combine provided summary (if any), stored summary, and generated summary
      const pieces = [conversationSummary, storedSummary, generatedSummary].filter((s) => !!(s && s.trim())) as string[];
      let finalSummary = pieces.join(' ').slice(0, 1200);

      // Get auth token for streaming request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session for streaming');
      }
      
      // Mobile-optimized anon key fallback for PWA environments
      let maybeAnonKey;
      try {
        maybeAnonKey = (typeof window !== 'undefined' && (window as any).__SUPABASE_ANON_KEY)
          || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';
      } catch (e) {
        maybeAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU';
      }

      // Mobile-optimized SSE request with retry logic
      const maxRetries = 2;
      let response;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-ai-v2-brain-stream`, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'omit',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'X-Request-ID': requestId,
              'X-Mobile-Request': 'true',
              'apikey': maybeAnonKey
            },
        body: JSON.stringify({
          message,
          language,
          conversationId,
          inputType,
          activeTrigger,
          attachedFiles,
          recentMessages: enhancedMessages,
          conversationSummary: finalSummary,
          personalTouch,
          clientLocalHour,
          isWelcomeBack,
          requestId
            }),
            signal
          });
          
          if (response.ok) break;
          
          if (attempt === maxRetries) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          // Brief delay before retry on mobile networks
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          
        } catch (error: any) {
          if (attempt === maxRetries || error.name === 'AbortError') {
            throw error;
          }
          console.warn(`🔄 Retry attempt ${attempt}/${maxRetries} for mobile request [${requestId}]`);
        }
      }

      if (!response.ok) throw new Error(`Streaming request failed: ${response.status}`);

      // SSE parsing
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body reader available');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let metadata: any = {};
      let encounteredError: string | null = null;
      let isCompleted = false;

      const abortHandler = async () => { try { await reader.cancel(); } catch {} };
      if (signal) {
        if (signal.aborted) {
          await abortHandler();
          throw new Error('Streaming aborted');
        }
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      // Hard timeout to prevent lingering open streams on iOS/Safari
      const TIMEOUT_MS = 120000; // 120s
      const timeoutId = setTimeout(async () => {
        try {
          if (!isCompleted) {
            encounteredError = encounteredError || 'timeout';
            console.warn(`⏱️ FRONTEND BOSS: Streaming timeout [${requestId}] after ${TIMEOUT_MS}ms`);
            onError?.('timeout');
            await reader.cancel();
          }
        } catch {}
      }, TIMEOUT_MS);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (!isCompleted) onComplete?.(metadata);
            console.log(`✅ FRONTEND BOSS: Stream closed cleanly [${requestId}]`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);

            if (data === '[DONE]') {
              if (!isCompleted) { onComplete?.(metadata); isCompleted = true; }
              console.log(`🏁 FRONTEND BOSS: Received [DONE] [${requestId}]`);
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) { encounteredError = parsed.error; continue; }
              if (typeof parsed.token === 'string') { fullResponse += parsed.token; onToken?.(parsed.token); }
              else if (typeof parsed.response === 'string') { fullResponse += parsed.response; onToken?.(parsed.response); }
              if (parsed.metadata && typeof parsed.metadata === 'object') {
                metadata = { ...metadata, ...parsed.metadata };
              }
              if (parsed.done === true) {
                if (!isCompleted) { onComplete?.(parsed.metadata || metadata); isCompleted = true; }
              }
            } catch {
              // Not JSON? Treat as raw token
              fullResponse += data;
              onToken?.(data);
            }
          }
        }
      } finally {
        try { reader.releaseLock(); } catch {}
        if (signal) signal.removeEventListener('abort', abortHandler as any);
        try { localStorage.setItem('wakti_last_seen_at', String(Date.now())); } catch {}
        try { /* clear timeout if set */ /* eslint-disable @typescript-eslint/no-unused-expressions */ (typeof timeoutId !== 'undefined') && clearTimeout(timeoutId); } catch {}
      }

      // Best-effort: persist updated rolling summary after stream
      try {
        const msgsForSummary: AIMessage[] = [
          ...enhancedMessages,
          { id: `user-${Date.now()}`, role: 'user', content: message, timestamp: new Date() } as AIMessage,
          { id: `assistant-${Date.now()}`, role: 'assistant', content: fullResponse, timestamp: new Date() } as AIMessage
        ];
        const updatedSummary = this.generateConversationSummary(msgsForSummary);
        if (updatedSummary && updatedSummary.trim()) {
          const uuidLike2 = typeof conversationId === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(conversationId);
          if (uuidLike2) {
            const { data: existing } = await supabase
              .from('ai_conversation_summaries')
              .select('id')
              .eq('conversation_id', conversationId)
              .limit(1)
              .maybeSingle();
            if (existing?.id) {
              await supabase
                .from('ai_conversation_summaries')
                .update({ summary_text: updatedSummary, message_count: msgsForSummary.length })
                .eq('id', existing.id);
            } else {
              await supabase
                .from('ai_conversation_summaries')
                .insert({ user_id: userId, conversation_id: conversationId, summary_text: updatedSummary, message_count: msgsForSummary.length });
            }
          } else if (conversationId) {
            localStorage.setItem(`wakti_local_summary_${conversationId}`, updatedSummary);
          }
        }
      } catch {}

      if (encounteredError) throw new Error(encounteredError);

      console.log(`✅ FRONTEND BOSS: Streaming completed successfully [${requestId}]`);
      return { response: fullResponse, conversationId, metadata };
    } catch (error: any) {
      console.error('❌ FRONTEND BOSS: Streaming failed:', error);
      onError?.(error.message || 'Streaming failed');
      throw error;
    }
  }

  async sendMessage(
    message: string,
    userId?: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' | 'vision' = 'text',
    recentMessages: AIMessage[] = [],
    skipContextLoad: boolean = false,
    activeTrigger: string = 'chat',
    conversationSummary: string = '',
    attachedFiles: any[] = [],
    signal?: AbortSignal,
    imageMode?: string
  ) {
    try {
      // Ensure user id
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');
        userId = user.id;
      }

      const personalTouch = this.getPersonalTouch();

      // Compute client local hour and welcome-back flag
      const clientLocalHour = new Date().getHours();
      let isWelcomeBack = false;
      try {
        const lastSeenStr = localStorage.getItem('wakti_last_seen_at');
        if (lastSeenStr) {
          const gapMs = Date.now() - Number(lastSeenStr);
          isWelcomeBack = gapMs >= 12 * 60 * 60 * 1000; // 12 hours
        }
      } catch {}

      // Enhanced message handling with 20-message memory
      const enhancedMessages = this.getEnhancedMessages(recentMessages);
      const generatedSummary = this.generateConversationSummary(enhancedMessages);

      // Load stored rolling summary (Supabase by conversation UUID, else local fallback)
      let storedSummary: string | null = null;
      const uuidLike = typeof conversationId === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(conversationId || '');
      try {
        if (uuidLike && conversationId) {
          const { data: row } = await supabase
            .from('ai_conversation_summaries')
            .select('summary_text')
            .eq('conversation_id', conversationId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          storedSummary = (row as any)?.summary_text || null;
        } else if (conversationId) {
          storedSummary = localStorage.getItem(`wakti_local_summary_${conversationId}`) || null;
        }
      } catch {}

      const pieces = [conversationSummary, storedSummary, generatedSummary].filter((s) => !!(s && (s as string).trim())) as string[];
      const finalSummary = pieces.join(' ').slice(0, 1200);

      // Image generation uses non-streaming function; others can reuse streaming and return the final object
      if (activeTrigger === 'image') {
        const payload = {
          message,
          conversationId,
          language,
          attachedFiles,
          activeTrigger: 'image',
          recentMessages: enhancedMessages,
          personalTouch,
          userId,
          imageMode,
          conversationSummary: finalSummary,
          clientLocalHour,
          isWelcomeBack
        };

        const resp = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-ai-v2-brain`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-app-name': 'Wakti AI'
          },
          body: JSON.stringify(payload),
          signal
        });

        if (!resp.ok) {
          throw new Error(`Non-streaming request failed: ${resp.status}`);
        }

        const data = await resp.json();

        // Best-effort: persist updated rolling summary after completion
        try {
          const msgsForSummary: AIMessage[] = [
            ...enhancedMessages,
            { id: `user-${Date.now()}`, role: 'user', content: message, timestamp: new Date() } as AIMessage,
            { id: `assistant-${Date.now()}`, role: 'assistant', content: data?.response || '', timestamp: new Date() } as AIMessage
          ];
          const updatedSummary = this.generateConversationSummary(msgsForSummary);
          if (updatedSummary && updatedSummary.trim()) {
            const uuidLike2 = typeof conversationId === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(conversationId || '');
            if (uuidLike2 && conversationId) {
              const { data: existing } = await supabase
                .from('ai_conversation_summaries')
                .select('id')
                .eq('conversation_id', conversationId)
                .limit(1)
                .maybeSingle();
              if ((existing as any)?.id) {
                await supabase
                  .from('ai_conversation_summaries')
                  .update({ summary_text: updatedSummary, message_count: msgsForSummary.length })
                  .eq('id', (existing as any).id);
              } else {
                await supabase
                  .from('ai_conversation_summaries')
                  .insert({ user_id: userId, conversation_id: conversationId, summary_text: updatedSummary, message_count: msgsForSummary.length });
              }
            } else if (conversationId) {
              localStorage.setItem(`wakti_local_summary_${conversationId}`, updatedSummary);
            }
          }
        } catch {}

        try { localStorage.setItem('wakti_last_seen_at', String(Date.now())); } catch {}

        return data; // { response, imageUrl?, error?, ... }
      }

      // Vision/chat/search accumulation via streaming method under the hood
      const streamed = await this.sendStreamingMessage(
        message,
        userId,
        language,
        conversationId,
        inputType,
        enhancedMessages,
        skipContextLoad,
        activeTrigger,
        finalSummary,
        attachedFiles,
        undefined,
        undefined,
        undefined,
        signal
      );

      const meta = streamed?.metadata || {};
      return {
        response: streamed?.response || '',
        conversationId: streamed?.conversationId || conversationId,
        error: false,
        browsingUsed: meta?.browsingUsed,
        browsingData: meta?.browsingData,
        modelUsed: meta?.model,
        responseTime: meta?.responseTime,
        fallbackUsed: meta?.fallbackUsed
      };
    } catch (error: any) {
      console.error('❌ FRONTEND BOSS: sendMessage failed:', error);
      // Return friendly shape expected by callers
      return {
        response: language === 'ar' ? 'أعتذر، لست متاح حالياً. يرجى المحاولة مرة أخرى.' : "I apologize, I'm not available right now. Please try again.",
        error: true
      };
    }
  }

  // Legacy methods - now handled by frontend
  async getConversations(): Promise<AIConversation[]> {
    console.log('⚠️ BACKEND WORKER: getConversations called - should use frontend memory instead');
    return [];
  }

  async getConversationMessages(conversationId: string): Promise<any[]> {
    console.log('⚠️ BACKEND WORKER: getConversationMessages called - should use frontend memory instead');
    return [];
  }

  async deleteConversation(conversationId: string): Promise<void> {
    console.log('⚠️ BACKEND WORKER: deleteConversation called - should use frontend memory instead');
  }

  saveChatSession(messages: AIMessage[], conversationId?: string | null) {
    console.log('⚠️ BACKEND WORKER: saveChatSession called - should use EnhancedFrontendMemory instead');
  }

  loadChatSession(): { messages: AIMessage[], conversationId?: string | null } | null {
    console.log('⚠️ BACKEND BOSS: loadChatSession called - should use EnhancedFrontendMemory instead');
    return null;
  }

  clearChatSession() {
    console.log('⚠️ BACKEND WORKER: clearChatSession called - should use EnhancedFrontendMemory instead');
  }
}

export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
export { WaktiAIV2ServiceClass };
