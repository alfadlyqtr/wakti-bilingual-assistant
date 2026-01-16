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
} from '../types';

interface ProjectContextValue {
  // Project data
  project: Project | null;
  files: ProjectFile[];
  generatedFiles: Record<string, string>;
  codeContent: string;
  loading: boolean;
  
  // Chat state
  chatMessages: ChatMessage[];
  chatInput: string;
  attachedImages: ImageAttachment[];
  aiEditing: boolean;
  isGenerating: boolean;
  
  // UI state
  deviceView: DeviceView;
  leftPanelMode: LeftPanelMode;
  mainTab: MainTab;
  rightPanelMode: RightPanelMode;
  mobileTab: 'chat' | 'preview';
  
  // Visual edit state
  elementSelectMode: boolean;
  selectedElementInfo: SelectedElementInfo | null;
  showElementEditPopover: boolean;
  
  // Error state
  crashReport: string | null;
  aiError: AIError | null;
  
  // Backend context
  backendContext: BackendContext | null;
  uploadedAssets: UploadedAsset[];
  
  // Agent mode state
  thinkingStartTime: number | null;
  toolsUsedCount: number;
  editedFilesTracking: EditedFileTracking[];
  generationSteps: GenerationStep[];
  
  // Language
  isRTL: boolean;
  language: string;
  
  // Actions - these will be provided by hooks
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  setFiles: React.Dispatch<React.SetStateAction<ProjectFile[]>>;
  setGeneratedFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setCodeContent: React.Dispatch<React.SetStateAction<string>>;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  setAttachedImages: React.Dispatch<React.SetStateAction<ImageAttachment[]>>;
  setAiEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  setDeviceView: React.Dispatch<React.SetStateAction<DeviceView>>;
  setLeftPanelMode: React.Dispatch<React.SetStateAction<LeftPanelMode>>;
  setMainTab: React.Dispatch<React.SetStateAction<MainTab>>;
  setRightPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
  setMobileTab: React.Dispatch<React.SetStateAction<'chat' | 'preview'>>;
  setElementSelectMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedElementInfo: React.Dispatch<React.SetStateAction<SelectedElementInfo | null>>;
  setShowElementEditPopover: React.Dispatch<React.SetStateAction<boolean>>;
  setCrashReport: React.Dispatch<React.SetStateAction<string | null>>;
  setAiError: React.Dispatch<React.SetStateAction<AIError | null>>;
  setBackendContext: React.Dispatch<React.SetStateAction<BackendContext | null>>;
  setThinkingStartTime: React.Dispatch<React.SetStateAction<number | null>>;
  setToolsUsedCount: React.Dispatch<React.SetStateAction<number>>;
  setEditedFilesTracking: React.Dispatch<React.SetStateAction<EditedFileTracking[]>>;
  setGenerationSteps: React.Dispatch<React.SetStateAction<GenerationStep[]>>;
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
