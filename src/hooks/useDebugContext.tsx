import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ============================================================================
// WAKTI AI CODER DEBUG CONTEXT
// Provides all 3 debug capability layers:
// - Option C: Manual Debug Mode (user triggers debug)
// - Option B: Smart Error Context (auto-capture errors for AI)
// - Option A: Full Auto-Debug Loop (auto-fix on detection)
// ============================================================================

export interface CapturedError {
  id: string;
  type: 'runtime' | 'syntax' | 'network' | 'render' | 'build' | 'console';
  message: string;
  stack?: string;
  timestamp: Date;
  file?: string;
  line?: number;
  column?: number;
  componentStack?: string;
  metadata?: Record<string, any>;
}

export interface CapturedNetworkError {
  id: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  responseBody?: string;
  timestamp: Date;
}

export interface CapturedConsoleLog {
  id: string;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: Date;
  args?: any[];
}

export interface DebugSession {
  id: string;
  startedAt: Date;
  errors: CapturedError[];
  networkErrors: CapturedNetworkError[];
  consoleLogs: CapturedConsoleLog[];
  autoFixAttempts: number;
  maxAutoFixAttempts: number;
  lastFixPrompt?: string;
  status: 'idle' | 'capturing' | 'auto-fixing' | 'waiting-user';
}

interface DebugContextValue {
  // Current session
  session: DebugSession | null;
  
  // Capture methods
  captureError: (error: Omit<CapturedError, 'id' | 'timestamp'>) => void;
  captureNetworkError: (error: Omit<CapturedNetworkError, 'id' | 'timestamp'>) => void;
  captureConsoleLog: (log: Omit<CapturedConsoleLog, 'id' | 'timestamp'>) => void;
  
  // Session control
  startSession: () => void;
  endSession: () => void;
  clearSession: () => void;
  
  // Error context for AI
  getDebugContextForAI: () => string;
  hasErrors: () => boolean;
  getErrorCount: () => number;
  
  // Auto-fix control (Option A)
  enableAutoFix: boolean;
  setEnableAutoFix: (enabled: boolean) => void;
  triggerAutoFix: () => void;
  onAutoFixRequested?: (context: string) => void;
  setOnAutoFixRequested: (callback: ((context: string) => void) | undefined) => void;
  incrementAutoFixAttempt: () => boolean; // Returns false if max reached
  
  // Manual debug mode (Option C)
  isDebugPanelOpen: boolean;
  setDebugPanelOpen: (open: boolean) => void;
}

const DebugContext = createContext<DebugContextValue | undefined>(undefined);

export const useDebugContext = () => {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error('useDebugContext must be used within a DebugContextProvider');
  }
  return context;
};

// Safe version that won't throw (for components that may be outside provider)
export const useDebugContextSafe = () => {
  return useContext(DebugContext);
};

interface DebugContextProviderProps {
  children: React.ReactNode;
  maxAutoFixAttempts?: number;
}

export const DebugContextProvider: React.FC<DebugContextProviderProps> = ({
  children,
  maxAutoFixAttempts = 3
}) => {
  const [session, setSession] = useState<DebugSession | null>(null);
  const [enableAutoFix, setEnableAutoFix] = useState(false);
  const [isDebugPanelOpen, setDebugPanelOpen] = useState(false);
  const onAutoFixRequestedRef = useRef<((context: string) => void) | undefined>();

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const startSession = useCallback(() => {
    console.log('[DebugContext] Starting new debug session');
    setSession({
      id: generateId(),
      startedAt: new Date(),
      errors: [],
      networkErrors: [],
      consoleLogs: [],
      autoFixAttempts: 0,
      maxAutoFixAttempts,
      status: 'capturing'
    });
  }, [maxAutoFixAttempts]);

  const endSession = useCallback(() => {
    if (session) {
      console.log('[DebugContext] Ending session with', session.errors.length, 'errors');
      setSession(prev => prev ? { ...prev, status: 'idle' } : null);
    }
  }, [session]);

  const clearSession = useCallback(() => {
    console.log('[DebugContext] Clearing session');
    setSession(null);
  }, []);

  const captureError = useCallback((error: Omit<CapturedError, 'id' | 'timestamp'>) => {
    console.log('[DebugContext] Captured error:', error.type, error.message);
    setSession(prev => {
      if (!prev) {
        // Auto-start session on first error
        return {
          id: generateId(),
          startedAt: new Date(),
          errors: [{ ...error, id: generateId(), timestamp: new Date() }],
          networkErrors: [],
          consoleLogs: [],
          autoFixAttempts: 0,
          maxAutoFixAttempts,
          status: 'capturing'
        };
      }
      
      // Deduplicate: don't add same error message twice in 2 seconds
      const recentDupe = prev.errors.find(
        e => e.message === error.message && 
        new Date().getTime() - e.timestamp.getTime() < 2000
      );
      if (recentDupe) return prev;
      
      return {
        ...prev,
        errors: [...prev.errors, { ...error, id: generateId(), timestamp: new Date() }]
      };
    });
  }, [maxAutoFixAttempts]);

  const captureNetworkError = useCallback((error: Omit<CapturedNetworkError, 'id' | 'timestamp'>) => {
    console.log('[DebugContext] Captured network error:', error.url, error.status);
    setSession(prev => {
      if (!prev) {
        return {
          id: generateId(),
          startedAt: new Date(),
          errors: [],
          networkErrors: [{ ...error, id: generateId(), timestamp: new Date() }],
          consoleLogs: [],
          autoFixAttempts: 0,
          maxAutoFixAttempts,
          status: 'capturing'
        };
      }
      return {
        ...prev,
        networkErrors: [...prev.networkErrors, { ...error, id: generateId(), timestamp: new Date() }]
      };
    });
  }, [maxAutoFixAttempts]);

  const captureConsoleLog = useCallback((log: Omit<CapturedConsoleLog, 'id' | 'timestamp'>) => {
    // Only capture errors and warnings, skip regular logs to avoid noise
    if (log.level !== 'error' && log.level !== 'warn') return;
    
    setSession(prev => {
      if (!prev) return prev;
      
      // Limit console logs to last 50
      const newLogs = [...prev.consoleLogs, { ...log, id: generateId(), timestamp: new Date() }];
      if (newLogs.length > 50) newLogs.shift();
      
      return { ...prev, consoleLogs: newLogs };
    });
  }, []);

  const hasErrors = useCallback(() => {
    return (session?.errors.length ?? 0) > 0 || (session?.networkErrors.length ?? 0) > 0;
  }, [session]);

  const getErrorCount = useCallback(() => {
    return (session?.errors.length ?? 0) + (session?.networkErrors.length ?? 0);
  }, [session]);

  // Build debug context string for AI prompt injection
  const getDebugContextForAI = useCallback(() => {
    if (!session || (!session.errors.length && !session.networkErrors.length)) {
      return '';
    }

    let context = `\n\n## 🔴 DEBUG CONTEXT - ERRORS DETECTED\n`;
    context += `The preview is showing errors that need to be fixed:\n\n`;

    // Runtime/Syntax Errors
    if (session.errors.length > 0) {
      context += `### Runtime Errors (${session.errors.length}):\n`;
      session.errors.slice(-5).forEach((err, i) => {
        context += `\n**Error ${i + 1}** [${err.type}]:\n`;
        context += `\`\`\`\n${err.message}\n\`\`\`\n`;
        if (err.file) context += `File: \`${err.file}\``;
        if (err.line) context += ` Line: ${err.line}`;
        if (err.stack) {
          // Truncate stack to first 5 lines
          const stackLines = err.stack.split('\n').slice(0, 5).join('\n');
          context += `\nStack:\n\`\`\`\n${stackLines}\n\`\`\`\n`;
        }
        if (err.componentStack) {
          const compLines = err.componentStack.split('\n').slice(0, 3).join('\n');
          context += `Component Stack:\n\`\`\`\n${compLines}\n\`\`\`\n`;
        }
      });
    }

    // Network Errors
    if (session.networkErrors.length > 0) {
      context += `\n### Network Errors (${session.networkErrors.length}):\n`;
      session.networkErrors.slice(-3).forEach((err, i) => {
        context += `\n**Network Error ${i + 1}**:\n`;
        context += `- URL: \`${err.url}\`\n`;
        context += `- Method: ${err.method}\n`;
        context += `- Status: ${err.status} ${err.statusText}\n`;
        if (err.responseBody) {
          const truncated = err.responseBody.substring(0, 200);
          context += `- Response: \`${truncated}${err.responseBody.length > 200 ? '...' : ''}\`\n`;
        }
      });
    }

    // Console Errors (warnings/errors only)
    const consoleErrors = session.consoleLogs.filter(l => l.level === 'error');
    if (consoleErrors.length > 0) {
      context += `\n### Console Errors (${consoleErrors.length}):\n`;
      consoleErrors.slice(-5).forEach((log, i) => {
        context += `- ${log.message.substring(0, 200)}\n`;
      });
    }

    context += `\n**INSTRUCTION**: Fix these errors in the code. Do NOT ignore them.\n`;
    
    if (session.autoFixAttempts > 0) {
      context += `\n⚠️ This is auto-fix attempt #${session.autoFixAttempts + 1} of ${session.maxAutoFixAttempts}. Previous fix did not resolve the issue.\n`;
    }

    return context;
  }, [session]);

  const incrementAutoFixAttempt = useCallback(() => {
    let canContinue = true;
    setSession(prev => {
      if (!prev) return prev;
      const newAttempts = prev.autoFixAttempts + 1;
      canContinue = newAttempts < prev.maxAutoFixAttempts;
      return {
        ...prev,
        autoFixAttempts: newAttempts,
        status: canContinue ? 'auto-fixing' : 'waiting-user'
      };
    });
    return canContinue;
  }, []);

  const triggerAutoFix = useCallback(() => {
    if (!session || !hasErrors()) return;
    
    const context = getDebugContextForAI();
    if (onAutoFixRequestedRef.current) {
      console.log('[DebugContext] Triggering auto-fix with context');
      onAutoFixRequestedRef.current(context);
    }
  }, [session, hasErrors, getDebugContextForAI]);

  const setOnAutoFixRequested = useCallback((callback: ((context: string) => void) | undefined) => {
    onAutoFixRequestedRef.current = callback;
  }, []);

  const value: DebugContextValue = {
    session,
    captureError,
    captureNetworkError,
    captureConsoleLog,
    startSession,
    endSession,
    clearSession,
    getDebugContextForAI,
    hasErrors,
    getErrorCount,
    enableAutoFix,
    setEnableAutoFix,
    triggerAutoFix,
    onAutoFixRequested: onAutoFixRequestedRef.current,
    setOnAutoFixRequested,
    incrementAutoFixAttempt,
    isDebugPanelOpen,
    setDebugPanelOpen
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
};

export default DebugContextProvider;
