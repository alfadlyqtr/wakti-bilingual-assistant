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

// ULTRA-FAST: Optimized message compression with size limits
class MessageCompressor {
  static compressHistory(messages: AIMessage[]): { summary: string; recentMessages: AIMessage[] } {
    // Reduced from 5 to 3 messages for faster processing
    if (messages.length <= 3) {
      return { summary: '', recentMessages: messages };
    }

    // Reduced from 3 to 2 recent messages for speed
    const recentMessages = messages.slice(-2);
    const oldMessages = messages.slice(0, -2);
    
    // Skip compression for very short conversations (speed optimization)
    if (oldMessages.length <= 2) {
      return { summary: '', recentMessages: messages.slice(-3) };
    }
    
    // Create minimal summary of older messages
    const summary = this.createMinimalSummary(oldMessages);
    
    return { summary, recentMessages };
  }

  private static createMinimalSummary(messages: AIMessage[]): string {
    if (messages.length === 0) return '';
    
    // Simplified summary creation for speed
    const topics = new Set<string>();
    let actionCount = 0;
    
    messages.forEach(msg => {
      if (msg.intent && msg.intent !== 'chat_response') topics.add(msg.intent);
      if (msg.actionTaken) actionCount++;
    });
    
    // Minimal summary format for faster processing
    let summary = '';
    if (topics.size > 0) {
      summary = `Previous: ${Array.from(topics).join(', ')}.`;
    }
    if (actionCount > 0) {
      summary += ` Actions: ${actionCount}.`;
    }
    
    return summary || 'Previous conversation context.';
  }
}

// ULTRA-FAST: Auth cache manager with longer cache duration
class AuthCache {
  private static cache: { userId: string; token: string; expires: number } | null = null;
  
  static async getValidAuth(): Promise<{ userId: string; token: string } | null> {
    // Check cache first - extended cache time for speed
    if (this.cache && Date.now() < this.cache.expires) {
      return { userId: this.cache.userId, token: this.cache.token };
    }
    
    // Get fresh auth using getSession
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || !session) return null;
    
    // Extended cache for 15 minutes (was 10) for better performance
    this.cache = {
      userId: session.user.id,
      token: session.access_token,
      expires: Date.now() + (15 * 60 * 1000)
    };
    
    return { userId: session.user.id, token: session.access_token };
  }
  
  static clearCache() {
    this.cache = null;
  }
}

// ULTRA-FAST: Local memory cache with optimized storage
class LocalMemoryCache {
  private static readonly STORAGE_KEY = 'wakti_ai_memory';
  private static readonly MAX_MESSAGES = 4; // Reduced from 5 for speed
  
  static saveMessages(conversationId: string | null, messages: AIMessage[]) {
    try {
      // Only save essential data for speed
      const memory = {
        conversationId,
        messages: messages.slice(-this.MAX_MESSAGES).map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content.substring(0, 500), // Truncate long content for speed
          timestamp: msg.timestamp,
          intent: msg.intent,
          confidence: msg.confidence
        })),
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
      
      // Check if memory is less than 30 minutes old (reduced from 1 hour)
      if (Date.now() - memory.timestamp > 30 * 60 * 1000) {
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

const PERSONAL_TOUCH_KEY = "wakti_personal_touch";

interface PersonalTouchData {
  nickname: string;
  tone: string;
  style: string;
  instruction: string;
}

function loadWaktiPersonalTouch(): PersonalTouchData | null {
  try {
    const stored = localStorage.getItem(PERSONAL_TOUCH_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function buildOptimizedSystemPrompt(data: PersonalTouchData | null): string {
  // Simplified system prompt for speed
  let prompt = "You are Wakti AI.";
  
  if (data?.nickname) {
    prompt += ` Call user "${data.nickname}".`;
  }
  
  if (data?.tone && data.tone !== 'neutral') {
    prompt += ` ${data.tone} tone.`;
  }
  
  if (data?.instruction) {
    // Truncate long instructions for speed
    prompt += ` ${data.instruction.substring(0, 100)}`;
  }
  
  return prompt;
}

export class WaktiAIV2ServiceClass {
  // ULTRA-FAST: Enhanced message sending with aggressive optimization
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
      
      // ULTRA-FAST: Enhanced cache check with user patterns
      if (!attachedFiles?.length && activeTrigger === 'chat' && message.length < 150) {
        const cachedResponse = AIResponseCache.getCachedResponse(message, userId);
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
      
      // ULTRA-FAST: Optimized message compression
      const { summary, recentMessages } = MessageCompressor.compressHistory(conversationHistory);
      
      // ULTRA-FAST: Optimized file processing
      let processedFiles = [];
      if (attachedFiles?.length > 0) {
        processedFiles = await this.processUltraFastFiles(attachedFiles);
      }
      
      // ULTRA-FAST: Minimal personal touch integration
      const personalTouch = loadWaktiPersonalTouch();
      const customSystemPrompt = buildOptimizedSystemPrompt(personalTouch);
      
      // ULTRA-FAST: Streamlined API call
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
          recentMessages: recentMessages.slice(-2), // Further reduced context
          customSystemPrompt,
          ultraFastMode: true,
          minimalContext: true // New flag for minimal processing
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
      
      // Enhanced caching for better performance
      if (activeTrigger === 'chat' && !attachedFiles?.length && message.length < 100 && response.data.response) {
        AIResponseCache.setCachedResponse(message, response.data.response, userId);
      }
      
      // FIRE-AND-FORGET: Background logging
      this.logQuotaAsync(auth.userId, inputType, responseTime).catch(() => {});
      
      return response.data;
    } catch (error: any) {
      console.error('⚡ ULTRA-FAST AI: Service error:', error);
      throw error;
    }
  }
  
  // Ultra-fast file processing with direct URL handling
  private static async processUltraFastFiles(attachedFiles: any[]): Promise<any[]> {
    if (!attachedFiles?.length) return [];
    
    return attachedFiles.map(file => {
      // Direct URL handling for optimized files (no conversion)
      if (file.optimized && file.publicUrl) {
        return {
          type: 'image_url',
          image_url: { url: file.publicUrl },
          name: file.name
        };
      }
      
      // Skip heavy processing for non-optimized files
      if (file.content && file.content.length < 500000) { // 500KB limit for speed
        return {
          type: 'image_url',
          image_url: { url: `data:${file.type};base64,${file.content}` },
          name: file.name
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
      setTimeout(async () => {
        await supabase.functions.invoke('log-quota-usage', {
          body: { userId, inputType, responseTime }
        });
      }, 0);
    } catch (e) {
      // Silent failure
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
  
  
  static async getConversations(): Promise<AIConversation[]> {
    try {
      const auth = await AuthCache.getValidAuth();
      if (!auth) throw new Error('Authentication required');
      
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', auth.userId)
        .order('last_message_at', { ascending: false })
        .limit(15); // Reduced from 20 for speed
      
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
        .limit(30); // Reduced from 50 for speed
      
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
