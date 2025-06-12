
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
  quotaStatus?: any;
  requiresSearchConfirmation?: boolean;
  imageUrl?: string;
  isTextGenerated?: boolean;
  actionResult?: any;
  fileAnalysisResults?: any[];
  deepIntegration?: any;
  automationSuggestions?: any[];
  predictiveInsights?: any;
  workflowActions?: any[];
  contextualActions?: any[];
  needsConfirmation?: boolean;
  pendingTaskData?: any;
  pendingReminderData?: any;
  attachedFiles?: any[];
}

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  language: string;
  created_at: string;
  updated_at: string;
}
