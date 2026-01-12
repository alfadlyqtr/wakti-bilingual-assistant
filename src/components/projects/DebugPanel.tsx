import React from 'react';
import { useDebugContext } from '@/hooks/useDebugContext';
import { Bug, X, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Wifi, Terminal, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// ============================================================================
// DEBUG PANEL
// Option C: Manual Debug Mode - User triggers debug, then asks AI
// Shows captured errors and provides "Ask AI to Fix" button
// ============================================================================

interface DebugPanelProps {
  onAskAIToFix?: (debugContext: string) => void;
  isAIProcessing?: boolean;
  className?: string;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  onAskAIToFix,
  isAIProcessing = false,
  className
}) => {
  const {
    session,
    hasErrors,
    getErrorCount,
    getDebugContextForAI,
    clearSession,
    enableAutoFix,
    setEnableAutoFix,
    isDebugPanelOpen,
    setDebugPanelOpen
  } = useDebugContext();

  const [isExpanded, setIsExpanded] = React.useState(true);

  const errorCount = getErrorCount();
  const hasAnyErrors = hasErrors();

  // Don't render if no errors and panel is closed
  if (!hasAnyErrors && !isDebugPanelOpen) {
    return null;
  }

  const handleAskAIToFix = () => {
    const context = getDebugContextForAI();
    if (context && onAskAIToFix) {
      onAskAIToFix(context);
    }
  };

  return (
    <div className={cn(
      "bg-zinc-900/95 backdrop-blur-xl border border-red-500/30 rounded-lg shadow-2xl",
      "transition-all duration-300",
      className
    )}>
      {/* Header - Always visible */}
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bug className="w-5 h-5 text-red-400" />
            {errorCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {errorCount > 9 ? '9+' : errorCount}
              </span>
            )}
          </div>
          <span className="text-sm font-semibold text-white">Debug Panel</span>
          <span className="text-xs text-zinc-500">
            ({session?.errors.length || 0} errors, {session?.networkErrors.length || 0} network)
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Auto-Fix Toggle */}
          <div className="flex items-center gap-2 mr-2">
            <Zap className={cn("w-3.5 h-3.5", enableAutoFix ? "text-amber-400" : "text-zinc-600")} />
            <span className="text-xs text-zinc-400">Auto-Fix</span>
            <Switch
              checked={enableAutoFix}
              onCheckedChange={setEnableAutoFix}
              className="scale-75"
            />
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              clearSession();
            }}
            className="h-7 px-2 text-zinc-400 hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDebugPanelOpen(false);
            }}
            className="h-7 px-2 text-zinc-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
          
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 max-h-64 overflow-y-auto">
          {/* Runtime Errors */}
          {session?.errors && session.errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Runtime Errors ({session.errors.length})</span>
              </div>
              {session.errors.slice(-3).map((error) => (
                <div 
                  key={error.id}
                  className="bg-red-950/30 border border-red-900/30 rounded-md p-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] uppercase font-bold text-red-500 bg-red-500/20 px-1.5 py-0.5 rounded">
                      {error.type}
                    </span>
                    {error.file && (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {error.file}{error.line ? `:${error.line}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-red-300 mt-1.5 font-mono break-all">
                    {error.message.substring(0, 200)}
                    {error.message.length > 200 && '...'}
                  </p>
                  {error.stack && (
                    <pre className="text-[10px] text-zinc-500 mt-2 overflow-x-auto max-h-16 font-mono">
                      {error.stack.split('\n').slice(0, 3).join('\n')}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Network Errors */}
          {session?.networkErrors && session.networkErrors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-orange-400">
                <Wifi className="w-3.5 h-3.5" />
                <span>Network Errors ({session.networkErrors.length})</span>
              </div>
              {session.networkErrors.slice(-2).map((error) => (
                <div 
                  key={error.id}
                  className="bg-orange-950/30 border border-orange-900/30 rounded-md p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-orange-500 bg-orange-500/20 px-1.5 py-0.5 rounded">
                      {error.status || 'ERR'}
                    </span>
                    <span className="text-xs text-orange-300">{error.method}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 font-mono truncate">
                    {error.url}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Console Errors */}
          {session?.consoleLogs && session.consoleLogs.filter(l => l.level === 'error').length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-yellow-400">
                <Terminal className="w-3.5 h-3.5" />
                <span>Console Errors ({session.consoleLogs.filter(l => l.level === 'error').length})</span>
              </div>
              {session.consoleLogs.filter(l => l.level === 'error').slice(-2).map((log) => (
                <div 
                  key={log.id}
                  className="bg-yellow-950/20 border border-yellow-900/20 rounded-md p-2"
                >
                  <p className="text-xs text-yellow-200 font-mono truncate">
                    {log.message.substring(0, 150)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* No Errors State */}
          {!hasAnyErrors && (
            <div className="text-center py-6 text-zinc-500">
              <Bug className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No errors detected</p>
              <p className="text-xs">Errors will appear here when they occur</p>
            </div>
          )}

          {/* Action Buttons */}
          {hasAnyErrors && (
            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <Button
                onClick={handleAskAIToFix}
                disabled={isAIProcessing}
                className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-medium"
              >
                {isAIProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    AI Fixing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Ask AI to Fix ({errorCount} error{errorCount !== 1 ? 's' : ''})
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Auto-Fix Status */}
          {session?.status === 'auto-fixing' && (
            <div className="bg-amber-950/30 border border-amber-900/30 rounded-md p-3 text-center">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 text-amber-400 animate-spin" />
              <p className="text-xs text-amber-300">
                Auto-fixing... Attempt {session.autoFixAttempts} of {session.maxAutoFixAttempts}
              </p>
            </div>
          )}

          {session?.status === 'waiting-user' && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-md p-3 text-center">
              <p className="text-xs text-zinc-400">
                Max auto-fix attempts reached. Please fix manually or try the button above.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPACT ERROR INDICATOR
// Shows in the header/toolbar when errors exist
// ============================================================================
interface ErrorIndicatorProps {
  onClick?: () => void;
  className?: string;
}

export const ErrorIndicator: React.FC<ErrorIndicatorProps> = ({ onClick, className }) => {
  const { hasErrors, getErrorCount, setDebugPanelOpen } = useDebugContext();

  if (!hasErrors()) return null;

  const count = getErrorCount();

  return (
    <button
      onClick={() => {
        setDebugPanelOpen(true);
        onClick?.();
      }}
      className={cn(
        "relative flex items-center gap-1.5 px-2 py-1 rounded-md",
        "bg-red-500/20 border border-red-500/30",
        "text-red-400 hover:text-red-300 hover:bg-red-500/30",
        "transition-all duration-200",
        "animate-pulse",
        className
      )}
    >
      <Bug className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">{count}</span>
    </button>
  );
};

export default DebugPanel;
