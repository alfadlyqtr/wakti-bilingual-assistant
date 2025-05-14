import { quotes } from './dailyQuotes';

// Custom quotes storage
const CUSTOM_QUOTES_KEY = 'wakti_custom_quotes';
const LAST_QUOTE_KEY = 'wakti_last_quote';
const LAST_QUOTE_TIME_KEY = 'wakti_last_quote_time';

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
  
  // Default preferences
  return {
    category: 'motivation',
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
const getAllQuotesFromCategory = (category: string): string[] => {
  if (category === 'mixed') {
    // For mixed category, collect all quotes from all categories
    let allQuotes: string[] = [];
    
    Object.keys(quotes).forEach(cat => {
      if (cat !== 'mixed' && cat !== 'custom' && typeof quotes[cat] !== 'string') {
        const categoryQuotes = getAllQuotesFromCategory(cat);
        allQuotes = [...allQuotes, ...categoryQuotes];
      }
    });
    
    return allQuotes;
  } else if (category === 'custom') {
    return getCustomQuotes();
  } else if (typeof quotes[category] === 'string') {
    // Category that's marked as "To be filled next"
    return ["Category will be available in the next update."];
  } else if (typeof quotes[category] === 'object') {
    // For structured categories like motivational, islamic, etc.
    let categoryQuotes: string[] = [];
    
    Object.keys(quotes[category]).forEach(subcat => {
      categoryQuotes = [...categoryQuotes, ...quotes[category][subcat]];
    });
    
    return categoryQuotes;
  }
  
  return [];
};

// Get a random quote based on preferences
export const getRandomQuote = (category: string = 'motivation'): string => {
  const allQuotes = getAllQuotesFromCategory(category);
  
  // If no quotes available for the category
  if (allQuotes.length === 0) {
    return "Wisdom awaits. More quotes coming soon.";
  }
  
  // Get a random quote
  const randomIndex = Math.floor(Math.random() * allQuotes.length);
  const quote = allQuotes[randomIndex];
  
  // Store this quote and time
  saveLastQuote(quote);
  
  return quote;
};

// Save the last displayed quote and time
const saveLastQuote = (quote: string): void => {
  try {
    localStorage.setItem(LAST_QUOTE_KEY, quote);
    localStorage.setItem(LAST_QUOTE_TIME_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Error saving last quote:', error);
  }
};

// Get the last displayed quote
export const getLastQuote = (): { quote: string; timestamp: string } => {
  try {
    const quote = localStorage.getItem(LAST_QUOTE_KEY) || "";
    const timestamp = localStorage.getItem(LAST_QUOTE_TIME_KEY) || new Date().toISOString();
    
    return { quote, timestamp };
  } catch (error) {
    console.error('Error getting last quote:', error);
    return { quote: "", timestamp: new Date().toISOString() };
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
export const getQuoteForDisplay = (): string => {
  const { category, frequency } = getQuotePreferences();
  
  // If we should show a new quote based on frequency
  if (shouldShowNewQuote(frequency)) {
    return getRandomQuote(category);
  }
  
  // Otherwise return the last quote
  const { quote } = getLastQuote();
  return quote || getRandomQuote(category);
};

// Extract author from quote
export const getQuoteAuthor = (quote: string): string => {
  const parts = quote.split(' - ');
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  return 'Unknown';
};

// Extract quote text without author
export const getQuoteText = (quote: string): string => {
  const lastDashIndex = quote.lastIndexOf(' - ');
  if (lastDashIndex !== -1) {
    return quote.substring(0, lastDashIndex);
  }
  return quote;
};
