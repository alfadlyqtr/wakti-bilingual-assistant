
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTheme } from '@/providers/ThemeProvider';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { RefreshCw, Settings, Check } from 'lucide-react';
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

type MultiCategoryPreferences = QuotePreferences & { categories: string[] };

export const QuotePreferencesManager: React.FC = () => {
  const { language } = useTheme();
  const { showSuccess } = useToastHelper();

  // Updated: use categories: string[] instead of category: string
  const defaultCategories = ['motivational'];
  const [preferences, setPreferences] = useState<MultiCategoryPreferences>({
    categories: defaultCategories,
    frequency: '2xday',
  });
  const [currentQuote, setCurrentQuote] = useState<QuoteObject | string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add all available quote categories
  const categoryOptions = [
    { value: "motivational", label: language === "ar" ? "تحفيزية" : "Motivational" },
    { value: "islamic", label: language === "ar" ? "إسلامية" : "Islamic" },
    { value: "positive", label: language === "ar" ? "إيجابية" : "Positive" },
    { value: "health", label: language === "ar" ? "صحة" : "Health" },
    { value: "productivity", label: language === "ar" ? "إنتاجية" : "Productivity" },
    { value: "discipline", label: language === "ar" ? "انضباط" : "Discipline" },
    { value: "mixed", label: language === "ar" ? "متنوعة" : "Mixed" },
    { value: "custom", label: language === "ar" ? "مخصصة" : "Custom" },
  ];

  // Safe loading and migration from old single-category prefs
  useEffect(() => {
    const prefs = getQuotePreferences() as any;
    let newPrefs: MultiCategoryPreferences;
    if ('category' in prefs && typeof prefs.category === 'string') {
      newPrefs = { ...prefs, categories: [prefs.category] };
    } else if ('categories' in prefs && Array.isArray(prefs.categories)) {
      newPrefs = { ...prefs };
    } else {
      newPrefs = { categories: defaultCategories, frequency: '2xday' };
    }
    setPreferences(newPrefs);

    const quote = getQuoteForDisplay();
    setCurrentQuote(quote);
  }, []);

  const handleCategoryToggle = (categoryValue: string) => {
    let newCats: string[];
    if (preferences.categories.includes(categoryValue)) {
      // Minimum 1 category must be kept
      if (preferences.categories.length === 1) return;
      newCats = preferences.categories.filter(c => c !== categoryValue);
    } else {
      newCats = [...preferences.categories, categoryValue];
    }
    const newPrefs = { ...preferences, categories: newCats };
    setPreferences(newPrefs);
    saveQuotePreferences(newPrefs);
    showSuccess(language === 'ar' ? 'تم تحديث تفضيلات الاقتباس' : 'Quote preferences updated');
  };

  const handleFrequencyChange = (value: string) => {
    const newPrefs = { ...preferences, frequency: value };
    setPreferences(newPrefs);
    saveQuotePreferences(newPrefs);
    showSuccess(language === 'ar' ? 'تم تحديث تفضيلات الاقتباس' : 'Quote preferences updated');
  };

  const handleRefreshQuote = async () => {
    setIsRefreshing(true);
    try {
      const newQuote = forceNewQuote(undefined, preferences.categories);
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

  // Display selected categories as comma-separated
  const selectedCatsLabels = categoryOptions
    .filter(opt => preferences.categories.includes(opt.value))
    .map(opt => opt.label)
    .join(', ');

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
            {language === 'ar' ? 'فئات الاقتباس (يمكنك اختيار أكثر من واحدة)' : 'Quote Categories (multi-select)'}
          </Label>
          {/* Custom multi-select dropdown UI that matches shadcn triggers */}
          <Select value="" onValueChange={() => undefined} open={false}>
            <SelectTrigger>
              <SelectValue placeholder={language === 'ar' ? 'اختر... ' : 'Select...'}>
                {selectedCatsLabels}
              </SelectValue>
            </SelectTrigger>
            {/* Fake trigger above for styling. Real category selection below: */}
          </Select>
          <div className="relative mt-2">
            <div className="absolute z-50 w-full bg-popover border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {categoryOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleCategoryToggle(option.value)}
                  className={`flex items-center px-3 py-2 w-full text-left hover:bg-accent transition 
                      ${preferences.categories.includes(option.value) ? 'bg-accent' : ''}`}
                  style={{ direction: language === "ar" ? "rtl" : "ltr" }}
                >
                  <Checkbox
                    checked={preferences.categories.includes(option.value)}
                    className="mr-2"
                    tabIndex={-1}
                    readOnly
                  />
                  <span className="flex-1">{option.label}</span>
                  {preferences.categories.includes(option.value) && <Check className="w-4 h-4 text-primary ml-2" />}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {language === "ar"
              ? "يجب اختيار فئة واحدة على الأقل"
              : "You must select at least one category"}
          </div>
        </div>

        {/* Quote Frequency */}
        <div className="space-y-2">
          <Label className="text-base font-medium">
            {language === 'ar' ? 'تكرار تغيير الاقتباس' : 'Quote Change Frequency'}
          </Label>
          <Select value={preferences.frequency} onValueChange={handleFrequencyChange}>
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
