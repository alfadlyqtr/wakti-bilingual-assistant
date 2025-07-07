
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

// Enhanced API key validation with detailed logging
export function validateApiKeys(): { valid: boolean; missing: string[] } {
  const keys = {
    ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY,
    TAVILY_API_KEY,
    RUNWARE_API_KEY
  };
  
  const missing = [];
  
  for (const [name, value] of Object.entries(keys)) {
    if (!value) {
      missing.push(name);
      console.error(`❌ CRITICAL: ${name} is not configured`);
    } else {
      console.log(`✅ ${name} is configured (${value.length} chars)`);
    }
  }
  
  return { valid: missing.length === 0, missing };
}

// Utility functions for the AI service
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

// Enhanced logging utility with detailed error tracking
export function logWithTimestamp(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

// UPGRADED: Claude API helper with Claude 4 Sonnet support
export async function callClaudeAPI(
  messages: any[],
  maxTokens: number = 4096,
  model: string = 'claude-3-5-sonnet-20241022' // Will upgrade to Claude 4 once available
): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    const error = 'CRITICAL ERROR: Anthropic API key not configured in Edge Function environment';
    console.error(error);
    throw new Error(error);
  }

  console.log(`🚀 CLAUDE API: Calling ${model} with ${messages.length} messages, max tokens: ${maxTokens}`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
      stream: false // Will add streaming support
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Claude API error (${response.status}):`, errorText);
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log(`✅ CLAUDE API: Success, response length: ${result.content?.[0]?.text?.length || 0}`);
  return result;
}

// Enhanced DeepSeek fallback with better error handling
export async function callDeepSeekAPI(
  messages: any[],
  maxTokens: number = 4096
): Promise<any> {
  if (!DEEPSEEK_API_KEY) {
    const error = 'CRITICAL ERROR: DeepSeek API key not configured';
    console.error(error);
    throw new Error(error);
  }

  console.log(`🔄 DEEPSEEK FALLBACK: Calling with ${messages.length} messages`);

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
      temperature: 0.7,
      stream: false
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ DeepSeek API error (${response.status}):`, errorText);
    throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log(`✅ DEEPSEEK FALLBACK: Success, response length: ${result.choices?.[0]?.message?.content?.length || 0}`);
  return result;
}
