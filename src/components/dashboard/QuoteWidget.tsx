
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { getQuoteForDisplay, getQuoteText, getQuoteAuthor } from '@/utils/quoteService';

interface QuoteWidgetProps {
  className?: string;
}

export const QuoteWidget: React.FC<QuoteWidgetProps> = ({ className }) => {
  const { language } = useTheme();
  const [quote, setQuote] = useState<string>("");
  
  useEffect(() => {
    // Get the quote on component mount and when language changes
    const quoteText = getQuoteForDisplay();
    setQuote(quoteText);
  }, [language]); // Re-fetch quote when language changes
  
  // If no quote is available yet
  if (!quote) {
    return null;
  }
  
  const quoteText = getQuoteText(quote);
  const quoteAuthor = getQuoteAuthor(quote);
  
  // Use a different layout for Arabic
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className={`text-sm ${language === 'ar' ? 'text-right' : ''}`}>
          <p className="text-sm italic">{language === 'ar' ? `"${quoteText}"` : `"${quoteText}"`}</p>
          <p className="text-xs text-muted-foreground mt-1">- {quoteAuthor}</p>
        </div>
      </CardContent>
    </Card>
  );
};
