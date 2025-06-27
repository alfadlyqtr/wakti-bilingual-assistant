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
      'detailed': 4, // Increased for better context
      'step-by-step': 3,
      'casual': 3,
      'funny': 3
    };
    
    const limit = contextLimits[userStyle] || 3;
    
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
      if (msg.actionTaken) actions.push(msg.content.substring(0, 40));
    });
    
    let summary = `Previous: ${Array.from(topics).slice(0, 4).join(', ')}.`;
    if (actions.length > 0) {
      summary += ` Actions: ${actions.slice(0, 3).join('; ')}.`;
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

// ENHANCED: Personal touch cache with better personality building
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

// ENHANCED: Build comprehensive system prompt with personality
function buildPersonalizedSystemPrompt(data: PersonalTouchData | null, language: string = 'en'): string {
  let basePrompt = language === 'ar' 
    ? "أنت وقتي AI، مساعد ذكي ومفيد."
    : "You are Wakti AI, a smart and helpful assistant.";

  if (!data) return basePrompt;

  // Add nickname
  if (data.nickname) {
    basePrompt += language === 'ar' 
      ? ` اسم المستخدم "${data.nickname}".`
      : ` Call the user "${data.nickname}".`;
  }
  
  // Add tone with personality instructions
  if (data.tone && data.tone !== 'neutral') {
    switch (data.tone) {
      case 'funny':
        basePrompt += language === 'ar'
          ? " كن مرحاً ولطيفاً، استخدم النكات والرموز التعبيرية 😄"
          : " Be funny and playful! Use jokes, puns, and emojis 😄. Keep things light and entertaining.";
        break;
      case 'casual':
        basePrompt += language === 'ar'
          ? " كن ودوداً وعادياً، استخدم الرموز التعبيرية 😊"
          : " Be casual and friendly! Use emojis 😊, contractions, and conversational language.";
        break;
      case 'encouraging':
        basePrompt += language === 'ar'
          ? " كن محفزاً ومشجعاً، استخدم عبارات إيجابية 💪"
          : " Be encouraging and motivating! Use positive language and supportive emojis 💪✨";
        break;
      case 'serious':
        basePrompt += language === 'ar'
          ? " كن جدياً ومهنياً في ردودك"
          : " Be serious and professional in your responses.";
        break;
      default:
        basePrompt += language === 'ar'
          ? ` استخدم نبرة ${data.tone}`
          : ` Use a ${data.tone} tone.`;
    }
  }
  
  // Add style with detailed instructions
  if (data.style) {
    switch (data.style) {
      case 'short answers':
        basePrompt += language === 'ar'
          ? " اجعل إجاباتك مختصرة ومباشرة."
          : " Keep your answers brief and to the point.";
        break;
      case 'bullet points':
        basePrompt += language === 'ar'
          ? " استخدم النقاط والقوائم لتنظيم المعلومات."
          : " Use bullet points and lists to organize information clearly.";
        break;
      case 'detailed':
        basePrompt += language === 'ar'
          ? " قدم إجابات مفصلة وشاملة مع أمثلة وتوضيحات."
          : " Provide detailed, comprehensive answers with examples and explanations.";
        break;
      case 'step-by-step':
        basePrompt += language === 'ar'
          ? " قسم إجاباتك إلى خطوات واضحة ومرقمة."
          : " Break down your responses into clear, numbered steps.";
        break;
      default:
        basePrompt += language === 'ar'
          ? ` اتبع أسلوب ${data.style}`
          : ` Follow a ${data.style} style.`;
    }
  }
  
  // Add custom instruction
  if (data.instruction && data.instruction.trim()) {
    basePrompt += language === 'ar'
      ? ` تعليمات إضافية: ${data.instruction}`
      : ` Additional instruction: ${data.instruction}`;
  }
  
  return basePrompt;
}

// ENHANCED: Get smart token limits with better allocation for personality
function getPersonalizedTokenLimits(style: string, tone: string): number {
  const baseTokens = {
    'short answers': 200,    // Increased from 150
    'bullet points': 300,    // Increased from 200
    'detailed': 600,         // Increased from 400
    'step-by-step': 400,     // Increased from 300
    'casual': 350,           // Increased from 250
    'neutral': 300           // Same
  };
  
  let tokens = baseTokens[style] || 350;
  
  // Add extra tokens for personality tones
  if (tone === 'funny' || tone === 'casual') {
    tokens += 100; // Extra space for jokes and emojis
  }
  
  return tokens;
}

// ENHANCED: Detect if query is simple or needs personality
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

// ENHANCED: Detect task creation intent
function hasTaskCreationIntent(message: string): boolean {
  const taskKeywords = [
    'create task', 'add task', 'make task', 'new task',
    'create reminder', 'add reminder', 'set reminder',
    'أنشئ مهمة', 'أضف مهمة', 'أنشئ تذكير',
    'remind me', 'ذكرني'
  ];
  
  const lowerMessage = message.toLowerCase();
  return taskKeywords.some(keyword => lowerMessage.includes(keyword));
}

// FIXED: Request debouncer with proper typing
class RequestDebouncer {
  private static timers = new Map<string, ReturnType<typeof setTimeout>>();
  
  static debounce(key: string, fn: Function, delay: number = 300) { // Reduced delay
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
  // ENHANCED: Message sending with restored personality and task creation
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
    enablePredictiveIntegration: boolean = true,
    enableWorkflowAutomation: boolean = true,
    confirmTask: boolean = false,
    confirmReminder: boolean = false,
    pendingTaskData: any = null,
    pendingReminderData: any = null
  ) {
    try {
      console.log('⚡ ENHANCED AI: Processing with personality restoration');
      const startTime = Date.now();
      
      // ENHANCED: Load personal touch settings
      const personalTouch = PersonalTouchCache.loadWaktiPersonalTouch();
      const userStyle = personalTouch?.style || 'detailed';
      const userTone = personalTouch?.tone || 'neutral';
      
      // ENHANCED: Smart optimization based on query complexity
      const isSimple = isSimpleQuery(message);
      const hasTaskIntent = hasTaskCreationIntent(message);
      const useAggressiveOptimization = isSimple && !hasTaskIntent && activeTrigger === 'chat';
      
      // ENHANCED: Aggressive caching only for simple queries
      if (useAggressiveOptimization && !attachedFiles?.length) {
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
      
      // ULTRA-FAST: More aggressive compression for speed
      const { summary, recentMessages } = MessageCompressor.compressHistory(conversationHistory, userStyle);
      
      // ULTRA-FAST: Process attached files (keep existing optimization)
      let processedFiles = attachedFiles;
      if (attachedFiles?.length > 0) {
        processedFiles = await this.processOptimizedFiles(attachedFiles);
      }
      
      // ULTRA-FAST: Build ultra-minimal custom system prompt
      const customSystemPrompt = buildPersonalizedSystemPrompt(personalTouch, language);
      
      // ULTRA-FAST: Get smart token limits (further reduced)
      const maxTokens = getPersonalizedTokenLimits(userStyle, userTone);
      
      // Create abort controller for request timeout
      const abortController = AuthCache.getAbortController();
      
      // ULTRA-FAST: Aggressive timeout based on user style
      const timeoutMs = useAggressiveOptimization ? 4000 : 6000; // Reduced timeouts
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
      
      try {
        // ULTRA-FAST: Direct API call with ultra-minimal payload
        const response = await supabase.functions.invoke('wakti-ai-v2-brain', {
          body: {
            message,
            userId: auth.userId,
            language,
            conversationId,
            inputType,
            activeTrigger,
            attachedFiles: processedFiles,
            // ULTRA-FAST: Skip most context for speed
            conversationSummary: useAggressiveOptimization ? '' : summary?.substring(0, 100) || '',
            recentMessages: useAggressiveOptimization ? [] : recentMessages.slice(-1),
            customSystemPrompt: customSystemPrompt.substring(0, 100), // Further truncate
            maxTokens,
            userStyle,
            userTone,
            // Ultra-fast mode flags
            ultraFastMode: true,
            speedOptimized: true,
            aggressiveOptimization: useAggressiveOptimization,
            hasTaskIntent,
            personalityEnabled: !useAggressiveOptimization
          },
          headers: {
            'x-auth-token': auth.token,
            'x-skip-auth': 'true'
          }
        });
        
        clearTimeout(timeoutId);
        
        const responseTime = Date.now() - startTime;
        console.log(`⚡ ENHANCED AI: Response in ${responseTime}ms (${useAggressiveOptimization ? 'speed' : 'personality'} mode)`);
        
        if (response.error) {
          throw new Error(response.error.message || 'AI service error');
        }
        
        // ULTRA-FAST: Cache simple responses immediately
        if (useAggressiveOptimization && !attachedFiles?.length) {
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
      console.error('⚡ ENHANCED AI: Service error:', error);
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
    enablePredictiveIntegration: boolean = true,
    enableWorkflowAutomation: boolean = true,
    confirmTask: boolean = false,
    confirmReminder: boolean = false,
    pendingTaskData: any = null,
    pendingReminderData: any = null
  ) {
    return WaktiAIV2ServiceClass.sendMessage(
      message, userId, language, conversationId, inputType, conversationHistory,
      confirmSearch, activeTrigger, textGenParams, attachedFiles, calendarContext,
      userContext, enableAdvancedIntegration, enablePredictiveIntegration,
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
