export interface ConversationMetadata {
  id: string;
  title: string;
  lastMessageAt: Date;
  messageCount: number;
  createdAt: Date;
}

export interface StoredConversation {
  id: string;
  title: string;
  messages: any[];
  lastMessageAt: Date;
  messageCount: number;
  createdAt: Date;
}

class EnhancedFrontendMemoryClass {
  private generateConversationId(): string {
    return `frontend-conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateConversationTitle(firstMessage: string): string {
    const cleaned = firstMessage.trim().substring(0, 50);
    return cleaned.length > 47 ? cleaned + '...' : cleaned;
  }

  // Active conversation management
  saveActiveConversation(messages: any[], conversationId?: string | null): string {
    try {
      // Normalize input defensively
      const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];
      const normalized = safeMessages.map(m => ({
        ...m,
        role: m?.role || 'assistant',
        content: typeof m?.content === 'string' ? m.content : ''
      }));

      const actualId = conversationId || this.generateConversationId();
      const title = normalized.length > 0 ? this.generateConversationTitle(normalized[0].content) : 'New Conversation';
      
      const activeData = {
        id: actualId,
        title,
        messages: normalized.slice(-20), // Keep last 20 messages
        lastMessageAt: Date.now(),
        messageCount: normalized.length,
        createdAt: Date.now()
      };
      
      localStorage.setItem('wakti_active_conversation', JSON.stringify(activeData));
      console.log('✅ FRONTEND BOSS: Saved active conversation', actualId, 'with', normalized.length, 'messages');
      
      return actualId;
    } catch (error) {
      console.error('❌ FRONTEND BOSS: Failed to save active conversation:', error);
      return conversationId || this.generateConversationId();
    }
  }

  loadActiveConversation(): { messages: any[], conversationId: string | null } {
    try {
      const stored = localStorage.getItem('wakti_active_conversation');
      if (!stored) {
        console.log('💭 FRONTEND BOSS: No active conversation found');
        return { messages: [], conversationId: null };
      }

      const data = JSON.parse(stored);
      
      // Check if data is less than 24 hours old
      const now = Date.now();
      const age = now - (data.lastMessageAt || 0);
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (age > maxAge) {
        // Auto-archive expired conversation
        this.archiveConversation(data);
        localStorage.removeItem('wakti_active_conversation');
        console.log('📦 FRONTEND BOSS: Auto-archived expired active conversation');
        return { messages: [], conversationId: null };
      }

      console.log('✅ FRONTEND BOSS: Loaded active conversation', data.id, 'with', data.messages?.length || 0, 'messages');
      return {
        messages: data.messages || [],
        conversationId: data.id || null
      };
    } catch (error) {
      console.error('❌ FRONTEND BOSS: Failed to load active conversation:', error);
      return { messages: [], conversationId: null };
    }
  }

  clearActiveConversation() {
    try {
      localStorage.removeItem('wakti_active_conversation');
      console.log('🗑️ FRONTEND BOSS: Cleared active conversation');
    } catch (error) {
      console.error('❌ FRONTEND BOSS: Failed to clear active conversation:', error);
    }
  }

  // Sidebar archive management
  archiveCurrentConversation(messages: any[], conversationId: string | null): boolean {
    if (!conversationId || messages.length === 0) {
      console.log('⚠️ FRONTEND BOSS: No conversation to archive');
      return false;
    }

    try {
      const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];
      const normalized = safeMessages.map(m => ({
        ...m,
        role: m?.role || 'assistant',
        content: typeof m?.content === 'string' ? m.content : ''
      }));

      const conversation: StoredConversation = {
        id: conversationId,
        title: this.generateConversationTitle(normalized[0]?.content || ''),
        messages: normalized.slice(-20), // Keep last 20 messages
        lastMessageAt: new Date(),
        messageCount: normalized.length,
        createdAt: new Date()
      };

      this.archiveConversation(conversation);
      console.log('📦 FRONTEND BOSS: Archived conversation', conversationId, 'to sidebar');
      return true;
    } catch (error) {
      console.error('❌ FRONTEND BOSS: Failed to archive conversation:', error);
      return false;
    }
  }

  private archiveConversation(conversation: StoredConversation) {
    try {
      const stored = localStorage.getItem('wakti_archived_conversations');
      const archived: StoredConversation[] = stored ? JSON.parse(stored) : [];
      
      // Remove if already exists (prevent duplicates)
      const filtered = archived.filter(conv => conv.id !== conversation.id);
      
      // Add to beginning and keep only last 5
      filtered.unshift(conversation);
      const limitedArchived = filtered.slice(0, 5);
      
      localStorage.setItem('wakti_archived_conversations', JSON.stringify(limitedArchived));
      console.log('📦 FRONTEND BOSS: Conversation archived, total archived:', limitedArchived.length);
    } catch (error) {
      console.error('❌ FRONTEND BOSS: Failed to save to archive:', error);
    }
  }

  loadArchivedConversations(): ConversationMetadata[] {
    try {
      const stored = localStorage.getItem('wakti_archived_conversations');
      const archived: StoredConversation[] = stored ? JSON.parse(stored) : [];
      
      return archived.map(conv => ({
        id: conv.id,
        title: conv.title,
        lastMessageAt: new Date(conv.lastMessageAt),
        messageCount: conv.messageCount,
        createdAt: new Date(conv.createdAt)
      }));
    } catch (error) {
      console.error('❌ FRONTEND BOSS: Failed to load archived conversations:', error);
      return [];
    }
  }

  loadArchivedConversation(conversationId: string): { messages: any[], conversationId: string } | null {
    try {
      const stored = localStorage.getItem('wakti_archived_conversations');
      const archived: StoredConversation[] = stored ? JSON.parse(stored) : [];
      
      const conversation = archived.find(conv => conv.id === conversationId);
      if (!conversation) {
        console.log('❌ FRONTEND BOSS: Archived conversation not found:', conversationId);
        return null;
      }

      console.log('✅ FRONTEND BOSS: Loaded archived conversation', conversationId, 'with', conversation.messages.length, 'messages');
      return {
        messages: conversation.messages,
        conversationId: conversation.id
      };
    } catch (error) {
      console.error('❌ FRONTEND BOSS: Failed to load archived conversation:', error);
      return null;
    }
  }

  deleteArchivedConversation(conversationId: string): boolean {
    try {
      const stored = localStorage.getItem('wakti_archived_conversations');
      const archived: StoredConversation[] = stored ? JSON.parse(stored) : [];
      
      const filtered = archived.filter(conv => conv.id !== conversationId);
      localStorage.setItem('wakti_archived_conversations', JSON.stringify(filtered));
      
      console.log('🗑️ FRONTEND BOSS: Deleted archived conversation', conversationId);
      return true;
    } catch (error) {
      console.error('❌ FRONTEND BOSS: Failed to delete archived conversation:', error);
      return false;
    }
  }

  // New conversation workflow
  startNewConversation(currentMessages: any[], currentConversationId: string | null): string {
    console.log('🔄 FRONTEND BOSS: Starting new conversation workflow');
    
    // Archive current conversation if it exists
    if (currentConversationId && currentMessages.length > 0) {
      this.archiveCurrentConversation(currentMessages, currentConversationId);
    }
    
    // Clear active conversation
    this.clearActiveConversation();
    
    // Generate new conversation ID
    const newConversationId = this.generateConversationId();
    console.log('✅ FRONTEND BOSS: New conversation started:', newConversationId);
    
    return newConversationId;
  }

  // Clear all memory
  clearAllMemory() {
    try {
      localStorage.removeItem('wakti_active_conversation');
      localStorage.removeItem('wakti_archived_conversations');
      console.log('🗑️ FRONTEND BOSS: Cleared all memory');
    } catch (error) {
      console.error('❌ FRONTEND BOSS: Failed to clear all memory:', error);
    }
  }
}

export const EnhancedFrontendMemory = new EnhancedFrontendMemoryClass();
export { EnhancedFrontendMemoryClass };
