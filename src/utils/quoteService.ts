import { quotes } from './dailyQuotes';

// Custom quotes storage
const CUSTOM_QUOTES_KEY_PREFIX = 'wakti_custom_quotes_';
const LAST_QUOTE_KEY = 'wakti_last_quote';
const LAST_QUOTE_TIME_KEY = 'wakti_last_quote_time';

// Quote object interface
export interface QuoteObject {
  text_en: string;
  text_ar: string;
  source: string;
}

// Interface for quote preferences
export interface QuotePreferences {
  categories: string[];
  frequency: string;
}

// Helper for migration from old single category prefs
const legacySingleCategoryToCategories = (stored: any) => {
  if (!stored) return ['motivational'];
  if ('categories' in stored && Array.isArray(stored.categories)) return stored.categories;
  if ('category' in stored && typeof stored.category === 'string') return [stored.category];
  return ['motivational'];
};

// Get user preferences from localStorage
export const getQuotePreferences = (): QuotePreferences => {
  try {
    const storedPreferences = localStorage.getItem('wakti_quote_preferences');
    if (storedPreferences) {
      const parsed = JSON.parse(storedPreferences);
      // Migration logic
      const categories = legacySingleCategoryToCategories(parsed);
      return {
        categories,
        frequency: parsed.frequency || '2xday',
      };
    }
  } catch (error) {
    console.error('Error loading quote preferences:', error);
  }
  return {
    categories: ['motivational'],
    frequency: '2xday',
  };
};

// Save user preferences to localStorage
export const saveQuotePreferences = (preferences: QuotePreferences): void => {
  try {
    localStorage.setItem('wakti_quote_preferences', JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving quote preferences:', error);
  }
};

// ------- USER-PRIVATE CUSTOM QUOTES -------

// Save custom quotes for a specific user
export const saveCustomQuotes = (customQuotes: string[], userId?: string): void => {
  if (!userId) return;
  try {
    localStorage.setItem(`${CUSTOM_QUOTES_KEY_PREFIX}${userId}`, JSON.stringify(customQuotes));
  } catch (error) {
    console.error('Error saving custom quotes:', error);
  }
};

// Get custom quotes for a specific user
export const getCustomQuotes = (userId?: string): string[] => {
  if (!userId) return [];
  try {
    const storedQuotes = localStorage.getItem(`${CUSTOM_QUOTES_KEY_PREFIX}${userId}`);
    if (storedQuotes) {
      return JSON.parse(storedQuotes);
    }
  } catch (error) {
    console.error('Error loading custom quotes:', error);
  }
  return [];
};

// -------------------------------------------
// Helper function to get all quotes from a category or multiple categories
const getAllQuotesFromCategory = (category: string, userId?: string): (QuoteObject | string)[] => {
  console.log(`Getting quotes from category: ${category}`);

  if (category === 'mixed') {
    // For mixed category, collect all quotes from all categories
    let allQuotes: QuoteObject[] = [];
    Object.keys(quotes).forEach(cat => {
      if (cat !== 'mixed' && cat !== 'custom' && typeof quotes[cat] !== 'string') {
        const categoryQuotes = getAllQuotesFromCategory(cat) as QuoteObject[];
        allQuotes = [...allQuotes, ...categoryQuotes];
      }
    });
    return allQuotes;
  } else if (category === 'custom') {
    return getCustomQuotes(userId);
  } else if (quotes[category] && typeof quotes[category] === 'object') {
    let categoryQuotes: QuoteObject[] = [];
    Object.keys(quotes[category]).forEach(subcat => {
      if (Array.isArray(quotes[category][subcat])) {
        categoryQuotes = [...categoryQuotes, ...quotes[category][subcat]];
      }
    });
    console.log(`Found ${categoryQuotes.length} quotes in category '${category}'`);
    return categoryQuotes;
  }
  // If category doesn't exist or is empty
  console.log(`Category '${category}' not found or empty, using default quote`);
  return [{
    text_en: "Wisdom awaits. More quotes coming soon.",
    text_ar: "الحكمة تنتظر. المزيد من الاقتباسات قريبًا.",
    source: "WAKTI"
  }];
};

// Update function accepts an array of categories (multi-selection)
const getAllQuotesFromCategories = (categories: string[], userId?: string): (QuoteObject | string)[] => {
  let allQuotes: (QuoteObject | string)[] = [];
  categories.forEach(category => {
    // Re-use existing logic
    const quotesArr = getAllQuotesFromCategory(category, userId);
    allQuotes = allQuotes.concat(quotesArr);
  });
  // Remove duplicate quotes (by text_en or full string)
  const seen = new Set();
  return allQuotes.filter(quote => {
    if (typeof quote === 'string') {
      if (seen.has(quote)) return false;
      seen.add(quote);
      return true;
    }
    if (seen.has(quote.text_en)) return false;
    seen.add(quote.text_en);
    return true;
  });
};

// Get a random quote based on preferences (now multi-category)
export const getRandomQuote = (categories: string[] = ['motivational'], userId?: string): QuoteObject | string => {
  const allQuotes = getAllQuotesFromCategories(categories, userId);
  if (allQuotes.length === 0) {
    return {
      text_en: "Wisdom awaits. More quotes coming soon.",
      text_ar: "الحكمة تنتظر. المزيد من الاقتباسات قريبًا.",
      source: "WAKTI"
    };
  }
  const lastQuote = getLastQuoteObject();
  let availableQuotes = allQuotes;
  if (lastQuote && allQuotes.length > 1) {
    availableQuotes = allQuotes.filter(quote => {
      if (typeof quote === 'string' && typeof lastQuote === 'string') {
        return quote !== lastQuote;
      }
      if (typeof quote === 'object' && typeof lastQuote === 'object') {
        return quote.text_en !== lastQuote.text_en;
      }
      return true;
    });
  }
  const randomIndex = Math.floor(Math.random() * availableQuotes.length);
  const quote = availableQuotes[randomIndex];
  saveLastQuote(quote);
  return quote;
};

// Force a new quote (pass categories from preferences, not just one)
export const forceNewQuote = (userId?: string, categories?: string[]): QuoteObject | string => {
  const prefs = getQuotePreferences();
  const cats = categories || prefs.categories;
  const newQuote = getRandomQuote(cats, userId);
  return newQuote;
};

// Save the last displayed quote and time
const saveLastQuote = (quote: QuoteObject | string): void => {
  try {
    localStorage.setItem(LAST_QUOTE_KEY, JSON.stringify(quote));
    localStorage.setItem(LAST_QUOTE_TIME_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Error saving last quote:', error);
  }
};

// Get the last displayed quote object
export const getLastQuoteObject = (): QuoteObject | string | null => {
  try {
    const quoteStr = localStorage.getItem(LAST_QUOTE_KEY);
    if (!quoteStr) return null;
    
    try {
      return JSON.parse(quoteStr);
    } catch (e) {
      // Handle old format quotes that were stored as strings
      return quoteStr;
    }
  } catch (error) {
    console.error('Error getting last quote object:', error);
    return null;
  }
};

// Get the last displayed quote
export const getLastQuote = (): { quote: QuoteObject | string; timestamp: string } => {
  try {
    const quote = getLastQuoteObject();
    
    if (!quote) {
      const defaultQuote = {
        text_en: "Welcome to WAKTI.",
        text_ar: "مرحبًا بك في وكتي.",
        source: "WAKTI"
      };
      
      return { 
        quote: defaultQuote, 
        timestamp: new Date().toISOString() 
      };
    }
    
    const timestamp = localStorage.getItem(LAST_QUOTE_TIME_KEY) || new Date().toISOString();
    
    return { quote, timestamp };
  } catch (error) {
    console.error('Error getting last quote:', error);
    return { 
      quote: {
        text_en: "Welcome to WAKTI.",
        text_ar: "مرحبًا بك في وكتي.",
        source: "WAKTI"
      }, 
      timestamp: new Date().toISOString() 
    };
  }
};

// Check if we should show a new quote based on frequency
export const shouldShowNewQuote = (frequency: string): boolean => {
  const { timestamp } = getLastQuote();
  const lastQuoteTime = new Date(timestamp).getTime();
  const currentTime = new Date().getTime();
  const hoursSinceLastQuote = (currentTime - lastQuoteTime) / (1000 * 60 * 60);
  
  console.log(`Hours since last quote: ${hoursSinceLastQuote.toFixed(2)}, frequency: ${frequency}`);
  
  switch (frequency) {
    case '2xday':
      return hoursSinceLastQuote >= 12; // Show new quote every 12 hours
    case '4xday':
      return hoursSinceLastQuote >= 6; // Show new quote every 6 hours
    case '6xday':
      return hoursSinceLastQuote >= 4; // Show new quote every 4 hours
    case 'appStart':
      return true; // Always show a new quote on app start
    default:
      return hoursSinceLastQuote >= 12; // Default to 2x per day
  }
};

// Get quote for display based on preferences (now supports multiple categories)
export const getQuoteForDisplay = (userId?: string): QuoteObject | string => {
  const { categories, frequency } = getQuotePreferences();
  const lastQuoteData = getLastQuoteObject();
  const hasValidQuote = lastQuoteData !== null &&
    lastQuoteData !== undefined &&
    typeof lastQuoteData !== 'string' &&
    lastQuoteData.text_en !== "Welcome to WAKTI.";
  if (shouldShowNewQuote(frequency) || !hasValidQuote) {
    const newQuote = getRandomQuote(categories, userId);
    return newQuote;
  }
  const { quote } = getLastQuote();
  return quote;
};

// Return the appropriate quote text based on language
export const getQuoteText = (quote: QuoteObject | string, language: string): string => {
  if (typeof quote === 'string') {
    // For backward compatibility with custom quotes
    const lastDashIndex = quote.lastIndexOf(' - ');
    if (lastDashIndex !== -1) {
      return quote.substring(0, lastDashIndex);
    }
    return quote;
  }
  
  // Return the appropriate language text
  return language === 'ar' ? quote.text_ar : quote.text_en;
};

// Extract quote author/source
export const getQuoteAuthor = (quote: QuoteObject | string): string => {
  if (typeof quote === 'string') {
    // For backward compatibility with custom quotes
    const parts = quote.split(' - ');
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    return 'Unknown';
  }
  
  return quote.source;
};
