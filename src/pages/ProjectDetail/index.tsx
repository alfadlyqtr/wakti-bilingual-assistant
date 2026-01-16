// ProjectDetail - Refactored Entry Point
// Part of Group A Enhancement: Performance & Code Quality
// This file orchestrates the modular hooks and components

import { Suspense, useEffect, useMemo, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Import modular hooks
import { useProjectState } from './hooks/useProjectState';
import { useChatState } from './hooks/useChatState';
import { useAgentMode } from './hooks/useAgentMode';
import { useVisualEditMode } from './hooks/useVisualEditMode';
import { useSandpackSync } from './hooks/useSandpackSync';

// Import regular components
import { ChatSkeleton } from './components/ChatSkeleton';
import { PreviewSkeleton } from './components/PreviewSkeleton';
import { SuspenseFallback } from './components/SuspenseFallback';

// Lazy load heavy components
const SandpackStudio = lazy(() => import('@/components/projects/SandpackStudio'));
const ElementEditPopover = lazy(() => 
  import('@/components/projects/ElementEditPopover').then(m => ({ default: m.ElementEditPopover }))
);

// Context provider
import { ProjectContextProvider } from './context/ProjectContext';
import type { ProjectContextValue } from './context/ProjectContext';

/**
 * ProjectDetailRefactored - The modular version of ProjectDetail
 * 
 * This component serves as the orchestrator that:
 * 1. Initializes all hooks
 * 2. Provides context to child components
 * 3. Renders the main layout with Suspense boundaries
 */
export function ProjectDetailRefactored() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useTheme();
  const { user } = useAuth();
  const isRTL = language === 'ar';

  // Initialize all hooks
  const projectState = useProjectState({
    projectId: id,
    userId: user?.id,
    isRTL,
  });

  const chatState = useChatState({
    projectId: id,
    isRTL,
  });

  const agentMode = useAgentMode({
    isRTL,
  });

  const visualEditMode = useVisualEditMode({
    isRTL,
  });

  const sandpackSync = useSandpackSync({
    projectId: id,
  });

  // Initialize files when project loads
  useEffect(() => {
    if (Object.keys(projectState.generatedFiles).length > 0) {
      sandpackSync.initializeFiles(projectState.generatedFiles);
    }
  }, [projectState.generatedFiles, sandpackSync]);

  // Fetch project on mount
  useEffect(() => {
    if (user && id) {
      projectState.fetchProject();
      chatState.fetchChatHistory();
      projectState.fetchUploadedAssets();
      projectState.fetchBackendContext();
    }
  }, [user, id, projectState, chatState]);

  // Build context value for provider
  const contextValue: ProjectContextValue = useMemo(() => ({
    // Project data
    project: projectState.project,
    files: projectState.files,
    generatedFiles: projectState.generatedFiles,
    codeContent: projectState.codeContent,
    loading: projectState.loading,
    saving: projectState.saving,
    
    // Chat state
    chatMessages: chatState.chatMessages,
    chatInput: chatState.chatInput,
    attachedImages: chatState.attachedImages,
    aiEditing: chatState.aiEditing,
    isGenerating: chatState.isGenerating,
    dynamicSuggestions: chatState.dynamicSuggestions,
    
    // UI state - defaults for now
    deviceView: 'desktop' as const,
    leftPanelMode: 'chat' as const,
    mainTab: 'builder' as const,
    rightPanelMode: 'preview' as const,
    mobileTab: 'preview' as const,
    leftPanelWidth: 420,
    
    // Visual edit state
    elementSelectMode: visualEditMode.elementSelectMode,
    selectedElementInfo: visualEditMode.selectedElementInfo,
    showElementEditPopover: visualEditMode.showElementEditPopover,
    pendingElementImageEdit: null,
    
    // Error state
    crashReport: null,
    aiError: null,
    autoFixCountdown: null,
    
    // Backend context
    backendContext: projectState.backendContext,
    uploadedAssets: projectState.uploadedAssets,
    
    // Agent mode state
    thinkingStartTime: agentMode.thinkingStartTime,
    toolsUsedCount: agentMode.toolsUsedCount,
    editedFilesTracking: agentMode.editedFilesTracking,
    generationSteps: agentMode.generationSteps,
    lastThinkingDuration: agentMode.lastThinkingDuration,
    
    // Dialogs - defaults for now
    showClarifyingQuestions: false,
    clarifyingQuestions: [],
    pendingPrompt: '',
    showMigrationApproval: false,
    pendingMigration: null,
    showStockPhotoSelector: false,
    showPublishModal: false,
    
    // Language
    isRTL,
    language,
    
    // User instructions
    userInstructions: '',
    creationPromptInfo: null,
    
    // Sandpack
    sandpackKey: sandpackSync.sandpackKey,
  }), [
    projectState,
    chatState,
    agentMode,
    visualEditMode,
    sandpackSync,
    isRTL,
    language,
  ]);

  // Redirect if no project access
  useEffect(() => {
    if (!projectState.loading && !projectState.project && id) {
      navigate('/projects');
    }
  }, [projectState.loading, projectState.project, id, navigate]);

  // Loading state
  if (projectState.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <SuspenseFallback type="default" isRTL={isRTL} />
      </div>
    );
  }

  return (
    <ProjectContextProvider value={contextValue}>
      <div className={cn(
        "h-screen flex flex-col bg-background overflow-hidden",
        isRTL && "rtl"
      )}>
        {/* Main Layout - Left Panel (Chat) + Right Panel (Preview) */}
        <div className="flex-1 flex min-h-0">
          {/* Left Panel - Chat/Code */}
          <div className="w-[420px] border-r border-border flex flex-col">
            <Suspense fallback={<ChatSkeleton isRTL={isRTL} />}>
              {/* Chat panel content will be added in next phase */}
              <div className="flex-1 p-4 flex flex-col items-center justify-center text-muted-foreground">
                <p className="text-sm">
                  {isRTL ? 'لوحة المحادثة' : 'Chat Panel'}
                </p>
                <p className="text-xs mt-1 opacity-60">
                  {chatState.chatMessages.length} {isRTL ? 'رسائل' : 'messages'}
                </p>
              </div>
            </Suspense>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 flex flex-col min-w-0">
            <Suspense fallback={<PreviewSkeleton isRTL={isRTL} />}>
              {Object.keys(projectState.generatedFiles).length > 0 ? (
                <SandpackStudio
                  key={sandpackSync.stableKey}
                  files={projectState.generatedFiles}
                  elementSelectMode={visualEditMode.elementSelectMode}
                  onElementSelect={(_ref, info) => {
                    if (info) visualEditMode.handleElementSelected(info);
                  }}
                  isLoading={chatState.isGenerating}
                  deviceView="desktop"
                />
              ) : (
                <PreviewSkeleton isRTL={isRTL} />
              )}
            </Suspense>
          </div>
        </div>

        {/* Modals - Lazy loaded with Suspense */}
        <Suspense fallback={null}>
          {visualEditMode.showElementEditPopover && visualEditMode.selectedElementInfo && (
            <ElementEditPopover
              element={visualEditMode.selectedElementInfo}
              onClose={visualEditMode.closeElementEditPopover}
              onDirectEdit={() => {}}
              onImageChange={() => {}}
              onAIEdit={() => {}}
              isRTL={isRTL}
            />
          )}
        </Suspense>
      </div>
    </ProjectContextProvider>
  );
}

export default ProjectDetailRefactored;
