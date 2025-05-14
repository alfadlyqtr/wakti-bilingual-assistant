
import { quotes } from './dailyQuotes';

// Custom quotes storage
const CUSTOM_QUOTES_KEY = 'wakti_custom_quotes';
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
  category: string;
  frequency: string;
}

// Get user preferences from localStorage
export const getQuotePreferences = (): QuotePreferences => {
  try {
    const storedPreferences = localStorage.getItem('wakti_quote_preferences');
    if (storedPreferences) {
      return JSON.parse(storedPreferences);
    }
  } catch (error) {
    console.error('Error loading quote preferences:', error);
  }
  
  // Default preferences - use "motivational" instead of "motivation"
  return {
    category: 'motivational',
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

// Save custom quotes
export const saveCustomQuotes = (customQuotes: string[]): void => {
  try {
    localStorage.setItem(CUSTOM_QUOTES_KEY, JSON.stringify(customQuotes));
  } catch (error) {
    console.error('Error saving custom quotes:', error);
  }
};

// Get custom quotes
export const getCustomQuotes = (): string[] => {
  try {
    const storedQuotes = localStorage.getItem(CUSTOM_QUOTES_KEY);
    if (storedQuotes) {
      return JSON.parse(storedQuotes);
    }
  } catch (error) {
    console.error('Error loading custom quotes:', error);
  }
  
  return [];
};

// Helper function to get all quotes from a category
const getAllQuotesFromCategory = (category: string): (QuoteObject | string)[] => {
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
    return getCustomQuotes();
  } else if (quotes[category] && typeof quotes[category] === 'object') {
    // For structured categories like motivational, islamic, etc.
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

// Get a random quote based on preferences
export const getRandomQuote = (category: string = 'motivational'): QuoteObject | string => {
  const allQuotes = getAllQuotesFromCategory(category);
  console.log(`Found ${allQuotes.length} quotes in category '${category}'`);
  
  // If no quotes available for the category
  if (allQuotes.length === 0) {
    console.log("No quotes found for category:", category);
    return {
      text_en: "Wisdom awaits. More quotes coming soon.",
      text_ar: "الحكمة تنتظر. المزيد من الاقتباسات قريبًا.",
      source: "WAKTI"
    };
  }
  
  // Get a random quote
  const randomIndex = Math.floor(Math.random() * allQuotes.length);
  const quote = allQuotes[randomIndex];
  console.log("Selected quote:", quote);
  
  // Store this quote and time
  saveLastQuote(quote);
  
  return quote;
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

// Get the last displayed quote
export const getLastQuote = (): { quote: QuoteObject | string; timestamp: string } => {
  try {
    const quoteStr = localStorage.getItem(LAST_QUOTE_KEY);
    let quote;
    
    if (quoteStr) {
      try {
        quote = JSON.parse(quoteStr);
      } catch (e) {
        // Handle old format quotes that were stored as strings
        quote = quoteStr;
      }
    } else {
      quote = {
        text_en: "Welcome to WAKTI.",
        text_ar: "مرحبًا بك في وكتي.",
        source: "WAKTI"
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

// Get quote for display based on preferences
export const getQuoteForDisplay = (): QuoteObject | string => {
  const { category, frequency } = getQuotePreferences();
  
  // Remove debugging code that was forcing new quotes
  // localStorage.removeItem(LAST_QUOTE_KEY);
  
  // If we should show a new quote based on frequency
  if (shouldShowNewQuote(frequency)) {
    const newQuote = getRandomQuote(category);
    console.log("Showing new quote:", newQuote);
    return newQuote;
  }
  
  // Otherwise return the last quote
  const { quote } = getLastQuote();
  console.log("Showing last quote:", quote);
  return quote || getRandomQuote(category);
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
