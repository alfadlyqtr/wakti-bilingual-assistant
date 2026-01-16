import { useState, useCallback, useRef } from 'react';

interface GenerationStep {
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

interface EditedFile {
  id: string;
  fileName: string;
  status: 'editing' | 'edited';
}

interface AIError {
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  severity: 'error' | 'warning' | 'info';
  technicalDetails?: string;
  suggestedAction?: string;
  suggestedActionAr?: string;
}

interface UseGenerationStateReturn {
  // Generation state
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  generationSteps: GenerationStep[];
  setGenerationSteps: React.Dispatch<React.SetStateAction<GenerationStep[]>>;
  
  // Thinking timer
  thinkingStartTime: number | null;
  setThinkingStartTime: React.Dispatch<React.SetStateAction<number | null>>;
  lastThinkingDuration: number | null;
  setLastThinkingDuration: React.Dispatch<React.SetStateAction<number | null>>;
  
  // Edited files tracking
  editedFilesTracking: EditedFile[];
  setEditedFilesTracking: React.Dispatch<React.SetStateAction<EditedFile[]>>;
  showAllEditedFiles: boolean;
  setShowAllEditedFiles: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Tool usage
  toolsUsedCount: number;
  setToolsUsedCount: React.Dispatch<React.SetStateAction<number>>;
  
  // Error state
  aiError: AIError | null;
  setAiError: React.Dispatch<React.SetStateAction<AIError | null>>;
  
  // Crash recovery
  crashReport: string | null;
  setCrashReport: React.Dispatch<React.SetStateAction<string | null>>;
  autoFixCountdown: number | null;
  setAutoFixCountdown: React.Dispatch<React.SetStateAction<number | null>>;
  
  // Stop generation
  isStopping: boolean;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  stopGeneration: () => void;
  
  // Dynamic suggestions
  dynamicSuggestions: string[];
  setDynamicSuggestions: React.Dispatch<React.SetStateAction<string[]>>;
  
  // Amplification
  isAmplifying: boolean;
  setIsAmplifying: React.Dispatch<React.SetStateAction<boolean>>;
}

interface UseGenerationStateOptions {
  isRTL: boolean;
  setChatMessages: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useGenerationState({ isRTL, setChatMessages }: UseGenerationStateOptions): UseGenerationStateReturn {
  // Core generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  
  // Thinking timer
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [lastThinkingDuration, setLastThinkingDuration] = useState<number | null>(null);
  
  // File tracking
  const [editedFilesTracking, setEditedFilesTracking] = useState<EditedFile[]>([]);
  const [showAllEditedFiles, setShowAllEditedFiles] = useState(false);
  
  // Tool usage
  const [toolsUsedCount, setToolsUsedCount] = useState(0);
  
  // Error handling
  const [aiError, setAiError] = useState<AIError | null>(null);
  
  // Crash recovery
  const [crashReport, setCrashReport] = useState<string | null>(null);
  const [autoFixCountdown, setAutoFixCountdown] = useState<number | null>(null);
  
  // Stop generation
  const [isStopping, setIsStopping] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Dynamic suggestions
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  
  // Amplification
  const [isAmplifying, setIsAmplifying] = useState(false);
  
  // Stop generation handler
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStopping(true);
    setIsGenerating(false);
    setThinkingStartTime(null);
    setGenerationSteps([]);
    
    // Add stopped message
    setChatMessages((prev: any[]) => [...prev, {
      id: `stopped-${Date.now()}`,
      role: 'assistant',
      content: isRTL ? '⏹️ تم إيقاف التوليد بواسطة المستخدم' : '⏹️ Generation stopped by user'
    }]);
    
    setTimeout(() => setIsStopping(false), 500);
  }, [isRTL, setChatMessages]);

  return {
    isGenerating,
    setIsGenerating,
    generationSteps,
    setGenerationSteps,
    thinkingStartTime,
    setThinkingStartTime,
    lastThinkingDuration,
    setLastThinkingDuration,
    editedFilesTracking,
    setEditedFilesTracking,
    showAllEditedFiles,
    setShowAllEditedFiles,
    toolsUsedCount,
    setToolsUsedCount,
    aiError,
    setAiError,
    crashReport,
    setCrashReport,
    autoFixCountdown,
    setAutoFixCountdown,
    isStopping,
    abortControllerRef,
    stopGeneration,
    dynamicSuggestions,
    setDynamicSuggestions,
    isAmplifying,
    setIsAmplifying,
  };
}
