// Agent-related type interfaces for the AI Coder

export interface AgentState {
  isEditing: boolean;
  isGenerating: boolean;
  thinkingStartTime: number | null;
  toolsUsedCount: number;
  editedFiles: EditedFile[];
  currentTool?: string;
  lastThinkingDuration?: number;
}

export interface EditedFile {
  id: string;
  fileName: string;
  status: 'editing' | 'edited';
}

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
  result?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  questionAr?: string;
  options: Array<{
    label: string;
    labelAr?: string;
    value: string;
  }>;
  multiSelect?: boolean;
}

export interface PendingMigration {
  title: string;
  titleAr?: string;
  sqlPreview: string;
  description?: string;
  descriptionAr?: string;
}
