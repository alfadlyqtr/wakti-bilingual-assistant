export type AIMode = 'general' | 'writer' | 'creative' | 'assistant';

export const ASSISTANT_MODES = [
  {
    id: 'general',
    name: 'Chat',
    description: 'General conversation',
    color: {
      dark: '#3498db',
      light: '#3498db'
    },
    activeColor: {
      dark: '#2980b9',
      light: '#2980b9'  
    },
    icon: 'MessageSquare'
  },
  {
    id: 'writer',
    name: 'Type',
    description: 'Writing assistant',
    color: {
      dark: '#1abc9c',
      light: '#1abc9c'
    },
    activeColor: {
      dark: '#16a085',
      light: '#16a085'
    },
    icon: 'Edit3'
  },
  {
    id: 'creative',
    name: 'Create',
    description: 'Creative generation',
    color: {
      dark: '#e67e22',
      light: '#e67e22'
    },
    activeColor: {
      dark: '#d35400',
      light: '#d35400'
    },
    icon: 'Paintbrush'
  },
  {
    id: 'assistant',
    name: 'Plan',
    description: 'Task management',
    color: {
      dark: '#9b59b6',
      light: '#9b59b6'
    },
    activeColor: {
      dark: '#8e44ad',
      light: '#8e44ad'
    },
    icon: 'Calendar'
  }
];

// Chat message interface
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode: AIMode;
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
  metadata?: any;
}

// Intent types
export type AIIntent = 
  | 'general_chat'
  | 'create_task'
  | 'create_reminder'
  | 'create_event'
  | 'generate_image'
  | 'math_question';

// Interface for intent data
export interface IntentData {
  intent: AIIntent;
  data: any;
}
