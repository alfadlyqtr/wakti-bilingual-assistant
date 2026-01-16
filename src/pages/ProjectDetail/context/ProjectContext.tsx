// Project Context - Shared state across all ProjectDetail components
// Part of Group A Enhancement: Code Quality & Performance

import React, { createContext, useContext, ReactNode } from 'react';
import type {
  Project,
  ProjectFile,
  ChatMessage,
  BackendContext,
  UploadedAsset,
  SelectedElementInfo,
  AIError,
  EditedFileTracking,
  GenerationStep,
  PendingMigration,
  DeviceView,
  LeftPanelMode,
  MainTab,
  RightPanelMode,
  ImageAttachment,
  ClarifyingQuestion,
  PendingElementImageEdit,
  CreationPromptInfo,
} from '../types';

interface ProjectContextValue {
  // Project data
  project: Project | null;
  files: ProjectFile[];
  generatedFiles: Record<string, string>;
  codeContent: string;
  loading: boolean;
  saving: boolean;
  
  // Chat state
  chatMessages: ChatMessage[];
  chatInput: string;
  attachedImages: ImageAttachment[];
  aiEditing: boolean;
  isGenerating: boolean;
  dynamicSuggestions: string[];
  
  // UI state
  deviceView: DeviceView;
  leftPanelMode: LeftPanelMode;
  mainTab: MainTab;
  rightPanelMode: RightPanelMode;
  mobileTab: 'chat' | 'preview';
  leftPanelWidth: number;
  
  // Visual edit state
  elementSelectMode: boolean;
  selectedElementInfo: SelectedElementInfo | null;
  showElementEditPopover: boolean;
  pendingElementImageEdit: PendingElementImageEdit | null;
  
  // Error state
  crashReport: string | null;
  aiError: AIError | null;
  autoFixCountdown: number | null;
  
  // Backend context
  backendContext: BackendContext | null;
  uploadedAssets: UploadedAsset[];
  
  // Agent mode state
  thinkingStartTime: number | null;
  toolsUsedCount: number;
  editedFilesTracking: EditedFileTracking[];
  generationSteps: GenerationStep[];
  lastThinkingDuration: number | null;
  
  // Dialogs & Modals
  showClarifyingQuestions: boolean;
  clarifyingQuestions: ClarifyingQuestion[];
  pendingPrompt: string;
  showMigrationApproval: boolean;
  pendingMigration: PendingMigration | null;
  showStockPhotoSelector: boolean;
  showPublishModal: boolean;
  
  // Language
  isRTL: boolean;
  language: string;
  
  // User instructions
  userInstructions: string;
  creationPromptInfo: CreationPromptInfo | null;
  
  // Sandpack key for forcing re-render
  sandpackKey: number;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectContextProvider');
  }
  return context;
}

interface ProjectContextProviderProps {
  children: ReactNode;
  value: ProjectContextValue;
}

export function ProjectContextProvider({ children, value }: ProjectContextProviderProps) {
  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export { ProjectContext };
export type { ProjectContextValue };
