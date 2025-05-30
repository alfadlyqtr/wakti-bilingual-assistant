
import React from 'react';
import { Copy, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { toast } from '@/components/ui/toast-helper';
import { generatePDF } from '@/utils/pdfUtils';

interface SearchResultActionsProps {
  content: string;
  query?: string;
  sources?: Array<{
    title: string;
    url: string;
    content?: string;
  }>;
  metadata?: {
    searchMode?: string;
    intent?: string;
    timestamp?: Date;
  };
}

export function SearchResultActions({ 
  content, 
  query = '', 
  sources = [], 
  metadata = {} 
}: SearchResultActionsProps) {
  const { language } = useTheme();

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: language === 'ar' ? 'تم النسخ' : 'Copied',
        description: language === 'ar' ? 'تم نسخ النص بنجاح' : 'Text copied to clipboard successfully'
      });
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text',
        variant: 'destructive'
      });
    }
  };

  const handleExportPDF = async () => {
    try {
      const pdfOptions = {
        title: query || (language === 'ar' ? 'نتيجة البحث' : 'Search Result'),
        content: {
          text: content
        },
        metadata: {
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          type: metadata.searchMode === 'advanced' 
            ? (language === 'ar' ? 'بحث متقدم' : 'Advanced Search')
            : (language === 'ar' ? 'بحث أساسي' : 'Basic Search'),
          host: 'WAKTI AI'
        },
        language: language as 'en' | 'ar'
      };

      const pdfBlob = await generatePDF(pdfOptions);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `wakti-search-result-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: language === 'ar' ? 'تم التصدير' : 'Exported',
        description: language === 'ar' ? 'تم تصدير PDF بنجاح' : 'PDF exported successfully'
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تصدير PDF' : 'Failed to export PDF',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopyText}
        className="flex items-center gap-2 text-xs h-8 px-3"
      >
        <Copy className="h-3 w-3" />
        {language === 'ar' ? 'نسخ النص' : 'Copy Text'}
      </Button>
      
      <Button
        size="sm"
        variant="outline"
        onClick={handleExportPDF}
        className="flex items-center gap-2 text-xs h-8 px-3"
      >
        <FileText className="h-3 w-3" />
        {language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
      </Button>
    </div>
  );
}
