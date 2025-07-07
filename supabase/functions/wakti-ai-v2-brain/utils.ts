
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

// Simplified API key validation
export function validateApiKeys(): { valid: boolean; missing: string[] } {
  const keys = { ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, TAVILY_API_KEY, RUNWARE_API_KEY };
  const missing = Object.entries(keys).filter(([_, value]) => !value).map(([name]) => name);
  return { valid: missing.length === 0, missing };
}

// Utility functions
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

// SIMPLIFIED: Claude 4 API with robust JSON parsing
export async function callClaudeAPI(
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
      messages
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude 4 API error (${response.status}): ${errorText}`);
  }

  // Safe JSON parsing
  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    throw new Error('Empty response from Claude 4 API');
  }

  try {
    return JSON.parse(responseText);
  } catch (jsonError) {
    console.error('❌ Claude 4 JSON parsing error:', jsonError);
    console.error('❌ Raw response:', responseText.substring(0, 200));
    throw new Error('Invalid JSON response from Claude 4 API');
  }
}

// SIMPLIFIED: DeepSeek fallback with robust JSON parsing
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
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
  }

  // Safe JSON parsing
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
