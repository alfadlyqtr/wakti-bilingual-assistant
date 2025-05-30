
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, FileDown, ExternalLink, Clock } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AdvancedSearchResultProps {
  result: {
    title: string;
    content: string;
    url: string;
    score: number;
    published_date?: string;
  };
  index: number;
}

export function AdvancedSearchResult({ result, index }: AdvancedSearchResultProps) {
  const { language } = useTheme();

  const handleCopyText = async () => {
    try {
      const textToCopy = `${result.title}\n\n${result.content}\n\nSource: ${result.url}`;
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: language === 'ar' ? 'تم النسخ' : 'Copied',
        description: language === 'ar' ? 'تم نسخ النص بنجاح' : 'Text copied to clipboard',
      });
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text',
        variant: 'destructive'
      });
    }
  };

  const handleExportPDF = () => {
    // This would be implemented later with jsPDF
    toast({
      title: language === 'ar' ? 'قريباً' : 'Coming Soon',
      description: language === 'ar' ? 'تصدير PDF سيكون متاحاً قريباً' : 'PDF export will be available soon',
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return null;
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  return (
    <Card className="mb-4 border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs font-medium bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400">
                #{index + 1}
              </Badge>
              <Badge className={cn("text-xs", getRelevanceColor(result.score))}>
                {Math.round(result.score * 100)}% {language === 'ar' ? 'صلة' : 'relevance'}
              </Badge>
              {result.published_date && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDate(result.published_date)}
                </div>
              )}
            </div>
            <CardTitle className="text-lg font-semibold leading-tight mb-2 text-foreground">
              {result.title}
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyText}
              className="h-8 w-8 p-0 hover:bg-purple-50 dark:hover:bg-purple-900/30"
              title={language === 'ar' ? 'نسخ النص' : 'Copy text'}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportPDF}
              className="h-8 w-8 p-0 hover:bg-purple-50 dark:hover:bg-purple-900/30"
              title={language === 'ar' ? 'تصدير PDF' : 'Export PDF'}
            >
              <FileDown className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(result.url, '_blank')}
              className="h-8 w-8 p-0 hover:bg-purple-50 dark:hover:bg-purple-900/30"
              title={language === 'ar' ? 'فتح المصدر' : 'Open source'}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {result.content}
          </p>
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
          <span className="truncate flex-1" title={result.url}>
            {language === 'ar' ? 'المصدر:' : 'Source:'} {new URL(result.url).hostname}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
