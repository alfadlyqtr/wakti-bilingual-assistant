
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
export const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
export const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
export const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// OPTIMIZED API key validation
export function validateApiKeys(): { valid: boolean; missing: string[] } {
  const keys = { ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, TAVILY_API_KEY, RUNWARE_API_KEY };
  const missing = Object.entries(keys).filter(([_, value]) => !value).map(([name]) => name);
  return { valid: missing.length === 0, missing };
}

// OPTIMIZED utility functions
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

// ENHANCED: Date comparison for document analysis
export function isDocumentExpired(expiryDateString: string): { expired: boolean; daysExpired?: number; formattedDate?: string } {
  try {
    // Parse various date formats commonly found in documents
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // MM/DD/YYYY or DD/MM/YYYY
      /(\d{1,2})-(\d{1,2})-(\d{4})/,   // MM-DD-YYYY or DD-MM-YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
      /(\d{1,2})\s+(\w+)\s+(\d{4})/,   // DD Month YYYY
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/  // Month DD, YYYY
    ];
    
    let parsedDate: Date | null = null;
    
    for (const pattern of datePatterns) {
      const match = expiryDateString.match(pattern);
      if (match) {
        if (pattern === datePatterns[0] || pattern === datePatterns[1]) {
          // Try both MM/DD and DD/MM formats
          const date1 = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
          const date2 = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
          
          // Use the date that makes more sense (not in the distant future)
          const now = new Date();
          const futureThreshold = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
          
          if (date1 <= futureThreshold) {
            parsedDate = date1;
          } else if (date2 <= futureThreshold) {
            parsedDate = date2;
          } else {
            parsedDate = date1; // Default to first format
          }
        } else if (pattern === datePatterns[2]) {
          // YYYY-MM-DD
          parsedDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else {
          // Handle month names
          parsedDate = new Date(expiryDateString);
        }
        break;
      }
    }
    
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      // Fallback to generic date parsing
      parsedDate = new Date(expiryDateString);
      if (isNaN(parsedDate.getTime())) {
        return { expired: false };
      }
    }
    
    const now = new Date();
    const diffTime = now.getTime() - parsedDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      expired: diffTime > 0,
      daysExpired: diffDays > 0 ? diffDays : undefined,
      formattedDate: parsedDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    };
  } catch (error) {
    console.error('Error parsing expiry date:', error);
    return { expired: false };
  }
}

// ENHANCED: Language detection from text
export function detectLanguageFromText(text: string): 'ar' | 'en' {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicPattern.test(text) ? 'ar' : 'en';
}

// OPTIMIZED: Claude 4 API with enhanced error handling and faster response
export async function callClaude35API(
  messages: any[],
  maxTokens: number = 4096,
  model: string = 'claude-3-5-sonnet-20241022'
): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
      temperature: 0.3 // Optimized for consistent responses
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude 3.5 API error (${response.status}): ${errorText}`);
  }

  // OPTIMIZED: Fast JSON parsing with validation
  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    throw new Error('Empty response from Claude 3.5 API');
  }

  try {
    return JSON.parse(responseText);
  } catch (jsonError) {
    console.error('❌ Claude 3.5 JSON parsing error:', jsonError);
    console.error('❌ Raw response:', responseText.substring(0, 200));
    throw new Error('Invalid JSON response from Claude 3.5 API');
  }
}

// OPTIMIZED: DeepSeek fallback (kept for compatibility but optimized)
export async function callDeepSeekAPI(
  messages: any[],
  maxTokens: number = 4096
): Promise<any> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API key not configured');
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: maxTokens,
      temperature: 0.3 // Optimized for consistency
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
  }

  // OPTIMIZED: Fast JSON parsing
  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    throw new Error('Empty response from DeepSeek API');
  }

  try {
    return JSON.parse(responseText);
  } catch (jsonError) {
    console.error('❌ DeepSeek JSON parsing error:', jsonError);
    console.error('❌ Raw response:', responseText.substring(0, 200));
    throw new Error('Invalid JSON response from DeepSeek API');
  }
}
