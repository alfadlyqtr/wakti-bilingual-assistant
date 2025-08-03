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
}

export interface AIConversation {
  id: string;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
}

class WaktiAIV2ServiceClass {
  private personalTouchCache: any = null;

  constructor() {
    console.log('🤖 WAKTI AI SERVICE: Initialized as Backend Worker (Frontend Boss mode)');
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
    attachedFiles: any[] = []
  ) {
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Authentication required');
          userId = user.id;
        }

        console.log(`🤖 FRONTEND BOSS: Attempt ${attempt}/${maxRetries} - Sending to backend worker for ${activeTrigger} mode`);

        const personalTouch = this.getPersonalTouch();

        // Simplified timeout - backend worker handles processing
        const timeoutDuration = 20000; // 20s for all requests
        
        console.log(`⏱️ FRONTEND BOSS: Using ${timeoutDuration/1000}s timeout for backend communication`);

        // FRONTEND BOSS: Send to backend worker with minimal payload
        const { data, error } = await Promise.race([
          supabase.functions.invoke('wakti-ai-v2-brain', {
            body: {
              message,
              language,
              conversationId: conversationId,
              inputType,
              activeTrigger,
              attachedFiles,
              recentMessages: recentMessages.slice(-6), // Send last 6 messages for context
              personalTouch: personalTouch
            }
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Frontend timeout - Backend worker took too long (>${timeoutDuration/1000}s)`)), timeoutDuration)
          )
        ]) as any;

        if (error) {
          console.error(`❌ FRONTEND BOSS: Attempt ${attempt} failed:`, error);
          lastError = error;
          
          // Don't retry on specific errors
          if (error.message?.includes('Authentication') || 
              error.message?.includes('API key') ||
              error.message?.includes('Invalid image')) {
            throw error;
          }
          
          if (attempt < maxRetries) {
            console.log(`🔄 FRONTEND BOSS: Retrying in ${attempt}s...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            continue;
          }
          
          throw error;
        }

        // Success - create response message
        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response || 'I apologize, but I encountered an issue processing your request.',
          timestamp: new Date(),
          intent: data.intent,
          confidence: data.confidence as 'high' | 'medium' | 'low',
          actionTaken: data.actionTaken,
          imageUrl: data.imageUrl,
          browsingUsed: data.browsingUsed,
          browsingData: data.browsingData
        };

        console.log(`✅ FRONTEND BOSS: Successfully received response from backend worker`);

        return {
          ...data,
          conversationId: conversationId,
          response: assistantMessage.content
        };

      } catch (error: any) {
        lastError = error;
        console.error(`❌ FRONTEND BOSS: Attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          break;
        }
      }
    }

    // All attempts failed
    console.error('❌ FRONTEND BOSS: All attempts failed, returning error');
    
    // Provide specific error messages based on error type
    let errorMessage = 'I apologize, but I encountered an issue processing your request.';
    if (language === 'ar') {
      errorMessage = 'أعتذر، واجهت مشكلة في معالجة طلبك.';
    }
    
    if (lastError?.message?.includes('timeout')) {
      errorMessage = language === 'ar' 
        ? 'أعتذر، استغرق الطلب وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى.'
        : 'I apologize, the request took longer than expected. Please try again.';
    } else if (lastError?.message?.includes('network') || lastError?.message?.includes('fetch')) {
      errorMessage = language === 'ar'
        ? 'أعتذر، حدثت مشكلة في الاتصال. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.'
        : 'I apologize, there was a connection issue. Please check your internet connection and try again.';
    }

    throw new Error(errorMessage);
  }

  private getPersonalTouch() {
    try {
      const stored = localStorage.getItem('wakti_personal_touch');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  clearPersonalTouchCache() {
    this.personalTouchCache = null;
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
    console.log('⚠️ BACKEND WORKER: loadChatSession called - should use EnhancedFrontendMemory instead');
    return null;
  }

  clearChatSession() {
    console.log('⚠️ BACKEND WORKER: clearChatSession called - should use EnhancedFrontendMemory instead');
  }
}

export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
export { WaktiAIV2ServiceClass };
