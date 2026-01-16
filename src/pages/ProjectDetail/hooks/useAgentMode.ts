// useAgentMode - AI agent state and auto-fix logic
// Part of Group A Enhancement: Performance & Code Quality

import { useState, useCallback, useRef, useEffect } from 'react';
import type { AIError, EditedFileTracking, GenerationStep } from '../types';

interface UseAgentModeProps {
  isRTL: boolean;
}

export function useAgentMode({ isRTL }: UseAgentModeProps) {
  // Thinking/generation state
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [lastThinkingDuration, setLastThinkingDuration] = useState<number | null>(null);
  const thinkingStartTimeRef = useRef<number | null>(null);
  
  // Tool usage tracking
  const [toolsUsedCount, setToolsUsedCount] = useState(0);
  const [editedFilesTracking, setEditedFilesTracking] = useState<EditedFileTracking[]>([]);
  const [showAllEditedFiles, setShowAllEditedFiles] = useState(false);
  
  // Generation steps
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  
  // Error state
  const [aiError, setAiError] = useState<AIError | null>(null);
  const [crashReport, setCrashReport] = useState<string | null>(null);
  
  // Auto-fix state
  const [autoFixCountdown, setAutoFixCountdown] = useState<number | null>(null);
  const autoFixTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoFixTriggeredRef = useRef<boolean>(false);
  const autoFixAttemptsRef = useRef<Map<string, number>>(new Map());
  const MAX_AUTO_FIX_ATTEMPTS = 3;
  
  // Stop generation
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  
  // AMP (Amplify) state
  const [isAmplifying, setIsAmplifying] = useState(false);
  
  // Start thinking timer
  const startThinking = useCallback(() => {
    const now = Date.now();
    setThinkingStartTime(now);
    thinkingStartTimeRef.current = now;
  }, []);
  
  // Stop thinking timer and return duration
  const stopThinking = useCallback((): number | null => {
    if (thinkingStartTimeRef.current) {
      const duration = Math.floor((Date.now() - thinkingStartTimeRef.current) / 1000);
      setLastThinkingDuration(duration);
      setThinkingStartTime(null);
      thinkingStartTimeRef.current = null;
      return duration;
    }
    return null;
  }, []);
  
  // Stop generation
  const stopGeneration = useCallback((setChatMessages: (fn: (prev: any[]) => any[]) => void) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStopping(true);
    setThinkingStartTime(null);
    setGenerationSteps([]);
    
    // Add stopped message
    setChatMessages(prev => [...prev, {
      id: `stopped-${Date.now()}`,
      role: 'assistant',
      content: isRTL ? '⏹️ تم إيقاف التوليد بواسطة المستخدم' : '⏹️ Generation stopped by user'
    }]);
    
    setTimeout(() => setIsStopping(false), 500);
  }, [isRTL]);
  
  // Create new abort controller
  const createAbortController = useCallback(() => {
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current;
  }, []);
  
  // Track edited file
  const trackEditedFile = useCallback((fileName: string, status: 'editing' | 'edited') => {
    setEditedFilesTracking(prev => {
      const existing = prev.find(f => f.fileName === fileName);
      if (existing) {
        return prev.map(f => f.fileName === fileName ? { ...f, status } : f);
      }
      return [...prev, { id: `file-${Date.now()}`, fileName, status }];
    });
  }, []);
  
  // Clear edited files tracking
  const clearEditedFilesTracking = useCallback(() => {
    setEditedFilesTracking([]);
  }, []);
  
  // Increment tool usage count
  const incrementToolsUsed = useCallback(() => {
    setToolsUsedCount(prev => prev + 1);
  }, []);
  
  // Reset tool usage count
  const resetToolsUsed = useCallback(() => {
    setToolsUsedCount(0);
  }, []);
  
  // Get auto-fix attempt count for an error
  const getAutoFixAttempts = useCallback((errorKey: string): number => {
    return autoFixAttemptsRef.current.get(errorKey) || 0;
  }, []);
  
  // Increment auto-fix attempt count
  const incrementAutoFixAttempts = useCallback((errorKey: string) => {
    const current = autoFixAttemptsRef.current.get(errorKey) || 0;
    autoFixAttemptsRef.current.set(errorKey, current + 1);
  }, []);
  
  // Check if max auto-fix attempts reached
  const hasReachedMaxAutoFixAttempts = useCallback((errorKey: string): boolean => {
    return (autoFixAttemptsRef.current.get(errorKey) || 0) >= MAX_AUTO_FIX_ATTEMPTS;
  }, []);
  
  // Reset auto-fix attempts for an error
  const resetAutoFixAttempts = useCallback((errorKey: string) => {
    autoFixAttemptsRef.current.delete(errorKey);
  }, []);
  
  // Start auto-fix countdown
  const startAutoFixCountdown = useCallback((seconds: number, onComplete: () => void) => {
    setAutoFixCountdown(seconds);
    
    let remaining = seconds;
    autoFixTimerRef.current = setInterval(() => {
      remaining--;
      setAutoFixCountdown(remaining);
      
      if (remaining <= 0) {
        clearInterval(autoFixTimerRef.current!);
        autoFixTimerRef.current = null;
        setAutoFixCountdown(null);
        onComplete();
      }
    }, 1000);
  }, []);
  
  // Cancel auto-fix countdown
  const cancelAutoFix = useCallback(() => {
    if (autoFixTimerRef.current) {
      clearInterval(autoFixTimerRef.current);
      autoFixTimerRef.current = null;
    }
    setAutoFixCountdown(null);
    setCrashReport(null);
  }, []);
  
  // Set auto-fix triggered flag
  const setAutoFixTriggered = useCallback((triggered: boolean) => {
    autoFixTriggeredRef.current = triggered;
  }, []);
  
  // Check if auto-fix is triggered
  const isAutoFixTriggered = useCallback(() => {
    return autoFixTriggeredRef.current;
  }, []);
  
  // Build auto-fix prompt based on error type
  const buildAutoFixPrompt = useCallback((error: string, attemptNumber: number): string => {
    const isRetry = attemptNumber > 1;
    
    // Detect error type and provide specific instructions
    let fixInstructions = '';
    
    if (error.includes('ModuleNotFoundError') || error.includes('Could not find module')) {
      const moduleMatch = error.match(/['"]([^'"]+)['"]/);
      const moduleName = moduleMatch ? moduleMatch[1] : 'the module';
      fixInstructions = `
**ERROR TYPE: Missing Module/File**

The file ${moduleName} doesn't exist or the import path is wrong.

**FIX STEPS:**
1. Use list_files to see what files exist
2. Use read_file to check the import statement
3. Either CREATE the missing file or FIX the import path
4. Make sure the component is exported correctly`;
    } else if (error.includes('is not defined') || error.includes('ReferenceError')) {
      const varMatch = error.match(/(\w+) is not defined/);
      const varName = varMatch ? varMatch[1] : 'variable';
      fixInstructions = `
**ERROR TYPE: Undefined Variable/Function**

${varName} is used but not defined or imported.

**FIX STEPS:**
1. Use read_file to see the current imports
2. If it's a React hook (useState, useEffect, etc.) - add to React import
3. If it's a component - import it from the correct file
4. If it's a variable - define it before using it`;
    } else if (error.includes('SyntaxError') || error.includes('Unexpected token')) {
      fixInstructions = `
**ERROR TYPE: Syntax Error**

There's invalid JavaScript/JSX syntax.

**FIX STEPS:**
1. Use read_file to see the file with the error
2. Look for missing closing brackets, braces, or parentheses
3. Check for missing commas in objects/arrays
4. Make sure JSX tags are properly closed`;
    } else {
      fixInstructions = `
**ERROR TYPE: Runtime Error**

**FIX STEPS:**
1. Use read_file to see the file causing the error
2. Find the exact line causing the issue
3. Fix the root cause, not just the symptom`;
    }
    
    let retryWarning = '';
    if (isRetry) {
      retryWarning = `
⚠️ **THIS IS ATTEMPT #${attemptNumber} - PREVIOUS FIX FAILED**

The previous fix did NOT work. You MUST:
1. READ the file(s) again to see current state
2. UNDERSTAND why the previous fix failed
3. Try a DIFFERENT approach this time
4. State your new plan before making changes

DO NOT repeat the same fix that already failed.
`;
    }
    
    return `🔧 **AUTO-FIX: Fix this error NOW**
${retryWarning}
\`\`\`
${error}
\`\`\`
${fixInstructions}

**MANDATORY WORKFLOW:**
1. First, use read_file to see the current code
2. State your fix plan
3. Make the fix using search_replace
4. Call task_complete when done

**ACTION REQUIRED:** Edit the file(s) to fix this error. Do NOT just explain - actually make the code changes.`;
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoFixTimerRef.current) {
        clearInterval(autoFixTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  return {
    // State
    thinkingStartTime,
    lastThinkingDuration,
    toolsUsedCount,
    editedFilesTracking,
    showAllEditedFiles,
    generationSteps,
    aiError,
    crashReport,
    autoFixCountdown,
    isStopping,
    isAmplifying,
    
    // Refs
    abortControllerRef,
    
    // Setters
    setThinkingStartTime,
    setLastThinkingDuration,
    setToolsUsedCount,
    setEditedFilesTracking,
    setShowAllEditedFiles,
    setGenerationSteps,
    setAiError,
    setCrashReport,
    setAutoFixCountdown,
    setIsStopping,
    setIsAmplifying,
    
    // Actions
    startThinking,
    stopThinking,
    stopGeneration,
    createAbortController,
    trackEditedFile,
    clearEditedFilesTracking,
    incrementToolsUsed,
    resetToolsUsed,
    getAutoFixAttempts,
    incrementAutoFixAttempts,
    hasReachedMaxAutoFixAttempts,
    resetAutoFixAttempts,
    startAutoFixCountdown,
    cancelAutoFix,
    setAutoFixTriggered,
    isAutoFixTriggered,
    buildAutoFixPrompt,
    MAX_AUTO_FIX_ATTEMPTS,
  };
}
