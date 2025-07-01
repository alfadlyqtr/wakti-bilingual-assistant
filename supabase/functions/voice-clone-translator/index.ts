
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');

console.log("🌐 VOICE CLONE TRANSLATOR: Function loaded");
console.log("🌐 DeepSeek API Key available:", !!DEEPSEEK_API_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

serve(async (req) => {
  console.log(`🌐 Request: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if API key is available
    if (!DEEPSEEK_API_KEY) {
      console.error('🌐 DEEPSEEK_API_KEY not found in environment');
      throw new Error('DeepSeek API key not configured');
    }

    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized - user not authenticated');
    }

    console.log(`🌐 Authenticated user: ${user.id}`);

    // Get request data
    const requestBody = await req.json();
    const { original_text, target_language } = requestBody;
    
    console.log(`🌐 Translation request:`, {
      textLength: original_text?.length || 0,
      targetLanguage: target_language,
      textPreview: original_text?.substring(0, 100)
    });

    if (!original_text || !target_language) {
      throw new Error('Missing required fields: original_text and target_language are required');
    }

    // Prepare the translation prompt
    const translationPrompt = `Translate the following text to ${target_language}. Return ONLY the translation, nothing else. Do not add any explanations, comments, or additional text.\n\nText to translate: ${original_text}`;

    console.log(`🌐 Calling DeepSeek API...`);

    // Call DeepSeek API
    const deepSeekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate text accurately to the requested language. Return ONLY the translation without any additional text, explanations, or formatting.`
          },
          {
            role: 'user',
            content: translationPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        stream: false
      }),
    });

    console.log(`🌐 DeepSeek API response status: ${deepSeekResponse.status}`);

    if (!deepSeekResponse.ok) {
      const errorText = await deepSeekResponse.text();
      console.error('🌐 DeepSeek API error:', {
        status: deepSeekResponse.status,
        statusText: deepSeekResponse.statusText,
        error: errorText
      });
      throw new Error(`DeepSeek API error: ${deepSeekResponse.status} - ${errorText}`);
    }

    const result = await deepSeekResponse.json();
    console.log('🌐 DeepSeek API response received:', {
      hasChoices: !!result.choices,
      choicesLength: result.choices?.length || 0
    });

    const translatedText = result.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      console.error('🌐 No translation received from DeepSeek:', result);
      throw new Error('No translation received from DeepSeek API');
    }

    console.log(`🌐 Translation successful:`, {
      originalLength: original_text.length,
      translatedLength: translatedText.length,
      translatedPreview: translatedText.substring(0, 100)
    });

    return new Response(JSON.stringify({
      success: true,
      original_text,
      translated_text: translatedText,
      target_language
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('🌐 Translation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Translation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
