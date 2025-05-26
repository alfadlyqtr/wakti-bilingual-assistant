
export type AIMode = 'general' | 'creative' | 'writer' | 'assistant';

export interface ActionButton {
  id: string;
  text: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  action: string;
  data?: any;
  autoTrigger?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'image' | 'action' | 'system';
  imageUrl?: string;
  actions?: ActionButton[];
  autoExecuted?: boolean;
  isLoading?: boolean;
  originalPrompt?: string;
  actionButtons?: {
    primary?: {
      text: string;
      action: string;
    };
    secondary?: {
      text: string;
      action: string;
    };
  };
  metadata?: {
    intent?: string;
    confidence?: number;
    executionTime?: number;
    provider?: 'deepseek' | 'openai' | 'system' | 'error';
    userId?: string;
    imageUrl?: string;
    imagePrompt?: string;
    hasMedia?: boolean;
    actionButtons?: any;
    intentData?: {
      intent?: string;
      data?: any;
      directGeneration?: boolean;
    };
  };
}

export interface AIContext {
  currentPage?: string;
  recentActions?: string[];
  userPreferences?: Record<string, any>;
  taskCount?: number;
  eventCount?: number;
  reminderCount?: number;
  lastInteraction?: Date;
}

export interface IntentResult {
  intent: string;
  confidence: number;
  data?: any;
  autoExecute?: boolean;
  suggestedActions?: ActionButton[];
}
