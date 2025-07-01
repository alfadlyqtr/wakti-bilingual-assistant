
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
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("🌐 VOICE CLONE TRANSLATOR: Function loaded - Translation only");

serve(async (req) => {
  console.log(`🌐 Request received: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    console.log("🌐 Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🌐 Authenticating user...");
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (!user) {
      console.log("🌐 Authentication failed - no user");
      throw new Error('Unauthorized');
    }

    console.log(`🌐 User authenticated: ${user.id}`);

    const requestBody = await req.json();
    const { original_text, target_language } = requestBody;

    console.log("🌐 Request data:", { 
      text_length: original_text?.length, 
      target_language,
      has_deepseek_key: !!DEEPSEEK_API_KEY 
    });

    if (!original_text || !target_language) {
      console.log("🌐 Missing required parameters");
      throw new Error('Missing required parameters: original_text and target_language');
    }

    console.log('🌐 TRANSLATOR: Processing translation request', {
      text_length: original_text.length,
      target_language,
      user_id: user.id
    });

    // Translate with DeepSeek
    console.log('🌐 TRANSLATOR: Calling DeepSeek API for translation');
    
    const translateResponse = await fetch('https://api.deepseek.com/chat/completions', {
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
            content: `You are a professional translator. Translate the following text to ${target_language}. Return only the translation, nothing else. Maintain the tone and meaning of the original text. If the text is already in the target language, return it as is.`
          },
          {
            role: 'user',
            content: original_text
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      }),
    });

    console.log(`🌐 DeepSeek API response status: ${translateResponse.status}`);

    if (!translateResponse.ok) {
      const errorText = await translateResponse.text();
      console.error('🌐 DeepSeek API error:', translateResponse.status, errorText);
      throw new Error(`Translation failed: ${translateResponse.status} - ${errorText}`);
    }

    const translateResult = await translateResponse.json();
    const translatedText = translateResult.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      console.log('🌐 No translation received from DeepSeek');
      throw new Error('No translation received from DeepSeek');
    }

    console.log('🌐 TRANSLATOR: Translation successful', {
      original_length: original_text.length,
      translated_length: translatedText.length
    });

    const response = {
      success: true,
      original_text,
      translated_text: translatedText,
      target_language
    };

    console.log('🌐 Sending successful response');
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('🌐 TRANSLATOR ERROR:', error);
    
    const errorResponse = {
      success: false,
      error: error.message || 'Translation failed'
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
