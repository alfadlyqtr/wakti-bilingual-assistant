
import { supabase } from '@/integrations/supabase/client';
import { PerformanceCache } from './PerformanceCache';
import { WaktiAIV2Service, AIMessage } from './WaktiAIV2Service';

class OptimizedWaktiAIServiceClass {
  private conversationSummaries = new Map<string, string>();

  // Optimized auth with caching
  private async getAuthenticatedUser(forceRefresh = false) {
    const authHeader = `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`;
    
    if (!forceRefresh) {
      const cached = PerformanceCache.getCachedAuth(authHeader);
      if (cached) return cached;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Authentication failed');

    // Cache for 10 minutes
    PerformanceCache.cacheAuth(authHeader, user, 600000);
    return user;
  }

  // Smart context loading - only when needed
  private async getSmartContext(message: string, userId: string) {
    if (!PerformanceCache.needsCalendarContext(message)) {
      return { calendarContext: null, userContext: null };
    }

    const cacheKey = `context_${userId}`;
    const cached = PerformanceCache.get(cacheKey);
    if (cached) return cached;

    console.log('🧠 Loading calendar context for relevant query:', message.slice(0, 50));

    const [calendarContext, userContext] = await Promise.all([
      WaktiAIV2Service.getCalendarContext(userId),
      WaktiAIV2Service.getUserContext(userId)
    ]);

    const context = { calendarContext, userContext };
    PerformanceCache.set(cacheKey, context, 600000); // 10 minutes
    return context;
  }

  // Optimized message history with summarization
  private async getOptimizedMessageHistory(conversationId: string | null, sessionMessages: AIMessage[]) {
    if (!conversationId && sessionMessages.length <= 10) {
      return sessionMessages;
    }

    const cacheKey = `history_${conversationId || 'session'}`;
    const cached = PerformanceCache.get<AIMessage[]>(cacheKey);
    if (cached) return [...cached, ...sessionMessages.slice(-5)];

    let conversationMessages: AIMessage[] = [];
    
    if (conversationId) {
      const dbMessages = await WaktiAIV2Service.getConversationMessages(conversationId);
      conversationMessages = dbMessages.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at),
        intent: msg.intent,
        confidence: msg.confidence_level as 'high' | 'medium' | 'low',
        actionTaken: !!msg.action_taken,
        inputType: msg.input_type as 'text' | 'voice'
      }));
    }

    const allMessages = [...conversationMessages, ...sessionMessages];
    
    // If more than 20 messages, summarize older ones
    if (allMessages.length > 20) {
      const recentMessages = allMessages.slice(-10);
      const olderMessages = allMessages.slice(0, -10);
      
      // Create summary of older messages (simplified)
      const summary = this.createMessageSummary(olderMessages);
      const summaryMessage: AIMessage = {
        id: 'summary',
        role: 'assistant',
        content: `[CONTEXT SUMMARY] ${summary}`,
        timestamp: new Date(),
        intent: 'context_summary',
        confidence: 'high'
      };

      const optimizedHistory = [summaryMessage, ...recentMessages];
      PerformanceCache.set(cacheKey, optimizedHistory, 300000); // 5 minutes
      return optimizedHistory;
    }

    PerformanceCache.set(cacheKey, allMessages, 300000);
    return allMessages;
  }

  private createMessageSummary(messages: AIMessage[]): string {
    const topics = new Set<string>();
    let taskCount = 0;
    let questionCount = 0;

    messages.forEach(msg => {
      if (msg.role === 'user') {
        if (msg.content.includes('task') || msg.content.includes('reminder')) taskCount++;
        if (msg.content.includes('?')) questionCount++;
        
        // Extract key topics (simplified)
        const words = msg.content.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.length > 4 && !['what', 'when', 'where', 'how', 'can', 'will', 'would'].includes(word)) {
            topics.add(word);
          }
        });
      }
    });

    return `Previous conversation covered ${Array.from(topics).slice(0, 5).join(', ')}. ${taskCount} tasks discussed, ${questionCount} questions asked.`;
  }

  // Main optimized send message method
  async sendOptimizedMessage(
    message: string,
    conversationId: string | null,
    sessionMessages: AIMessage[],
    language: string = 'en',
    inputType: 'text' | 'voice' = 'text',
    activeTrigger: string = 'chat',
    attachedFiles: any[] = []
  ) {
    try {
      console.log('🚀 Optimized AI request starting');
      const startTime = Date.now();

      // Fast auth check
      const user = await this.getAuthenticatedUser();
      console.log(`⚡ Auth: ${Date.now() - startTime}ms`);

      // Smart context loading
      const authTime = Date.now();
      const { calendarContext, userContext } = await this.getSmartContext(message, user.id);
      console.log(`🧠 Context: ${Date.now() - authTime}ms`);

      // Optimized message history
      const contextTime = Date.now();
      const optimizedHistory = await this.getOptimizedMessageHistory(conversationId, sessionMessages);
      console.log(`📚 History: ${Date.now() - contextTime}ms`);

      // Send to AI with optimized data
      const historyTime = Date.now();
      const response = await WaktiAIV2Service.sendMessage(
        message,
        user.id,
        language,
        conversationId,
        inputType,
        optimizedHistory,
        false,
        activeTrigger,
        null,
        attachedFiles,
        calendarContext,
        userContext
      );

      console.log(`🤖 AI Response: ${Date.now() - historyTime}ms`);
      console.log(`🚀 Total optimized request: ${Date.now() - startTime}ms`);

      return response;
    } catch (error) {
      console.error('❌ Optimized AI request failed:', error);
      throw error;
    }
  }
}

export const OptimizedWaktiAIService = new OptimizedWaktiAIServiceClass();
