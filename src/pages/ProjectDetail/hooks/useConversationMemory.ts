import { useState, useCallback, useRef, useEffect } from 'react';

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    hasCode?: boolean;
    filesModified?: string[];
    toolsUsed?: string[];
  };
}

export interface ProjectContext {
  projectId: string;
  projectName?: string;
  currentFile?: string;
  openFiles: string[];
  technologies: string[];
  recentErrors: string[];
}

export interface UserContext {
  language: string;
  isRTL: boolean;
  preferences: {
    verbosity: 'concise' | 'detailed';
    autoApply: boolean;
  };
}

export interface ConversationMemory {
  messages: ContextMessage[];
  projectContext: ProjectContext;
  userContext: UserContext;
  summaries: string[];
  lastUpdated: number;
}

const MAX_MESSAGES = 20; // Keep last 20 messages in context
const SUMMARY_THRESHOLD = 10; // Summarize after 10 messages

interface UseConversationMemoryOptions {
  projectId: string;
  maxMessages?: number;
  persistKey?: string;
}

interface UseConversationMemoryReturn {
  memory: ConversationMemory;
  addMessage: (role: ContextMessage['role'], content: string, metadata?: ContextMessage['metadata']) => void;
  updateProjectContext: (update: Partial<ProjectContext>) => void;
  updateUserContext: (update: Partial<UserContext>) => void;
  getContextForAI: () => string;
  getRecentMessages: (count?: number) => ContextMessage[];
  clearMemory: () => void;
  summarizeConversation: () => Promise<string>;
}

/**
 * Hook for managing conversation memory with context awareness
 * This enables the AI to remember past interactions and maintain context
 */
export function useConversationMemory({
  projectId,
  maxMessages = MAX_MESSAGES,
  persistKey,
}: UseConversationMemoryOptions): UseConversationMemoryReturn {
  const [memory, setMemory] = useState<ConversationMemory>(() => {
    // Try to restore from localStorage if persistKey provided
    if (persistKey) {
      try {
        const stored = localStorage.getItem(`wakti-memory-${persistKey}`);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Failed to restore conversation memory:', e);
      }
    }
    
    return {
      messages: [],
      projectContext: {
        projectId,
        openFiles: [],
        technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Vite'],
        recentErrors: [],
      },
      userContext: {
        language: 'en',
        isRTL: false,
        preferences: {
          verbosity: 'concise',
          autoApply: true,
        },
      },
      summaries: [],
      lastUpdated: Date.now(),
    };
  });

  // Persist to localStorage when memory changes
  useEffect(() => {
    if (persistKey) {
      try {
        localStorage.setItem(`wakti-memory-${persistKey}`, JSON.stringify(memory));
      } catch (e) {
        console.warn('Failed to persist conversation memory:', e);
      }
    }
  }, [memory, persistKey]);

  /**
   * Add a message to the conversation memory
   */
  const addMessage = useCallback((
    role: ContextMessage['role'],
    content: string,
    metadata?: ContextMessage['metadata']
  ) => {
    setMemory(prev => {
      const newMessage: ContextMessage = {
        role,
        content,
        timestamp: Date.now(),
        metadata,
      };

      let messages = [...prev.messages, newMessage];

      // Trim to max messages
      if (messages.length > maxMessages) {
        messages = messages.slice(-maxMessages);
      }

      return {
        ...prev,
        messages,
        lastUpdated: Date.now(),
      };
    });
  }, [maxMessages]);

  /**
   * Update project context
   */
  const updateProjectContext = useCallback((update: Partial<ProjectContext>) => {
    setMemory(prev => ({
      ...prev,
      projectContext: { ...prev.projectContext, ...update },
      lastUpdated: Date.now(),
    }));
  }, []);

  /**
   * Update user context
   */
  const updateUserContext = useCallback((update: Partial<UserContext>) => {
    setMemory(prev => ({
      ...prev,
      userContext: { ...prev.userContext, ...update },
      lastUpdated: Date.now(),
    }));
  }, []);

  /**
   * Generate context string for AI prompts
   */
  const getContextForAI = useCallback((): string => {
    const { messages, projectContext, userContext, summaries } = memory;
    
    const parts: string[] = [];

    // Add summaries of older conversations
    if (summaries.length > 0) {
      parts.push('## Previous Conversation Summary');
      parts.push(summaries.join('\n'));
    }

    // Add project context
    parts.push('## Project Context');
    parts.push(`- Project: ${projectContext.projectName || projectContext.projectId}`);
    if (projectContext.currentFile) {
      parts.push(`- Current file: ${projectContext.currentFile}`);
    }
    if (projectContext.openFiles.length > 0) {
      parts.push(`- Open files: ${projectContext.openFiles.join(', ')}`);
    }
    parts.push(`- Technologies: ${projectContext.technologies.join(', ')}`);
    
    if (projectContext.recentErrors.length > 0) {
      parts.push('## Recent Errors');
      projectContext.recentErrors.slice(-3).forEach(err => {
        parts.push(`- ${err}`);
      });
    }

    // Add user preferences
    parts.push('## User Preferences');
    parts.push(`- Language: ${userContext.language}`);
    parts.push(`- Verbosity: ${userContext.preferences.verbosity}`);

    // Add recent conversation
    if (messages.length > 0) {
      parts.push('## Recent Conversation');
      messages.slice(-10).forEach(msg => {
        const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
        // Truncate long messages
        const content = msg.content.length > 200 
          ? msg.content.slice(0, 200) + '...'
          : msg.content;
        parts.push(`${role}: ${content}`);
        
        if (msg.metadata?.filesModified?.length) {
          parts.push(`  (Modified: ${msg.metadata.filesModified.join(', ')})`);
        }
      });
    }

    return parts.join('\n');
  }, [memory]);

  /**
   * Get recent messages
   */
  const getRecentMessages = useCallback((count: number = 10): ContextMessage[] => {
    return memory.messages.slice(-count);
  }, [memory.messages]);

  /**
   * Clear all memory
   */
  const clearMemory = useCallback(() => {
    setMemory({
      messages: [],
      projectContext: {
        projectId,
        openFiles: [],
        technologies: ['React', 'TypeScript', 'Tailwind CSS', 'Vite'],
        recentErrors: [],
      },
      userContext: memory.userContext, // Preserve user context
      summaries: [],
      lastUpdated: Date.now(),
    });
    
    if (persistKey) {
      localStorage.removeItem(`wakti-memory-${persistKey}`);
    }
  }, [projectId, memory.userContext, persistKey]);

  /**
   * Summarize older messages to compress context
   */
  const summarizeConversation = useCallback(async (): Promise<string> => {
    const { messages } = memory;
    
    if (messages.length < SUMMARY_THRESHOLD) {
      return '';
    }

    // Simple local summarization (can be enhanced with AI later)
    const oldMessages = messages.slice(0, -5); // Keep last 5 fresh
    
    const userRequests = oldMessages
      .filter(m => m.role === 'user')
      .map(m => m.content.slice(0, 100))
      .join('; ');
    
    const filesModified = new Set<string>();
    oldMessages.forEach(m => {
      m.metadata?.filesModified?.forEach(f => filesModified.add(f));
    });

    const summary = `User requested: ${userRequests}. Files modified: ${Array.from(filesModified).join(', ') || 'none'}.`;

    setMemory(prev => ({
      ...prev,
      messages: messages.slice(-5), // Keep only recent
      summaries: [...prev.summaries.slice(-2), summary], // Keep last 3 summaries
      lastUpdated: Date.now(),
    }));

    return summary;
  }, [memory]);

  return {
    memory,
    addMessage,
    updateProjectContext,
    updateUserContext,
    getContextForAI,
    getRecentMessages,
    clearMemory,
    summarizeConversation,
  };
}
