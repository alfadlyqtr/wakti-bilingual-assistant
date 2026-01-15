import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Wrench, RefreshCw, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AutoFixCardProps {
  errorMessage: string;
  onAutoFix?: () => void;
  isFixing?: boolean;
  language?: 'en' | 'ar';
  className?: string;
}

export function AutoFixCard({
  errorMessage,
  onAutoFix,
  isFixing = false,
  language = 'en',
  className
}: AutoFixCardProps) {
  const [showFullError, setShowFullError] = React.useState(false);
  const isRTL = language === 'ar';

  // Extract just the error line for preview
  const errorLines = errorMessage.split('\n').filter(line => line.trim());
  const previewError = errorLines.slice(0, 3).join('\n');
  const hasMoreLines = errorLines.length > 3;

  const handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(errorMessage);
      toast.success(isRTL ? 'تم نسخ الخطأ' : 'Error copied to clipboard');
    } catch {
      toast.error(isRTL ? 'فشل في النسخ' : 'Failed to copy');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        "rounded-xl border border-red-500/30 bg-gradient-to-br from-red-950/80 via-red-900/50 to-orange-950/60 backdrop-blur-md shadow-xl shadow-red-500/10 overflow-hidden",
        className
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-red-900/40 to-orange-900/30 border-b border-red-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-red-300 text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              {isRTL ? 'طلب إصلاح تلقائي' : 'Auto-Fix Requested'}
            </h4>
            <p className="text-xs text-red-400/70 mt-0.5">
              {isRTL ? 'تم اكتشاف خطأ في المعاينة' : 'Preview encountered an error'}
            </p>
          </div>
        </div>
      </div>

      {/* Error Preview */}
      <div className="p-4 space-y-3">
        <div className="relative">
          <pre className={cn(
            "text-xs font-mono bg-black/40 rounded-lg p-3 border border-red-900/30 text-red-300 overflow-x-auto",
            !showFullError && hasMoreLines && "max-h-24 overflow-hidden"
          )}>
            {showFullError ? errorMessage : previewError}
          </pre>
          
          {/* Gradient fade for collapsed state */}
          {!showFullError && hasMoreLines && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg pointer-events-none" />
          )}
        </div>

        {/* Show more/less toggle */}
        {hasMoreLines && (
          <button
            onClick={() => setShowFullError(!showFullError)}
            className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-300 transition-colors"
          >
            {showFullError ? (
              <>
                <ChevronUp className="w-3 h-3" />
                {isRTL ? 'إخفاء التفاصيل' : 'Show less'}
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                {isRTL ? 'عرض المزيد' : 'Show full error'}
              </>
            )}
          </button>
        )}

        {/* Common causes info */}
        <div className="text-xs text-muted-foreground bg-black/20 rounded-lg p-3 border border-red-900/20">
          <p className="font-medium text-red-400/80 mb-1.5">
            {isRTL ? 'الأسباب الشائعة:' : 'Common causes:'}
          </p>
          <ul className="space-y-1 text-red-300/60">
            <li>• {isRTL ? 'استيرادات مفقودة' : 'Missing imports or dependencies'}</li>
            <li>• {isRTL ? 'متغيرات غير معرفة' : 'Undefined variables or functions'}</li>
            <li>• {isRTL ? 'بناء JSX غير صالح' : 'Invalid JSX syntax'}</li>
            <li>• {isRTL ? 'أخطاء في الأنواع' : 'Type errors'}</li>
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 bg-black/20 border-t border-red-900/30 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyError}
          className="h-8 text-xs text-red-400/70 hover:text-red-300 hover:bg-red-950/50"
        >
          <Copy className="w-3.5 h-3.5 mr-1.5" />
          {isRTL ? 'نسخ' : 'Copy'}
        </Button>

        {onAutoFix && (
          <Button
            onClick={onAutoFix}
            disabled={isFixing}
            size="sm"
            className={cn(
              "h-8 text-xs font-medium bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white border-0 shadow-lg shadow-red-500/20",
              isFixing && "opacity-70 cursor-not-allowed"
            )}
          >
            {isFixing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                {isRTL ? 'جاري الإصلاح...' : 'Fixing...'}
              </>
            ) : (
              <>
                <Wrench className="w-3.5 h-3.5 mr-1.5" />
                {isRTL ? 'إصلاح تلقائي' : 'Auto Fix'}
              </>
            )}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// Helper to parse auto-fix message content
export function parseAutoFixMessage(content: string): { isAutoFix: boolean; errorMessage: string } {
  const autoFixPattern = /🔧 \*\*AUTO-FIX REQUESTED\*\*[\s\S]*?```([\s\S]*?)```/;
  const match = content.match(autoFixPattern);
  
  if (match) {
    return {
      isAutoFix: true,
      errorMessage: match[1].trim()
    };
  }
  
  return {
    isAutoFix: false,
    errorMessage: ''
  };
}

export default AutoFixCard;
