
import React from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Copy, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generatePDF } from '@/utils/pdfUtils';

interface TextActionButtonsProps {
  text: string;
  mode: 'compose' | 'reply';
}

export function TextActionButtons({ text, mode }: TextActionButtonsProps) {
  const { language } = useTheme();
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: language === 'ar' ? 'تم النسخ!' : 'Copied!',
        description: language === 'ar' ? 'تم نسخ النص إلى الحافظة' : 'Text copied to clipboard',
      });
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text',
        variant: 'destructive',
      });
    }
  };

  const handleExportPDF = async () => {
    try {
      const pdfBlob = await generatePDF({
        title: mode === 'compose' 
          ? (language === 'ar' ? 'نص مُنشأ' : 'Generated Text')
          : (language === 'ar' ? 'رد مُنشأ' : 'Generated Reply'),
        content: { text },
        metadata: {
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          type: mode === 'compose' ? 'Generated Text' : 'Generated Reply'
        },
        language: language === 'ar' ? 'ar' : 'en'
      });

      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mode === 'compose' ? 'generated-text' : 'generated-reply'}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: language === 'ar' ? 'تم التصدير!' : 'Exported!',
        description: language === 'ar' ? 'تم تصدير النص كـ PDF' : 'Text exported as PDF',
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تصدير PDF' : 'Failed to export PDF',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <Button
        onClick={handleCopy}
        variant="outline"
        size="sm"
        className="h-8 px-3 text-xs"
      >
        <Copy className="h-3 w-3 mr-1" />
        {language === 'ar' ? 'نسخ' : 'Copy'}
      </Button>
      <Button
        onClick={handleExportPDF}
        variant="outline"
        size="sm"
        className="h-8 px-3 text-xs"
      >
        <FileText className="h-3 w-3 mr-1" />
        {language === 'ar' ? 'PDF' : 'PDF'}
      </Button>
    </div>
  );
}
