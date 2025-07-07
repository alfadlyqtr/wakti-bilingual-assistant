
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

// Enhanced logging utility
export function logWithTimestamp(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

// Claude API helper functions
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
      'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

// DeepSeek fallback helper
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
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}
