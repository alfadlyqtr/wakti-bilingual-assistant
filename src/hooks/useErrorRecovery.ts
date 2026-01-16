import { useState, useCallback, useRef, useEffect } from 'react';

export interface ErrorInfo {
  id: string;
  type: 'runtime' | 'syntax' | 'network' | 'render' | 'build' | 'console';
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
  componentStack?: string;
  timestamp: number;
  severity: 'error' | 'warning' | 'info';
  category?: string; // e.g., 'react', 'tailwind', 'import', 'api'
}

export interface AutoFixAttempt {
  id: string;
  errorId: string;
  prompt: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  result?: string;
  timestamp: number;
}

interface UseErrorRecoveryOptions {
  maxAutoFixAttempts?: number;
  autoFixEnabled?: boolean;
  onAutoFixRequest?: (error: ErrorInfo, context: string) => Promise<boolean>;
}

interface UseErrorRecoveryReturn {
  // Error state
  errors: ErrorInfo[];
  hasErrors: boolean;
  errorCount: number;
  lastError: ErrorInfo | null;
  
  // Auto-fix state
  autoFixAttempts: AutoFixAttempt[];
  isAutoFixing: boolean;
  canAutoFix: boolean;
  
  // Actions
  captureError: (error: Omit<ErrorInfo, 'id' | 'timestamp' | 'severity'>) => void;
  clearErrors: () => void;
  dismissError: (errorId: string) => void;
  triggerAutoFix: (errorId?: string) => Promise<boolean>;
  
  // Analysis
  categorizeError: (message: string) => ErrorInfo['category'];
  getErrorContext: () => string;
  getSuggestedFix: (error: ErrorInfo) => string | null;
}

export function useErrorRecovery({
  maxAutoFixAttempts = 3,
  autoFixEnabled = true,
  onAutoFixRequest,
}: UseErrorRecoveryOptions = {}): UseErrorRecoveryReturn {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [autoFixAttempts, setAutoFixAttempts] = useState<AutoFixAttempt[]>([]);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const autoFixCountRef = useRef(0);

  const generateId = () => `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Categorize error based on message content
  const categorizeError = useCallback((message: string): ErrorInfo['category'] => {
    const lower = message.toLowerCase();
    
    if (lower.includes('cannot read properties of') || lower.includes('is not defined') || lower.includes('undefined')) {
      return 'runtime';
    }
    if (lower.includes('module not found') || lower.includes('cannot find module') || lower.includes('import')) {
      return 'import';
    }
    if (lower.includes('react') || lower.includes('component') || lower.includes('hook') || lower.includes('render')) {
      return 'react';
    }
    if (lower.includes('tailwind') || lower.includes('css') || lower.includes('style')) {
      return 'tailwind';
    }
    if (lower.includes('fetch') || lower.includes('api') || lower.includes('network') || lower.includes('cors')) {
      return 'api';
    }
    if (lower.includes('syntax') || lower.includes('unexpected token') || lower.includes('parsing')) {
      return 'syntax';
    }
    if (lower.includes('type') || lower.includes('typescript')) {
      return 'typescript';
    }
    
    return undefined;
  }, []);

  // Determine severity
  const determineSeverity = useCallback((type: ErrorInfo['type'], message: string): ErrorInfo['severity'] => {
    if (type === 'runtime' || type === 'render' || type === 'build') return 'error';
    if (type === 'console' && message.toLowerCase().includes('error')) return 'error';
    if (type === 'console' && message.toLowerCase().includes('warn')) return 'warning';
    if (type === 'network') return 'error';
    return 'info';
  }, []);

  // Capture a new error
  const captureError = useCallback((error: Omit<ErrorInfo, 'id' | 'timestamp' | 'severity'>) => {
    const severity = determineSeverity(error.type, error.message);
    const category = categorizeError(error.message);
    
    // Dedupe: don't capture same error within 2 seconds
    setErrors(prev => {
      const isDupe = prev.some(e => 
        e.message === error.message && 
        Date.now() - e.timestamp < 2000
      );
      if (isDupe) return prev;
      
      const newError: ErrorInfo = {
        ...error,
        id: generateId(),
        timestamp: Date.now(),
        severity,
        category,
      };
      
      // Keep last 20 errors
      return [...prev.slice(-19), newError];
    });
  }, [categorizeError, determineSeverity]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors([]);
    setAutoFixAttempts([]);
    autoFixCountRef.current = 0;
  }, []);

  // Dismiss a specific error
  const dismissError = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId));
  }, []);

  // Get suggested fix for common errors
  const getSuggestedFix = useCallback((error: ErrorInfo): string | null => {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('cannot read properties of undefined') || msg.includes('cannot read properties of null')) {
      return 'Add optional chaining (?.) or nullish coalescing (??) to prevent undefined access';
    }
    if (msg.includes('is not defined')) {
      const match = error.message.match(/(\w+) is not defined/i);
      if (match) {
        return `Import or define "${match[1]}" before using it`;
      }
    }
    if (msg.includes('module not found')) {
      return 'Check the import path or install the missing package';
    }
    if (msg.includes('adjacent jsx elements')) {
      return 'Wrap adjacent JSX elements in a fragment (<>...</>) or parent element';
    }
    if (msg.includes('hooks can only be called')) {
      return 'Move hook calls to the top level of your component, not inside conditions or loops';
    }
    if (msg.includes('unique "key" prop')) {
      return 'Add a unique key prop to each item in the list';
    }
    
    return null;
  }, []);

  // Get formatted error context for AI
  const getErrorContext = useCallback((): string => {
    if (errors.length === 0) return '';
    
    const recentErrors = errors.slice(-5);
    let context = '## Current Errors\n\n';
    
    recentErrors.forEach((err, i) => {
      context += `### Error ${i + 1} (${err.type}${err.category ? ` - ${err.category}` : ''})\n`;
      context += `**Message:** ${err.message}\n`;
      if (err.file) context += `**File:** ${err.file}${err.line ? `:${err.line}` : ''}\n`;
      if (err.stack) context += `**Stack:** \`\`\`\n${err.stack.slice(0, 500)}\n\`\`\`\n`;
      
      const suggestion = getSuggestedFix(err);
      if (suggestion) {
        context += `**Suggested Fix:** ${suggestion}\n`;
      }
      context += '\n';
    });
    
    return context;
  }, [errors, getSuggestedFix]);

  // Trigger auto-fix for the most recent error
  const triggerAutoFix = useCallback(async (errorId?: string): Promise<boolean> => {
    if (!autoFixEnabled || isAutoFixing) return false;
    if (autoFixCountRef.current >= maxAutoFixAttempts) return false;
    
    const targetError = errorId 
      ? errors.find(e => e.id === errorId)
      : errors[errors.length - 1];
    
    if (!targetError || !onAutoFixRequest) return false;
    
    setIsAutoFixing(true);
    autoFixCountRef.current++;
    
    const attempt: AutoFixAttempt = {
      id: generateId(),
      errorId: targetError.id,
      prompt: `Fix this ${targetError.type} error: ${targetError.message}`,
      status: 'in_progress',
      timestamp: Date.now(),
    };
    
    setAutoFixAttempts(prev => [...prev, attempt]);
    
    try {
      const context = getErrorContext();
      const success = await onAutoFixRequest(targetError, context);
      
      setAutoFixAttempts(prev => 
        prev.map(a => a.id === attempt.id 
          ? { ...a, status: success ? 'success' : 'failed', result: success ? 'Fixed' : 'Failed' }
          : a
        )
      );
      
      if (success) {
        dismissError(targetError.id);
      }
      
      return success;
    } catch (err) {
      setAutoFixAttempts(prev => 
        prev.map(a => a.id === attempt.id 
          ? { ...a, status: 'failed', result: String(err) }
          : a
        )
      );
      return false;
    } finally {
      setIsAutoFixing(false);
    }
  }, [autoFixEnabled, errors, isAutoFixing, maxAutoFixAttempts, onAutoFixRequest, getErrorContext, dismissError]);

  // Computed values
  const hasErrors = errors.some(e => e.severity === 'error');
  const errorCount = errors.filter(e => e.severity === 'error').length;
  const lastError = errors.length > 0 ? errors[errors.length - 1] : null;
  const canAutoFix = autoFixEnabled && autoFixCountRef.current < maxAutoFixAttempts && hasErrors;

  return {
    errors,
    hasErrors,
    errorCount,
    lastError,
    autoFixAttempts,
    isAutoFixing,
    canAutoFix,
    captureError,
    clearErrors,
    dismissError,
    triggerAutoFix,
    categorizeError,
    getErrorContext,
    getSuggestedFix,
  };
}
