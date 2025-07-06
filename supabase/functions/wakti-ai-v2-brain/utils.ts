
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
export const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
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
