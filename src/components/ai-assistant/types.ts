
export type AIMode = 'general' | 'creative' | 'writer' | 'assistant';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  mode?: AIMode;
  type?: 'text' | 'image' | 'action' | 'system';
  imageUrl?: string;
  actions?: ActionButton[];
  autoExecuted?: boolean;
  metadata?: {
    intent?: string;
    confidence?: number;
    executionTime?: number;
    provider?: 'deepseek' | 'openai';
  };
}

export interface ActionButton {
  id: string;
  text: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  action: string;
  data?: any;
  autoTrigger?: boolean;
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
