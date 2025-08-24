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
      // Always keep the last 10 messages to maintain recent context
      if (index >= messages.length - 10) return true;
      
      // Filter out very short redundant responses
      if (msg.content && msg.content.length < 20) {
        return !redundantPatterns.some(pattern => pattern.test(msg.content.trim()));
      }
      
      // Keep longer, meaningful messages
      return true;
    });
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
      // Keep only last 50 messages to prevent storage overflow
      const messagesToStore = messages.slice(-50);
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
    onError?: (error: string) => void
  ) {
    try {
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');
        userId = user.id;
      }

      console.log(`🚀 FRONTEND BOSS: Starting streaming request for ${activeTrigger} mode`);

      const personalTouch = this.getPersonalTouch();

      // Get auth token for streaming request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session for streaming');
      }

      const response = await fetch(`https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/wakti-ai-v2-brain-stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          message,
          language,
          conversationId: conversationId,
          inputType,
          activeTrigger,
          attachedFiles,
          recentMessages: this.getEnhancedMessages(recentMessages), // Enhanced message handling
          personalTouch: personalTouch
        })
      });

      if (!response.ok) {
        throw new Error(`Streaming request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let metadata = {};

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.token && !parsed.done) {
                  fullResponse += parsed.token;
                  onToken?.(parsed.token);
                } else if (parsed.done) {
                  metadata = {
                    model: parsed.model,
                    fallbackUsed: parsed.fallbackUsed,
                    responseTime: parsed.responseTime,
                    browsingUsed: parsed.browsingUsed,
                    browsingData: parsed.browsingData
                  };
                  onComplete?.(metadata);
                } else if (parsed.error) {
                  onError?.(parsed.error);
                  break;
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      console.log(`✅ FRONTEND BOSS: Streaming completed successfully`);

      return {
        response: fullResponse,
        success: true,
        conversationId: conversationId,
        intent: activeTrigger,
        confidence: 'high',
        ...metadata
      };

    } catch (error: any) {
      console.error('❌ FRONTEND BOSS: Streaming error:', error);
      onError?.(error.message);
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
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!userId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Authentication required');
          userId = user.id;
        }

        console.log(`🤖 FRONTEND BOSS: Attempt ${attempt}/${maxRetries} - Sending to backend worker for ${activeTrigger} mode`, {
          imageMode: imageMode || 'none'
        });

        const personalTouch = this.getPersonalTouch();

        // Simplified timeout - backend worker handles processing
        const timeoutDuration = 30000; // 30s to accommodate image generation
        
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
              recentMessages: this.getEnhancedMessages(recentMessages), // Enhanced message handling
              personalTouch: personalTouch,
              imageMode: imageMode // Pass imageMode to backend
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
          browsingData: data.browsingData,
          metadata: {
            runwareCost: data.runwareCost,
            modelUsed: data.modelUsed,
            responseTime: data.responseTime,
            imageMode: imageMode
          }
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
