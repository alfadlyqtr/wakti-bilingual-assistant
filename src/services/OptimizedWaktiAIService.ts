
import { supabase } from '@/integrations/supabase/client';
import { PerformanceCache } from './PerformanceCache';
import { WaktiAIV2Service, AIMessage } from './WaktiAIV2Service';

class OptimizedWaktiAIServiceClass {
  private conversationSummaries = new Map<string, string>();

  // Enhanced auth with better error handling and caching
  private async getAuthenticatedUser(forceRefresh = false) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const authHeader = `Bearer ${session.access_token}`;
      
      if (!forceRefresh) {
        const cached = PerformanceCache.getCachedAuth(authHeader);
        if (cached) {
          console.log('🎯 Using cached auth user');
          return cached;
        }
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error('❌ Auth error:', error);
        throw new Error('Authentication failed');
      }

      // Cache for 10 minutes
      PerformanceCache.cacheAuth(authHeader, user, 600000);
      console.log('✅ Auth user cached');
      return user;
    } catch (error) {
      console.error('❌ Authentication error:', error);
      throw error;
    }
  }

  // Enhanced smart context loading with request deduplication
  private async getSmartContext(message: string, userId: string) {
    if (!PerformanceCache.needsCalendarContext(message)) {
      return { calendarContext: null, userContext: null };
    }

    const cacheKey = `context_${userId}`;
    
    return PerformanceCache.deduplicate(cacheKey, async () => {
      const cached = PerformanceCache.get(cacheKey);
      if (cached) {
        console.log('🎯 Using cached context');
        return cached;
      }

      console.log('🧠 Loading calendar context for relevant query:', message.slice(0, 50));

      const [calendarContext, userContext] = await Promise.all([
        WaktiAIV2Service.getCalendarContext(userId),
        WaktiAIV2Service.getUserContext(userId)
      ]);

      const context = { calendarContext, userContext };
      PerformanceCache.set(cacheKey, context, 600000); // 10 minutes
      return context;
    });
  }

  // Enhanced message history with better summarization
  private async getOptimizedMessageHistory(conversationId: string | null, sessionMessages: AIMessage[]) {
    if (!conversationId && sessionMessages.length <= 10) {
      return sessionMessages;
    }

    const cacheKey = `history_${conversationId || 'session'}`;
    
    return PerformanceCache.deduplicate(cacheKey, async () => {
      const cached = PerformanceCache.get<AIMessage[]>(cacheKey);
      if (cached) {
        console.log('🎯 Using cached message history');
        return [...cached, ...sessionMessages.slice(-5)];
      }

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
        
        // Create enhanced summary of older messages
        const summary = this.createEnhancedMessageSummary(olderMessages);
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
    });
  }

  private createEnhancedMessageSummary(messages: AIMessage[]): string {
    const topics = new Set<string>();
    const intents = new Set<string>();
    let taskCount = 0;
    let questionCount = 0;
    let actionCount = 0;

    messages.forEach(msg => {
      if (msg.role === 'user') {
        if (msg.content.includes('task') || msg.content.includes('reminder')) taskCount++;
        if (msg.content.includes('?')) questionCount++;
        if (msg.intent) intents.add(msg.intent);
        if (msg.actionTaken) actionCount++;
        
        // Extract key topics (enhanced)
        const words = msg.content.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4 && !['what', 'when', 'where', 'how', 'can', 'will', 'would', 'could', 'should'].includes(word)) {
            topics.add(word.replace(/[^a-z]/g, ''));
          }
        });
      }
    });

    const topicsList = Array.from(topics).slice(0, 5).join(', ');
    const intentsList = Array.from(intents).slice(0, 3).join(', ');

    return `Previous conversation (${messages.length} messages) covered: ${topicsList}. Main intents: ${intentsList}. Tasks discussed: ${taskCount}, Questions: ${questionCount}, Actions taken: ${actionCount}.`;
  }

  // Main optimized send message method with enhanced performance
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

      // Fast auth check with deduplication
      const user = await this.getAuthenticatedUser();
      console.log(`⚡ Auth: ${Date.now() - startTime}ms`);

      // Smart context loading with caching
      const authTime = Date.now();
      const contextResult = await this.getSmartContext(message, user.id);
      const { calendarContext, userContext } = contextResult;
      console.log(`🧠 Context: ${Date.now() - authTime}ms`);

      // Optimized message history with deduplication
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

      // Invalidate relevant caches after successful response
      if (response.actionTaken) {
        console.log('🗑️ Invalidating caches due to action taken');
        PerformanceCache.invalidate(`context_${user.id}`);
        PerformanceCache.invalidate('maw3d_events');
      }

      return response;
    } catch (error) {
      console.error('❌ Optimized AI request failed:', error);
      throw error;
    }
  }

  // Cache management methods
  clearCache() {
    PerformanceCache.clear();
    this.conversationSummaries.clear();
    console.log('🧹 AI service cache cleared');
  }

  getCacheStats() {
    return {
      ...PerformanceCache.getStats(),
      conversationSummaries: this.conversationSummaries.size
    };
  }
}

export const OptimizedWaktiAIService = new OptimizedWaktiAIServiceClass();
