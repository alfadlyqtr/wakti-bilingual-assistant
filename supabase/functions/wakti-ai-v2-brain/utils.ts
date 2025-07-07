
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

// UPGRADED: Claude 4 Sonnet API with proper headers and streaming support
export async function callClaudeAPI(
  messages: any[],
  maxTokens: number = 4096,
  model: string = 'claude-sonnet-4-20250514', // Claude 4 Sonnet
  enableStreaming: boolean = false
): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    const error = 'CRITICAL ERROR: Anthropic API key not configured in Edge Function environment';
    console.error(error);
    throw new Error(error);
  }

  console.log(`🚀 CLAUDE 4 API: Calling ${model} with ${messages.length} messages, max tokens: ${maxTokens}, streaming: ${enableStreaming}`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY, // Claude 4 requires x-api-key header
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01' // Required for Claude 4
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
      stream: enableStreaming // Enable streaming for real-time responses
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Claude 4 API error (${response.status}):`, errorText);
    throw new Error(`Claude 4 API error (${response.status}): ${errorText}`);
  }

  if (enableStreaming) {
    console.log(`✅ CLAUDE 4 STREAMING: Returning streaming response`);
    return response; // Return the response object for streaming
  }

  const result = await response.json();
  
  // Handle Claude 4's new refusal stop reason
  if (result.stop_reason === 'refusal') {
    console.warn('⚠️ CLAUDE 4: Content refused by model for safety reasons');
    throw new Error('Content refused by model for safety reasons');
  }
  
  console.log(`✅ CLAUDE 4 API: Success, response length: ${result.content?.[0]?.text?.length || 0}`);
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

// Streaming response parser for Claude 4
export function parseClaudeStreamChunk(chunk: string): { content: string; isComplete: boolean } {
  try {
    const lines = chunk.split('\n').filter(line => line.trim());
    let content = '';
    let isComplete = false;
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        if (data.type === 'content_block_delta' && data.delta?.text) {
          content += data.delta.text;
        } else if (data.type === 'message_stop') {
          isComplete = true;
        }
      }
    }
    
    return { content, isComplete };
  } catch (error) {
    console.error('Error parsing Claude stream chunk:', error);
    return { content: '', isComplete: false };
  }
}
