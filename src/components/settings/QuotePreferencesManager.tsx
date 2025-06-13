
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { RefreshCw, Settings } from 'lucide-react';
import { 
  getQuotePreferences, 
  saveQuotePreferences, 
  getQuoteForDisplay,
  getQuoteText,
  getQuoteAuthor,
  forceNewQuote,
  QuotePreferences,
  QuoteObject
} from '@/utils/quoteService';

export const QuotePreferencesManager: React.FC = () => {
  const { language } = useTheme();
  const { showSuccess } = useToastHelper();
  const [preferences, setPreferences] = useState<QuotePreferences>({ category: 'motivational', frequency: '2xday' });
  const [currentQuote, setCurrentQuote] = useState<QuoteObject | string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const prefs = getQuotePreferences();
    setPreferences(prefs);
    
    const quote = getQuoteForDisplay();
    setCurrentQuote(quote);
  }, []);

  const handlePreferenceChange = (key: keyof QuotePreferences, value: string) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    saveQuotePreferences(newPrefs);
    showSuccess(language === 'ar' ? 'تم تحديث تفضيلات الاقتباس' : 'Quote preferences updated');
  };

  const handleRefreshQuote = async () => {
    setIsRefreshing(true);
    try {
      const newQuote = forceNewQuote();
      setCurrentQuote(newQuote);
      showSuccess(language === 'ar' ? 'تم تحديث الاقتباس' : 'Quote refreshed');
    } catch (error) {
      console.error('Error refreshing quote:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const quoteText = currentQuote ? getQuoteText(currentQuote, language) : '';
  const quoteAuthor = currentQuote ? getQuoteAuthor(currentQuote) : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {language === 'ar' ? 'إعدادات الاقتباس اليومي' : 'Daily Quote Settings'}
        </CardTitle>
        <CardDescription>
          {language === 'ar' 
            ? 'تخصيص نوع وتكرار عرض الاقتباسات اليومية'
            : 'Customize the type and frequency of daily quotes'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quote Category */}
        <div className="space-y-2">
          <Label className="text-base font-medium">
            {language === 'ar' ? 'فئة الاقتباس' : 'Quote Category'}
          </Label>
          <Select value={preferences.category} onValueChange={(value) => handlePreferenceChange('category', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="motivational">
                {language === 'ar' ? 'تحفيزية' : 'Motivational'}
              </SelectItem>
              <SelectItem value="islamic">
                {language === 'ar' ? 'إسلامية' : 'Islamic'}
              </SelectItem>
              <SelectItem value="mixed">
                {language === 'ar' ? 'متنوعة' : 'Mixed'}
              </SelectItem>
              <SelectItem value="custom">
                {language === 'ar' ? 'مخصصة' : 'Custom'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quote Frequency */}
        <div className="space-y-2">
          <Label className="text-base font-medium">
            {language === 'ar' ? 'تكرار تغيير الاقتباس' : 'Quote Change Frequency'}
          </Label>
          <Select value={preferences.frequency} onValueChange={(value) => handlePreferenceChange('frequency', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2xday">
                {language === 'ar' ? 'مرتين يومياً (كل 12 ساعة)' : 'Twice Daily (Every 12 hours)'}
              </SelectItem>
              <SelectItem value="4xday">
                {language === 'ar' ? 'أربع مرات يومياً (كل 6 ساعات)' : 'Four Times Daily (Every 6 hours)'}
              </SelectItem>
              <SelectItem value="6xday">
                {language === 'ar' ? 'ست مرات يومياً (كل 4 ساعات)' : 'Six Times Daily (Every 4 hours)'}
              </SelectItem>
              <SelectItem value="appStart">
                {language === 'ar' ? 'عند كل بدء للتطبيق' : 'Every App Start'}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Current Quote Preview */}
        {currentQuote && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">
                {language === 'ar' ? 'الاقتباس الحالي' : 'Current Quote'}
              </Label>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshQuote}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {language === 'ar' ? 'تحديث' : 'Refresh'}
              </Button>
            </div>
            
            <div className="p-4 bg-muted/30 rounded-lg border">
              <p className="text-sm italic font-medium mb-2">"{quoteText}"</p>
              <p className="text-xs text-muted-foreground">— {quoteAuthor}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
