import React, { useEffect, useState } from 'react';
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
import { RefreshCw, Hand } from 'lucide-react';
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
    <div 
      className={`${className} relative p-4 rounded-xl shadow-glow transition-all duration-300 overflow-visible`}
      style={{
        background: 'rgba(87, 124, 255, 0.12)', // Vibrant blue tint with glass effect
        backdropFilter: 'blur(14px)',
        border: '1.5px solid rgba(87, 124, 255, 0.20)',
        boxShadow: '0 8px 32px rgba(87, 124, 255, 0.12), 0 2px 12px rgba(30, 58, 138, 0.08)',
      }}
    >
      {/* Glass/Glare Overlays */}
      <div className="absolute inset-0 rounded-xl pointer-events-none" 
        style={{
          background: "linear-gradient(135deg, rgba(87,124,255,0.20) 0%, rgba(255,255,255,0.08) 45%, rgba(87,124,255,0.08) 100%)"
        }} 
      />
      <div className="absolute -top-6 -left-6 w-24 h-24 bg-accent-blue/20 rounded-full blur-xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-2 right-3 w-16 h-6 bg-accent-blue/10 rounded-lg blur-md opacity-20 pointer-events-none" />

      {/* Drag handle inside the container */}
      <div className="absolute top-2 left-2 z-20 p-1 rounded-md bg-accent-blue/10 hover:bg-accent-blue/30 hover:text-background transition-colors cursor-grab active:cursor-grabbing border border-accent-blue/30">
        <Hand className="h-4 w-4 text-accent-blue" />
      </div>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-3 relative z-10 ml-10">
        <h3 className="text-lg font-semibold text-accent-blue bg-gradient-to-r from-accent-blue to-accent-blue/90 bg-clip-text text-transparent drop-shadow-md">
          {t("dailyQuote", language)}
        </h3>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-accent-blue/30" 
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 text-accent-blue ${isLoading ? 'animate-spin' : ''}`} />
          <span className="sr-only">
            {language === 'ar' ? "تحديث الاقتباس" : "Refresh quote"}
          </span>
        </Button>
      </div>
      {/* Quote Content */}
      <div className={`relative z-10 px-2 pb-2 ${language === 'ar' ? 'text-right' : ''}`}>
        <p className="text-sm italic font-medium mb-2 text-accent-blue/90">
          "{quoteText}"
        </p>
        <p className="text-xs text-accent-blue/70">
          — {quoteAuthor}
        </p>
      </div>
    </div>
  );
};
