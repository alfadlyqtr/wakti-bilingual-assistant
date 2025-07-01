import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Add API keys for real AI integration
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") || "yzJMWPrRdkJcge2q0yjSOwTGvlhMeOy1";

console.log("🔍 UNIFIED AI BRAIN: Function loaded with optimized voice translation and instant TTS");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 UNIFIED AI BRAIN: Processing request with optimized TTS");

    // CRITICAL: Extract and verify authentication token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error("🔍 UNIFIED AI BRAIN: Missing authorization header");
      return new Response(JSON.stringify({ 
        error: "Authentication required",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      console.error("🔍 UNIFIED AI BRAIN: Authentication failed:", authError);
      return new Response(JSON.stringify({ 
        error: "Invalid authentication",
        success: false
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check content type to determine processing mode
    const contentType = req.headers.get('content-type') || '';
    const isVoiceTranslation = contentType.includes('multipart/form-data');
    
    // Check if this is a TTS request
    let requestBody;
    let isTTSRequest = false;
    
    if (!isVoiceTranslation) {
      try {
        requestBody = await req.json();
        isTTSRequest = requestBody.text && (requestBody.voice || requestBody.requestType === 'tts');
        console.log("🔊 TTS REQUEST DETECTED:", isTTSRequest, "Body:", requestBody);
      } catch (e) {
        console.log("🔊 Not JSON request, continuing...");
      }
    }

    if (isVoiceTranslation) {
      console.log("🎤 VOICE TRANSLATION: Processing audio through optimized unified-ai-brain");
      return await processVoiceTranslationOptimized(req, user.id);
    }

    if (isTTSRequest) {
      console.log("🔊 TTS: Processing optimized text-to-speech");
      return await processTTSOptimized(requestBody, user.id);
    }

    // Get request body for regular requests if not already parsed
    if (!requestBody) {
      requestBody = await req.json();
    }
    
    console.log("🔍 UNIFIED AI BRAIN: Request body received for user:", user.id);

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      confirmSearch = false,
      activeTrigger = 'chat',
      attachedFiles = []
    } = requestBody;

    // CRITICAL: Ensure userId matches authenticated user
    if (userId !== user.id) {
      console.error("🔍 UNIFIED AI BRAIN: User ID mismatch - potential security breach attempt");
      return new Response(JSON.stringify({ 
        error: "User ID mismatch",
        success: false
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("🔍 UNIFIED AI BRAIN: Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🔍 UNIFIED AI BRAIN: Processing message for authenticated user:", user.id);
    console.log("🔍 UNIFIED AI BRAIN: Active trigger mode:", activeTrigger);

    // Enforce trigger isolation
    const intent = analyzeTriggerIntent(message, activeTrigger, language);
    console.log("🔍 UNIFIED AI BRAIN: Trigger analysis result:", intent);

    // Generate response based on trigger isolation with REAL AI
    let response = '';
    let imageUrl = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;

    // Handle trigger types with NO search quota restrictions
    switch (activeTrigger) {
      case 'search':
        // No quota checking - execute search directly
        if (intent.allowed) {
          console.log("🔍 Executing search for user:", user.id);
          
          const searchResult = await executeRegularSearch(message, language);
          if (searchResult.success) {
            browsingUsed = true;
            browsingData = searchResult.data;
            response = await processWithAI(message, searchResult.context, language);
          } else {
            response = await processWithAI(message, null, language);
          }
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع البحث\n\nهذا الوضع مخصص للأسئلة والبحث.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Search Mode\n\nThis mode is for questions and search.\n\nFor general chat, switch to Chat mode.`;
        }
        break;

      case 'image':
        if (intent.allowed) {
          try {
            console.log("🎨 Generating image with Runware API for prompt:", message);
            const imageResult = await generateImageWithRunware(message, user.id, language);
            
            if (imageResult.success) {
              imageUrl = imageResult.imageUrl;
              response = language === 'ar' 
                ? `🎨 تم إنشاء الصورة بنجاح!\n\n**الوصف:** ${message}`
                : `🎨 Image generated successfully!\n\n**Prompt:** ${message}`;
            } else {
              console.error("Image generation failed:", imageResult.error);
              response = language === 'ar' 
                ? `❌ عذراً، حدث خطأ في إنشاء الصورة. يرجى المحاولة مرة أخرى.`
                : `❌ Sorry, there was an error generating the image. Please try again.`;
            }
          } catch (error) {
            console.error("Image generation error:", error);
            response = language === 'ar' 
              ? `❌ عذراً، حدث خطأ في إنشاء الصورة. يرجى المحاولة مرة أخرى.`
              : `❌ Sorry, there was an error generating the image. Please try again.`;
          }
        } else {
          response = language === 'ar' 
            ? `⚠️ أنت في وضع إنشاء الصور\n\nهذا الوضع مخصص لإنشاء الصور فقط.\n\nللدردشة العامة، انتقل إلى وضع المحادثة.`
            : `⚠️ You're in Image Mode\n\nThis mode is for image generation only.\n\nFor general chat, switch to Chat mode.`;
        }
        break;

      case 'chat':
      default:
        // Chat mode - use real AI, now with vision capabilities
        response = await processWithAI(message, null, language, attachedFiles);
        break;
    }

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: intent.intent,
      confidence: intent.confidence,
      actionTaken,
      actionResult,
      imageUrl,
      browsingUsed,
      browsingData,
      quotaStatus,
      requiresSearchConfirmation: false,
      needsConfirmation: false,
      needsClarification: false,
      success: true
    };

    console.log("🔍 UNIFIED AI BRAIN: Sending real AI response for user:", user.id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🔍 UNIFIED AI BRAIN: Error processing request:", error);
    
    const errorResponse = {
      error: error.message || 'Unknown error occurred',
      success: false
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// OPTIMIZED: TTS Processing Function with instant generation
async function processTTSOptimized(requestBody: any, userId: string) {
  try {
    console.log("🔊 OPTIMIZED TTS: Processing instant text-to-speech for user:", userId);

    const { text, voice = 'alloy', language = 'en' } = requestBody;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new Error('Text is required for TTS');
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log("🔊 OPTIMIZED TTS: Generating instant speech for text:", text.substring(0, 100) + "...");

    // Use faster TTS-1-HD model for better quality and speed
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd', // Higher quality model
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: 1.1 // Slightly faster for responsive feel
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🔊 OPTIMIZED TTS: OpenAI TTS failed:", errorText);
      throw new Error(`TTS failed: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    console.log("🔊 OPTIMIZED TTS: Generated high-quality audio successfully, size:", audioBuffer.byteLength);

    const result = {
      audioContent: audioBase64,
      size: audioBuffer.byteLength,
      voice: voice,
      language: language,
      cached: true, // Mark as cacheable
      instant: true, // Mark as instant generation
      success: true
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🔊 OPTIMIZED TTS: Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'TTS generation failed',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// ENHANCED: Voice Translation Processing with Auto-TTS Generation
async function processVoiceTranslationOptimized(req: Request, userId: string) {
  try {
    console.log("🎤 OPTIMIZED VOICE TRANSLATION: Processing audio for user:", userId);

    const formData = await req.formData();
    const audioBlob = formData.get('audioBlob') as File;
    const targetLanguage = formData.get('targetLanguage') as string;
    const autoPlayEnabled = formData.get('autoPlayEnabled') === 'true';

    if (!audioBlob) {
      throw new Error('No audio data provided');
    }

    if (!targetLanguage) {
      throw new Error('Target language is required');
    }

    console.log("🎤 OPTIMIZED VOICE TRANSLATION: Audio blob size:", audioBlob.size, "Target language:", targetLanguage, "Auto-play:", autoPlayEnabled);

    // Step 1: Transcribe audio using OpenAI Whisper
    const transcriptionFormData = new FormData();
    transcriptionFormData.append('file', audioBlob, 'audio.webm');
    transcriptionFormData.append('model', 'whisper-1');

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: transcriptionFormData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error("🎤 Whisper transcription failed:", errorText);
      throw new Error(`Transcription failed: ${transcriptionResponse.status}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    const originalText = transcriptionResult.text;

    console.log("🎤 OPTIMIZED VOICE TRANSLATION: Transcribed text:", originalText);

    // Step 2: Translate the transcribed text
    const translationPrompt = `Translate the following text to ${getLanguageName(targetLanguage)}. Only return the translation, nothing else:\n\n"${originalText}"`;

    const translationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional translator. Translate the given text accurately while preserving the original meaning and tone.' 
          },
          { role: 'user', content: translationPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!translationResponse.ok) {
      const errorText = await translationResponse.text();
      console.error("🎤 Translation failed:", errorText);
      throw new Error(`Translation failed: ${translationResponse.status}`);
    }

    const translationResult = await translationResponse.json();
    const translatedText = translationResult.choices[0].message.content;

    console.log("🎤 OPTIMIZED VOICE TRANSLATION: Translated text:", translatedText);

    // Step 3: AUTO-GENERATE TTS immediately for instant playback
    let autoGeneratedTTS = null;
    try {
      console.log("🔊 AUTO-GENERATING TTS for instant playback...");
      
      const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1-hd',
          input: translatedText,
          voice: 'alloy',
          response_format: 'mp3',
          speed: 1.1
        }),
      });

      if (ttsResponse.ok) {
        const ttsAudioBuffer = await ttsResponse.arrayBuffer();
        const ttsAudioBase64 = btoa(String.fromCharCode(...new Uint8Array(ttsAudioBuffer)));
        
        autoGeneratedTTS = {
          audioContent: ttsAudioBase64,
          size: ttsAudioBuffer.byteLength,
          preGenerated: true
        };
        
        console.log("🔊 AUTO-GENERATED TTS successfully, size:", ttsAudioBuffer.byteLength);
      } else {
        console.log("🔊 TTS auto-generation failed, will generate on-demand");
      }
    } catch (ttsError) {
      console.log("🔊 TTS auto-generation failed:", ttsError.message);
    }

    // Step 4: Detect source language
    const sourceLanguage = await detectLanguage(originalText);

    const result = {
      originalText,
      translatedText,
      sourceLanguage,
      targetLanguage,
      autoGeneratedTTS, // Include pre-generated TTS
      instantPlayback: autoPlayEnabled, // Flag for auto-playback
      success: true
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🎤 OPTIMIZED VOICE TRANSLATION: Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Voice translation failed',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// NEW: TTS Processing Function
async function processTTS(requestBody: any, userId: string) {
  try {
    console.log("🔊 TTS: Processing text-to-speech for user:", userId);

    const { text, voice = 'alloy' } = requestBody;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new Error('Text is required for TTS');
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log("🔊 TTS: Generating speech for text:", text.substring(0, 100) + "...");

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🔊 TTS: OpenAI TTS failed:", errorText);
      throw new Error(`TTS failed: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    console.log("🔊 TTS: Generated audio successfully, size:", audioBuffer.byteLength);

    const result = {
      audioContent: audioBase64,
      size: audioBuffer.byteLength,
      success: true
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🔊 TTS: Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'TTS generation failed',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// NEW: Voice Translation Processing Function
async function processVoiceTranslation(req: Request, userId: string) {
  try {
    console.log("🎤 VOICE TRANSLATION: Processing audio for user:", userId);

    const formData = await req.formData();
    const audioBlob = formData.get('audioBlob') as File;
    const targetLanguage = formData.get('targetLanguage') as string;

    if (!audioBlob) {
      throw new Error('No audio data provided');
    }

    if (!targetLanguage) {
      throw new Error('Target language is required');
    }

    console.log("🎤 VOICE TRANSLATION: Audio blob size:", audioBlob.size, "Target language:", targetLanguage);

    // Step 1: Transcribe audio using OpenAI Whisper
    const transcriptionFormData = new FormData();
    transcriptionFormData.append('file', audioBlob, 'audio.webm');
    transcriptionFormData.append('model', 'whisper-1');

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: transcriptionFormData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error("🎤 Whisper transcription failed:", errorText);
      throw new Error(`Transcription failed: ${transcriptionResponse.status}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    const originalText = transcriptionResult.text;

    console.log("🎤 VOICE TRANSLATION: Transcribed text:", originalText);

    // Step 2: Translate the transcribed text
    const translationPrompt = `Translate the following text to ${getLanguageName(targetLanguage)}. Only return the translation, nothing else:\n\n"${originalText}"`;

    const translationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional translator. Translate the given text accurately while preserving the original meaning and tone.' 
          },
          { role: 'user', content: translationPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!translationResponse.ok) {
      const errorText = await translationResponse.text();
      console.error("🎤 Translation failed:", errorText);
      throw new Error(`Translation failed: ${translationResponse.status}`);
    }

    const translationResult = await translationResponse.json();
    const translatedText = translationResult.choices[0].message.content;

    console.log("🎤 VOICE TRANSLATION: Translated text:", translatedText);

    // Step 3: Detect source language
    const sourceLanguage = await detectLanguage(originalText);

    const result = {
      originalText,
      translatedText,
      sourceLanguage,
      targetLanguage,
      success: true
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🎤 VOICE TRANSLATION: Error:", error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Voice translation failed',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// Helper function to get language name
function getLanguageName(code: string): string {
  const languages: { [key: string]: string } = {
    'en': 'English',
    'ar': 'Arabic',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'hi': 'Hindi',
    'tr': 'Turkish',
    'nl': 'Dutch',
    'sv': 'Swedish'
  };
  return languages[code] || code;
}

// Helper function to detect source language
async function detectLanguage(text: string): string {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Detect the language of the given text. Respond with only the language code (en, ar, es, fr, de, it, pt, ru, ja, ko, zh, hi, tr, nl, sv).' 
          },
          { role: 'user', content: text }
        ],
        temperature: 0,
        max_tokens: 10
      })
    });

    if (response.ok) {
      const result = await response.json();
      return result.choices[0].message.content.trim().toLowerCase();
    }
  } catch (error) {
    console.error("Language detection failed:", error);
  }
  
  return 'auto'; // fallback
}

// SIMPLIFIED: Regular search function with optional web browsing
async function executeRegularSearch(query: string, language: string = 'en') {
  try {
    if (!TAVILY_API_KEY) {
      console.log("🔍 No Tavily API - using AI for search response");
      
      const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
      return {
        success: true,
        context: searchContext,
        data: { 
          sources: [],
          enhanced: false,
          note: "AI response without web search"
        }
      };
    }
    
    console.log("🔍 Executing regular Tavily search for query:", query);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic", // Use basic for regular search
        include_answer: true,
        include_raw_content: false,
        max_results: 10, // Updated from 3 to 10
        max_chunks: 5, // Added max_chunks parameter
        include_domains: [],
        exclude_domains: []
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tavily API error:", response.status, errorText);
      
      // Fallback to AI response
      const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
      return {
        success: true,
        context: searchContext,
        data: { 
          sources: [],
          enhanced: false,
          fallback: true,
          note: "AI response (Tavily fallback)"
        }
      };
    }
    
    const data = await response.json();
    console.log("✅ Regular Tavily search successful");
    
    // Create context from search results
    let searchContext = `Search results for: "${query}"\n\n`;
    if (data.answer) {
      searchContext += `Summary: ${data.answer}\n\n`;
    }
    
    if (data.results && data.results.length > 0) {
      searchContext += "Sources:\n";
      data.results.forEach((result, index) => {
        searchContext += `${index + 1}. ${result.title}\n`;
        searchContext += `   ${result.content}\n`;
        searchContext += `   Source: ${result.url}\n\n`;
      });
    }
    
    return {
      success: true,
      context: searchContext,
      data: { 
        sources: data.results || [],
        enhanced: false,
        searchDepth: "basic",
        answer: data.answer
      }
    };
  } catch (error) {
    console.error("Regular search execution error:", error);
    
    // Always provide AI response as fallback
    const searchContext = `Search request: "${query}". Provide helpful information based on your knowledge.`;
    return {
      success: true,
      context: searchContext,
      data: { 
        sources: [],
        enhanced: false,
        fallback: true,
        note: "AI response (error fallback)"
      }
    };
  }
}

// Generate image with Runware API
async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  try {
    console.log("🎨 Generating image with Runware for prompt:", prompt);

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY,
        },
        {
          taskType: "imageInference",
          taskUUID: crypto.randomUUID(),
          positivePrompt: prompt,
          model: "runware:100@1",
          width: 512,
          height: 512,
          numberResults: 1,
          outputFormat: "WEBP",
          CFGScale: 1,
          scheduler: "FlowMatchEulerDiscreteScheduler",
          steps: 4,
        },
      ]),
    });

    console.log("🎨 Runware response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("🎨 Runware response data:", result);
      
      // Find the image inference result
      const imageResult = result.data?.find((item: any) => item.taskType === "imageInference");
      
      if (imageResult && imageResult.imageURL) {
        // Save image to database
        try {
          await supabase
            .from('images')
            .insert({
              user_id: userId,
              prompt: prompt,
              image_url: imageResult.imageURL,
              metadata: { provider: 'runware', imageUUID: imageResult.imageUUID }
            });
        } catch (dbError) {
          console.log("Could not save image to database:", dbError);
          // Continue anyway, the image was generated successfully
        }

        return {
          success: true,
          imageUrl: imageResult.imageURL
        };
      } else {
        throw new Error('No image URL in Runware response');
      }
    } else {
      const errorText = await response.text();
      console.error("🎨 Runware API error:", response.status, errorText);
      throw new Error(`Runware API failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('🎨 Error generating image with Runware:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Real AI processing function
async function processWithAI(message: string, context: string | null, language: string = 'en', attachedFiles: any[] = []) {
  try {
    console.log("🤖 UNIFIED AI BRAIN: Processing with real AI");
    if (attachedFiles.length > 0) {
      console.log(`🤖 UNIFIED AI BRAIN: Processing with ${attachedFiles.length} file(s) for vision analysis.`);
    }
    
    // Try DeepSeek first, fallback to OpenAI. Force OpenAI for vision.
    let apiKey = DEEPSEEK_API_KEY;
    let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    let model = 'deepseek-chat';
    
    // Force OpenAI for any request with files/images
    if (!apiKey || (attachedFiles && attachedFiles.length > 0)) {
      apiKey = OPENAI_API_KEY;
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini'; // This model supports vision
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. كن ودوداً ومفيداً ومختصراً في إجاباتك.

تعليمات مهمة للتنسيق:
- استخدم نصاً عادياً واضحاً
- تجنب الرموز الزائدة مثل # أو ** أو ***
- استخدم فقرات بسيطة مع فواصل أسطر طبيعية
- اجعل الإجابة سهلة القراءة وبدون تعقيد في التنسيق`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. Be friendly, helpful, and concise in your responses.

Important formatting instructions:
- Use clean, plain text
- Avoid excessive symbols like #, **, or ***
- Use simple paragraphs with natural line breaks
- Keep responses readable and clean without formatting clutter`;
    
    // Construct user message content. It can be a simple string or an array for multimodal input.
    let userContent: any = message;
    
    // If there are files, build a multipart message
    if (attachedFiles && attachedFiles.length > 0) {
      const contentParts: any[] = [{ type: 'text', text: message }];

      attachedFiles.forEach(file => {
        // Assuming file has { type: 'image/jpeg', content: 'base64string' }
        if (file.type && file.type.startsWith('image/')) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${file.type};base64,${file.content}`
            }
          });
        }
      });
      
      userContent = contentParts;
    }
    
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];
    
    if (context) {
      messages.splice(1, 0, { role: 'assistant', content: `Context: ${context}` });
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API failed: ${response.status}`, errorText);
      throw new Error(`AI API failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🤖 UNIFIED AI BRAIN: AI processing error:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// SIMPLIFIED: Trigger isolation logic - only chat, search, image
function analyzeTriggerIntent(message: string, activeTrigger: string, language: string = 'en') {
  const lowerMessage = message.toLowerCase();
  
  console.log("🔍 UNIFIED AI BRAIN: Analyzing trigger intent for:", activeTrigger);
  
  switch (activeTrigger) {
    case 'search':
      // Search allows questions and search queries
      const searchPatterns = [
        'what', 'who', 'when', 'where', 'how', 'current', 'latest', 'recent', 'today', 'news',
        'weather', 'score', 'price', 'stock', 'update', 'information', 'find', 'search',
        'ما', 'من', 'متى', 'أين', 'كيف', 'حالي', 'آخر', 'مؤخراً', 'اليوم', 'أخبار',
        'طقس', 'نتيجة', 'سعر', 'معلومات', 'ابحث', 'بحث'
      ];
      
      const isSearchIntent = searchPatterns.some(pattern => lowerMessage.includes(pattern)) || lowerMessage.includes('?');
      
      return {
        intent: isSearchIntent ? 'search' : 'general_query',
        confidence: 'high',
        allowed: true // Allow all queries in search mode
      };

    case 'image':
      const imagePatterns = [
        'generate', 'create', 'make', 'draw', 'image', 'picture', 'photo', 'art', 'illustration',
        'أنشئ', 'اصنع', 'ارسم', 'صورة', 'رسم', 'فن'
      ];
      
      const isImageIntent = imagePatterns.some(pattern => lowerMessage.includes(pattern));
      
      return {
        intent: isImageIntent ? 'generate_image' : 'invalid_for_image',
        confidence: isImageIntent ? 'high' : 'low',
        allowed: isImageIntent
      };

    case 'chat':
    default:
      // Chat mode allows everything
      return {
        intent: 'general_chat',
        confidence: 'high',
        allowed: true
      };
  }
}
