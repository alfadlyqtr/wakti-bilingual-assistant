import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, X, Check, AlertTriangle, Copy, CheckCheck, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface MigrationApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onCancel: () => void;
  migrationTitle: string;
  migrationTitleAr?: string;
  sqlPreview: string;
  description?: string;
  descriptionAr?: string;
  isRTL?: boolean;
  onAlwaysAllowChange?: (alwaysAllow: boolean) => void;
}

export const MigrationApprovalDialog: React.FC<MigrationApprovalDialogProps> = ({
  isOpen,
  onClose,
  onApprove,
  onCancel,
  migrationTitle,
  migrationTitleAr,
  sqlPreview,
  description,
  descriptionAr,
  isRTL = false,
  onAlwaysAllowChange,
}) => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sqlPreview);
      setCopied(true);
      toast.success(isArabic ? 'تم نسخ SQL' : 'SQL copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(isArabic ? 'فشل النسخ' : 'Failed to copy');
    }
  }, [sqlPreview, isArabic]);

  const handleApprove = useCallback(() => {
    if (alwaysAllow && onAlwaysAllowChange) {
      onAlwaysAllowChange(true);
    }
    onApprove();
  }, [alwaysAllow, onAlwaysAllowChange, onApprove]);

  const handleAlwaysAllowChange = useCallback((checked: boolean) => {
    setAlwaysAllow(checked);
  }, []);

  // Analyze SQL for potential issues
  const analyzeSQL = useCallback((sql: string) => {
    const warnings: string[] = [];
    const lowerSQL = sql.toLowerCase();
    
    if (lowerSQL.includes('drop table')) {
      warnings.push(isArabic ? 'سيحذف هذا جدولاً' : 'This will drop a table');
    }
    if (lowerSQL.includes('delete from') && !lowerSQL.includes('where')) {
      warnings.push(isArabic ? 'حذف بدون شرط WHERE' : 'DELETE without WHERE clause');
    }
    if (lowerSQL.includes('truncate')) {
      warnings.push(isArabic ? 'سيحذف جميع البيانات' : 'This will remove all data');
    }
    
    return warnings;
  }, [isArabic]);

  const warnings = analyzeSQL(sqlPreview);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden ${isRTL ? 'rtl' : 'ltr'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {isArabic ? 'تغيير قاعدة البيانات مطلوب' : 'Database Change Required'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isArabic ? migrationTitleAr || migrationTitle : migrationTitle}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Description */}
          {(description || descriptionAr) && (
            <div className="px-4 py-3 bg-muted/20 border-b border-border">
              <p className="text-sm text-muted-foreground">
                {isArabic ? descriptionAr || description : description}
              </p>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="px-4 py-3 bg-destructive/10 border-b border-destructive/20">
              <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    {isArabic ? 'تحذير' : 'Warning'}
                  </p>
                  <ul className="text-xs text-destructive/80 mt-1 space-y-0.5">
                    {warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* SQL Preview */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                SQL Preview
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 text-xs gap-1"
              >
                {copied ? (
                  <>
                    <CheckCheck className="w-3 h-3" />
                    {isArabic ? 'تم النسخ' : 'Copied'}
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    {isArabic ? 'نسخ' : 'Copy'}
                  </>
                )}
              </Button>
            </div>
            <div className="relative rounded-lg bg-[#1e1e1e] border border-border overflow-hidden">
              <pre className="p-4 text-sm text-green-400 font-mono overflow-x-auto max-h-64 scrollbar-thin">
                <code>{sqlPreview}</code>
              </pre>
            </div>
          </div>

          {/* Always Allow Checkbox */}
          <div className={`px-4 pb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
            <label className={`flex items-center gap-2 cursor-pointer ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Checkbox
                checked={alwaysAllow}
                onCheckedChange={handleAlwaysAllowChange}
              />
              <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {isArabic 
                    ? 'السماح دائماً بالترحيلات من هذا المشروع' 
                    : 'Always allow migrations from this AI'
                  }
                </span>
              </div>
            </label>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-end gap-3 p-4 border-t border-border bg-muted/30 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Button
              variant="ghost"
              onClick={onCancel}
            >
              {isArabic ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleApprove}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              {isArabic ? 'موافقة' : 'Approve'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MigrationApprovalDialog;
