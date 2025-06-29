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

// ENHANCED: Smart conversation summary manager with 10+ message trigger
class ConversationSummaryManager {
  private static readonly SUMMARY_THRESHOLD = 10; // UPDATED: Trigger at 10+ messages
  private static readonly MAX_SUMMARY_LENGTH = 600; // INCREASED for better context
  private static readonly REFRESH_THRESHOLD = 10; // Refresh when 10+ new messages

  // ENHANCED: Smart summary creation with database integration
  static async createOrUpdateSummary(
    userId: string,
    conversationId: string | null,
    messages: AIMessage[]
  ): Promise<string | null> {
    if (!conversationId || messages.length < this.SUMMARY_THRESHOLD) return null;

    try {
      // Check if summary refresh is needed using new database function
      const { data: refreshNeeded } = await supabase.rpc(
        'refresh_conversation_summary_if_needed',
        {
          p_user_id: userId,
          p_conversation_id: conversationId,
          p_current_message_count: messages.length
        }
      );

      // Only create/update summary if refresh is needed
      if (!refreshNeeded) {
        // Return existing summary if no refresh needed
        const existingSummary = await this.getSummary(userId, conversationId);
        return existingSummary;
      }

      console.log('🧠 SMART SUMMARY: Creating fresh summary for conversation with', messages.length, 'messages');

      // Get existing summary for context enhancement
      const { data: existingSummary } = await supabase
        .from('ai_conversation_summaries')
        .select('*')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .single();

      // ENHANCED: Create intelligent summary from recent context
      const recentMessages = messages.slice(-this.SUMMARY_THRESHOLD * 2); // Use more context for better summaries
      const summaryText = this.generateEnhancedSummary(recentMessages, existingSummary?.summary_text);

      if (existingSummary) {
        // Update existing summary
        await supabase
          .from('ai_conversation_summaries')
          .update({
            summary_text: summaryText,
            message_count: messages.length,
            messages_since_summary: 0, // Reset counter
            last_message_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSummary.id);

        console.log('✅ SMART SUMMARY: Updated existing summary');
      } else {
        // Create new summary
        await supabase
          .from('ai_conversation_summaries')
          .insert({
            user_id: userId,
            conversation_id: conversationId,
            summary_text: summaryText,
            message_count: messages.length,
            messages_since_summary: 0,
            last_message_date: new Date().toISOString()
          });

        console.log('✅ SMART SUMMARY: Created new summary');
      }

      return summaryText;
    } catch (error) {
      console.error('🚨 SMART SUMMARY: Error managing conversation summary:', error);
      return null;
    }
  }

  static async getSummary(userId: string, conversationId: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('ai_conversation_summaries')
        .select('summary_text')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .single();

      return data?.summary_text || null;
    } catch {
      return null;
    }
  }

  // ENHANCED: Intelligent summary generation with conversation flow analysis
  private static generateEnhancedSummary(messages: AIMessage[], existingSummary?: string): string {
    const topics = new Set<string>();
    const userPreferences = [];
    const keyActions = [];
    const conversationFlow = [];
    const userPersonality = [];

    messages.forEach((msg, index) => {
      // Extract topics and intents
      if (msg.intent && msg.intent !== 'general_chat') topics.add(msg.intent);
      if (msg.actionTaken) keyActions.push(msg.content.substring(0, 100));
      
      // Analyze user preferences and personality
      const content = msg.content.toLowerCase();
      if (content.includes('like') || content.includes('prefer') || content.includes('love')) {
        userPreferences.push(msg.content.substring(0, 120));
      }
      
      // Track conversation flow patterns
      if (msg.role === 'user' && index < messages.length - 1) {
        const nextMsg = messages[index + 1];
        if (nextMsg && nextMsg.role === 'assistant') {
          conversationFlow.push({
            userQuery: msg.content.substring(0, 80),
            aiResponse: nextMsg.content.substring(0, 80)
          });
        }
      }

      // Extract personality indicators
      if (msg.role === 'user') {
        if (content.includes('thank') || content.includes('appreciate')) {
          userPersonality.push('polite');
        }
        if (content.includes('quick') || content.includes('fast') || content.includes('asap')) {
          userPersonality.push('prefers-speed');
        }
        if (content.includes('detail') || content.includes('explain') || content.includes('how')) {
          userPersonality.push('detail-oriented');
        }
      }
    });

    // Build enhanced summary
    let summary = 'Enhanced Conversation Memory:\n';
    
    // Include previous summary context if available
    if (existingSummary && existingSummary.length > 0) {
      summary += `Previous Context: ${existingSummary.substring(0, 200)}...\n\n`;
    }
    
    // Add current conversation insights
    if (topics.size > 0) {
      summary += `Topics: ${Array.from(topics).slice(0, 6).join(', ')}\n`;
    }
    
    if (keyActions.length > 0) {
      summary += `Key Actions: ${keyActions.slice(0, 3).join('; ')}\n`;
    }
    
    if (userPreferences.length > 0) {
      summary += `User Preferences: ${userPreferences.slice(0, 2).join('; ')}\n`;
    }
    
    if (userPersonality.length > 0) {
      summary += `Communication Style: ${[...new Set(userPersonality)].slice(0, 3).join(', ')}\n`;
    }
    
    // Add conversation flow insights
    if (conversationFlow.length > 0) {
      summary += `Recent Flow: ${conversationFlow.slice(-2).map(f => 
        `User: "${f.userQuery}" → AI: "${f.aiResponse}"`
      ).join(' | ')}\n`;
    }

    return summary.substring(0, ConversationSummaryManager.MAX_SUMMARY_LENGTH);
  }

  // ENHANCED: Manual cleanup trigger for immediate cleanup
  static async triggerCleanup(): Promise<{ success: boolean; message: string }> {
    try {
      await supabase.rpc('cleanup_old_conversation_summaries');
      return { 
        success: true, 
        message: 'Successfully cleaned up old conversation summaries' 
      };
    } catch (error) {
      console.error('🚨 CLEANUP ERROR:', error);
      return { 
        success: false, 
        message: 'Failed to cleanup old summaries' 
      };
    }
  }
}

// ENHANCED: Better message compression with SMART CONTEXT LOADING
class MessageCompressor {
  static compressHistory(messages: AIMessage[], userStyle: string = 'detailed'): { summary: string; recentMessages: AIMessage[] } {
    // ENHANCED: Dynamic context limits based on conversation patterns
    const contextLimits = {
      'short answers': 6,    // INCREASED from 4
      'bullet points': 8,    // INCREASED from 6
      'detailed': 10,        // INCREASED from 8
      'step-by-step': 10,    // INCREASED from 8
      'casual': 8,           // INCREASED from 6
      'funny': 8             // INCREASED from 6
    };
    
    const limit = contextLimits[userStyle] || 8; // INCREASED default from 6 to 8
    
    if (messages.length <= limit) {
      return { summary: '', recentMessages: messages };
    }

    const recentMessages = messages.slice(-limit);
    
    // ENHANCED: Create intelligent summary for compressed messages
    const oldMessages = messages.slice(0, -limit);
    const summary = this.createIntelligentSummary(oldMessages, userStyle);
    
    return { summary, recentMessages };
  }

  // ENHANCED: Intelligent summary creation for better context preservation
  private static createIntelligentSummary(messages: AIMessage[], userStyle: string): string {
    if (messages.length === 0) return '';
    
    const topics = new Set<string>();
    const actions = [];
    const userPatterns = [];
    const keyMoments = [];
    
    messages.forEach((msg, index) => {
      if (msg.intent && msg.intent !== 'general_chat') topics.add(msg.intent);
      if (msg.actionTaken) actions.push(msg.content.substring(0, 60));
      
      // Extract user communication patterns
      const content = msg.content.toLowerCase();
      if (msg.role === 'user') {
        if (content.includes('like') || content.includes('prefer')) {
          userPatterns.push(msg.content.substring(0, 80));
        }
        
        // Identify key moments in conversation
        if (content.includes('important') || content.includes('remember') || content.includes('note')) {
          keyMoments.push(msg.content.substring(0, 100));
        }
      }
    });
    
    let summary = `Conversation Context (${messages.length} messages):\n`;
    
    if (topics.size > 0) {
      summary += `Topics: ${Array.from(topics).slice(0, 5).join(', ')}\n`;
    }
    
    if (actions.length > 0) {
      summary += `Actions: ${actions.slice(0, 3).join('; ')}\n`;
    }
    
    if (userPatterns.length > 0) {
      summary += `User Style: ${userPatterns.slice(0, 2).join('; ')}\n`;
    }
    
    if (keyMoments.length > 0) {
      summary += `Key Points: ${keyMoments.slice(0, 2).join('; ')}\n`;
    }
    
    // Add user communication preference context
    summary += `Communication Style: ${userStyle}\n`;
    
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
    }, 20000);
    
    return controller;
  }
}

// FIXED: Enhanced local memory cache with better persistence logic
class LocalMemoryCache {
  private static readonly STORAGE_KEY = 'wakti_ai_memory';
  private static readonly MAX_MESSAGES = 20; // INCREASED to keep more conversation history
  
  static saveMessages(conversationId: string | null, messages: AIMessage[]) {
    try {
      console.log('💾 PERSISTENCE: Saving', messages.length, 'messages to local storage');
      const memory = {
        conversationId,
        messages: messages.slice(-this.MAX_MESSAGES), // Keep last 20 messages
        timestamp: Date.now(),
        userExplicitlyStartedNew: false // Track if user explicitly wants new conversation
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memory));
    } catch (e) {
      console.warn('Failed to save local memory:', e);
    }
  }
  
  static loadMessages(): { conversationId: string | null; messages: AIMessage[] } | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        console.log('💾 PERSISTENCE: No stored messages found');
        return null;
      }
      
      const memory = JSON.parse(stored);
      
      // Check if memory is less than 24 hours old (INCREASED from 2 hours for better persistence)
      if (Date.now() - memory.timestamp > 24 * 60 * 60 * 1000) {
        console.log('💾 PERSISTENCE: Stored messages expired (>24h), clearing');
        localStorage.removeItem(this.STORAGE_KEY);
        return null;
      }
      
      console.log('💾 PERSISTENCE: Loaded', memory.messages?.length || 0, 'messages from storage');
      
      return {
        conversationId: memory.conversationId,
        messages: memory.messages?.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })) || []
      };
    } catch (e) {
      console.warn('Failed to load local memory:', e);
      return null;
    }
  }
  
  static clearMemory() {
    console.log('💾 PERSISTENCE: Clearing local memory storage');
    localStorage.removeItem(this.STORAGE_KEY);
  }
  
  // NEW: Mark that user explicitly wants to start new conversation
  static markExplicitNewConversation() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const memory = JSON.parse(stored);
        memory.userExplicitlyStartedNew = true;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memory));
      }
    } catch (e) {
      console.warn('Failed to mark explicit new conversation:', e);
    }
  }
}

// ENHANCED: Personal touch integration with full options
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

// Request debouncer
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
  // ENHANCED: Main message sending with IMPROVED TIMEOUT HANDLING + PERSONALIZATION ENFORCEMENT
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

      console.log('🚀 ENHANCED AI: Starting with SMART MEMORY + PERSONALIZATION ENFORCEMENT');

      // STEP 1: Load personal touch settings (cached)
      const personalTouch = PersonalTouchCache.loadWaktiPersonalTouch();
      console.log('🎯 Personal Touch Loaded:', personalTouch);

      // STEP 2: SMART SUMMARY MANAGEMENT - Check and create/update if needed
      let enhancedSummary = conversationSummary;
      if (conversationId && sessionMessages.length >= 5) { // Start checking at 5 messages
        const smartSummary = await ConversationSummaryManager.createOrUpdateSummary(
          user.id,
          conversationId,
          sessionMessages
        );
        if (smartSummary) {
          enhancedSummary = smartSummary;
          console.log('🧠 SMART MEMORY: Using enhanced summary');
        }
      } else if (conversationId) {
        // Load existing summary for context
        const existingSummary = await ConversationSummaryManager.getSummary(user.id, conversationId);
        if (existingSummary) {
          enhancedSummary = existingSummary;
          console.log('🧠 SMART MEMORY: Using existing summary');
        }
      }

      // STEP 3: ENHANCED CONTEXT with smart message compression
      const userStyle = personalTouch?.style || 'detailed';
      const { summary: contextSummary, recentMessages } = MessageCompressor.compressHistory(
        sessionMessages,
        userStyle
      );

      // Combine smart summaries for optimal context
      const finalContext = [enhancedSummary, contextSummary].filter(Boolean).join('\n\n');

      console.log('⚡ ENHANCED CONTEXT: Making AI call with smart memory management');
      console.log(`📊 CONTEXT STATS: Summary: ${enhancedSummary ? 'Yes' : 'No'}, Recent Messages: ${recentMessages.length}, Total Context: ${finalContext.length} chars`);

      // FIXED: Increased timeout from 15s to 45s and added retry logic
      const makeApiCall = async (attempt: number = 1): Promise<any> => {
        const timeoutDuration = 45000; // Increased from 15000ms to 45000ms (45 seconds)
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AI_TIMEOUT')), timeoutDuration);
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
            conversationSummary: finalContext,
            recentMessages: recentMessages.slice(-10), // ENHANCED: More context
            customSystemPrompt: '',
            maxTokens: personalTouch?.style === 'short answers' ? 200 : 600, // INCREASED
            speedOptimized: true,
            aggressiveOptimization: false,
            personalityEnabled: true,
            enableTaskCreation: true,
            enablePersonality: true,
            personalTouch: personalTouch
          }
        });

        try {
          return await Promise.race([apiPromise, timeoutPromise]);
        } catch (error: any) {
          // ENHANCED: Retry logic for timeout and network errors
          if ((error.message === 'AI_TIMEOUT' || error.message?.includes('network') || error.message?.includes('fetch')) && attempt < 3) {
            console.log(`🔄 RETRY: Attempt ${attempt + 1}/3 after error:`, error.message);
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // Exponential backoff
            return makeApiCall(attempt + 1);
          }
          throw error;
        }
      };

      const { data, error } = await makeApiCall();

      if (error) {
        console.error('🚨 API Error:', error);
        throw error;
      }

      const apiTime = Date.now() - startTime;
      console.log(`⚡ API SUCCESS: Completed in ${apiTime}ms`);

      // CRITICAL: Apply PersonalizationProcessor with ENFORCEMENT for full personalization
      let finalResponse = data.response;
      
      if (personalTouch) {
        console.log('🎨 PERSONALIZATION ENFORCEMENT: Applying strict personalization matching');
        finalResponse = PersonalizationProcessor.enhanceResponse(
          data.response,
          {
            personalTouch,
            language,
            responseTime: apiTime
          }
        );
        
        console.log('✅ PERSONALIZATION ENFORCEMENT: Applied', {
          originalLength: data.response.length,
          finalLength: finalResponse.length,
          settingsApplied: {
            tone: personalTouch.tone,
            style: personalTouch.style,
            nickname: personalTouch.nickname ? 'Yes' : 'No',
            aiNickname: personalTouch.aiNickname ? 'Yes' : 'No'
          }
        });
      }

      const totalTime = Date.now() - startTime;
      console.log(`🚀 TOTAL SUCCESS: ${totalTime}ms (Smart Memory: ${!!enhancedSummary}, Personalization Enforced: ${!!personalTouch})`);

      return {
        ...data,
        response: finalResponse,
        processingTime: totalTime,
        apiTime,
        personalizedResponse: !!personalTouch,
        enhancedMemory: true,
        smartSummaryUsed: !!enhancedSummary,
        personalizationEnforced: !!personalTouch
      };

    } catch (error) {
      console.error('🚨 ENHANCED AI Error:', error);
      
      // IMPROVED: Better error handling without showing timeout errors to users
      if (error.message === 'AI_TIMEOUT') {
        console.log('⏱️ AI processing took longer than expected, but continuing...');
        // Return a graceful response instead of throwing
        return {
          response: language === 'ar' 
            ? 'عذراً، استغرق الأمر وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى.'
            : 'Sorry, this is taking longer than expected. Please try again.',
          success: false,
          processingTime: 45000,
          error: 'timeout_handled'
        };
      }
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new Error(language === 'ar' 
          ? 'مشكلة في الاتصال. يرجى التحقق من الإنترنت والمحاولة مرة أخرى.'
          : 'Connection issue. Please check your internet and try again.');
      }
      
      throw new Error(language === 'ar' 
        ? 'الخدمة غير متاحة مؤقتاً. يرجى المحاولة مرة أخرى.'
        : 'Service temporarily unavailable. Please try again in a moment.');
    }
  }

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
  
  // FIXED: Enhanced instance methods with improved persistence logic
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
  
  // NEW: Smart cleanup trigger for manual testing
  static async triggerSmartCleanup() {
    return ConversationSummaryManager.triggerCleanup();
  }
  
  triggerSmartCleanup() {
    return WaktiAIV2ServiceClass.triggerSmartCleanup();
  }
  
  // NEW: Method to clear personal touch cache for immediate settings application
  static clearPersonalTouchCache() {
    PersonalTouchCache.clearCache();
    console.log('🎯 Personal Touch Cache cleared - settings will apply immediately');
  }
  
  clearPersonalTouchCache() {
    return WaktiAIV2ServiceClass.clearPersonalTouchCache();
  }
}

export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
