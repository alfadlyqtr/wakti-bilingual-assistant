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
    }, 15000);
    
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

// ENHANCED: Build full system prompt with complete personality instructions
function buildPersonalizedSystemPrompt(data: PersonalTouchData | null, language: string = 'en'): string {
  let basePrompt = language === 'ar' 
    ? "أنت وقتي AI، مساعد ذكي ومفيد وودود."
    : "You are Wakti AI, a smart, helpful, and friendly assistant.";

  if (!data) return basePrompt;

  // Add nickname with personality
  if (data.nickname) {
    basePrompt += language === 'ar' 
      ? ` اسم المستخدم "${data.nickname}". كن شخصياً ومألوفاً معهم.`
      : ` Call the user "${data.nickname}". Be personal and familiar with them.`;
  }
  
  // ENHANCED: Full tone implementation with specific instructions
  if (data.tone && data.tone !== 'neutral') {
    switch (data.tone) {
      case 'funny':
        basePrompt += language === 'ar'
          ? " كن مرحاً ولطيفاً! استخدم النكات والرموز التعبيرية 😄🎉. اجعل المحادثة ممتعة ومسلية. اضف الدعابة والتعليقات الطريفة."
          : " Be funny and playful! Use jokes, puns, and emojis 😄🎉. Make conversations entertaining and light-hearted. Add humor and witty comments wherever appropriate.";
        break;
      case 'casual':
        basePrompt += language === 'ar'
          ? " كن ودوداً وعادياً! استخدم الرموز التعبيرية 😊 واللغة المألوفة. تحدث كما لو كنت صديق مقرب."
          : " Be casual and friendly! Use emojis 😊, contractions, and conversational language. Talk like you're a close friend having a relaxed chat.";
        break;
      case 'encouraging':
        basePrompt += language === 'ar'
          ? " كن محفزاً ومشجعاً! استخدم عبارات إيجابية والرموز التعبيرية المحفزة 💪✨. ادعم المستخدم وشجعه."
          : " Be encouraging and motivating! Use positive language, supportive phrases, and motivating emojis 💪✨. Uplift and inspire the user in every response.";
        break;
      case 'serious':
        basePrompt += language === 'ar'
          ? " كن جدياً ومهنياً في ردودك. استخدم لغة رسمية ومناسبة."
          : " Be serious and professional in your responses. Use formal language and maintain a professional tone.";
        break;
    }
  }
  
  // ENHANCED: Full style implementation with detailed instructions
  if (data.style) {
    switch (data.style) {
      case 'short answers':
        basePrompt += language === 'ar'
          ? " اجعل إجاباتك مختصرة ومباشرة. لا تزد عن 2-3 جمل إلا إذا كان ضرورياً."
          : " Keep your answers brief and to the point. Stick to 2-3 sentences unless more detail is absolutely necessary.";
        break;
      case 'bullet points':
        basePrompt += language === 'ar'
          ? " استخدم النقاط والقوائم لتنظيم المعلومات بوضوح. قسم الإجابات إلى نقاط منطقية."
          : " Use bullet points and lists to organize information clearly. Break down responses into logical, easy-to-read points.";
        break;
      case 'detailed':
        basePrompt += language === 'ar'
          ? " قدم إجابات مفصلة وشاملة مع أمثلة وتوضيحات وافية. اشرح المفاهيم بعمق وأضف السياق المناسب."
          : " Provide detailed, comprehensive answers with examples, explanations, and context. Explain concepts thoroughly and add relevant background information.";
        break;
      case 'step-by-step':
        basePrompt += language === 'ar'
          ? " قسم إجاباتك إلى خطوات واضحة ومرقمة. اجعل كل خطوة واضحة ومفهومة."
          : " Break down your responses into clear, numbered steps. Make each step actionable and easy to understand.";
        break;
    }
  }
  
  // Add custom instruction with full context
  if (data.instruction && data.instruction.trim()) {
    basePrompt += language === 'ar'
      ? ` تعليمات إضافية مهمة: ${data.instruction}`
      : ` Important additional instruction: ${data.instruction}`;
  }
  
  return basePrompt;
}

// ENHANCED: Better token allocation based on style and tone
function getPersonalizedTokenLimits(style: string, tone: string): number {
  const baseTokens = {
    'short answers': 250,    // Increased for personality
    'bullet points': 400,    // Increased for formatting
    'detailed': 700,         // Significantly increased
    'step-by-step': 500,     // Increased for explanations
    'casual': 450,           // Increased for conversation
    'neutral': 400
  };
  
  let tokens = baseTokens[style] || 450;
  
  // Add extra tokens for personality-rich tones
  if (tone === 'funny') {
    tokens += 150; // Extra space for jokes and personality
  } else if (tone === 'casual') {
    tokens += 100; // Extra space for friendly conversation
  } else if (tone === 'encouraging') {
    tokens += 100; // Extra space for motivational content
  }
  
  return tokens;
}

// ENHANCED: Better simple query detection - only truly simple queries
function isSimpleQuery(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  
  // Only very basic greetings and acknowledgments
  const simplePatterns = [
    /^(hi|hello|hey)$/,
    /^(thanks?|thank you)$/,
    /^(yes|no|ok|okay)$/,
    /^(bye|goodbye)$/,
    /^(مرحبا|أهلا|شكرا|نعم|لا|وداعا)$/
  ];
  
  return simplePatterns.some(pattern => pattern.test(trimmed)) && trimmed.length < 10;
}

// ENHANCED: Better task creation intent detection
function hasTaskCreationIntent(message: string): boolean {
  const taskKeywords = [
    // English patterns
    'create task', 'add task', 'make task', 'new task',
    'create reminder', 'add reminder', 'set reminder', 'remind me',
    'schedule', 'appointment', 'meeting',
    'tomorrow', 'next week', 'at 2pm', 'at 3:00',
    'shopping', 'buy', 'pickup', 'call',
    
    // Arabic patterns
    'أنشئ مهمة', 'أضف مهمة', 'أنشئ تذكير', 'ذكرني',
    'موعد', 'اجتماع', 'غدا', 'بكرة'
  ];
  
  const lowerMessage = message.toLowerCase();
  return taskKeywords.some(keyword => lowerMessage.includes(keyword)) ||
         // Detect time patterns
         /\d{1,2}:\d{2}|(\d{1,2}\s?(am|pm))/i.test(message) ||
         // Detect date patterns
         /(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(message);
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
  // ENHANCED: Restored full personality and task creation
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
      console.log('⚡ ENHANCED AI: Processing with full personality and task creation restored');
      const startTime = Date.now();
      
      // ENHANCED: Load personal touch settings
      const personalTouch = PersonalTouchCache.loadWaktiPersonalTouch();
      const userStyle = personalTouch?.style || 'detailed';
      const userTone = personalTouch?.tone || 'neutral';
      
      // ENHANCED: Better optimization logic - only for truly simple queries
      const isSimple = isSimpleQuery(message);
      const hasTaskIntent = hasTaskCreationIntent(message);
      const useAggressiveOptimization = isSimple && !hasTaskIntent && activeTrigger === 'chat' && !attachedFiles?.length;
      
      console.log(`⚡ ENHANCED AI: Mode - ${useAggressiveOptimization ? 'SPEED' : 'PERSONALITY'} | Style: ${userStyle} | Tone: ${userTone} | Task Intent: ${hasTaskIntent}`);
      
      // ENHANCED: Cached responses only for truly simple queries
      if (useAggressiveOptimization) {
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
      
      const auth = await AuthCache.getValidAuth();
      if (!auth) throw new Error('Authentication failed');
      
      // ENHANCED: Better conversation compression with personality awareness
      const { summary, recentMessages } = MessageCompressor.compressHistory(conversationHistory, userStyle);
      
      // ENHANCED: Process attached files
      let processedFiles = attachedFiles;
      if (attachedFiles?.length > 0) {
        processedFiles = await this.processOptimizedFiles(attachedFiles);
      }
      
      // ENHANCED: Build full system prompt without truncation
      const customSystemPrompt = buildPersonalizedSystemPrompt(personalTouch, language);
      console.log(`⚡ SYSTEM PROMPT LENGTH: ${customSystemPrompt.length} characters`);
      
      // ENHANCED: Proper token allocation
      const maxTokens = getPersonalizedTokenLimits(userStyle, userTone);
      
      const abortController = AuthCache.getAbortController();
      const timeoutMs = useAggressiveOptimization ? 4000 : 8000; // More time for personality
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
      
      try {
        const response = await supabase.functions.invoke('wakti-ai-v2-brain', {
          body: {
            message,
            userId: auth.userId,
            language,
            conversationId,
            inputType,
            activeTrigger,
            attachedFiles: processedFiles,
            
            // ENHANCED: Full context for personality and memory
            conversationSummary: useAggressiveOptimization ? '' : summary || '',
            recentMessages: useAggressiveOptimization ? [] : recentMessages,
            customSystemPrompt: customSystemPrompt, // Full prompt without truncation
            maxTokens,
            userStyle,
            userTone,
            
            // Enhanced optimization flags
            speedOptimized: useAggressiveOptimization,
            aggressiveOptimization: useAggressiveOptimization,
            hasTaskIntent,
            personalityEnabled: !useAggressiveOptimization, // Enable personality for non-simple queries
            
            // Enhanced context
            enableTaskCreation: true,
            enablePersonality: !useAggressiveOptimization
          },
          headers: {
            'x-auth-token': auth.token,
            'x-skip-auth': 'true'
          }
        });
        
        clearTimeout(timeoutId);
        
        const responseTime = Date.now() - startTime;
        console.log(`⚡ ENHANCED AI: Response in ${responseTime}ms (${useAggressiveOptimization ? 'SPEED' : 'PERSONALITY'} mode)`);
        
        if (response.error) {
          throw new Error(response.error.message || 'AI service error');
        }
        
        // Cache only simple responses
        if (useAggressiveOptimization && !attachedFiles?.length) {
          AIResponseCache.setCachedResponse(message, response.data.response);
        }
        
        // Fire-and-forget quota logging
        this.logQuotaAsync(auth.userId, inputType, responseTime).catch(e => 
          console.warn('Quota logging failed silently:', e)
        );
        
        return response.data;
      } catch (error: any) {
        clearTimeout(timeoutId);
        
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
