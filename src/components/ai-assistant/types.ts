
export type AIMode = 'general' | 'creative' | 'writer' | 'assistant';

export const ASSISTANT_MODES = [
  {
    id: 'general' as const,
    label: { en: 'General', ar: 'عام' },
    color: { light: '#3498db', dark: '#5dade2' }
  },
  {
    id: 'creative' as const,
    label: { en: 'Creative', ar: 'إبداعي' },
    color: { light: '#e67e22', dark: '#f39c12' }
  },
  {
    id: 'writer' as const,
    label: { en: 'Writer', ar: 'كاتب' },
    color: { light: '#9b59b6', dark: '#bb8fce' }
  },
  {
    id: 'assistant' as const,
    label: { en: 'Assistant', ar: 'مساعد' },
    color: { light: '#27ae60', dark: '#58d68d' }
  }
];

export interface ActionButton {
  id: string;
  text: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  action: string;
  data?: any;
  autoTrigger?: boolean;
}

export interface ModeSwitchAction {
  targetMode: AIMode;
  action: string;
  autoTrigger?: boolean;
}

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
  isLoading?: boolean;
  originalPrompt?: string;
  modeSwitchAction?: ModeSwitchAction;
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
