
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { 
  getQuoteForDisplay, 
  getQuoteText, 
  getQuoteAuthor, 
  QuoteObject 
} from '@/utils/quoteService';

interface QuoteWidgetProps {
  className?: string;
}

export const QuoteWidget: React.FC<QuoteWidgetProps> = ({ className }) => {
  const { language } = useTheme();
  const [quote, setQuote] = useState<QuoteObject | string | null>(null);
  
  useEffect(() => {
    // Get the quote on component mount and when language changes
    const fetchQuote = () => {
      const quoteData = getQuoteForDisplay();
      console.log("Fetched quote:", quoteData);
      setQuote(quoteData);
    };
    
    fetchQuote();
  }, [language]); // Re-fetch quote when language changes
  
  // If no quote is available yet
  if (!quote) {
    return null;
  }
  
  const quoteText = getQuoteText(quote, language);
  const quoteAuthor = getQuoteAuthor(quote);
  
  return (
    <Card className={className}>
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-lg">
          {t("dailyQuote", language)}
        </CardTitle>
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
