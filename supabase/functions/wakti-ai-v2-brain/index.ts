import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { generateImageWithRunware } from './imageGeneration.ts';

// ENHANCED CORS CONFIGURATION FOR PRODUCTION
const allowedOrigins = [
  'https://wakti.qa',
  'https://www.wakti.qa'
];

const getCorsHeaders = (origin: string | null) => {
  // Allow production domains + any lovable subdomain
  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('lovable.dev') ||
    origin.includes('lovable.app') ||
    origin.includes('lovableproject.com')
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, x-auth-token, x-skip-auth, content-length',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const RUNWARE_API_KEY = Deno.env.get('RUNWARE_API_KEY');
const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("WAKTI AI V2 BRAIN: BACKEND WORKER MODE - Frontend Boss, Backend Worker");

// Weather cache for performance optimization
const weatherCache = new Map();
const ipLocationCache = new Map();

// WEATHER FUNCTIONALITY
async function detectWeatherQuery(message: string, language: string): Promise<boolean> {
  const weatherKeywords = {
    en: ['weather', 'temperature', 'rain', 'sunny', 'cloudy', 'hot', 'cold', 'forecast', 'climate'],
    ar: ['طقس', 'حرارة', 'مطر', 'مشمس', 'غائم', 'حار', 'بارد', 'توقعات', 'مناخ', 'جو']
  };
  
  const keywords = weatherKeywords[language as keyof typeof weatherKeywords] || weatherKeywords.en;
  const lowerMessage = message.toLowerCase();
  
  return keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
}

async function extractCityFromMessage(message: string, language: string): Promise<string | null> {
  const cityPatterns = {
    en: [
      /weather in ([a-zA-Z\s]+)/i,
      /temperature in ([a-zA-Z\s]+)/i,
      /how.+weather.+in ([a-zA-Z\s]+)/i,
      /([a-zA-Z\s]+) weather/i
    ],
    ar: [
      /طقس في ([ا-ي\s]+)/i,
      /حرارة في ([ا-ي\s]+)/i,
      /كيف.+طقس.+في ([ا-ي\s]+)/i,
      /طقس ([ا-ي\s]+)/i
    ]
  };
  
  const patterns = cityPatterns[language as keyof typeof cityPatterns] || cityPatterns.en;
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

async function getUserLocationFromIP(): Promise<{lat: number, lon: number, city: string} | null> {
  try {
    const cacheKey = 'user_ip_location';
    if (ipLocationCache.has(cacheKey)) {
      return ipLocationCache.get(cacheKey);
    }
    
    const response = await fetch('http://ip-api.com/json/', {
      method: 'GET',
      headers: { 'User-Agent': 'WaktiAI/1.0' }
    });
    
    if (!response.ok) throw new Error('IP geolocation failed');
    
    const data = await response.json();
    
    if (data.status === 'success') {
      const location = {
        lat: data.lat,
        lon: data.lon,
        city: data.city
      };
      
      ipLocationCache.set(cacheKey, location);
      setTimeout(() => ipLocationCache.delete(cacheKey), 1800000); // 30 min cache
      
      return location;
    }
    
    return null;
  } catch (error) {
    console.error('IP geolocation error:', error);
    return null;
  }
}

async function geocodeCity(cityName: string): Promise<{lat: number, lon: number} | null> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`, {
      method: 'GET',
      headers: { 'User-Agent': 'WaktiAI/1.0' }
    });
    
    if (!response.ok) throw new Error('Geocoding failed');
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

async function getWeatherData(lat: number, lon: number): Promise<any> {
  try {
    const cacheKey = `weather_${lat}_${lon}`;
    if (weatherCache.has(cacheKey)) {
      return weatherCache.get(cacheKey);
    }
    
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`, {
      method: 'GET',
      headers: { 'User-Agent': 'WaktiAI/1.0' }
    });
    
    if (!response.ok) throw new Error('Weather API failed');
    
    const data = await response.json();
    
    weatherCache.set(cacheKey, data);
    setTimeout(() => weatherCache.delete(cacheKey), 1800000); // 30 min cache
    
    return data;
  } catch (error) {
    console.error('Weather API error:', error);
    return null;
  }
}

function getWeatherDescription(weatherCode: number, language: string): string {
  const weatherCodes = {
    en: {
      0: 'clear sky',
      1: 'mainly clear',
      2: 'partly cloudy',
      3: 'overcast',
      45: 'foggy',
      48: 'depositing rime fog',
      51: 'light drizzle',
      53: 'moderate drizzle',
      55: 'dense drizzle',
      61: 'slight rain',
      63: 'moderate rain',
      65: 'heavy rain',
      80: 'slight rain showers',
      81: 'moderate rain showers',
      82: 'violent rain showers',
      95: 'thunderstorm'
    },
    ar: {
      0: 'سماء صافية',
      1: 'صافية في الغالب',
      2: 'غائمة جزئياً',
      3: 'غائمة',
      45: 'ضبابية',
      48: 'ضباب متجمد',
      51: 'رذاذ خفيف',
      53: 'رذاذ معتدل',
      55: 'رذاذ كثيف',
      61: 'مطر خفيف',
      63: 'مطر معتدل',
      65: 'مطر غزير',
      80: 'زخات مطر خفيفة',
      81: 'زخات مطر معتدلة',
      82: 'زخات مطر عنيفة',
      95: 'عاصفة رعدية'
    }
  };
  
  const codes = weatherCodes[language as keyof typeof weatherCodes] || weatherCodes.en;
  return codes[weatherCode as keyof typeof codes] || (language === 'ar' ? 'غير معروف' : 'unknown');
}

async function processWeatherRequest(message: string, language: string): Promise<string> {
  try {
    console.log('🌤️ WEATHER: Processing weather request');
    
    // Extract city from message or use IP location
    const cityName = await extractCityFromMessage(message, language);
    let location;
    let cityDisplayName = '';
    
    if (cityName) {
      console.log(`🌤️ WEATHER: City detected: ${cityName}`);
      const coords = await geocodeCity(cityName);
      if (coords) {
        location = coords;
        cityDisplayName = cityName;
      }
    }
    
    if (!location) {
      console.log('🌤️ WEATHER: Using IP-based location');
      const ipLocation = await getUserLocationFromIP();
      if (ipLocation) {
        location = { lat: ipLocation.lat, lon: ipLocation.lon };
        cityDisplayName = ipLocation.city;
      }
    }
    
    if (!location) {
      return language === 'ar' 
        ? 'عذراً، لا أستطيع تحديد موقعك للحصول على معلومات الطقس.'
        : 'Sorry, I cannot determine your location to get weather information.';
    }
    
    // Get weather data
    const weatherData = await getWeatherData(location.lat, location.lon);
    
    if (!weatherData || !weatherData.current_weather) {
      return language === 'ar'
        ? 'عذراً، لا أستطيع الحصول على معلومات الطقس الآن. يرجى المحاولة مرة أخرى لاحقاً.'
        : 'Sorry, I cannot get weather information right now. Please try again later.';
    }
    
    const currentTemp = Math.round(weatherData.current_weather.temperature);
    const weatherCode = weatherData.current_weather.weathercode;
    const weatherDesc = getWeatherDescription(weatherCode, language);
    const maxTemp = weatherData.daily?.temperature_2m_max?.[0] ? Math.round(weatherData.daily.temperature_2m_max[0]) : null;
    const minTemp = weatherData.daily?.temperature_2m_min?.[0] ? Math.round(weatherData.daily.temperature_2m_min[0]) : null;
    
    console.log(`✅ WEATHER: Successfully retrieved weather for ${cityDisplayName}`);
    
    // Format response in user's language
    if (language === 'ar') {
      let response = `🌤️ الطقس الآن في ${cityDisplayName}: ${currentTemp}°م مع ${weatherDesc}`;
      if (maxTemp !== null && minTemp !== null) {
        response += `\n\nتوقعات اليوم: العظمى ${maxTemp}°م والصغرى ${minTemp}°م`;
      }
      return response;
    } else {
      let response = `🌤️ Current weather in ${cityDisplayName}: ${currentTemp}°C with ${weatherDesc}`;
      if (maxTemp !== null && minTemp !== null) {
        response += `\n\nToday's forecast: High ${maxTemp}°C, Low ${minTemp}°C`;
      }
      return response;
    }
    
  } catch (error) {
    console.error('🌤️ WEATHER ERROR:', error);
    return language === 'ar'
      ? 'عذراً، حدث خطأ أثناء الحصول على معلومات الطقس.'
      : 'Sorry, there was an error getting weather information.';
  }
}

// TAVILY SEARCH FUNCTION
async function performSearchWithTavily(query: string, userId: string, language: string = 'en') {
  console.log('🔍 BACKEND WORKER: Processing search request');
  
  if (!TAVILY_API_KEY) {
    return {
      success: false,
      error: language === 'ar' ? 'خدمة البحث غير متاحة' : 'Search service not configured',
      response: language === 'ar' 
        ? 'أعتذر، خدمة البحث غير متاحة حالياً.'
        : 'I apologize, search service is not available at the moment.'
    };
  }

  try {
    const searchPayload = {
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "basic",
      include_answer: true,
      include_raw_content: false,
      max_results: 5
    };

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload)
    });

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }

    const searchData = await response.json();
    const results = Array.isArray(searchData.results) ? searchData.results : [];
    const answer = searchData.answer || '';
    
    let searchResponse = language === 'ar' ? '🔍 نتائج البحث:\n\n' : '🔍 Search Results:\n\n';
    
    if (answer) {
      searchResponse += language === 'ar' ? `**الإجابة المباشرة:**\n${answer}\n\n` : `**Direct Answer:**\n${answer}\n\n`;
    }
    
    if (results.length > 0) {
      searchResponse += language === 'ar' ? '**المصادر:**\n' : '**Sources:**\n';
      results.forEach((result: any, index: number) => {
        if (result && typeof result === 'object') {
          searchResponse += `${index + 1}. **${result.title || 'No title'}**\n`;
          searchResponse += `   ${result.content || 'No content'}\n`;
          searchResponse += `   🔗 [${language === 'ar' ? 'المصدر' : 'Source'}](${result.url || '#'})\n\n`;
        }
      });
    }

    console.log(`✅ BACKEND WORKER: Search completed with ${results.length} results`);
    return {
      success: true,
      error: null,
      response: searchResponse,
      searchData: {
        answer,
        results,
        query,
        total_results: results.length
      }
    };

  } catch (error) {
    console.error('❌ BACKEND WORKER: Search error:', error);
    
    return {
      success: false,
      error: language === 'ar' ? 'فشل البحث' : 'Search failed',
      response: language === 'ar' 
        ? 'أعتذر، حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.'
        : 'I apologize, there was an error during the search. Please try again.'
    };
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    console.log("🔧 BACKEND WORKER: Handling OPTIONS request");
    return new Response(null, { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  }

  try {
    console.log("🤖 BACKEND WORKER: Processing Claude request from Frontend Boss");
    
    const contentType = req.headers.get('content-type') || '';
    let requestData;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const jsonData = formData.get('data') as string;
      requestData = JSON.parse(jsonData);
      
      const files = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('file-') && value instanceof File) {
          files.push(value);
        }
      }
      requestData.files = files;
    } else {
      requestData = await req.json();
    }

    const { 
      message, 
      conversationId,
      userId, 
      language = 'en',
      files = [],
      attachedFiles: requestAttachedFiles = [],
      activeTrigger = 'general',
      recentMessages = [],
      conversationSummary = '',
      personalTouch = null
    } = requestData;

    const actualUserId = userId || personalTouch?.userId || requestData.user_id || 'default_user';
    console.log(`🤖 BACKEND WORKER: Processing ${activeTrigger} mode for conversation ${conversationId || 'new'}`);

    const finalConversationId = conversationId;

    let attachedFiles = [];
    
    if (requestAttachedFiles && requestAttachedFiles.length > 0) {
      console.log(`📎 BACKEND WORKER: Processing ${requestAttachedFiles.length} files`);
      
      attachedFiles = requestAttachedFiles.map(file => ({
        url: file.url,
        type: file.type,
        name: file.name,
        imageType: file.imageType || { id: 'general', name: language === 'ar' ? 'عام' : 'General' }
      }));
    }

    console.log(`🎯 BACKEND WORKER: Mode=${activeTrigger}, HasImages=${attachedFiles.length > 0}`);

    let result;
    
    if (activeTrigger === 'image') {
      console.log('🎨 BACKEND WORKER: Processing image generation');
      result = await generateImageWithRunware(message, actualUserId, language);
      result.mode = 'image';
      result.intent = 'image';
    } else if (activeTrigger === 'search') {
      console.log('🔍 BACKEND WORKER: Processing search request');
      result = await performSearchWithTavily(message, actualUserId, language);
      result.mode = 'search';
      result.intent = 'search';
    } else {
      console.log('🤖 BACKEND WORKER: Processing Claude chat/vision/weather request');
      result = await callClaude35API(
        message,
        finalConversationId,
        actualUserId,
        language,
        attachedFiles,
        activeTrigger,
        recentMessages,
        conversationSummary,
        personalTouch
      );
    }

    const finalResponse = {
      response: result.response || 'Response received',
      conversationId: finalConversationId,
      intent: result.intent || activeTrigger,
      confidence: 'high',
      actionTaken: null,
      imageUrl: result.imageUrl || null,
      browsingUsed: activeTrigger === 'search',
      browsingData: result.searchData || null,
      needsConfirmation: false,
      
      success: result.success !== false,
      processingTime: Date.now(),
      aiProvider: result.mode === 'image' ? 'runware' : result.mode === 'search' ? 'tavily' : result.mode === 'weather' ? 'weather-api' : 'claude-3-5-sonnet-20241022',
      claude35Enabled: true,
      mode: result.mode || activeTrigger,
      fallbackUsed: false
    };

    console.log(`✅ BACKEND WORKER: Successfully processed ${activeTrigger} request, returning to Frontend Boss`);
    
    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY"
      }
    });

  } catch (error) {
    console.error("❌ BACKEND WORKER ERROR:", error);
    return new Response(JSON.stringify({
      error: error.message || 'Backend worker failed',
      success: false,
      response: 'I encountered an error processing your request. Please try again.',
      conversationId: null
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });
  }
});

async function callClaude35API(message, conversationId, userId, language = 'en', attachedFiles = [], activeTrigger = 'general', recentMessages = [], conversationSummary = '', personalTouch = null) {
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Check if this is a weather query
    const isWeatherQuery = await detectWeatherQuery(message, language);
    
    if (isWeatherQuery) {
      console.log('🌤️ WEATHER: Detected weather query, processing...');
      const weatherResponse = await processWeatherRequest(message, language);
      
      return {
        response: weatherResponse,
        success: true,
        model: 'weather-api',
        usage: null,
        mode: 'weather',
        intent: 'weather'
      };
    }

    console.log(`🤖 BACKEND WORKER: Processing ${activeTrigger} mode conversation`);
    
    let detectedMode = 'chat';

    if (attachedFiles && attachedFiles.length > 0) {
      const hasImages = attachedFiles.some(file => file.type?.startsWith('image/'));
      if (hasImages) {
        detectedMode = 'vision';
        console.log('🔍 BACKEND WORKER: Images detected, using vision mode');
      }
    }

    console.log(`🤖 BACKEND WORKER: Mode="${detectedMode}" (trigger: "${activeTrigger}")`);

    const responseLanguage = language;
    let messages = [];

    let personalizationContext = '';
    if (personalTouch) {
      const parts = [];
      if (personalTouch.nickname) parts.push(`User name: ${personalTouch.nickname}`);
      if (personalTouch.aiNickname) parts.push(`AI name: ${personalTouch.aiNickname}`);
      if (personalTouch.tone) parts.push(`Tone: ${personalTouch.tone}`);
      if (personalTouch.style) parts.push(`Style: ${personalTouch.style}`);
      if (personalTouch.instruction) parts.push(`Instructions: ${personalTouch.instruction}`);
      
      if (parts.length > 0) {
        personalizationContext = `\n\nPersonalization: ${parts.join(', ')}`;
      }
    }

    const currentDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Qatar'
    });

    if (detectedMode === 'vision') {
      console.log('👁️ BACKEND WORKER: Building vision request');
      
      const visionContent = [];
      
      // Add language enforcement directly in the message
      const languagePrefix = responseLanguage === 'ar' 
        ? 'يرجى الرد باللغة العربية فقط. ' 
        : 'Please respond in English only. ';
      
      visionContent.push({
        type: 'text',
        text: languagePrefix + (message || 'Analyze this image and describe what you see in detail.')
      });

      for (const file of attachedFiles) {
        if (file.type?.startsWith('image/')) {
          console.log(`📎 BACKEND WORKER: Processing ${file.name}`);
          
          let imageData;
          if (file.url.startsWith('data:')) {
            imageData = file.url.split(',')[1];
            console.log('✅ BACKEND WORKER: Extracted base64 data');
          } else {
            console.error('❌ Expected base64 data URL, got:', file.url.substring(0, 50));
            throw new Error('Invalid image data format - expected base64 data URL');
          }

          visionContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.type,
              data: imageData
            }
          });
        }
      }

      messages.push({
        role: 'user',
        content: visionContent
      });

    } else {
      if (recentMessages && recentMessages.length > 0) {
        const historyMessages = recentMessages.slice(-6);
        historyMessages.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({
              role: msg.role,
              content: msg.content
            });
          }
        });
        console.log(`🧠 BACKEND WORKER: Using ${historyMessages.length} messages from Frontend Boss conversation history`);
      }
      
      // Add language enforcement directly in the user message
      const languagePrefix = responseLanguage === 'ar' 
        ? 'يرجى الرد باللغة العربية فقط. ' 
        : 'Please respond in English only. ';
      
      messages.push({
        role: 'user',
        content: languagePrefix + message
      });
    }

    let systemPrompt;
    if (detectedMode === 'vision') {
      systemPrompt = responseLanguage === 'ar' 
        ? `⚠️ CRITICAL: استجب باللغة العربية فقط. لا تستخدم الإنجليزية مطلقاً. هذا أمر إجباري.

أنت WAKTI AI، مساعد ذكي متخصص في تحليل الصور. التاريخ الحالي: ${currentDate}

قم بتحليل الصورة المرفقة بالتفصيل واستخرج جميع المعلومات المفيدة منها. كن دقيقاً ووصفياً في تحليلك.

IMPORTANT: تذكر - استخدم العربية فقط في ردك. أي استخدام للإنجليزية غير مقبول.`
        : `⚠️ CRITICAL: Respond ONLY in English. Do not use Arabic at all. This is mandatory.

You are WAKTI AI, an intelligent assistant specialized in image analysis. Current date: ${currentDate}

Analyze the attached image in detail and extract all useful information from it. Be precise and descriptive in your analysis.

IMPORTANT: Remember - use only English in your response. Any use of Arabic is unacceptable.`;
    } else {
      systemPrompt = responseLanguage === 'ar' ? `⚠️ CRITICAL: استجب باللغة العربية فقط. لا تستخدم الإنجليزية مطلقاً. هذا أمر إجباري.

أنت WAKTI AI، مساعد ذكي متخصص في الإنتاجية والتنظيم.
التاريخ الحالي: ${currentDate}

## إنشاء الصور (في وضع المحادثة فقط):
عندما تكون في وضع المحادثة ويطلب المستخدمون إنشاء صور، اردد بـ:
"يرجى التبديل إلى وضع الصور لإنشاء المحتوى البصري."

## معلومات الطقس:
يمكنك تقديم معلومات الطقس الحالية للمستخدمين باللغة العربية.

أنت هنا لجعل حياة المستخدمين أكثر تنظيماً وإنتاجية!

IMPORTANT: تذكر - استخدم العربية فقط في ردك. أي استخدام للإنجليزية غير مقبول.
` : `⚠️ CRITICAL: Respond ONLY in English. Do not use Arabic at all. This is mandatory.

You are WAKTI AI, an intelligent assistant specializing in productivity and organization.
Current date: ${currentDate}

## Image Generation (Chat Mode Only):
When in chat mode and users request image generation, respond with:
"Please switch to image mode for visual content creation."

## Weather Information:
You can provide current weather information to users in English.

You're here to make users' lives more organized and productive!

IMPORTANT: Remember - use only English in your response. Any use of Arabic is unacceptable.
`;
      systemPrompt += personalizationContext;
    }

    console.log(`🤖 BACKEND WORKER: Calling Claude with mode=${detectedMode}, messages=${messages.length}`);

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: detectedMode === 'vision' ? 3000 : 2000,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.text();
      console.error('❌ BACKEND WORKER: Claude API error:', claudeResponse.status, errorData);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || (responseLanguage === 'ar' ? 'أعتذر، واجهت مشكلة في معالجة طلبك.' : 'I apologize, but I encountered an issue processing your request.');

    console.log(`✅ BACKEND WORKER: Claude response completed for ${detectedMode} mode`);

    console.log('🤖 BACKEND WORKER: Skipping database save - Frontend Boss handles persistence');

    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage,
      mode: detectedMode,
      intent: detectedMode
    };

  } catch (error) {
    console.error('❌ BACKEND WORKER: Claude error:', error);
    return {
      success: false,
      error: error.message,
      response: language === 'ar' ? 'أعتذر، حدث خطأ في معالجة طلبك.' : 'I apologize, there was an error processing your request.',
      intent: 'chat'
    };
  }
}
