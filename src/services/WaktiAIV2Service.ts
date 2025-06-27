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

// ULTRA-FAST: Message compression utilities with style-based optimization
class MessageCompressor {
  static compressHistory(messages: AIMessage[], userStyle: string = 'detailed'): { summary: string; recentMessages: AIMessage[] } {
    // Smart context reduction based on user style
    const contextLimits = {
      'short answers': 1,
      'bullet points': 2,
      'detailed': 3,
      'step-by-step': 2
    };
    
    const limit = contextLimits[userStyle] || 2;
    
    if (messages.length <= limit) {
      return { summary: '', recentMessages: messages };
    }

    const recentMessages = messages.slice(-limit);
    
    // Skip summary for simple styles to save processing time
    if (userStyle === 'short answers') {
      return { summary: '', recentMessages };
    }
    
    const oldMessages = messages.slice(0, -limit);
    const summary = this.createSummary(oldMessages);
    
    return { summary, recentMessages };
  }

  private static createSummary(messages: AIMessage[]): string {
    if (messages.length === 0) return '';
    
    const topics = new Set<string>();
    const actions = [];
    
    messages.forEach(msg => {
      if (msg.intent) topics.add(msg.intent);
      if (msg.actionTaken) actions.push(msg.content.substring(0, 30)); // Shorter for speed
    });
    
    let summary = `Previous: ${Array.from(topics).slice(0, 3).join(', ')}.`; // Limit topics
    if (actions.length > 0) {
      summary += ` Actions: ${actions.slice(0, 2).join('; ')}.`; // Limit actions
    }
    
    return summary;
  }
}

// ULTRA-FAST: Auth cache manager with connection pooling
class AuthCache {
  private static cache: { userId: string; token: string; expires: number } | null = null;
  private static connectionPool: AbortController[] = [];
  
  static async getValidAuth(): Promise<{ userId: string; token: string } | null> {
    // Check cache first
    if (this.cache && Date.now() < this.cache.expires) {
      return { userId: this.cache.userId, token: this.cache.token };
    }
    
    // Get fresh auth using getSession to get both user and session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || !session) return null;
    
    // Cache for 15 minutes (increased from 10)
    this.cache = {
      userId: session.user.id,
      token: session.access_token,
      expires: Date.now() + (15 * 60 * 1000)
    };
    
    return { userId: session.user.id, token: session.access_token };
  }
  
  static clearCache() {
    this.cache = null;
    // Clean up connection pool
    this.connectionPool.forEach(controller => controller.abort());
    this.connectionPool = [];
  }
  
  static getAbortController(): AbortController {
    const controller = new AbortController();
    this.connectionPool.push(controller);
    
    // Auto-cleanup after 10 seconds
    setTimeout(() => {
      const index = this.connectionPool.indexOf(controller);
      if (index > -1) this.connectionPool.splice(index, 1);
    }, 10000);
    
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

const PERSONAL_TOUCH_KEY = "wakti_personal_touch";

interface PersonalTouchData {
  nickname: string;
  tone: string;
  style: string;
  instruction: string;
}

// SPEED-OPTIMIZED: Personal touch cache
class PersonalTouchCache {
  private static cache: { data: PersonalTouchData | null; expires: number } | null = null;
  
  static loadWaktiPersonalTouch(): PersonalTouchData | null {
    // Check cache first (5 minute cache)
    if (this.cache && Date.now() < this.cache.expires) {
      return this.cache.data;
    }
    
    try {
      const stored = localStorage.getItem(PERSONAL_TOUCH_KEY);
      const data = stored ? JSON.parse(stored) : null;
      
      // Cache for 5 minutes
      this.cache = {
        data,
        expires: Date.now() + (5 * 60 * 1000)
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

// SPEED-OPTIMIZED: Build minimal system prompt
function buildOptimizedSystemPrompt(data: PersonalTouchData | null): string {
  if (!data) return "You are Wakti AI. Be helpful and concise.";

  let prompt = "You are Wakti AI.";
  
  if (data.nickname) {
    prompt += ` Call user "${data.nickname}".`;
  }
  
  if (data.tone && data.tone !== 'neutral') {
    prompt += ` Use ${data.tone} tone.`;
  }
  
  if (data.style) {
    // Optimize for different styles
    switch (data.style) {
      case 'short answers':
        prompt += ` Be very brief and direct.`;
        break;
      case 'bullet points':
        prompt += ` Use bullet points when helpful.`;
        break;
      case 'step-by-step':
        prompt += ` Structure responses step-by-step.`;
        break;
      default:
        prompt += ` Respond using ${data.style}.`;
    }
  }
  
  if (data.instruction) {
    // Limit instruction length for speed
    const shortInstruction = data.instruction.substring(0, 100);
    prompt += ` Note: ${shortInstruction}`;
  }
  
  return prompt.trim();
}

// SPEED-OPTIMIZED: Get smart token limits based on style
function getSmartTokenLimits(style: string): number {
  const tokenLimits = {
    'short answers': 200, // Reduced from 300
    'bullet points': 300, // Reduced from 400
    'detailed': 600, // Reduced from 800
    'step-by-step': 450, // Reduced from 600
    'casual': 350, // Reduced from 500
    'neutral': 400 // Reduced from 600
  };
  
  return tokenLimits[style] || 400;
}

// SPEED-OPTIMIZED: Detect if query is simple
function isSimpleQuery(message: string): boolean {
  const simplePatterns = [
    /^(hi|hello|hey|مرحبا|أهلا)$/i,
    /^(how are you|كيف حالك)\??$/i,
    /^(thanks?|thank you|شكرا)$/i,
    /^(bye|goodbye|مع السلامة)$/i,
    /^(yes|no|نعم|لا)$/i
  ];
  
  return simplePatterns.some(pattern => pattern.test(message.trim()));
}

// NEW: Request debouncer to prevent rapid requests
class RequestDebouncer {
  private static timers = new Map<string, number>();
  
  static debounce(key: string, fn: Function, delay: number = 500) {
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
  // ULTRA-FAST: Enhanced message sending with aggressive speed optimizations
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
      console.log('⚡ HYPER-OPTIMIZED AI: Ultra-speed processing initiated');
      const startTime = Date.now();
      
      // SPEED-OPTIMIZED: Load personal touch settings with caching
      const personalTouch = PersonalTouchCache.loadWaktiPersonalTouch();
      const userStyle = personalTouch?.style || 'detailed';
      
      // SPEED-OPTIMIZED: Check cache first for simple queries
      if (!attachedFiles?.length && activeTrigger === 'chat' && isSimpleQuery(message)) {
        const cachedResponse = AIResponseCache.getCachedResponse(message);
        if (cachedResponse) {
          console.log('⚡ INSTANT CACHE HIT: Returning cached response');
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
      
      // SPEED-OPTIMIZED: Compress message history based on user style (more aggressive)
      const { summary, recentMessages } = MessageCompressor.compressHistory(conversationHistory, userStyle);
      
      // SPEED-OPTIMIZED: Process attached files (keep existing optimization)
      let processedFiles = attachedFiles;
      if (attachedFiles?.length > 0) {
        processedFiles = await this.processOptimizedFiles(attachedFiles);
      }
      
      // SPEED-OPTIMIZED: Build minimal custom system prompt
      const customSystemPrompt = buildOptimizedSystemPrompt(personalTouch);
      
      // SPEED-OPTIMIZED: Get smart token limits (reduced)
      const maxTokens = getSmartTokenLimits(userStyle);
      
      // Create abort controller for request timeout
      const abortController = AuthCache.getAbortController();
      
      // Set aggressive timeout based on user style
      const timeoutMs = userStyle === 'short answers' ? 4000 : 6000;
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
      
      try {
        // ULTRA-FAST: Direct API call with speed-optimized payload (minimized)
        const response = await supabase.functions.invoke('wakti-ai-v2-brain', {
          body: {
            message,
            userId: auth.userId,
            language,
            conversationId,
            inputType,
            activeTrigger,
            attachedFiles: processedFiles,
            // AGGRESSIVE OPTIMIZATION: Skip context for short answers
            conversationSummary: userStyle === 'short answers' ? '' : summary?.substring(0, 200) || '',
            recentMessages: userStyle === 'short answers' ? [] : recentMessages.slice(-1),
            customSystemPrompt: customSystemPrompt.substring(0, 150), // Truncate prompt
            maxTokens,
            userStyle,
            // Ultra-fast mode flags
            ultraFastMode: true,
            speedOptimized: true,
            aggressiveOptimization: true
          },
          headers: {
            'x-auth-token': auth.token,
            'x-skip-auth': 'true'
          }
        });
        
        clearTimeout(timeoutId);
        
        const responseTime = Date.now() - startTime;
        console.log(`⚡ HYPER-OPTIMIZED AI: Response in ${responseTime}ms`);
        
        if (response.error) {
          throw new Error(response.error.message || 'AI service error');
        }
        
        // Cache simple responses for future use (only basic chat without files)
        if (activeTrigger === 'chat' && !attachedFiles?.length && isSimpleQuery(message)) {
          AIResponseCache.setCachedResponse(message, response.data.response);
        }
        
        // FIRE-AND-FORGET: Quota logging (non-blocking)
        this.logQuotaAsync(auth.userId, inputType, responseTime).catch(e => 
          console.warn('Quota logging failed silently:', e)
        );
        
        return response.data;
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        // Handle timeout specifically
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeoutMs}ms - try again`);
        }
        throw error;
      }
    } catch (error: any) {
      console.error('⚡ HYPER-OPTIMIZED AI: Service error:', error);
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
