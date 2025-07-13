import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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

console.log("WAKTI AI V2 BRAIN: Ultra-Smart System Initialized with Perfect API Routing");

// RUNWARE IMAGE GENERATION FUNCTION
async function generateImageWithRunware(prompt: string, userId: string, language: string = 'en') {
  console.log('🎨 IMAGE GEN: Starting generation for:', prompt.substring(0, 50));
  
  if (!RUNWARE_API_KEY) {
    return {
      success: false,
      error: language === 'ar' 
        ? 'خدمة إنشاء الصور غير متاحة' 
        : 'Image generation service not configured',
      response: language === 'ar' 
        ? 'أعتذر، خدمة إنشاء الصور غير متاحة حالياً.'
        : 'I apologize, image generation service is not available at the moment.'
    };
  }

  try {
    const taskUUID = crypto.randomUUID();
    
    const imageGenPayload = [
      {
        taskType: "authentication",
        apiKey: RUNWARE_API_KEY
      },
      {
        taskType: "imageInference",
        taskUUID: taskUUID,
        positivePrompt: prompt,
        width: 1024,
        height: 1024,
        model: "runware:100@1",
        numberResults: 1,
        outputFormat: "WEBP"
      }
    ];

    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imageGenPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ IMAGE API ERROR:', response.status, errorText);
      throw new Error(`Image generation API error: ${response.status}`);
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from image generation service');
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ IMAGE JSON parsing error:', jsonError);
      throw new Error('Invalid JSON response from image generation service');
    }

    if (responseData && responseData.data && Array.isArray(responseData.data)) {
      const imageResult = responseData.data.find((item: any) => item.taskType === 'imageInference');
      
      if (imageResult && imageResult.imageURL) {
        console.log('✅ IMAGE GEN: Successfully generated image');
        return {
          success: true,
          error: null,
          response: language === 'ar' 
            ? `🎨 تم إنشاء الصورة بنجاح!\n\n![Generated Image](${imageResult.imageURL})\n\nالوصف: ${prompt}`
            : `🎨 Image generated successfully!\n\n![Generated Image](${imageResult.imageURL})\n\nPrompt: ${prompt}`,
          imageUrl: imageResult.imageURL
        };
      }
    }

    console.warn('⚠️ IMAGE GEN: No valid image URL in response');
    return {
      success: false,
      error: language === 'ar' ? 'لم يتم إنشاء الصورة بنجاح' : 'Image generation failed',
      response: language === 'ar' 
        ? 'أعتذر، لم أتمكن من إنشاء الصورة. يرجى المحاولة مرة أخرى.'
        : 'I apologize, I could not generate the image. Please try again.'
    };

  } catch (error) {
    console.error('❌ IMAGE GEN: Critical error:', error);
    
    return {
      success: false,
      error: language === 'ar' ? 'خطأ في إنشاء الصورة' : 'Image generation failed',
      response: language === 'ar' 
        ? 'أعتذر، حدث خطأ أثناء إنشاء الصورة. يرجى المحاولة مرة أخرى.'
        : 'I apologize, there was an error generating the image. Please try again.'
    };
  }
}

// TAVILY SEARCH FUNCTION
async function performSearchWithTavily(query: string, userId: string, language: string = 'en') {
  console.log('🔍 SEARCH: Starting search for:', query.substring(0, 50));
  
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
      const errorText = await response.text();
      console.error('❌ SEARCH API ERROR:', response.status, errorText);
      throw new Error(`Search API error: ${response.status}`);
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from search service');
    }

    let searchData;
    try {
      searchData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('❌ SEARCH JSON parsing error:', jsonError);
      throw new Error('Invalid JSON response from search service');
    }

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

    console.log(`✅ SEARCH: Found ${results.length} results`);
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
    console.error('❌ SEARCH: Critical error:', error);
    
    return {
      success: false,
      error: language === 'ar' ? 'فشل البحث' : 'Search failed',
      response: language === 'ar' 
        ? 'أعتذر، حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.'
        : 'I apologize, there was an error during the search. Please try again.'
    };
  }
}

// PHASE 2: MEMORY FUNCTIONS IMPLEMENTATION

// Get stored user memory context
async function getUserMemoryContext(userId) {
  try {
    const { data, error } = await supabase
      .from('user_memory_context')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user memory context:', error);
      return null;
    }

    console.log('📚 MEMORY: Retrieved stored context for user');
    return data;
  } catch (error) {
    console.error('getUserMemoryContext error:', error);
    return null;
  }
}

// Analyze current conversation for contextual insights
function analyzeConversationForContext(recentMessages) {
  const context = {
    relationshipTone: 'neutral',
    communicationStyle: 'friendly',
    projectContext: '',
    workingPattern: 'normal',
    achievements: [],
    expertise: [],
    helpStyle: 'balanced'
  };

  if (!recentMessages || recentMessages.length === 0) {
    return context;
  }

  const allMessages = recentMessages.map(msg => msg.content?.toLowerCase() || '').join(' ');

  // Analyze relationship tone
  if (allMessages.includes('buddy') || allMessages.includes('friend') || allMessages.includes('dude')) {
    context.relationshipTone = 'casual_buddy';
  } else if (allMessages.includes('sir') || allMessages.includes('please') || allMessages.includes('thank you')) {
    context.relationshipTone = 'respectful';
  } else if (allMessages.includes('hey') || allMessages.includes('yo') || allMessages.includes('sup')) {
    context.relationshipTone = 'casual';
  }

  // Analyze communication patterns
  if (allMessages.includes('briefly') || allMessages.includes('quick') || allMessages.includes('short')) {
    context.communicationStyle = 'concise';
  } else if (allMessages.includes('detail') || allMessages.includes('explain') || allMessages.includes('elaborate')) {
    context.communicationStyle = 'detailed';
  }

  // Extract project context
  const projectKeywords = ['project', 'app', 'website', 'application', 'system', 'platform'];
  for (const keyword of projectKeywords) {
    const regex = new RegExp(`(\\w+\\s+${keyword}|${keyword}\\s+\\w+)`, 'gi');
    const matches = allMessages.match(regex);
    if (matches && matches.length > 0) {
      context.projectContext = matches[0];
      break;
    }
  }

  // Analyze working patterns
  if (allMessages.includes('night') || allMessages.includes('late') || allMessages.includes('evening')) {
    context.workingPattern = 'night_owl';
  } else if (allMessages.includes('morning') || allMessages.includes('early') || allMessages.includes('dawn')) {
    context.workingPattern = 'early_bird';
  }

  // Extract achievements
  const achievementKeywords = ['completed', 'finished', 'done', 'achieved', 'success', 'working'];
  for (const keyword of achievementKeywords) {
    const regex = new RegExp(`(\\w+\\s+${keyword}|${keyword}\\s+\\w+)`, 'gi');
    const matches = allMessages.match(regex);
    if (matches) {
      context.achievements.push(...matches.slice(0, 2)); // Limit to 2 achievements
    }
  }

  // Extract expertise areas
  const techKeywords = ['react', 'javascript', 'python', 'ai', 'database', 'api', 'frontend', 'backend'];
  for (const keyword of techKeywords) {
    if (allMessages.includes(keyword)) {
      context.expertise.push(keyword);
    }
  }

  console.log('🔍 CONVERSATION ANALYSIS: Extracted context insights');
  return context;
}

// Merge personalization settings with stored memory context
function mergePersonalizationWithMemory(storedContext, personalTouch) {
  const merged = storedContext || {};
  
  if (personalTouch) {
    if (personalTouch.nickname) {
      merged.preferred_nickname = personalTouch.nickname;
    }
    
    if (personalTouch.aiNickname) {
      merged.ai_nickname = personalTouch.aiNickname;
    }
    
    if (personalTouch.tone) {
      merged.preferred_tone = personalTouch.tone;
      merged.communication_style = personalTouch.tone === 'casual' ? 'informal' : 
                                   personalTouch.tone === 'professional' ? 'formal' : 'friendly';
    }
    
    if (personalTouch.style) {
      merged.reply_style = personalTouch.style;
    }
    
    if (personalTouch.instruction) {
      merged.custom_instructions = personalTouch.instruction;
    }
  }
  
  console.log('🔗 PERSONALIZATION MERGE: Combined settings with memory');
  return merged;
}

// Build personalized memory prompt
function buildPersonalizedMemoryPrompt(mergedContext, conversationContext) {
  let prompt = 'Enhanced Personal Context: ';
  
  // User's preferred nickname
  if (mergedContext.preferred_nickname) {
    prompt += `User name: ${mergedContext.preferred_nickname}. `;
  }
  
  // AI's nickname
  if (mergedContext.ai_nickname) {
    prompt += `AI name: ${mergedContext.ai_nickname}. `;
  }
  
  // Communication style from personalization
  const commStyle = mergedContext.communication_style || conversationContext.communicationStyle || 'friendly';
  prompt += `Communication: ${commStyle}. `;
  
  // Preferred tone
  if (mergedContext.preferred_tone) {
    prompt += `Tone: ${mergedContext.preferred_tone}. `;
  }
  
  // Reply style
  if (mergedContext.reply_style) {
    prompt += `Style: ${mergedContext.reply_style}. `;
  }
  
  // Custom instructions
  if (mergedContext.custom_instructions) {
    prompt += `Instructions: ${mergedContext.custom_instructions}. `;
  }
  
  // Relationship context from conversation analysis
  const relationshipStyle = conversationContext.relationshipTone || mergedContext.relationship_style || 'friendly';
  if (relationshipStyle !== 'neutral') {
    prompt += `Relationship: ${relationshipStyle}. `;
  }
  
  // Project context
  if (conversationContext.projectContext || mergedContext.current_projects) {
    prompt += `Project: ${conversationContext.projectContext || mergedContext.current_projects}. `;
  }
  
  // Working patterns
  if (conversationContext.workingPattern !== 'normal' || mergedContext.working_patterns) {
    prompt += `Working style: ${conversationContext.workingPattern || mergedContext.working_patterns}. `;
  }
  
  // Recent achievements
  if (mergedContext.recent_achievements) {
    prompt += `Recent wins: ${mergedContext.recent_achievements}. `;
  }
  
  // Interaction history
  if (mergedContext.interaction_count && mergedContext.interaction_count > 1) {
    prompt += `History: ${mergedContext.interaction_count} previous conversations. `;
  }
  
  // User expertise
  if (conversationContext.expertise.length > 0 || mergedContext.user_expertise) {
    const expertise = conversationContext.expertise.length > 0 ? 
      conversationContext.expertise.join(', ') : 
      (mergedContext.user_expertise || []).join(', ');
    if (expertise) {
      prompt += `Expertise: ${expertise}. `;
    }
  }
  
  console.log('🧠 MEMORY PROMPT: Built personalized context');
  return prompt.trim();
}

// Update user memory context with new insights and personalization
async function updateUserMemoryContext(userId, conversationContext, existingContext, personalTouch) {
  try {
    const updates = {
      user_id: userId,
      last_interaction: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      interaction_count: (existingContext?.interaction_count || 0) + 1
    };
    
    // Update from personalization settings
    if (personalTouch) {
      if (personalTouch.nickname) {
        updates.preferred_nickname = personalTouch.nickname;
      }
      
      if (personalTouch.aiNickname) {
        updates.ai_nickname = personalTouch.aiNickname;
      }
      
      if (personalTouch.tone) {
        updates.preferred_tone = personalTouch.tone;
        updates.communication_style = personalTouch.tone === 'casual' ? 'informal' : 
                                     personalTouch.tone === 'professional' ? 'formal' : 'friendly';
      }
      
      if (personalTouch.style) {
        updates.reply_style = personalTouch.style;
      }
      
      if (personalTouch.instruction) {
        updates.custom_instructions = personalTouch.instruction;
      }
    }
    
    // Update from conversation analysis
    if (conversationContext.relationshipTone !== 'neutral') {
      updates.relationship_style = conversationContext.relationshipTone;
    }
    
    // Update project context
    if (conversationContext.projectContext) {
      updates.current_projects = conversationContext.projectContext;
    }
    
    // Update working patterns
    if (conversationContext.workingPattern !== 'normal') {
      updates.working_patterns = conversationContext.workingPattern;
    }
    
    // Update achievements
    if (conversationContext.achievements.length > 0) {
      const newAchievements = conversationContext.achievements.join(', ');
      updates.recent_achievements = existingContext?.recent_achievements 
        ? `${existingContext.recent_achievements}, ${newAchievements}`
        : newAchievements;
    }
    
    // Update expertise
    if (conversationContext.expertise.length > 0) {
      updates.user_expertise = conversationContext.expertise;
    }
    
    await supabase
      .from('user_memory_context')
      .upsert(updates, { onConflict: 'user_id' });
      
    console.log('✅ MEMORY UPDATE: User context updated with personalization data');
  } catch (error) {
    console.error('Failed to update user memory:', error);
  }
}

// Main enhanced user context function
async function getEnhancedUserContext(userId, recentMessages, personalTouch) {
  console.log('🧠 GETTING ENHANCED USER CONTEXT WITH PERSONALIZATION');
  
  try {
    // Get stored user context
    const storedContext = await getUserMemoryContext(userId);
    
    // Analyze current conversation for context clues
    const conversationContext = analyzeConversationForContext(recentMessages);
    
    // Merge personalization data with stored context
    const mergedContext = mergePersonalizationWithMemory(storedContext, personalTouch);
    
    // Build enhanced memory prompt
    const memoryPrompt = buildPersonalizedMemoryPrompt(mergedContext, conversationContext);
    
    // Update user context with new insights AND personalization data (fire-and-forget)
    updateUserMemoryContext(userId, conversationContext, mergedContext, personalTouch).catch(console.error);
    
    return memoryPrompt;
  } catch (error) {
    console.error('Enhanced memory error:', error);
    return null;
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Enhanced preflight handling for image uploads
  if (req.method === "OPTIONS") {
    console.log("🔧 PREFLIGHT: Handling OPTIONS request from origin:", origin);
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
    console.log("🧠 WAKTI AI V2: Processing super-intelligent request with perfect routing");
    
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

    // ENSURE PROPER USER ID FOR MEMORY
    const actualUserId = userId || personalTouch?.userId || requestData.user_id || 'default_user';
    console.log('🔍 USER ID CHECK:', { original: userId, personal: personalTouch?.userId, final: actualUserId });

    console.log(`🎯 REQUEST DETAILS: Trigger=${activeTrigger}, Language=${language}, Files=${files.length}, AttachedFiles=${requestAttachedFiles.length}, Memory=${personalTouch ? 'enabled' : 'disabled'}, UserId=${actualUserId}`);

    let finalConversationId = conversationId;
    
    if (!finalConversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from('ai_conversations')
        .insert([{
          user_id: actualUserId,
          title: message.substring(0, 50) || 'New Wakti AI Chat',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        }])
        .select('id')
        .single();
        
      if (convError) {
        console.error('Conversation creation error:', convError);
        throw new Error('Failed to create conversation');
      }
      
      finalConversationId = newConversation.id;
      console.log(`💬 NEW CONVERSATION: Created ID ${finalConversationId}`);
    }

    // USE EXISTING UPLOADED FILES INSTEAD OF RE-UPLOADING
    let attachedFiles = [];
    
    // Use already uploaded files from SimplifiedFileUpload instead of re-uploading
    if (requestAttachedFiles && requestAttachedFiles.length > 0) {
      console.log(`📎 TRUE CLAUDE WAY: Using ${requestAttachedFiles.length} pure base64 files`);
      
      attachedFiles = requestAttachedFiles.map(file => ({
        url: file.url,
        type: file.type,
        name: file.name,
        imageType: file.imageType || { id: 'general', name: language === 'ar' ? 'عام' : 'General' }
      }));
      
      attachedFiles.forEach(file => {
        console.log(`📎 CLAUDE WAY FILE: ${file.name} (${file.imageType.name}) - Pure base64 data ready`);
      });
    }

    // 🚨 CRITICAL FIX: PERFECT API ROUTING BASED ON MODE
    console.log(`🎯 PERFECT ROUTING: Mode=${activeTrigger}, HasImages=${attachedFiles.length > 0}`);

    let result;
    
    // ROUTE TO CORRECT API BASED ON MODE
    if (activeTrigger === 'image') {
      console.log('🎨 ROUTING TO RUNWARE: Image generation mode');
      result = await generateImageWithRunware(message, actualUserId, language);
      result.mode = 'image';
      result.intent = 'image';
    } else if (activeTrigger === 'search') {
      console.log('🔍 ROUTING TO TAVILY: Search mode');
      result = await performSearchWithTavily(message, actualUserId, language);
      result.mode = 'search';
      result.intent = 'search';
    } else {
      console.log('🤖 ROUTING TO CLAUDE: Chat/Vision mode');
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
      aiProvider: result.mode === 'image' ? 'runware' : result.mode === 'search' ? 'tavily' : 'claude-3-5-sonnet-20241022',
      claude35Enabled: true,
      mode: result.mode || activeTrigger,
      fallbackUsed: false
    };

    console.log(`✅ WAKTI AI V2: Successfully processed ${activeTrigger} request with perfect routing for user ${actualUserId}`);
    
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
    console.error("❌ WAKTI AI V2 ERROR:", error);
    return new Response(JSON.stringify({
      error: error.message || 'Processing failed',
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

    console.log(`🧠 WAKTI AI V2: Processing ${activeTrigger} mode conversation`);
    
    // PROPER MODE DETECTION - ONLY VISION WHEN IMAGES PRESENT
    let detectedMode = 'chat'; // DEFAULT TO CHAT

    // Check if images are actually attached
    if (attachedFiles && attachedFiles.length > 0) {
      const hasImages = attachedFiles.some(file => file.type?.startsWith('image/'));
      if (hasImages) {
        detectedMode = 'vision';
        console.log('🔍 VISION MODE: Images detected, switching to vision processing');
      } else {
        detectedMode = 'chat';
        console.log('💬 CHAT MODE: No images found, using chat mode');
      }
    } else {
      detectedMode = 'chat';
      console.log('💬 CHAT MODE: No attachedFiles, using chat mode');
    }

    console.log(`🧠 MODE DETECTION RESULT: "${detectedMode}" (trigger: "${activeTrigger}", hasFiles: ${!!attachedFiles?.length})`);

    const responseLanguage = language;
    let messages = [];

    // 🧠 MEMORY LOADING - RESTORE FOR ALL MODES EXCEPT VISION
    let memoryPrompt = '';
    if (detectedMode !== 'vision' && personalTouch) {
      const contextMessages = recentMessages.slice(-3) || [];
      const enhancedUserContext = await getEnhancedUserContext(userId, contextMessages, personalTouch);
      if (enhancedUserContext && enhancedUserContext.trim()) {
        memoryPrompt = enhancedUserContext;
        console.log('🧠 MEMORY: Added personal context for', detectedMode, 'mode');
      }
    }

    // 👁️ VISION PROCESSING - SPECIALIZED
    if (detectedMode === 'vision') {
      console.log('👁️ VISION: Building image analysis request...');
      
      const visionContent = [];
      
      visionContent.push({
        type: 'text',
        text: message || 'Analyze this image and describe what you see in detail.'
      });

      for (const file of attachedFiles) {
        if (file.type?.startsWith('image/')) {
          console.log(`📎 TRUE CLAUDE WAY: Processing ${file.name} with image type: ${file.imageType?.name}`);
          
          // TRUE CLAUDE WAY: Direct base64 data URL processing
          let imageData;
          if (file.url.startsWith('data:')) {
            // Extract base64 data from data URL
            imageData = file.url.split(',')[1];
            console.log('✅ CLAUDE WAY: Extracted base64 data from data URL');
          } else {
            // This shouldn't happen with the new flow, but fallback
            console.error('❌ Expected base64 data URL, got:', file.url.substring(0, 50));
            throw new Error('Invalid image data format - expected base64 data URL');
          }

          // Add image type context to improve analysis
          if (file.imageType && file.imageType.id !== 'general') {
            console.log(`🏷️ SPECIALIZED ANALYSIS: ${file.imageType.name} - Adding context`);
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
      messages.push({
        role: 'user',
        content: message
      });
    }

    // MODE-SPECIFIC SYSTEM PROMPTS
    let systemPrompt;
    if (detectedMode === 'vision') {
      systemPrompt = responseLanguage === 'ar' 
        ? `أنت WAKTI AI، مساعد ذكي متخصص في تحليل الصور. قم بتحليل الصورة المرفقة بالتفصيل واستخرج جميع المعلومات المفيدة منها. كن دقيقاً ووصفياً في تحليلك. إذا كانت الصورة تحتوي على نص، اقرأه واستخرجه. إذا كانت تحتوي على أشخاص أو أشياء، صفها. إذا كانت وثيقة، لخص محتواها.`
        : `You are WAKTI AI, an intelligent assistant specialized in image analysis. Analyze the attached image in detail and extract all useful information from it. Be precise and descriptive in your analysis. If the image contains text, read and extract it. If it contains people or objects, describe them. If it's a document, summarize its content.`;
    } else {
      // REGULAR CHAT MODE WITH MEMORY
      const basePrompt = responseLanguage === 'ar' 
        ? `أنت WAKTI AI، المساعد الذكي الودود المتخصص في الإنتاجية. ساعد المستخدم بطريقة مفيدة وودية.`
        : `You are WAKTI AI, a friendly intelligent assistant specialized in productivity. Help the user in a helpful and friendly way.`;
      
      systemPrompt = memoryPrompt ? `${basePrompt}\n\n${memoryPrompt}` : basePrompt;
    }

    console.log(`🤖 CALLING CLAUDE: Mode=${detectedMode}, Messages=${messages.length}, Language=${responseLanguage}`);

    // 📡 CLAUDE API CALL
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
      console.error('Claude API error:', claudeResponse.status, errorData);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || (responseLanguage === 'ar' ? 'أعتذر، واجهت مشكلة في معالجة طلبك.' : 'I apologize, but I encountered an issue processing your request.');

    console.log(`✅ CLAUDE RESPONSE: Successfully processed ${detectedMode} request with TRUE CLAUDE WAY`);

    // 💾 STORE CONVERSATION WITH FIXED INTENT FIELD
    try {
      // PROPER INPUT TYPE FOR DATABASE - FIX THE CONSTRAINT VIOLATION
      const inputType = detectedMode === 'vision' ? 'image' : 'text';

      await supabase.from('ai_chat_history').insert([
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: message,
          input_type: inputType,
          intent: detectedMode, // 🚨 CRITICAL FIX: ADD INTENT FIELD
          language: responseLanguage,
          created_at: new Date().toISOString()
        },
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: responseText,
          input_type: 'text',
          intent: detectedMode, // 🚨 CRITICAL FIX: ADD INTENT FIELD
          language: responseLanguage,
          created_at: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Failed to store conversation:', error);
    }

    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage,
      mode: detectedMode,
      intent: detectedMode // Return the actual detected mode as intent
    };

  } catch (error) {
    console.error('Claude API Error:', error);
    return {
      success: false,
      error: error.message,
      response: language === 'ar' ? 'أعتذر، حدث خطأ في معالجة طلبك.' : 'I apologize, there was an error processing your request.',
      intent: 'chat'
    };
  }
}
