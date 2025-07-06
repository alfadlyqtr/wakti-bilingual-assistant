import { supabase } from '@/integrations/supabase/client';
import { ChatMemoryService } from './ChatMemoryService';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: 'high' | 'medium' | 'low';
  actionTaken?: boolean | null;
  inputType?: 'text' | 'voice';
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

export interface ConversationContext {
  recentMessages: AIMessage[];
  conversationSummary: string;
  messageCount: number;
  conversationId: string | null;
}

class WaktiAIV2ServiceClass {
  private memoryService: ChatMemoryService;
  private conversationCache = new Map<string, ConversationContext>();
  private saveQueue: Array<() => Promise<void>> = [];
  private processing = false;

  constructor() {
    this.memoryService = new ChatMemoryService();
    this.startBackgroundProcessor();
  }

  // ULTRA-FAST: Background processor for memory operations
  private startBackgroundProcessor() {
    setInterval(async () => {
      if (this.processing || this.saveQueue.length === 0) return;
      
      this.processing = true;
      const tasks = [...this.saveQueue];
      this.saveQueue.length = 0;
      
      try {
        await Promise.allSettled(tasks.map(task => task()));
      } catch (error) {
        console.warn('Background memory save failed:', error);
      } finally {
        this.processing = false;
      }
    }, 1000); // Process queue every second
  }

  // NEW: Clear personal touch cache method
  clearPersonalTouchCache() {
    // Clear any cached personal touch data if we had it
    // For now this is a placeholder since personal touch is stored in localStorage
    console.log('Personal touch cache cleared - settings will reload from localStorage');
  }

  // ULTRA-FAST: Get or create conversation (with caching)
  private async getOrCreateConversation(userId: string, existingConversationId?: string | null): Promise<string> {
    if (existingConversationId) {
      return existingConversationId;
    }

    try {
      // Create new conversation
      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: userId,
          title: 'WAKTI AI Conversation',
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.warn('Conversation creation failed, using fallback ID:', error);
      return `fallback-${Date.now()}`;
    }
  }

  // ULTRA-FAST: Load conversation context in parallel
  private async loadConversationContext(userId: string, conversationId: string | null): Promise<ConversationContext> {
    if (!conversationId) {
      return {
        recentMessages: [],
        conversationSummary: '',
        messageCount: 0,
        conversationId: null
      };
    }

    // Check cache first
    if (this.conversationCache.has(conversationId)) {
      return this.conversationCache.get(conversationId)!;
    }

    try {
      // Load in parallel: recent messages and summary
      const [messagesResult, summaryResult] = await Promise.allSettled([
        this.loadRecentMessages(conversationId),
        this.loadConversationSummary(userId, conversationId)
      ]);

      const recentMessages = messagesResult.status === 'fulfilled' ? messagesResult.value : [];
      const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : '';

      const context: ConversationContext = {
        recentMessages,
        conversationSummary: summary,
        messageCount: recentMessages.length,
        conversationId
      };

      // Cache for 5 minutes
      this.conversationCache.set(conversationId, context);
      setTimeout(() => this.conversationCache.delete(conversationId), 5 * 60 * 1000);

      return context;
    } catch (error) {
      console.warn('Context loading failed:', error);
      return {
        recentMessages: [],
        conversationSummary: '',
        messageCount: 0,
        conversationId
      };
    }
  }

  // Load recent messages (last 10)
  private async loadRecentMessages(conversationId: string): Promise<AIMessage[]> {
    const { data, error } = await supabase
      .from('ai_chat_history')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return (data || []).reverse().map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at),
      intent: msg.intent,
      confidence: msg.confidence_level as 'high' | 'medium' | 'low',
      actionTaken: msg.action_taken,
      inputType: msg.input_type as 'text' | 'voice',
      browsingUsed: msg.browsing_used,
      browsingData: msg.browsing_data
    }));
  }

  // Load conversation summary
  private async loadConversationSummary(userId: string, conversationId: string): Promise<string> {
    const { data, error } = await supabase
      .from('ai_conversation_summaries')
      .select('summary_text')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .single();

    if (error || !data) return '';
    return data.summary_text;
  }

  // ULTRA-FAST: Queue message saving for background processing
  private queueMessageSave(userId: string, conversationId: string, message: AIMessage, response?: AIMessage) {
    this.saveQueue.push(async () => {
      try {
        const messagesToSave = response ? [message, response] : [message];
        
        const insertData = messagesToSave.map(msg => ({
          user_id: userId,
          conversation_id: conversationId,
          role: msg.role,
          content: msg.content,
          intent: msg.intent,
          confidence_level: msg.confidence,
          action_taken: msg.actionTaken,
          input_type: msg.inputType || 'text',
          browsing_used: msg.browsingUsed || false,
          browsing_data: msg.browsingData,
          metadata: {
            imageUrl: msg.imageUrl,
            attachedFiles: msg.attachedFiles
          }
        }));

        await supabase.from('ai_chat_history').insert(insertData);
        
        // Update conversation timestamp
        await supabase
          .from('ai_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);

        // Clear cache to force refresh
        this.conversationCache.delete(conversationId);
        
        console.log('✅ Memory: Background saved', messagesToSave.length, 'messages');
      } catch (error) {
        console.warn('Background message save failed:', error);
      }
    });
  }

  // ENHANCED: Main send message with memory integration
  async sendMessage(
    message: string,
    userId?: string,
    language: string = 'en',
    conversationId?: string | null,
    inputType: 'text' | 'voice' = 'text',
    recentMessages: AIMessage[] = [],
    skipContextLoad: boolean = false,
    activeTrigger: string = 'chat',
    conversationSummary: string = '',
    attachedFiles: any[] = []
  ) {
    try {
      // Get user ID
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');
        userId = user.id;
      }

      // ULTRA-FAST: Get/create conversation and load context in parallel
      const [actualConversationId, contextPromise] = await Promise.all([
        this.getOrCreateConversation(userId, conversationId),
        skipContextLoad ? Promise.resolve(null) : this.loadConversationContext(userId, conversationId)
      ]);

      const context = contextPromise || {
        recentMessages: recentMessages.slice(-8), // Use provided messages if skipping context load
        conversationSummary,
        messageCount: recentMessages.length,
        conversationId: actualConversationId
      };

      // Create user message object
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        inputType: inputType,
        attachedFiles: attachedFiles
      };

      // ENHANCED: Call AI brain with full context
      const { data, error } = await supabase.functions.invoke('wakti-ai-v2-brain', {
        body: {
          message,
          userId,
          language,
          conversationId: actualConversationId,
          inputType,
          activeTrigger,
          attachedFiles,
          conversationSummary: context.conversationSummary,
          recentMessages: context.recentMessages,
          customSystemPrompt: '',
          maxTokens: 400,
          userStyle: 'detailed',
          userTone: 'neutral',
          speedOptimized: true,
          aggressiveOptimization: false,
          hasTaskIntent: false,
          personalityEnabled: true,
          enableTaskCreation: true,
          enablePersonality: true,
          personalTouch: this.getPersonalTouch()
        }
      });

      if (error) throw error;

      // Create assistant response message
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

      // ULTRA-FAST: Queue background save (fire-and-forget)
      this.queueMessageSave(userId, actualConversationId, userMessage, assistantMessage);

      // ULTRA-FAST: Update memory service in background
      this.saveQueue.push(async () => {
        try {
          await this.memoryService.addMessage(userMessage);
          await this.memoryService.addMessage(assistantMessage);
          console.log('✅ Memory: ChatMemoryService updated');
        } catch (error) {
          console.warn('Memory service update failed:', error);
        }
      });

      return {
        ...data,
        conversationId: actualConversationId,
        response: assistantMessage.content
      };

    } catch (error: any) {
      console.error('AI Service Error:', error);
      throw new Error(error.message || 'AI request failed');
    }
  }

  // Get personal touch settings
  private getPersonalTouch() {
    try {
      const stored = localStorage.getItem('wakti_personal_touch');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  // Get conversations
  async getConversations(): Promise<AIConversation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, title, last_message_at, created_at')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return (data || []).map(conv => ({
        id: conv.id,
        title: conv.title,
        lastMessageAt: new Date(conv.last_message_at),
        createdAt: new Date(conv.created_at)
      }));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  // Get conversation messages
  async getConversationMessages(conversationId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      return [];
    }
  }

  // Delete conversation
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      // Delete in parallel
      await Promise.all([
        supabase.from('ai_chat_history').delete().eq('conversation_id', conversationId),
        supabase.from('ai_conversations').delete().eq('id', conversationId)
      ]);
      
      // Clear cache
      this.conversationCache.delete(conversationId);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  // Session management (browser storage)
  saveChatSession(messages: AIMessage[], conversationId?: string | null) {
    try {
      const sessionData = {
        messages: messages.slice(-10), // Keep last 10 messages
        conversationId,
        timestamp: Date.now()
      };
      localStorage.setItem('wakti_ai_session', JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Session save failed:', error);
    }
  }

  loadChatSession(): { messages: AIMessage[], conversationId?: string | null } | null {
    try {
      const stored = localStorage.getItem('wakti_ai_session');
      if (!stored) return null;

      const sessionData = JSON.parse(stored);
      
      // Check if session is not too old (24 hours)
      if (Date.now() - sessionData.timestamp > 24 * 60 * 60 * 1000) {
        this.clearChatSession();
        return null;
      }

      return {
        messages: sessionData.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })),
        conversationId: sessionData.conversationId
      };
    } catch (error) {
      console.warn('Session load failed:', error);
      return null;
    }
  }

  clearChatSession() {
    try {
      localStorage.removeItem('wakti_ai_session');
    } catch (error) {
      console.warn('Session clear failed:', error);
    }
  }
}

// Export singleton instance
export const WaktiAIV2Service = new WaktiAIV2ServiceClass();
export { WaktiAIV2ServiceClass };
