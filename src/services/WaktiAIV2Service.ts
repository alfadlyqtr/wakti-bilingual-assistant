
import { supabase } from '@/integrations/supabase/client';
import { AIResponseCache } from './AIResponseCache';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: boolean | string;
  inputType?: 'text' | 'voice';
  browsingUsed?: boolean;
  browsingData?: any;
  imageUrl?: string;
  isTextGenerated?: boolean;
  actionResult?: any;
  userProfile?: any;
  needsConfirmation?: boolean;
  pendingTaskData?: any;
  pendingReminderData?: any;
  attachedFiles?: any[];
}

export interface AIConversation {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  message_count: number;
}

// ULTRA-FAST: Message compression utilities
class MessageCompressor {
  static compressHistory(messages: AIMessage[]): { summary: string; recentMessages: AIMessage[] } {
    if (messages.length <= 5) {
      return { summary: '', recentMessages: messages };
    }

    const recentMessages = messages.slice(-3); // Keep last 3 messages
    const oldMessages = messages.slice(0, -3);
    
    // Create simple summary of older messages
    const summary = this.createSummary(oldMessages);
    
    return { summary, recentMessages };
  }

  private static createSummary(messages: AIMessage[]): string {
    if (messages.length === 0) return '';
    
    const topics = new Set<string>();
    const actions = [];
    
    messages.forEach(msg => {
      if (msg.intent) topics.add(msg.intent);
      if (msg.actionTaken) actions.push(msg.content.substring(0, 50));
    });
    
    let summary = `Previous conversation covered: ${Array.from(topics).join(', ')}.`;
    if (actions.length > 0) {
      summary += ` Actions taken: ${actions.join('; ')}.`;
    }
    
    return summary;
  }
}

// ULTRA-FAST: Auth cache manager
class AuthCache {
  private static cache: { userId: string; token: string; expires: number } | null = null;
  
  static async getValidAuth(): Promise<{ userId: string; token: string } | null> {
    // Check cache first
    if (this.cache && Date.now() < this.cache.expires) {
      return { userId: this.cache.userId, token: this.cache.token };
    }
    
    // Get fresh auth using getSession to get both user and session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || !session) return null;
    
    // Cache for 10 minutes
    this.cache = {
      userId: session.user.id,
      token: session.access_token,
      expires: Date.now() + (10 * 60 * 1000)
    };
    
    return { userId: session.user.id, token: session.access_token };
  }
  
  static clearCache() {
    this.cache = null;
  }
}

// ULTRA-FAST: Local memory cache
class LocalMemoryCache {
  private static readonly STORAGE_KEY = 'wakti_ai_memory';
  private static readonly MAX_MESSAGES = 5;
  
  static saveMessages(conversationId: string | null, messages: AIMessage[]) {
    try {
      const memory = {
        conversationId,
        messages: messages.slice(-this.MAX_MESSAGES),
        timestamp: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memory));
    } catch (e) {
      console.warn('Failed to save local memory:', e);
    }
  }
  
  static loadMessages(): { conversationId: string | null; messages: AIMessage[] } | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;
      
      const memory = JSON.parse(stored);
      
      // Check if memory is less than 1 hour old
      if (Date.now() - memory.timestamp > 60 * 60 * 1000) {
        localStorage.removeItem(this.STORAGE_KEY);
        return null;
      }
      
      return {
        conversationId: memory.conversationId,
        messages: memory.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      };
    } catch (e) {
      console.warn('Failed to load local memory:', e);
      return null;
    }
  }
  
  static clearMemory() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export class WaktiAIV2ServiceClass {
  // ULTRA-FAST: Enhanced message sending with aggressive caching
  static async sendMessage(
    message: string,
    userId?: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' = 'text',
    conversationHistory: any[] = [],
    confirmSearch: boolean = false,
    activeTrigger: string = 'chat',
    textGenParams: any = null,
    attachedFiles: any[] = [],
    calendarContext: any = null,
    userContext: any = null,
    enableAdvancedIntegration: boolean = true,
    enablePredictiveInsights: boolean = true,
    enableWorkflowAutomation: boolean = true,
    confirmTask: boolean = false,
    confirmReminder: boolean = false,
    pendingTaskData: any = null,
    pendingReminderData: any = null
  ) {
    try {
      console.log('⚡ ULTRA-FAST AI: Message processing initiated');
      const startTime = Date.now();
      
      // ULTRA-FAST: Check cache first for basic responses (but skip for files)
      if (!attachedFiles?.length && activeTrigger === 'chat' && message.length < 100) {
        const cachedResponse = AIResponseCache.getCachedResponse(message);
        if (cachedResponse) {
          console.log('⚡ CACHE HIT: Returning cached response instantly');
          return {
            response: cachedResponse,
            conversationId: conversationId || this.generateConversationId(),
            intent: 'cached_response',
            confidence: 'high',
            success: true,
            cached: true,
            processingTime: Date.now() - startTime
          };
        }
      }
      
      // ULTRA-FAST: Get cached auth
      const auth = await AuthCache.getValidAuth();
      if (!auth) throw new Error('Authentication failed');
      
      // ULTRA-FAST: Compress message history
      const { summary, recentMessages } = MessageCompressor.compressHistory(conversationHistory);
      
      // ULTRA-FAST: Process attached files with document support
      let processedFiles = attachedFiles;
      if (attachedFiles?.length > 0) {
        processedFiles = await this.processOptimizedFiles(attachedFiles);
      }
      
      // ULTRA-FAST: Direct API call with optimized payload
      const response = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId: auth.userId,
          language,
          conversationId,
          inputType,
          activeTrigger,
          attachedFiles: processedFiles,
          conversationSummary: summary,
          recentMessages: recentMessages.slice(-3),
          // Ultra-fast mode flag
          ultraFastMode: true
        },
        headers: {
          'x-auth-token': auth.token,
          'x-skip-auth': 'true'
        }
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`⚡ ULTRA-FAST AI: Response received in ${responseTime}ms`);
      
      if (response.error) {
        throw new Error(response.error.message || 'AI service error');
      }
      
      // Cache simple responses for future use (only basic chat without files)
      if (activeTrigger === 'chat' && !attachedFiles?.length && message.length < 50) {
        AIResponseCache.setCachedResponse(message, response.data.response);
      }
      
      // FIRE-AND-FORGET: Quota logging
      this.logQuotaAsync(auth.userId, inputType, responseTime).catch(e => 
        console.warn('Quota logging failed silently:', e)
      );
      
      return response.data;
    } catch (error: any) {
      console.error('⚡ ULTRA-FAST AI: Service error:', error);
      throw error;
    }
  }
  
  // Enhanced file processing with document support
  private static async processOptimizedFiles(attachedFiles: any[]): Promise<any[]> {
    if (!attachedFiles?.length) return [];
    
    return attachedFiles.map(file => {
      // Handle different file types
      if (file.type?.startsWith('image/')) {
        // Image files for OpenAI Vision
        if (file.optimized && file.publicUrl) {
          return {
            type: 'image_url',
            image_url: {
              url: file.publicUrl
            },
            name: file.name
          };
        }
        
        if (file.content) {
          return {
            type: 'image_url',
            image_url: {
              url: `data:${file.type};base64,${file.content}`
            },
            name: file.name
          };
        }
      } else if (file.type === 'text/plain' || 
                 file.type === 'application/pdf' || 
                 file.type?.includes('document')) {
        // Document files
        return {
          type: 'document',
          content: file.content,
          name: file.name,
          fileType: file.type
        };
      }
      
      return null;
    }).filter(Boolean);
  }

  private static generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // FIRE-AND-FORGET: Non-blocking quota logging
  private static async logQuotaAsync(userId: string, inputType: string, responseTime: number) {
    try {
      // This runs in background without blocking user experience
      setTimeout(async () => {
        await supabase.functions.invoke('log-quota-usage', {
          body: { userId, inputType, responseTime }
        });
      }, 0);
    } catch (e) {
      // Silent failure - never block user experience
    }
  }
  
  // Instance methods for compatibility
  saveChatSession(messages: AIMessage[], conversationId: string | null) {
    LocalMemoryCache.saveMessages(conversationId, messages);
  }
  
  loadChatSession() {
    return LocalMemoryCache.loadMessages();
  }
  
  clearChatSession() {
    LocalMemoryCache.clearMemory();
  }
  
  sendMessage(
    message: string,
    userId: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' = 'text',
    conversationHistory: any[] = [],
    confirmSearch: boolean = false,
    activeTrigger: string = 'chat',
    textGenParams: any = null,
    attachedFiles: any[] = [],
    calendarContext: any = null,
    userContext: any = null,
    enableAdvancedIntegration: boolean = true,
    enablePredictiveInsights: boolean = true,
    enableWorkflowAutomation: boolean = true,
    confirmTask: boolean = false,
    confirmReminder: boolean = false,
    pendingTaskData: any = null,
    pendingReminderData: any = null
  ) {
    return WaktiAIV2ServiceClass.sendMessage(
      message, userId, language, conversationId, inputType, conversationHistory,
      confirmSearch, activeTrigger, textGenParams, attachedFiles, calendarContext,
      userContext, enableAdvancedIntegration, enablePredictiveInsights,
      enableWorkflowAutomation, confirmTask, confirmReminder, pendingTaskData, pendingReminderData
    );
  }
  
  // ULTRA-FAST: Streamlined conversation operations
  static async getConversations(): Promise<AIConversation[]> {
    try {
      const auth = await AuthCache.getValidAuth();
      if (!auth) throw new Error('Authentication required');
      
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', auth.userId)
        .order('last_message_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }
  
  getConversations() {
    return WaktiAIV2ServiceClass.getConversations();
  }
  
  static async getConversationMessages(conversationId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching conversation messages:', error);
      throw error;
    }
  }
  
  getConversationMessages(conversationId: string) {
    return WaktiAIV2ServiceClass.getConversationMessages(conversationId);
  }
  
  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      const [messagesResult, conversationResult] = await Promise.all([
        supabase.from('ai_chat_history').delete().eq('conversation_id', conversationId),
        supabase.from('ai_conversations').delete().eq('id', conversationId)
      ]);
      
      if (messagesResult.error) throw messagesResult.error;
      if (conversationResult.error) throw conversationResult.error;
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }
  
  deleteConversation(conversationId: string) {
    return WaktiAIV2ServiceClass.deleteConversation(conversationId);
  }
}

export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
