import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  RefreshCw, 
  X,
  Lightbulb,
  FileCode,
  Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ErrorInfo {
  type: 'runtime' | 'syntax' | 'network' | 'render' | 'build' | 'console';
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  category?: string;
  severity: 'error' | 'warning' | 'info';
}

interface EnhancedErrorOverlayProps {
  error: ErrorInfo;
  suggestedFix?: string | null;
  onAutoFix?: () => void;
  onDismiss?: () => void;
  onRetry?: () => void;
  isFixing?: boolean;
  canAutoFix?: boolean;
  autoFixAttempts?: number;
  maxAutoFixAttempts?: number;
  isRTL?: boolean;
  className?: string;
}

const categoryLabels: Record<string, { en: string; ar: string; icon: React.ReactNode; color: string }> = {
  runtime: { en: 'Runtime Error', ar: 'خطأ وقت التشغيل', icon: <AlertCircle className="w-4 h-4" />, color: 'red' },
  syntax: { en: 'Syntax Error', ar: 'خطأ في الصياغة', icon: <FileCode className="w-4 h-4" />, color: 'orange' },
  import: { en: 'Import Error', ar: 'خطأ في الاستيراد', icon: <FileCode className="w-4 h-4" />, color: 'yellow' },
  react: { en: 'React Error', ar: 'خطأ React', icon: <AlertTriangle className="w-4 h-4" />, color: 'blue' },
  api: { en: 'API Error', ar: 'خطأ API', icon: <AlertCircle className="w-4 h-4" />, color: 'purple' },
  typescript: { en: 'Type Error', ar: 'خطأ في النوع', icon: <FileCode className="w-4 h-4" />, color: 'cyan' },
};

export function EnhancedErrorOverlay({
  error,
  suggestedFix,
  onAutoFix,
  onDismiss,
  onRetry,
  isFixing = false,
  canAutoFix = false,
  autoFixAttempts = 0,
  maxAutoFixAttempts = 3,
  isRTL = false,
  className,
}: EnhancedErrorOverlayProps) {
  const [showStack, setShowStack] = useState(false);
  const [copied, setCopied] = useState(false);

  const categoryInfo = error.category ? categoryLabels[error.category] : null;
  
  const handleCopy = async () => {
    const text = `${error.type}: ${error.message}${error.stack ? `\n\nStack:\n${error.stack}` : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(isRTL ? 'تم نسخ الخطأ' : 'Error copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(isRTL ? 'فشل في النسخ' : 'Failed to copy');
    }
  };

  const severityColors = {
    error: 'from-red-950/90 via-red-900/80 to-orange-950/70 border-red-500/40',
    warning: 'from-amber-950/90 via-amber-900/80 to-yellow-950/70 border-amber-500/40',
    info: 'from-blue-950/90 via-blue-900/80 to-indigo-950/70 border-blue-500/40',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        "rounded-xl border backdrop-blur-md shadow-2xl overflow-hidden",
        `bg-gradient-to-br ${severityColors[error.severity]}`,
        className
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {categoryInfo ? (
            <span className={cn(
              "p-1.5 rounded-lg",
              `bg-${categoryInfo.color}-500/20 text-${categoryInfo.color}-400`
            )}>
              {categoryInfo.icon}
            </span>
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-white">
              {categoryInfo 
                ? (isRTL ? categoryInfo.ar : categoryInfo.en)
                : (isRTL ? 'خطأ' : 'Error')
              }
            </h3>
            {error.file && (
              <p className="text-xs text-gray-400">
                {error.file}{error.line ? `:${error.line}` : ''}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title={isRTL ? 'نسخ' : 'Copy'}
          >
            <Copy className={cn("w-4 h-4", copied ? "text-green-400" : "text-gray-400")} />
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title={isRTL ? 'إغلاق' : 'Dismiss'}
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      <div className="px-4 py-3">
        <p className="text-sm text-white/90 font-mono leading-relaxed break-all">
          {error.message}
        </p>
      </div>

      {/* Stack Trace (collapsible) */}
      {error.stack && (
        <div className="border-t border-white/10">
          <button
            onClick={() => setShowStack(!showStack)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/5 transition-colors"
          >
            <span className="text-xs text-gray-400">
              {isRTL ? 'تتبع المكدس' : 'Stack Trace'}
            </span>
            {showStack ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>
          
          <AnimatePresence>
            {showStack && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <pre className="px-4 py-3 text-[10px] text-gray-400 font-mono overflow-x-auto max-h-40 bg-black/30">
                  {error.stack}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Suggested Fix */}
      {suggestedFix && (
        <div className="px-4 py-3 border-t border-white/10 bg-emerald-950/30">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-emerald-400 mb-1">
                {isRTL ? 'اقتراح الإصلاح' : 'Suggested Fix'}
              </p>
              <p className="text-xs text-emerald-300/80">
                {suggestedFix}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-2">
          {canAutoFix && onAutoFix && (
            <button
              onClick={onAutoFix}
              disabled={isFixing || autoFixAttempts >= maxAutoFixAttempts}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                isFixing 
                  ? "bg-amber-500/20 text-amber-400 cursor-wait"
                  : autoFixAttempts >= maxAutoFixAttempts
                    ? "bg-gray-500/20 text-gray-400 cursor-not-allowed"
                    : "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
              )}
            >
              {isFixing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {isRTL ? 'جارٍ الإصلاح...' : 'Fixing...'}
                </>
              ) : (
                <>
                  <Wrench className="w-3.5 h-3.5" />
                  {isRTL ? 'إصلاح تلقائي' : 'Auto-Fix'}
                </>
              )}
            </button>
          )}
          
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isRTL ? 'إعادة المحاولة' : 'Retry'}
            </button>
          )}
        </div>

        {autoFixAttempts > 0 && (
          <span className="text-[10px] text-gray-500">
            {isRTL 
              ? `محاولة ${autoFixAttempts}/${maxAutoFixAttempts}`
              : `Attempt ${autoFixAttempts}/${maxAutoFixAttempts}`
            }
          </span>
        )}
      </div>
    </motion.div>
  );
}
