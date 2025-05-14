import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { 
  getQuoteForDisplay, 
  getQuoteText, 
  getQuoteAuthor, 
  QuoteObject,
  forceNewQuote
} from '@/utils/quoteService';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface QuoteWidgetProps {
  className?: string;
}

export const QuoteWidget: React.FC<QuoteWidgetProps> = ({ className }) => {
  const { language } = useTheme();
  const [quote, setQuote] = useState<QuoteObject | string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchQuote = (forceRefresh = false) => {
    try {
      setIsLoading(true);
      const quoteData = forceRefresh ? forceNewQuote() : getQuoteForDisplay();
      console.log("Fetched quote in widget:", quoteData);
      setQuote(quoteData);
      
      if (forceRefresh) {
        toast({
          title: language === 'ar' ? "تم تحديث الاقتباس" : "Quote refreshed"
        });
      }
    } catch (error) {
      console.error("Error fetching quote:", error);
      // Fallback to default quote on error
      setQuote({
        text_en: "The journey of a thousand miles begins with a single step.",
        text_ar: "رحلة الألف ميل تبدأ بخطوة واحدة.",
        source: "Lao Tzu"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    // Get the quote on component mount and when language changes
    fetchQuote();
  }, [language]); // Re-fetch quote when language changes
  
  // If no quote is available yet
  if (!quote) {
    return null;
  }
  
  const quoteText = getQuoteText(quote, language);
  const quoteAuthor = getQuoteAuthor(quote);
  
  const handleRefresh = () => {
    fetchQuote(true); // Force a new quote
  };
  
  return (
    <Card className={className}>
      <CardHeader className="p-3 pb-1">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">
            {t("dailyQuote", language)}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="sr-only">
              {language === 'ar' ? "تحديث الاقتباس" : "Refresh quote"}
            </span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className={`text-sm ${language === 'ar' ? 'text-right' : ''}`}>
          <p className="text-sm italic">{`"${quoteText}"`}</p>
          <p className="text-xs text-muted-foreground mt-1">- {quoteAuthor}</p>
        </div>
      </CardContent>
    </Card>
  );
};
