import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Copy, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { toast } from 'sonner';

type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorExplanationCardProps {
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  severity?: ErrorSeverity;
  technicalDetails?: string;
  suggestedAction?: string;
  suggestedActionAr?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const severityConfig = {
  error: {
    icon: AlertCircle,
    bgClass: 'bg-red-500/10 border-red-500/30',
    iconClass: 'text-red-500',
    titleClass: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-yellow-500/10 border-yellow-500/30',
    iconClass: 'text-yellow-500',
    titleClass: 'text-yellow-600 dark:text-yellow-400',
  },
  info: {
    icon: Info,
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    iconClass: 'text-blue-500',
    titleClass: 'text-blue-600 dark:text-blue-400',
  },
};

export function ErrorExplanationCard({
  title,
  titleAr,
  message,
  messageAr,
  severity = 'error',
  technicalDetails,
  suggestedAction,
  suggestedActionAr,
  onRetry,
  onDismiss,
  className = ''
}: ErrorExplanationCardProps) {
  const { language } = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const config = severityConfig[severity];
  const Icon = config.icon;

  const handleCopyError = async () => {
    const errorText = `${title}\n${message}${technicalDetails ? `\n\nTechnical Details:\n${technicalDetails}` : ''}`;
    try {
      await navigator.clipboard.writeText(errorText);
      toast.success(language === 'ar' ? 'تم نسخ الخطأ' : 'Error copied');
    } catch {
      toast.error(language === 'ar' ? 'فشل في النسخ' : 'Failed to copy');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-4 ${config.bgClass} ${className}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full bg-background/50 ${config.iconClass}`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className={`font-semibold text-sm ${config.titleClass}`}>
            {language === 'ar' && titleAr ? titleAr : title}
          </h4>

          {/* Message */}
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'ar' && messageAr ? messageAr : message}
          </p>

          {/* Suggested action */}
          {(suggestedAction || suggestedActionAr) && (
            <p className="text-sm text-foreground/80 mt-2 flex items-center gap-1">
              <span className="text-primary">💡</span>
              <span>{language === 'ar' && suggestedActionAr ? suggestedActionAr : suggestedAction}</span>
            </p>
          )}

          {/* Technical details toggle */}
          {technicalDetails && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>
                {language === 'ar' 
                  ? (showDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل')
                  : (showDetails ? 'Hide details' : 'Show details')
                }
              </span>
            </button>
          )}

          {/* Technical details content */}
          {showDetails && technicalDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2"
            >
              <pre className="text-xs bg-background/50 rounded p-2 overflow-x-auto text-muted-foreground font-mono">
                {technicalDetails}
              </pre>
            </motion.div>
          )}
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-7 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            {language === 'ar' ? 'إعادة المحاولة' : 'Try again'}
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyError}
          className="h-7 text-xs"
        >
          <Copy className="w-3 h-3 mr-1" />
          {language === 'ar' ? 'نسخ الخطأ' : 'Copy error'}
        </Button>
      </div>
    </motion.div>
  );
}

export default ErrorExplanationCard;
