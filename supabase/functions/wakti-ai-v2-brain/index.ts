import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Restore all API keys
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY");
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

console.log("🔍 WAKTI AI V2.5 SMART FILE PROCESSING: Enhanced with DeepSeek vision and file analysis");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Enhanced file processing function
async function processAttachedFiles(files: any[]) {
  try {
    console.log("📁 WAKTI AI V2.5: Processing", files.length, "attached files");
    
    const processedFiles = [];
    
    for (const file of files) {
      console.log("📁 Processing file:", file.name, "Type:", file.type);
      
      let fileContent = null;
      let fileAnalysis = null;
      
      if (file.type.startsWith('image/')) {
        // Process image files with DeepSeek vision
        console.log("🖼️ Processing image file:", file.name);
        fileAnalysis = await analyzeImageWithDeepSeek(file);
        
      } else if (file.type === 'application/pdf') {
        // Process PDF files
        console.log("📄 Processing PDF file:", file.name);
        fileContent = await extractPDFText(file);
        
      } else if (file.type === 'text/plain') {
        // Process text files
        console.log("📝 Processing text file:", file.name);
        fileContent = await extractTextContent(file);
      }
      
      processedFiles.push({
        name: file.name,
        type: file.type,
        url: file.url,
        content: fileContent,
        analysis: fileAnalysis
      });
    }
    
    return processedFiles;
    
  } catch (error) {
    console.error("📁 Error processing files:", error);
    return [];
  }
}

// Analyze images using DeepSeek vision
async function analyzeImageWithDeepSeek(file: any) {
  try {
    console.log("🖼️ Analyzing image with DeepSeek vision:", file.name);
    
    if (!DEEPSEEK_API_KEY) {
      console.log("🖼️ DeepSeek API key not available, falling back to basic description");
      return `I can see you've uploaded an image file named "${file.name}". However, I need the DeepSeek API key to analyze the image content in detail.`;
    }
    
    // Download the image from the URL
    const imageResponse = await fetch(file.url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    
    // Use DeepSeek vision model
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-vl',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image in detail. Describe what you see, read any text present, explain any diagrams or charts, and provide context about the image content. Be comprehensive and detailed in your analysis.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${file.type};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('🖼️ DeepSeek vision API error:', errorData);
      
      // Fallback to OpenAI if DeepSeek fails
      if (OPENAI_API_KEY) {
        console.log('🖼️ Falling back to OpenAI vision...');
        return await analyzeImageWithOpenAI(file, base64Image);
      }
      
      throw new Error(errorData.error?.message || `Vision API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    console.log('🖼️ Successfully analyzed image with DeepSeek vision');
    return analysis;
    
  } catch (error) {
    console.error("🖼️ Error analyzing image:", error);
    return `I can see you've uploaded an image file named "${file.name}", but I encountered an error analyzing it: ${error.message}`;
  }
}

// Fallback to OpenAI vision if DeepSeek fails
async function analyzeImageWithOpenAI(file: any, base64Image: string) {
  try {
    console.log("🖼️ Using OpenAI vision as fallback for:", file.name);
    
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
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image in detail. Describe what you see, read any text present, explain any diagrams or charts, and provide context about the image content.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${file.type};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI vision failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error("🖼️ OpenAI vision fallback failed:", error);
    return `I can see you've uploaded an image file named "${file.name}", but I'm unable to analyze it at the moment due to technical limitations.`;
  }
}

// Extract text from PDF files
async function extractPDFText(file: any) {
  try {
    console.log("📄 Extracting text from PDF:", file.name);
    
    // For now, return a placeholder. In a full implementation, you'd use a PDF parsing library
    // This would require adding a PDF parser dependency to the edge function
    return `PDF file "${file.name}" uploaded. Note: PDF text extraction is not yet implemented in this demo version. Please describe the PDF content in your message if you'd like me to help with it.`;
    
  } catch (error) {
    console.error("📄 Error extracting PDF text:", error);
    return `PDF file "${file.name}" uploaded, but text extraction failed.`;
  }
}

// Extract content from text files
async function extractTextContent(file: any) {
  try {
    console.log("📝 Extracting text content from:", file.name);
    
    const response = await fetch(file.url);
    if (!response.ok) {
      throw new Error(`Failed to download text file: ${response.status}`);
    }
    
    const textContent = await response.text();
    console.log("📝 Successfully extracted text content, length:", textContent.length);
    
    return textContent;
    
  } catch (error) {
    console.error("📝 Error extracting text content:", error);
    return `Text file "${file.name}" uploaded, but content extraction failed.`;
  }
}

// ULTRA-STRICT TRIGGER-BASED INTENT ANALYSIS - ABSOLUTE CONTROL
function analyzeIntentWithAbsoluteTriggerControl(message, language = 'en', activeTrigger = 'chat', textGenParams = null) {
  const lowerMessage = message.toLowerCase();
  
  console.log("🎯 WAKTI AI V2.5: === ULTRA-STRICT TRIGGER ANALYSIS ===");
  console.log("🎯 WAKTI AI V2.5: Message:", message);
  console.log("🎯 WAKTI AI V2.5: Active trigger (ABSOLUTE CONTROLLER):", activeTrigger);
  console.log("🎯 WAKTI AI V2.5: Language:", language);
  console.log("🎯 WAKTI AI V2.5: Text Gen Params:", textGenParams);
  
  // Check for text generation request FIRST
  if (textGenParams) {
    console.log("🎯 WAKTI AI V2.5: ✅ TEXT GENERATION MODE DETECTED - NO BROWSING ALLOWED");
    return {
      intent: 'generate_text',
      confidence: 'high',
      action: 'generate_text',
      params: textGenParams,
      requiresBrowsing: false, // ABSOLUTE: Text generation NEVER needs browsing
      triggerMode: 'text_generation',
      strictMode: 'TEXT_GENERATION_NO_BROWSING'
    };
  }
  
  // 🚨 ULTRA-STRICT TRIGGER CONTROL: Trigger is the ABSOLUTE and ONLY controller
  // NO EXCEPTIONS, NO OVERRIDES, NO SMART DETECTION
  
  switch (activeTrigger) {
    case 'chat':
      console.log("🎯 WAKTI AI V2.5: ✅ CHAT MODE - BROWSING ABSOLUTELY FORBIDDEN");
      console.log("🎯 WAKTI AI V2.5: 🚫 NO SEARCH, NO TAVILY, NO BROWSING - DEEPSEEK ONLY");
      
      // Check for image generation patterns only (no browsing)
      const imagePatterns = [
        'generate image', 'create image', 'draw', 'make picture', 'image of', 'picture of',
        'أنشئ صورة', 'اصنع صورة', 'ارسم', 'صورة', 'اعمل صورة', 'كون صورة'
      ];
      
      if (imagePatterns.some(p => lowerMessage.includes(p))) {
        const prompt = message.replace(/(generate image|create image|draw|make picture|image of|picture of|أنشئ صورة|اصنع صورة|ارسم|صورة)/gi, '').trim();
        console.log("🎯 WAKTI AI V2.5: 🎨 IMAGE GENERATION REQUEST IN CHAT MODE");
        return {
          intent: 'generate_image',
          confidence: 'high',
          action: 'generate_image',
          params: { prompt: prompt || message },
          requiresBrowsing: false, // ABSOLUTE: No browsing for images
          triggerMode: 'chat',
          strictMode: 'CHAT_IMAGE_NO_BROWSING'
        };
      }
      
      // ABSOLUTE CHAT RESPONSE - NO BROWSING WHATSOEVER
      console.log("🎯 WAKTI AI V2.5: 💬 PURE CHAT MODE - DEEPSEEK GENERAL KNOWLEDGE ONLY");
      return {
        intent: 'general_chat',
        confidence: 'high',
        action: null,
        params: null,
        requiresBrowsing: false, // ABSOLUTE: Chat mode = NO browsing
        triggerMode: 'chat',
        strictMode: 'CHAT_NO_BROWSING_EVER'
      };
      
    case 'search':
      console.log("🎯 WAKTI AI V2.5: ✅ SEARCH MODE - BROWSING ABSOLUTELY REQUIRED");
      console.log("🎯 WAKTI AI V2.5: 🌐 TAVILY API ENABLED - BASIC SEARCH MODE");
      return {
        intent: 'real_time_search',
        confidence: 'high',
        action: null,
        params: null,
        requiresBrowsing: true, // ABSOLUTE: Search mode = MUST browse
        triggerMode: 'search',
        strictMode: 'SEARCH_BROWSING_REQUIRED'
      };
      
    case 'advanced_search':
      console.log("🎯 WAKTI AI V2.5: ✅ ADVANCED SEARCH MODE - ADVANCED BROWSING ABSOLUTELY REQUIRED");
      console.log("🎯 WAKTI AI V2.5: 🌐 TAVILY API ENABLED - ADVANCED SEARCH MODE");
      return {
        intent: 'advanced_real_time_search',
        confidence: 'high',
        action: null,
        params: null,
        requiresBrowsing: true, // ABSOLUTE: Advanced search mode = MUST browse
        triggerMode: 'advanced_search',
        strictMode: 'ADVANCED_SEARCH_BROWSING_REQUIRED'
      };
      
    case 'image':
      console.log("🎯 WAKTI AI V2.5: ✅ IMAGE MODE - GENERATE IMAGES ONLY");
      const prompt = message.replace(/(generate image|create image|draw|make picture|image of|picture of|أنشئ صورة|اصنع صورة|ارسم|صورة)/gi, '').trim();
      return {
        intent: 'generate_image',
        confidence: 'high',
        action: 'generate_image',
        params: { prompt: prompt || message },
        requiresBrowsing: false, // ABSOLUTE: No browsing for image generation
        triggerMode: 'image',
        strictMode: 'IMAGE_NO_BROWSING'
      };
      
    default:
      console.log("🎯 WAKTI AI V2.5: ⚠️ UNKNOWN TRIGGER - DEFAULTING TO SAFE CHAT MODE");
      console.log("🎯 WAKTI AI V2.5: 🚫 SAFETY MODE: NO BROWSING");
      return {
        intent: 'general_chat',
        confidence: 'medium',
        action: null,
        params: null,
        requiresBrowsing: false, // ABSOLUTE: Unknown = safe mode = no browsing
        triggerMode: 'chat',
        strictMode: 'UNKNOWN_TRIGGER_SAFE_MODE'
      };
  }
}

// Text generation function
async function generateText(params, language = 'en') {
  try {
    console.log("📝 WAKTI AI V2.5: Generating text with params:", params);
    
    if (!DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key not configured");
    }
    
    let systemPrompt = '';
    let userPrompt = '';

    // Length mapping
    const lengthMap = {
      'Short': '1-2 paragraphs (50-100 words)',
      'Medium': '3-4 paragraphs (150-300 words)', 
      'Long': '5+ paragraphs (400+ words)'
    };

    // Format instructions
    const formatMap = {
      'Plain': 'Write in continuous text format.',
      'Bullet Points': 'Use bullet points and clear structure.',
      'Paragraphs': 'Organize into well-structured paragraphs with clear topic sentences.'
    };

    if (params.mode === 'compose') {
      systemPrompt = `You are a professional text generator. Create ${params.contentType?.toLowerCase()} content that is ${params.tone?.toLowerCase()} in tone. 

Length: ${lengthMap[params.length]}
Format: ${formatMap[params.format]}

${params.to ? `Recipient: ${params.to}` : ''}
${params.from ? `Sender: ${params.from}` : ''}

Focus on clarity, appropriate tone, and meeting the exact requirements specified.`;

      userPrompt = params.topic ? `Please write a ${params.contentType?.toLowerCase()} about: ${params.topic}` : `Please write a ${params.contentType?.toLowerCase()}.`;
    } else {
      // Reply mode
      systemPrompt = `You are writing a ${params.replyType?.toLowerCase()} reply. Be ${params.tone?.toLowerCase()} in tone and keep it ${lengthMap[params.length]}.

${formatMap[params.format]}

${params.to ? `To: ${params.to}` : ''}
${params.from ? `From: ${params.from}` : ''}

Write a direct reply that addresses the original message appropriately.`;

      userPrompt = `Original message to reply to:
"${params.originalMessage}"

Please write an appropriate reply.`;
    }

    console.log('📝 WAKTI AI V2.5: Calling DeepSeek API for text generation...');

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    console.log('📝 WAKTI AI V2.5: DeepSeek API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('📝 WAKTI AI V2.5: DeepSeek API error:', errorData);
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('📝 WAKTI AI V2.5: Successfully generated text, length:', generatedText?.length);

    return {
      success: true,
      generatedText: generatedText,
      params: params
    };
    
  } catch (error) {
    console.error("📝 WAKTI AI V2.5: Text generation error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Image generation function
async function generateImage(prompt, language = 'en') {
  try {
    console.log("🎨 WAKTI AI V2.5: Generating image with prompt:", prompt);
    
    if (!RUNWARE_API_KEY) {
      throw new Error("Runware API key not configured");
    }
    
    // Enhance prompt for better results
    let enhancedPrompt = prompt;
    if (language === 'ar') {
      // Translate Arabic prompt to English for better image generation
      enhancedPrompt = await translateText(prompt, 'ar', 'en');
    }
    
    // Add style enhancements
    enhancedPrompt = `${enhancedPrompt}, high quality, detailed, professional photography style`;
    
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWARE_API_KEY}`
      },
      body: JSON.stringify([
        {
          taskType: "authentication",
          apiKey: RUNWARE_API_KEY
        },
        {
          taskType: "imageInference",
          taskUUID: crypto.randomUUID(),
          positivePrompt: enhancedPrompt,
          width: 1024,
          height: 1024,
          model: "runware:100@1",
          numberResults: 1,
          outputFormat: "WEBP",
          CFGScale: 1,
          scheduler: "FlowMatchEulerDiscreteScheduler"
        }
      ])
    });
    
    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("🎨 WAKTI AI V2.5: Image generation result:", result);
    
    if (result.data && result.data.length > 0) {
      const imageData = result.data.find(item => item.taskType === "imageInference");
      if (imageData && imageData.imageURL) {
        return {
          success: true,
          imageUrl: imageData.imageURL,
          prompt: enhancedPrompt
        };
      }
    }
    
    throw new Error("No image URL in response");
    
  } catch (error) {
    console.error("🎨 WAKTI AI V2.5: Image generation error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Translation function
async function translateText(text, fromLang, toLang) {
  try {
    if (!OPENAI_API_KEY) {
      return text;
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Translate the following text from ${fromLang} to ${toLang}. Only return the translation, nothing else.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.choices[0].message.content.trim();
    }
    
    return text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

// Enhanced browsing function with strict trigger validation
async function executeBrowsing(query, searchMode = 'basic', language = 'en', triggerMode = 'search') {
  try {
    console.log("🌐 WAKTI AI V2.5: === BROWSING EXECUTION START ===");
    console.log("🌐 WAKTI AI V2.5: Query:", query);
    console.log("🌐 WAKTI AI V2.5: Search Mode:", searchMode);
    console.log("🌐 WAKTI AI V2.5: Trigger Mode:", triggerMode);
    
    // STRICT VALIDATION: Only allow browsing for search triggers
    if (triggerMode !== 'search' && triggerMode !== 'advanced_search') {
      console.log("🌐 WAKTI AI V2.5: 🚫 BROWSING BLOCKED - Invalid trigger mode:", triggerMode);
      throw new Error(`Browsing not allowed for trigger mode: ${triggerMode}`);
    }
    
    if (!TAVILY_API_KEY) {
      throw new Error("Tavily API key not configured");
    }
    
    // Configure Tavily parameters based on search mode
    let tavilyConfig;
    
    if (searchMode === 'advanced') {
      // Advanced Search Configuration
      tavilyConfig = {
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "advanced",
        include_answer: true,
        include_images: true,
        include_raw_content: false,
        max_results: 10,
        chunks_per_source: 5,
        time_range: "year"
      };
    } else {
      // Basic Search Configuration
      tavilyConfig = {
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: "basic",
        include_answer: true,
        include_images: true,
        include_raw_content: false,
        max_results: 2,
        chunks_per_source: 1,
        time_range: "month"
      };
    }
    
    console.log("🌐 WAKTI AI V2.5: Using Tavily config:", tavilyConfig);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tavilyConfig)
    });
    
    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("🌐 WAKTI AI V2.5: Browsing results:", data);
    
    // Create rich context for AI processing
    let richContext = `Search Query: "${query}" (${searchMode} mode)\n\n`;
    
    // Add main answer
    if (data.answer) {
      richContext += `Main Answer: ${data.answer}\n\n`;
    }
    
    // Add detailed source information
    if (data.results && data.results.length > 0) {
      richContext += "Additional Sources & Details:\n";
      data.results.forEach((result, index) => {
        richContext += `${index + 1}. ${result.title}\n`;
        richContext += `   URL: ${result.url}\n`;
        if (result.content) {
          richContext += `   Content: ${result.content}\n`;
        }
        richContext += "\n";
      });
    }
    
    // Add image context if available
    if (data.images && data.images.length > 0) {
      richContext += `Images Available: ${data.images.length} related images found\n\n`;
    }
    
    console.log("🌐 WAKTI AI V2.5: === BROWSING EXECUTION SUCCESS ===");
    
    return {
      success: true,
      answer: data.answer,
      sources: data.results?.slice(0, searchMode === 'advanced' ? 10 : 2) || [],
      images: data.images || [],
      query: query,
      searchMode: searchMode,
      richContext: richContext
    };
    
  } catch (error) {
    console.error("🌐 WAKTI AI V2.5: ❌ BROWSING ERROR:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Detect query type for specialized formatting
function detectQueryType(query) {
  const lowerQuery = query.toLowerCase();
  
  // Sports patterns
  const sportsPatterns = ['game', 'score', 'match', 'team', 'player', 'league', 'championship', 'final', 'tournament', 'win', 'won', 'beat', 'defeat', 'goal', 'points'];
  
  // News patterns
  const newsPatterns = ['news', 'breaking', 'latest', 'update', 'report', 'announcement', 'today', 'happened', 'event'];
  
  // Tech patterns
  const techPatterns = ['tech', 'technology', 'software', 'app', 'device', 'smartphone', 'computer', 'ai', 'artificial intelligence', 'specs', 'features'];
  
  // Entertainment patterns
  const entertainmentPatterns = ['movie', 'film', 'tv show', 'series', 'actor', 'actress', 'director', 'review', 'rating', 'music', 'album', 'song'];
  
  // Weather patterns
  const weatherPatterns = ['weather', 'temperature', 'rain', 'sunny', 'cloudy', 'forecast', 'storm', 'climate'];
  
  // Finance patterns
  const financePatterns = ['stock', 'market', 'price', 'crypto', 'bitcoin', 'currency', 'trading', 'exchange rate'];
  
  if (sportsPatterns.some(pattern => lowerQuery.includes(pattern))) return 'sports';
  if (newsPatterns.some(pattern => lowerQuery.includes(pattern))) return 'news';
  if (techPatterns.some(pattern => lowerQuery.includes(pattern))) return 'tech';
  if (entertainmentPatterns.some(pattern => lowerQuery.includes(pattern))) return 'entertainment';
  if (weatherPatterns.some(pattern => lowerQuery.includes(pattern))) return 'weather';
  if (financePatterns.some(pattern => lowerQuery.includes(pattern))) return 'finance';
  
  return 'general';
}

// Enhanced AI processing function with ULTRA-STRICT browsing control and file processing
async function processWithAI(message, context, language = 'en', allowBrowsing = false, triggerMode = 'chat', attachedFiles = []) {
  try {
    console.log("🤖 WAKTI AI V2.5: === AI PROCESSING START ===");
    console.log("🤖 WAKTI AI V2.5: Trigger Mode:", triggerMode);
    console.log("🤖 WAKTI AI V2.5: Allow Browsing:", allowBrowsing);
    console.log("🤖 WAKTI AI V2.5: Has Context:", !!context);
    console.log("🤖 WAKTI AI V2.5: Attached Files:", attachedFiles?.length || 0);
    
    // ULTRA-STRICT VALIDATION: Double-check browsing permissions
    if (allowBrowsing && triggerMode !== 'search' && triggerMode !== 'advanced_search') {
      console.log("🤖 WAKTI AI V2.5: 🚫 BROWSING PERMISSION DENIED - Invalid trigger for browsing");
      allowBrowsing = false; // Force disable browsing
    }
    
    // Process attached files if any
    let fileContext = '';
    if (attachedFiles && attachedFiles.length > 0) {
      console.log("📁 WAKTI AI V2.5: Processing attached files...");
      const processedFiles = await processAttachedFiles(attachedFiles);
      
      if (processedFiles.length > 0) {
        fileContext = '\n\n=== ATTACHED FILES ANALYSIS ===\n';
        processedFiles.forEach((file, index) => {
          fileContext += `\nFile ${index + 1}: ${file.name} (${file.type})\n`;
          if (file.analysis) {
            fileContext += `Image Analysis: ${file.analysis}\n`;
          }
          if (file.content) {
            fileContext += `Content: ${file.content}\n`;
          }
        });
        fileContext += '\n=== END FILE ANALYSIS ===\n';
        
        console.log("📁 WAKTI AI V2.5: Generated file context, length:", fileContext.length);
      }
    }
    
    // Try DeepSeek first, fallback to OpenAI
    let apiKey = DEEPSEEK_API_KEY;
    let apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    let model = 'deepseek-chat';
    
    if (!apiKey) {
      apiKey = OPENAI_API_KEY;
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini';
    }
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    // Detect query type for specialized formatting
    const queryType = detectQueryType(message);
    
    // Ultra-strict system prompt based on trigger mode
    let systemPrompt;
    
    if (!allowBrowsing || triggerMode === 'chat') {
      // ULTRA-STRICT NO-BROWSING MODE for Chat
      systemPrompt = language === 'ar' 
        ? `أنت WAKTI، مساعد ذكي ودود جداً يتحدث العربية بطلاقة. تتحدث مثل صديق مقرب ومطلع يحب مشاركة المعلومات بطريقة ممتعة ومفصلة.

🚨 CRITICAL: أنت في وضع المحادثة العامة - لا يمكنك الوصول للإنترنت أو المعلومات الحديثة مطلقاً.

🎯 أسلوبك في الحديث:
- كن ودوداً ومحادثاً مثل صديق مقرب
- استخدم تعبيرات عامية وطبيعية
- اظهر الحماس والشغف عند مشاركة المعلومات
- قدم معلومات عامة من معرفتك السابقة فقط
- إذا سأل عن معلومات حديثة، أخبره بوضوح أن يستخدم وضع البحث

📁 معالجة الملفات المرفقة:
- إذا رفق المستخدم ملفات (صور، مستندات)، قم بتحليلها بتفصيل كبير
- اوصف الصور بدقة واقرأ أي نص موجود فيها
- اشرح الرسوم البيانية والمخططات والجداول
- اربط محتوى الملفات بسؤال المستخدم وقدم إجابة شاملة

إذا سأل عن أخبار حديثة أو معلومات متغيرة، قل له: "للحصول على المعلومات الحديثة والدقيقة، يرجى التبديل إلى وضع البحث 🔍"`
        : `You are WAKTI, a super friendly and knowledgeable AI assistant. You chat like a close buddy who's genuinely excited to share cool information and help out!

🚨 CRITICAL: You're in general chat mode - you CANNOT access the internet or current information whatsoever.

🎯 Your conversation style:
- Be warm, friendly, and conversational like a close friend
- Use casual expressions and natural language
- Show enthusiasm and passion when sharing information
- Only provide general knowledge from your training data
- If asked about current/recent info, clearly tell them to use Search mode

📁 File Processing Capabilities:
- If the user uploads files (images, documents), analyze them in great detail
- Describe images thoroughly and read any text present in them
- Explain diagrams, charts, and data visualizations
- Connect file content to the user's question and provide comprehensive answers

If asked about current events, news, or changing information, say: "For current and accurate information, please switch to Search mode 🔍"`;
      
    } else {
      // BROWSING ALLOWED MODE for Search (with context validation)
      systemPrompt = language === 'ar' 
        ? `أنت WAKTI، مساعد ذكي ودود جداً يتحدث العربية بطلاقة. تتحدث مثل صديق مقرب ومطلع يحب مشاركة المعلومات بطريقة ممتعة ومفصلة.

🌐 أنت في وضع البحث - يمكنك الوصول للمعلومات الحديثة.

🎯 أسلوبك في الحديث:
- كن ودوداً ومحادثاً مثل صديق مقرب
- استخدم تعبيرات عامية وطبيعية
- اظهر الحماس والشغف عند مشاركة المعلومات
- قدم تفاصيل غنية ومعلومات إضافية مثيرة من نتائج البحث
- اربط المعلومات بالسياق والخلفية

📁 معالجة الملفات المرفقة:
- إذا رفق المستخدم ملفات (صور، مستندات)، قم بتحليلها بتفصيل كبير
- اوصف الصور بدقة واقرأ أي نص موجود فيها
- اشرح الرسوم البيانية والمخططات والجداول
- اربط محتوى الملفات بسؤال المستخدم ونتائج البحث

📝 تنسيق الإجابات:
${queryType === 'sports' ? '- الرياضة: اذكر النتائج، النقاط المهمة، اللحظات الحاسمة، إحصائيات اللاعبين' : ''}
${queryType === 'news' ? '- الأخبار: قدم الخط الزمني، الحقائق المهمة، التأثيرات والخلفية' : ''}
${queryType === 'tech' ? '- التكنولوجيا: اذكر المواصفات، المقارنات، الميزات الجديدة' : ''}
${queryType === 'entertainment' ? '- الترفيه: قدم المراجعات، التقييمات، معلومات عن الطاقم' : ''}
${queryType === 'weather' ? '- الطقس: اذكر التوقعات، النصائح، المقارنات' : ''}
${queryType === 'finance' ? '- المالية: قدم الأرقام، الاتجاهات، التحليل' : ''}
- عام: قدم شرحاً شاملاً مع السياق والخلفية

كن صديقاً حقيقياً يحب مشاركة المعلومات الرائعة والحديثة!`
        : `You are WAKTI, a super friendly and knowledgeable AI assistant. You chat like a close buddy who's genuinely excited to share cool information and help out!

🌐 You're in search mode - you have access to current information.

🎯 Your conversation style:
- Be warm, friendly, and conversational like a close friend
- Use casual expressions and natural language
- Show enthusiasm and passion when sharing information
- Provide rich details and interesting additional context from search results
- Connect information to broader context and background

📁 File Processing Capabilities:
- If the user uploads files (images, documents), analyze them in great detail
- Describe images thoroughly and read any text present in them
- Explain diagrams, charts, and data visualizations
- Connect file content to the user's question and search results

📝 Response formatting based on query type:
${queryType === 'sports' ? '- Sports: Include scores, highlights, key moments, player stats, game analysis' : ''}
${queryType === 'news' ? '- News: Provide timeline, key facts, implications, background context' : ''}
${queryType === 'tech' ? '- Tech: Mention specs, comparisons, new features, user impact' : ''}
${queryType === 'entertainment' ? '- Entertainment: Include reviews, ratings, cast/crew info, behind-the-scenes' : ''}
${queryType === 'weather' ? '- Weather: Give forecasts, tips, comparisons, what to expect' : ''}
${queryType === 'finance' ? '- Finance: Provide numbers, trends, analysis, market context' : ''}
- General: Give comprehensive explanations with context and background

Be like that friend who always has the coolest and most current facts and loves sharing them in an engaging way!`;
    }
    
    // Combine the user message with file context
    const enhancedMessage = message + fileContext;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enhancedMessage }
    ];
    
    if (context && allowBrowsing) {
      messages.splice(1, 0, { role: 'assistant', content: `Here's what I found: ${context}` });
      console.log("🤖 WAKTI AI V2.5: ✅ Using search context in AI processing");
    } else {
      console.log("🤖 WAKTI AI V2.5: 💬 Pure chat mode - no search context");
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
        temperature: allowBrowsing ? 0.8 : 0.7, // Slightly different temperature for different modes
        max_tokens: 1500 // Increased for file analysis
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    const aiResponse = result.choices[0].message.content;
    
    console.log("🤖 WAKTI AI V2.5: === AI PROCESSING SUCCESS ===");
    console.log("🤖 WAKTI AI V2.5: Response length:", aiResponse.length);
    
    return aiResponse;
    
  } catch (error) {
    console.error("🤖 WAKTI AI V2.5: ❌ AI PROCESSING ERROR:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

// Task extraction helper
function extractTaskData(message) {
  const title = message.replace(/create task|add task|new task|make task|todo|أنشئ مهمة|أضف مهمة/gi, '').trim();
  return {
    title: title || 'New Task',
    description: '',
    priority: 'medium'
  };
}

// Event extraction helper
function extractEventData(message) {
  const title = message.replace(/create event|add event|schedule|meeting|appointment|أنشئ حدث|أضف حدث/gi, '').trim();
  return {
    title: title || 'New Event',
    description: '',
    startTime: null,
    endTime: null
  };
}

// Reminder extraction helper
function extractReminderData(message) {
  const title = message.replace(/remind me|reminder|don\'t forget|alert me|ذكرني|تذكير|لا تنس/gi, '').trim();
  return {
    title: title || 'New Reminder',
    dueDate: null
  };
}

// Check browsing quota
async function checkBrowsingQuota(userId) {
  try {
    const { data, error } = await supabase.rpc('check_browsing_quota', {
      p_user_id: userId
    });
    
    if (error) {
      console.error("Quota check error:", error);
      return { count: 0, limit: 60, canBrowse: true };
    }
    
    const count = data || 0;
    const limit = 60; // Monthly limit
    const usagePercentage = Math.round((count / limit) * 100);
    
    return {
      count,
      limit,
      usagePercentage,
      remaining: Math.max(0, limit - count),
      canBrowse: count < limit,
      requiresConfirmation: usagePercentage >= 80
    };
  } catch (error) {
    console.error("Quota check error:", error);
    return { count: 0, limit: 60, canBrowse: true };
  }
}

// Log AI usage
async function logAIUsage(userId, modelUsed, hasBrowsing = false) {
  try {
    await supabase.rpc('log_ai_usage', {
      p_user_id: userId,
      p_model_used: modelUsed,
      p_has_browsing: hasBrowsing
    });
  } catch (error) {
    console.error("Usage logging error:", error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🎯 WAKTI AI V2.5: === SMART FILE PROCESSING REQUEST START ===");
    console.log("🎯 WAKTI AI V2.5: Request method:", req.method);

    // Enhanced JSON parsing with detailed debugging
    let requestBody;
    try {
      const rawBody = await req.text();
      console.log("🎯 WAKTI AI V2.5: Raw request body received");
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error("Empty request body received");
      }
      
      requestBody = JSON.parse(rawBody);
      console.log("🎯 WAKTI AI V2.5: ✅ Successfully parsed request body");
    } catch (parseError) {
      console.error("🎯 WAKTI AI V2.5: ❌ JSON parsing error:", parseError);
      
      return new Response(JSON.stringify({ 
        error: "Invalid JSON in request body",
        details: parseError.message,
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Extract fields with defaults - INCLUDING activeTrigger, textGenParams, and attachedFiles
    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      conversationHistory = [],
      confirmSearch = false,
      activeTrigger = 'chat',
      textGenParams = null,
      attachedFiles = []
    } = requestBody;

    console.log("🎯 WAKTI AI V2.5: === EXTRACTED FIELDS ===");
    console.log("🎯 WAKTI AI V2.5: Message:", message);
    console.log("🎯 WAKTI AI V2.5: User ID:", userId);
    console.log("🎯 WAKTI AI V2.5: Language:", language);
    console.log("🎯 WAKTI AI V2.5: Active Trigger (ABSOLUTE CONTROLLER):", activeTrigger);
    console.log("🎯 WAKTI AI V2.5: Input Type:", inputType);
    console.log("🎯 WAKTI AI V2.5: Text Gen Params:", textGenParams);
    console.log("🎯 WAKTI AI V2.5: Attached Files:", attachedFiles?.length || 0);
    console.log("🎯 WAKTI AI V2.5: Confirm Search:", confirmSearch);

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("🎯 WAKTI AI V2.5: ❌ Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      console.error("🎯 WAKTI AI V2.5: ❌ Missing userId");
      return new Response(JSON.stringify({ 
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ULTRA-STRICT TRIGGER ANALYSIS: Analyze intent with ABSOLUTE trigger control
    console.log("🎯 WAKTI AI V2.5: === STARTING ULTRA-STRICT TRIGGER ANALYSIS ===");
    const intentAnalysis = analyzeIntentWithAbsoluteTriggerControl(message, language, activeTrigger, textGenParams);
    console.log("🎯 WAKTI AI V2.5: === ULTRA-STRICT TRIGGER RESULT ===");
    console.log("🎯 WAKTI AI V2.5: Intent:", intentAnalysis.intent);
    console.log("🎯 WAKTI AI V2.5: Requires Browsing:", intentAnalysis.requiresBrowsing);
    console.log("🎯 WAKTI AI V2.5: Trigger Mode:", intentAnalysis.triggerMode);
    console.log("🎯 WAKTI AI V2.5: Strict Mode:", intentAnalysis.strictMode);

    let response = '';
    let imageUrl = null;
    let generatedText = null;
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;

    // Get quota status
    quotaStatus = await checkBrowsingQuota(userId);

    // ULTRA-STRICT TRIGGER PROCESSING: Process based on ABSOLUTE trigger control
    console.log("🎯 WAKTI AI V2.5: === PROCESSING WITH ULTRA-STRICT TRIGGER CONTROL ===");
    
    if (intentAnalysis.intent === 'generate_text') {
      console.log("📝 WAKTI AI V2.5: Handling text generation");
      
      const textResult = await generateText(intentAnalysis.params, language);
      
      if (textResult.success) {
        generatedText = textResult.generatedText;
        response = language === 'ar' 
          ? `تم إنشاء النص بنجاح! 📝\n\n${textResult.generatedText}`
          : `Text generated successfully! 📝\n\n${textResult.generatedText}`;
        actionTaken = 'generate_text';
        actionResult = { generatedText: textResult.generatedText, params: textResult.params };
      } else {
        response = language === 'ar' 
          ? `عذراً، فشل في إنشاء النص: ${textResult.error}`
          : `Sorry, failed to generate text: ${textResult.error}`;
      }
      
    } else if (intentAnalysis.intent === 'generate_image') {
      console.log("🎨 WAKTI AI V2.5: Handling image generation");
      
      const imageResult = await generateImage(intentAnalysis.params.prompt, language);
      
      if (imageResult.success) {
        imageUrl = imageResult.imageUrl;
        response = language === 'ar' 
          ? `تم إنشاء الصورة بنجاح! 🎨\n\nالوصف: ${intentAnalysis.params.prompt}`
          : `Image generated successfully! 🎨\n\nPrompt: ${intentAnalysis.params.prompt}`;
        actionTaken = 'generate_image';
        actionResult = { imageUrl, prompt: intentAnalysis.params.prompt };
      } else {
        response = language === 'ar' 
          ? `عذراً، فشل في إنشاء الصورة: ${imageResult.error}`
          : `Sorry, failed to generate image: ${imageResult.error}`;
      }
      
    } else if (intentAnalysis.requiresBrowsing) {
      console.log("🌐 WAKTI AI V2.5: TRIGGER DEMANDS BROWSING - ENABLING TAVILY");
      console.log("🌐 WAKTI AI V2.5: Trigger Mode:", activeTrigger);
      console.log("🌐 WAKTI AI V2.5: Strict Mode:", intentAnalysis.strictMode);
      
      if (quotaStatus.canBrowse && (confirmSearch || !quotaStatus.requiresConfirmation)) {
        // Determine search mode based on trigger
        const searchMode = activeTrigger === 'advanced_search' ? 'advanced' : 'basic';
        
        console.log("🌐 WAKTI AI V2.5: Executing browsing with mode:", searchMode);
        const browsingResult = await executeBrowsing(message, searchMode, language, activeTrigger);
        
        if (browsingResult.success) {
          browsingUsed = true;
          browsingData = {
            hasResults: true,
            sources: browsingResult.sources,
            images: browsingResult.images,
            query: browsingResult.query,
            searchMode: browsingResult.searchMode
          };
          
          // Use rich context for better AI processing WITH browsing allowed AND file processing
          response = await processWithAI(message, browsingResult.richContext, language, true, activeTrigger, attachedFiles);
          
          // Log browsing usage
          await logAIUsage(userId, 'deepseek-chat', true);
          console.log("🌐 WAKTI AI V2.5: ✅ BROWSING SUCCESSFUL");
        } else {
          console.log("🌐 WAKTI AI V2.5: ❌ BROWSING FAILED - Falling back to AI without browsing");
          // If browsing fails, fall back to AI without browsing but with file processing
          response = await processWithAI(message, null, language, false, 'chat', attachedFiles);
        }
      } else if (quotaStatus.requiresConfirmation && !confirmSearch) {
        response = language === 'ar' 
          ? `لقد استخدمت ${quotaStatus.count} من ${quotaStatus.limit} عملية بحث شهرية (${quotaStatus.usagePercentage}%). هل تريد المتابعة بالبحث؟`
          : `You've used ${quotaStatus.count} of ${quotaStatus.limit} monthly searches (${quotaStatus.usagePercentage}%). Do you want to proceed with search?`;
      } else {
        response = language === 'ar' 
          ? `لقد وصلت إلى حد البحث الشهري (${quotaStatus.limit}). يمكنني الإجابة على أسئلة عامة.`
          : `You've reached your monthly search limit (${quotaStatus.limit}). I can answer general questions.`;
      }
      
    } else {
      console.log("💬 WAKTI AI V2.5: TRIGGER FORBIDS BROWSING - PURE CHAT MODE WITH FILE PROCESSING");
      console.log("💬 WAKTI AI V2.5: Strict Mode:", intentAnalysis.strictMode);
      // ULTRA-STRICT: Pass allowBrowsing=false to prevent ANY browsing but allow file processing
      response = await processWithAI(message, null, language, false, activeTrigger, attachedFiles);
    }

    // Handle conversation storage
    let finalConversationId = conversationId;
    if (!conversationId) {
      try {
        const { data: newConv, error: convError } = await supabase
          .from('ai_conversations')
          .insert({
            title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            user_id: userId
          })
          .select()
          .single();
        
        if (!convError && newConv) {
          finalConversationId = newConv.id;
        }
      } catch (convErr) {
        console.log("🎯 WAKTI AI V2.5: Conversation creation failed, continuing without storage");
      }
    }

    // Store chat history
    if (finalConversationId) {
      try {
        // Store user message
        await supabase.from('ai_chat_history').insert({
          conversation_id: finalConversationId,
          user_id: userId,
          role: 'user',
          content: message,
          input_type: inputType
        });

        // Store AI response
        await supabase.from('ai_chat_history').insert({
          conversation_id: finalConversationId,
          user_id: userId,
          role: 'assistant',
          content: response,
          intent: intentAnalysis.intent,
          confidence_level: intentAnalysis.confidence,
          action_taken: actionTaken,
          action_result: actionResult,
          browsing_used: browsingUsed,
          browsing_data: browsingData,
          quota_status: quotaStatus
        });

        // Update conversation timestamp
        await supabase
          .from('ai_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', finalConversationId);
      } catch (dbError) {
        console.error("🎯 WAKTI AI V2.5: Database storage error:", dbError);
      }
    }

    // Log AI usage
    await logAIUsage(userId, 'deepseek-chat', browsingUsed);

    // Return successful response
    const responseData = {
      success: true,
      response: response,
      conversationId: finalConversationId,
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      actionTaken: actionTaken,
      actionResult: actionResult,
      imageUrl: imageUrl,
      generatedText: generatedText,
      browsingUsed: browsingUsed,
      browsingData: browsingData,
      quotaStatus: quotaStatus,
      requiresSearchConfirmation: quotaStatus?.requiresConfirmation && !confirmSearch && intentAnalysis.requiresBrowsing,
      triggerMode: activeTrigger,
      strictMode: intentAnalysis.strictMode
    };

    console.log("🎯 WAKTI AI V2.5: === SMART FILE PROCESSING SUCCESS ===");
    console.log("🎯 WAKTI AI V2.5: Browsing Used:", browsingUsed);
    console.log("🎯 WAKTI AI V2.5: Intent:", intentAnalysis.intent);
    console.log("🎯 WAKTI AI V2.5: Trigger Mode:", activeTrigger);
    console.log("🎯 WAKTI AI V2.5: Strict Mode:", intentAnalysis.strictMode);
    console.log("🎯 WAKTI AI V2.5: Files Processed:", attachedFiles?.length || 0);
    console.log("🎯 WAKTI AI V2.5: === REQUEST END ===");

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🎯 WAKTI AI V2.5: ❌ Request processing error:", error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || "Internal server error",
      response: "Sorry, I encountered an error processing your request. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
