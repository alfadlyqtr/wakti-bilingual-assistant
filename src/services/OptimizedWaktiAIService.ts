
import { supabase } from '@/integrations/supabase/client';
import { performanceCache } from './PerformanceCache';

interface OptimizedAIRequest {
  message: string;
  userId: string;
  language: string;
  conversationId?: string | null;
  inputType?: 'text' | 'voice';
}

interface OptimizedAIResponse {
  response: string;
  conversationId?: string;
  quotaUsed: number;
  cached?: boolean;
}

class OptimizedWaktiAIService {
  private readonly RESPONSE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private generateCacheKey(message: string, userId: string, language: string): string {
    // Create a simple hash for caching similar requests
    const hash = btoa(message + userId + language).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    return `ai_response_${hash}`;
  }

  async getOptimizedAIResponse(request: OptimizedAIRequest): Promise<OptimizedAIResponse> {
    try {
      // Check cache for similar recent requests
      const cacheKey = this.generateCacheKey(request.message, request.userId, request.language);
      const cachedResponse = performanceCache.get<OptimizedAIResponse>(cacheKey);
      
      if (cachedResponse) {
        console.log('🚀 Returning cached AI response');
        return { ...cachedResponse, cached: true };
      }

      // Get optimized context (cached if possible)
      const context = await this.getOptimizedContext(request.userId);
      
      // Make the AI request
      const response = await this.callAIEdgeFunction({
        ...request,
        context
      });

      // Cache successful responses
      if (response.response) {
        performanceCache.set(cacheKey, response, this.RESPONSE_CACHE_TTL);
      }

      return response;

    } catch (error) {
      console.error('Error in optimized AI service:', error);
      throw error;
    }
  }

  private async getOptimizedContext(userId: string) {
    const contextCacheKey = `ai_context_${userId}`;
    const cachedContext = performanceCache.get(contextCacheKey);
    
    if (cachedContext) {
      return cachedContext;
    }

    try {
      // Fetch minimal context data in parallel
      const [calendarData, userProfile] = await Promise.all([
        this.getRecentCalendarEvents(userId),
        this.getUserProfile(userId)
      ]);

      const context = {
        calendar: calendarData,
        profile: userProfile,
        timestamp: new Date().toISOString()
      };

      performanceCache.set(contextCacheKey, context, this.CONTEXT_CACHE_TTL);
      return context;

    } catch (error) {
      console.error('Error fetching optimized context:', error);
      return {};
    }
  }

  private async getRecentCalendarEvents(userId: string) {
    try {
      const { data } = await supabase
        .from('tr_tasks')
        .select('id, title, due_date, due_time, completed')
        .eq('user_id', userId)
        .eq('completed', false)
        .order('due_date', { ascending: true })
        .limit(10);

      return data || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }

  private async getUserProfile(userId: string) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, settings')
        .eq('id', userId)
        .single();

      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  private async callAIEdgeFunction(request: any): Promise<OptimizedAIResponse> {
    try {
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/unified-ai-brain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        response: data.response || 'I apologize, but I encountered an error processing your request.',
        conversationId: data.conversationId,
        quotaUsed: data.response?.length || 0
      };

    } catch (error) {
      console.error('Error calling AI edge function:', error);
      throw error;
    }
  }

  clearCache(userId?: string) {
    if (userId) {
      performanceCache.clear(`ai_response_${userId}`);
      performanceCache.clear(`ai_context_${userId}`);
    } else {
      performanceCache.clear('ai_response_');
      performanceCache.clear('ai_context_');
    }
  }
}

export const optimizedWaktiAIService = new OptimizedWaktiAIService();
