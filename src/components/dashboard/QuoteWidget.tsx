
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
import { toast } from "sonner";

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
        toast.success(language === 'ar' ? "تم تحديث الاقتباس" : "Quote refreshed");
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
    <Card 
      className={`${className} relative shadow-lg transform hover:shadow-xl transition-all duration-300`}
      style={{
        background: 'rgba(30, 58, 138, 0.1)', // Light navy blue with 90% transparency
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(30, 58, 138, 0.2)',
        boxShadow: '0 8px 32px rgba(30, 58, 138, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)',
        transform: 'translateZ(0)', // Enable 3D rendering context
      }}
    >
      {/* 3D effect overlay */}
      <div 
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.05) 100%)',
          borderRadius: 'inherit',
        }}
      />
      
      <CardHeader className="p-3 pb-1 relative z-10">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg text-blue-900 font-semibold">
            {t("dailyQuote", language)}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-blue-900/10" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 text-blue-900 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="sr-only">
              {language === 'ar' ? "تحديث الاقتباس" : "Refresh quote"}
            </span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 relative z-10">
        <div className={`text-sm ${language === 'ar' ? 'text-right' : ''}`}>
          <p className="text-sm italic text-blue-900 font-medium">{`"${quoteText}"`}</p>
          <p className="text-xs text-blue-800/80 mt-1 font-medium">- {quoteAuthor}</p>
        </div>
      </CardContent>
    </Card>
  );
};
