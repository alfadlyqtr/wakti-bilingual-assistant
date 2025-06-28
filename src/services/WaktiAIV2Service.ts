import { supabase } from '@/integrations/supabase/client';
import { AIResponseCache } from './AIResponseCache';
import { PersonalizationProcessor } from './PersonalizationProcessor';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: boolean;
  inputType?: 'text' | 'voice';
  attachedFiles?: any[];
  imageUrl?: string;
  browsingUsed?: boolean;
  browsingData?: any;
  isTextGenerated?: boolean;
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

// ENHANCED: Better message compression with personality awareness
class MessageCompressor {
  static compressHistory(messages: AIMessage[], userStyle: string = 'detailed'): { summary: string; recentMessages: AIMessage[] } {
    // Enhanced context limits based on user style
    const contextLimits = {
      'short answers': 2,
      'bullet points': 3,
      'detailed': 4,        // Keep more for detailed users
      'step-by-step': 4,
      'casual': 3,
      'funny': 3
    };
    
    const limit = contextLimits[userStyle] || 3;
    
    if (messages.length <= limit) {
      return { summary: '', recentMessages: messages };
    }

    const recentMessages = messages.slice(-limit);
    
    // Enhanced summary creation for better memory
    const oldMessages = messages.slice(0, -limit);
    const summary = this.createEnhancedSummary(oldMessages, userStyle);
    
    return { summary, recentMessages };
  }

  private static createEnhancedSummary(messages: AIMessage[], userStyle: string): string {
    if (messages.length === 0) return '';
    
    const topics = new Set<string>();
    const actions = [];
    const userPreferences = [];
    
    messages.forEach(msg => {
      if (msg.intent && msg.intent !== 'general_chat') topics.add(msg.intent);
      if (msg.actionTaken) actions.push(msg.content.substring(0, 50));
      
      // Extract user preferences from conversation
      const content = msg.content.toLowerCase();
      if (content.includes('like') || content.includes('prefer')) {
        userPreferences.push(msg.content.substring(0, 60));
      }
    });
    
    let summary = `Previous conversation context:\n`;
    
    if (topics.size > 0) {
      summary += `Topics discussed: ${Array.from(topics).slice(0, 5).join(', ')}\n`;
    }
    
    if (actions.length > 0) {
      summary += `Actions taken: ${actions.slice(0, 3).join('; ')}\n`;
    }
    
    if (userPreferences.length > 0) {
      summary += `User preferences: ${userPreferences.slice(0, 2).join('; ')}\n`;
    }
    
    // Add style context for personality
    summary += `User communication style: ${userStyle}\n`;
    
    return summary;
  }
}

// ENHANCED: Better auth cache with longer validity
class AuthCache {
  private static cache: { userId: string; token: string; expires: number } | null = null;
  private static connectionPool: AbortController[] = [];
  
  static async getValidAuth(): Promise<{ userId: string; token: string } | null> {
    // Check cache first (extended to 20 minutes)
    if (this.cache && Date.now() < this.cache.expires) {
      return { userId: this.cache.userId, token: this.cache.token };
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || !session) return null;
    
    // Cache for 20 minutes
    this.cache = {
      userId: session.user.id,
      token: session.access_token,
      expires: Date.now() + (20 * 60 * 1000)
    };
    
    return { userId: session.user.id, token: session.access_token };
  }
  
  static clearCache() {
    this.cache = null;
    this.connectionPool.forEach(controller => controller.abort());
    this.connectionPool = [];
  }
  
  static getAbortController(): AbortController {
    const controller = new AbortController();
    this.connectionPool.push(controller);
    
    setTimeout(() => {
      const index = this.connectionPool.indexOf(controller);
      if (index > -1) this.connectionPool.splice(index, 1);
    }, 20000); // Increased from 15s to 20s
    
    return controller;
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

// ENHANCED: Personal touch integration
const PERSONAL_TOUCH_KEY = "wakti_personal_touch";

interface PersonalTouchData {
  nickname: string;
  tone: string;
  style: string;
  instruction: string;
  aiNickname?: string;
}

// ENHANCED: Better personal touch cache
class PersonalTouchCache {
  private static cache: { data: PersonalTouchData | null; expires: number } | null = null;
  
  static loadWaktiPersonalTouch(): PersonalTouchData | null {
    if (this.cache && Date.now() < this.cache.expires) {
      return this.cache.data;
    }
    
    try {
      const stored = localStorage.getItem(PERSONAL_TOUCH_KEY);
      const data = stored ? JSON.parse(stored) : null;
      
      this.cache = {
        data,
        expires: Date.now() + (10 * 60 * 1000)
      };
      
      return data;
    } catch {
      return null;
    }
  }
  
  static clearCache() {
    this.cache = null;
  }
}

// FIXED: Request debouncer with proper typing
class RequestDebouncer {
  private static timers = new Map<string, ReturnType<typeof setTimeout>>();
  
  static debounce(key: string, fn: Function, delay: number = 200) {
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = setTimeout(() => {
      fn();
      this.timers.delete(key);
    }, delay);
    
    this.timers.set(key, timer);
  }
  
  static clearAll() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }
}

export class WaktiAIV2ServiceClass {
  // FIXED: Increased timeout to 15 seconds with better error handling
  static async sendMessage(
    message: string,
    userId?: string,
    language: string = 'en',
    conversationId: string | null = null,
    inputType: 'text' | 'voice' = 'text',
    sessionMessages: AIMessage[] = [],
    streamResponse: boolean = false,
    activeTrigger: string = 'chat',
    conversationSummary: string = '',
    attachedFiles: any[] = []
  ): Promise<any> {
    try {
      const startTime = Date.now();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      console.log('🚀 FIXED TIMEOUT AI: Starting with 15-second timeout protection');

      // STEP 1: Load personal touch settings (cached)
      const personalTouch = PersonalTouchCache.loadWaktiPersonalTouch();
      console.log('🎯 Personal Touch:', personalTouch);

      // STEP 2: Build minimal context for speed
      const recentMessages = sessionMessages.slice(-4).map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));

      // STEP 3: Create timeout-protected API call with INCREASED timeout
      console.log('⚡ FIXED TIMEOUT: Making AI call with 15-second timeout (was 10s)');

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000); // INCREASED from 10s
      });

      const apiPromise = supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId: user.id,
          language,
          conversationId,
          inputType,
          activeTrigger,
          attachedFiles,
          conversationSummary: '', // Minimal for speed
          recentMessages: recentMessages.slice(-2), // Minimal context
          customSystemPrompt: '', // Let edge function handle personalization
          maxTokens: personalTouch?.style === 'short answers' ? 200 : 400,
          speedOptimized: true,
          aggressiveOptimization: true,
          personalityEnabled: true, // Enable personalization
          enableTaskCreation: true,
          enablePersonality: true, // Enable personalization
          personalTouch: personalTouch // Pass personal touch to edge function
        }
      });

      // Race between API call and timeout with INCREASED timeout
      const { data, error } = await Promise.race([apiPromise, timeoutPromise]) as any;

      if (error) {
        console.error('🚨 API Error:', error);
        throw error;
      }

      const apiTime = Date.now() - startTime;
      console.log(`⚡ SUCCESS: Completed in ${apiTime}ms`);

      // STEP 4: Minimal post-processing (most personalization done in edge function)
      let finalResponse = data.response;
      
      // Only apply minimal post-processing if needed
      if (personalTouch && !data.personalizedResponse) {
        console.log('🎨 MINIMAL POST-PROCESSING: Applying final touches');
        finalResponse = PersonalizationProcessor.enhanceResponse(
          data.response,
          {
            personalTouch,
            language,
            responseTime: apiTime
          }
        );
      }

      const totalTime = Date.now() - startTime;
      console.log(`🚀 TOTAL TIME: ${totalTime}ms (Timeout Fixed: 15s, Personalized: ${!!personalTouch})`);

      // Return enhanced response
      return {
        ...data,
        response: finalResponse,
        processingTime: totalTime,
        apiTime,
        personalizedResponse: !!personalTouch,
        timeoutProtected: true
      };

    } catch (error) {
      console.error('🚨 FIXED TIMEOUT Error:', error);
      
      // IMPROVED: Better error handling - never show "trouble connecting"
      if (error.message?.includes('timeout')) {
        throw new Error('AI response is taking longer than expected. Please try again.');
      }
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new Error('Network connection issue. Please check your internet and try again.');
      }
      
      // Generic fallback
      throw new Error('AI service is temporarily unavailable. Please try again in a moment.');
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
    RequestDebouncer.clearAll();
    AuthCache.clearCache();
  }
  
  sendMessage(
    message: string,
    userId: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' = 'text',
    conversationHistory: any[] = [],
    streamResponse: boolean = false,
    activeTrigger: string = 'chat',
    conversationSummary: string = '',
    attachedFiles: any[] = []
  ) {
    return WaktiAIV2ServiceClass.sendMessage(
      message,
      userId,
      language,
      conversationId,
      inputType,
      conversationHistory,
      streamResponse,
      activeTrigger,
      conversationSummary,
      attachedFiles
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
