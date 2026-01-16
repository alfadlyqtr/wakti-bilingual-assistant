// ErrorBanner - Error display with auto-fix countdown
// Part of Group A Enhancement: Error Handling

import React from 'react';
import { AlertTriangle, X, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ErrorBannerProps {
  error: string;
  autoFixCountdown: number | null;
  isRTL: boolean;
  onAutoFix: () => void;
  onCancel: () => void;
  maxAttempts: number;
  currentAttempts: number;
}

export function ErrorBanner({
  error,
  autoFixCountdown,
  isRTL,
  onAutoFix,
  onCancel,
  maxAttempts,
  currentAttempts
}: ErrorBannerProps) {
  const hasReachedMax = currentAttempts >= maxAttempts;
  
  // Extract error type for categorization
  const getErrorCategory = (errorText: string): {
    type: 'syntax' | 'runtime' | 'module' | 'reference' | 'unknown';
    icon: React.ReactNode;
    color: string;
  } => {
    if (errorText.includes('SyntaxError') || errorText.includes('Unexpected token')) {
      return { type: 'syntax', icon: '⚡', color: 'text-yellow-500' };
    }
    if (errorText.includes('ModuleNotFoundError') || errorText.includes('Could not find module')) {
      return { type: 'module', icon: '📦', color: 'text-blue-500' };
    }
    if (errorText.includes('is not defined') || errorText.includes('ReferenceError')) {
      return { type: 'reference', icon: '🔗', color: 'text-purple-500' };
    }
    if (errorText.includes('TypeError') || errorText.includes('is not a function')) {
      return { type: 'runtime', icon: '⚙️', color: 'text-orange-500' };
    }
    return { type: 'unknown', icon: '❌', color: 'text-red-500' };
  };
  
  const category = getErrorCategory(error);
  
  return (
    <div className={cn(
      "bg-gradient-to-r from-red-950/90 to-red-900/80 border-l-4 border-red-500 rounded-lg p-4 shadow-xl backdrop-blur-sm animate-in slide-in-from-top-2 duration-300",
      isRTL ? "border-l-0 border-r-4 text-right" : ""
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-start justify-between gap-3 mb-3",
        isRTL ? "flex-row-reverse" : ""
      )}>
        <div className={cn("flex items-center gap-2", isRTL ? "flex-row-reverse" : "")}>
          <span className={cn("text-xl", category.color)}>{category.icon}</span>
          <div>
            <h4 className="font-semibold text-red-100 text-sm">
              {isRTL ? 'خطأ في التطبيق' : 'Application Error'}
            </h4>
            <p className="text-xs text-red-300/80 capitalize">
              {category.type} error
              {currentAttempts > 0 && (
                <span className="ml-2 text-red-400">
                  ({isRTL ? `محاولة ${currentAttempts}/${maxAttempts}` : `Attempt ${currentAttempts}/${maxAttempts}`})
                </span>
              )}
            </p>
          </div>
        </div>
        
        <button
          onClick={onCancel}
          className="text-red-400 hover:text-red-200 transition-colors p-1"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      {/* Error message */}
      <div className="bg-black/30 rounded-md p-3 mb-3 overflow-x-auto">
        <pre className={cn(
          "text-xs text-red-200 font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto",
          isRTL ? "direction-ltr text-left" : ""
        )}>
          {error.length > 500 ? error.substring(0, 500) + '...' : error}
        </pre>
      </div>
      
      {/* Actions */}
      <div className={cn(
        "flex items-center gap-2",
        isRTL ? "flex-row-reverse" : ""
      )}>
        {!hasReachedMax ? (
          <>
            <Button
              onClick={onAutoFix}
              size="sm"
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white gap-2"
            >
              {autoFixCountdown !== null ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {isRTL ? `إصلاح تلقائي (${autoFixCountdown}ث)` : `Auto-fixing (${autoFixCountdown}s)`}
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" />
                  {isRTL ? 'إصلاح تلقائي' : 'Auto-fix'}
                </>
              )}
            </Button>
            
            <Button
              onClick={onCancel}
              size="sm"
              variant="ghost"
              className="text-red-300 hover:text-red-100 hover:bg-red-800/30"
            >
              {isRTL ? 'تجاهل' : 'Dismiss'}
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {isRTL 
                ? 'تم الوصول للحد الأقصى من المحاولات. يرجى الإصلاح يدويًا.'
                : 'Max attempts reached. Please fix manually.'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
