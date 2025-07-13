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

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("WAKTI AI V2 BRAIN: Ultra-Smart System Initialized with Task & Reminder Intelligence + Memory");

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
    console.log("🧠 WAKTI AI V2: Processing super-intelligent request with memory");
    
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

    // DEBUG: Check what files we have
    console.log(`🔍 DEBUG ATTACHED FILES:`, {
      requestDataFiles: !!requestData.files,
      requestAttachedFiles: !!requestAttachedFiles,
      attachedFilesLength: requestAttachedFiles?.length || 0,
      processedFilesLength: attachedFiles.length,
      attachedFilesContent: requestAttachedFiles?.map(f => ({
        name: f.name,
        type: f.type,
        hasUrl: !!f.url,
        imageType: f.imageType?.name
      })) || []
    });

    const result = await callClaude35API(
      message,
      finalConversationId,
      actualUserId,
      language,
      attachedFiles, // Use the processed files
      activeTrigger,
      recentMessages,
      conversationSummary,
      personalTouch
    );

    const finalResponse = {
      response: result.response || 'Response received',
      conversationId: finalConversationId,
      intent: activeTrigger,
      confidence: 'high',
      actionTaken: null,
      imageUrl: result.imageUrl || null,
      browsingUsed: activeTrigger === 'search',
      browsingData: null,
      needsConfirmation: false,
      
      success: result.success !== false,
      processingTime: Date.now(),
      aiProvider: 'claude-3-5-sonnet-20241022',
      claude35Enabled: true,
      mode: activeTrigger,
      fallbackUsed: false
    };

    console.log(`✅ WAKTI AI V2: Successfully processed ${activeTrigger} request with memory for user ${actualUserId}`);
    
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
    
    // DEBUG: Check what's in attachedFiles
    console.log(`🔍 DEBUG ATTACHED FILES IN CLAUDE CALL:`, {
      attachedFilesExists: !!attachedFiles,
      attachedFilesLength: attachedFiles?.length || 0,
      attachedFilesContent: attachedFiles?.map(f => ({
        name: f.name,
        type: f.type,
        hasUrl: !!f.url,
        imageType: f.imageType?.name
      })) || []
    });

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

    // Override only if explicitly requested
    if (activeTrigger === 'search') {
      detectedMode = 'search';
    } else if (activeTrigger === 'image') {
      detectedMode = 'image';
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

    // 💾 STORE CONVERSATION
    try {
      // PROPER INPUT TYPE FOR DATABASE - FIX THE CONSTRAINT VIOLATION
      const inputType = detectedMode === 'vision' ? 'image' : 'text';

      await supabase.from('ai_chat_history').insert([
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: message,
          input_type: inputType, // Use proper input type that matches database constraints
          language: responseLanguage,
          created_at: new Date().toISOString()
        },
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: responseText,
          input_type: 'text',
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
      mode: detectedMode // Return the actual detected mode
    };

  } catch (error) {
    console.error('Claude API Error:', error);
    return {
      success: false,
      error: error.message,
      response: language === 'ar' ? 'أعتذر، حدث خطأ في معالجة طلبك.' : 'I apologize, there was an error processing your request.'
    };
  }
}
