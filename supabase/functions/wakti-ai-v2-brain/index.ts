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
      activeTrigger = 'general',
      recentMessages = [],
      conversationSummary = '',
      personalTouch = null
    } = requestData;

    // ENSURE PROPER USER ID FOR MEMORY
    const actualUserId = userId || personalTouch?.userId || requestData.user_id || 'default_user';
    console.log('🔍 USER ID CHECK:', { original: userId, personal: personalTouch?.userId, final: actualUserId });

    console.log(`🎯 REQUEST DETAILS: Trigger=${activeTrigger}, Language=${language}, Files=${files.length}, Memory=${personalTouch ? 'enabled' : 'disabled'}, UserId=${actualUserId}`);

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

    let attachedFiles = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const fileName = `wakti-ai-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const fileExt = file.name?.split('.').pop() || 'jpg';
        const filePath = `${fileName}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('wakti-ai-uploads')
          .upload(filePath, file, {
            contentType: file.type,
            cacheControl: '3600'
          });
          
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('wakti-ai-uploads')
            .getPublicUrl(filePath);
            
          const imageTypeData = requestData.imageTypes && requestData.imageTypes.length > 0 
            ? requestData.imageTypes[0] 
            : { id: 'general', name: language === 'ar' ? 'عام' : 'General' };
            
          attachedFiles.push({
            url: urlData.publicUrl,
            type: file.type,
            name: file.name,
            imageType: imageTypeData
          });
          
          console.log(`📎 FILE UPLOADED: ${filePath} (${imageTypeData.name})`);
        }
      }
    }

    const result = await callClaude35API(
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
      
      // ADD TASK & REMINDER FIELDS:
      pendingTaskData: result.taskData || null,
      pendingReminderData: result.reminderData || null,
      showTaskForm: result.showTaskForm || false,
      reminderCreated: result.reminderCreated || false,
      
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
      conversationId: null,
      showTaskForm: false,
      reminderCreated: false
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

    // SMART MODE DETECTION - Auto-detect what the user wants
    let detectedMode = activeTrigger; // Default to current trigger

    // 1. IMAGE DETECTION - If images uploaded, switch to vision mode
    if (attachedFiles && attachedFiles.length > 0) {
      const hasImages = attachedFiles.some(file => file.type?.startsWith('image/'));
      if (hasImages) {
        detectedMode = 'vision';
        console.log('🔍 VISION MODE ACTIVATED: Image detected, switching to vision processing');
      }
    }

    // 2. TASK/REMINDER DETECTION - Check for explicit task creation requests
    else if (message.toLowerCase().includes('create task') || 
             message.toLowerCase().includes('أنشئ مهمة') ||
             message.toLowerCase().includes('add task') ||
             message.toLowerCase().includes('new task')) {
      detectedMode = 'task';
      console.log('📝 TASK MODE ACTIVATED: Task creation detected');
    }

    // 3. CHAT MODE - Everything else
    else {
      detectedMode = 'chat';
      console.log('💬 CHAT MODE ACTIVATED: General conversation detected');
    }

    // Log the smart detection result
    console.log(`🧠 SMART DETECTION: Input mode "${activeTrigger}" → Detected mode "${detectedMode}"`);

    // SKIP TASK PROCESSING FOR VISION MODE
    if (detectedMode === 'vision') {
      console.log('📸 TASK PROCESSING: Skipped (not needed for vision mode)');
    }

    const responseLanguage = language;
    let messages = [];

    // 🧠 CONDITIONAL MEMORY LOADING (not for vision)
    if (detectedMode !== 'vision' && personalTouch) {
      const contextMessages = recentMessages.slice(-3) || [];
      const enhancedUserContext = await getEnhancedUserContext(userId, contextMessages, personalTouch);
      
      if (enhancedUserContext && enhancedUserContext.trim()) {
        messages.push({
          role: 'user',
          content: `Personal context: ${enhancedUserContext}`
        });
        console.log('🧠 MEMORY: Added light personal context');
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
          console.log(`📎 VISION: Adding image ${file.name} to Claude request`);
          
          let imageData;
          if (file.url.includes('base64,')) {
            imageData = file.url.split('base64,')[1];
          } else {
            try {
              const response = await fetch(file.url);
              const arrayBuffer = await response.arrayBuffer();
              const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
              imageData = base64;
            } catch (error) {
              console.error('Failed to fetch image for base64 conversion:', error);
              continue;
            }
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

    // 🎯 MODE-SPECIFIC SYSTEM PROMPTS
    let systemPrompt;
    
    if (detectedMode === 'vision') {
      systemPrompt = responseLanguage === 'ar' ? 
        `أنت WAKTI AI، مساعد ذكي متخصص في تحليل الصور. قم بتحليل الصورة المرفقة بالتفصيل واستخرج جميع المعلومات المفيدة منها. كن دقيقاً ووصفياً في تحليلك. إذا كانت الصورة تحتوي على نص، اقرأه واستخرجه. إذا كانت تحتوي على أشخاص أو أشياء، صفها. إذا كانت وثيقة، لخص محتواها.` :
        `You are WAKTI AI, an intelligent assistant specialized in image analysis. Analyze the attached image in detail and extract all useful information from it. Be precise and descriptive in your analysis. If the image contains text, read and extract it. If it contains people or objects, describe them. If it's a document, summarize its content.`;
    } else if (detectedMode === 'task') {
      systemPrompt = responseLanguage === 'ar' ? 
        `أنت WAKTI AI، مساعد ذكي متخصص في إنشاء المهام والتذكيرات. عندما يطلب المستخدم إنشاء مهمة، استخرج التفاصيل وقدمها في تنسيق JSON محدد.` :
        `You are WAKTI AI, an intelligent assistant specialized in creating tasks and reminders. When users request task creation, extract details and provide them in specific JSON format.`;
    } else {
      systemPrompt = responseLanguage === 'ar' ? 
        `أنت WAKTI AI، المساعد الذكي الودود المتخصص في الإنتاجية. ساعد المستخدم بطريقة مفيدة وودية.` :
        `You are WAKTI AI, a friendly intelligent assistant specialized in productivity. Help the user in a helpful and friendly way.`;
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

    console.log(`✅ CLAUDE RESPONSE: Successfully processed ${detectedMode} request`);

    // 💾 STORE CONVERSATION
    try {
      await supabase.from('ai_chat_history').insert([
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: message,
          input_type: detectedMode === 'vision' ? 'image' : 'text',
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

    // PROCESS TASK & REMINDER ACTIONS - Only for non-vision modes
    let taskReminderResult = { showTaskForm: false, taskData: null, reminderCreated: false, reminderData: null };
    
    if (detectedMode !== 'vision') {
      console.log('📝 TASK PROCESSING: Running task analysis');
      taskReminderResult = await processTaskAndReminderActions(responseText, userId);
    } else {
      console.log('📝 TASK PROCESSING: Skipped for vision mode');
    }

    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage,
      mode: detectedMode,
      showTaskForm: taskReminderResult.showTaskForm,
      taskData: taskReminderResult.taskData,
      reminderCreated: taskReminderResult.reminderCreated,
      reminderData: taskReminderResult.reminderData
    };

  } catch (error) {
    console.error('Claude API Error:', error);
    return {
      success: false,
      error: error.message,
      response: language === 'ar' ? 'أعتذر، حدث خطأ في معالجة طلبك.' : 'I apologize, there was an error processing your request.',
      showTaskForm: false,
      reminderCreated: false
    };
  }
}

// TASK & REMINDER PROCESSING FUNCTIONS
async function processTaskAndReminderActions(responseText, userId) {
  console.log('🎯 PROCESSING TASK & REMINDER ACTIONS');
  
  let result = {
    showTaskForm: false,
    taskData: null,
    reminderCreated: false,
    reminderData: null,
    originalResponse: responseText
  };
  
  // Process task creation requests
  const taskMatch = extractTaskData(responseText);
  if (taskMatch) {
    result.showTaskForm = true;
    result.taskData = await processTaskDateTime(taskMatch);
    console.log('📋 TASK FORM DATA PREPARED:', result.taskData);
  }
  
  // Process reminder creation
  const reminderMatch = extractReminderData(responseText);
  if (reminderMatch) {
    const processedReminder = await processReminderDateTime(reminderMatch);
    const createdReminder = await createReminderInDatabase(processedReminder, userId);
    if (createdReminder) {
      result.reminderCreated = true;
      result.reminderData = createdReminder;
      console.log('⏰ REMINDER CREATED:', createdReminder.id);
    }
  }
  
  return result;
}

// Extract task data from AI response
function extractTaskData(responseText) {
  const taskRegex = /```json\s*(\{[\s\S]*?"action":\s*"create_task_form"[\s\S]*?\})\s*```/g;
  const match = taskRegex.exec(responseText);
  
  if (match) {
    try {
      const taskData = JSON.parse(match[1]);
      return taskData.data;
    } catch (error) {
      console.error('Failed to parse task JSON:', error);
    }
  }
  return null;
}

// Extract reminder data from AI response
function extractReminderData(responseText) {
  const reminderRegex = /```json\s*(\{[\s\S]*?"action":\s*"create_reminder"[\s\S]*?\})\s*```/g;
  const match = reminderRegex.exec(responseText);
  
  if (match) {
    try {
      const reminderData = JSON.parse(match[1]);
      return reminderData.data;
    } catch (error) {
      console.error('Failed to parse reminder JSON:', error);
    }
  }
  return null;
}

// Process and convert task date/time
async function processTaskDateTime(taskData) {
  const today = new Date();
  let dueDate = taskData.dueDate;
  
  // Convert relative dates to actual dates
  if (typeof dueDate === 'string') {
    const lowerDate = dueDate.toLowerCase();
    
    if (lowerDate.includes('tomorrow') || lowerDate.includes('غداً')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      dueDate = tomorrow.toISOString().split('T')[0];
    } else if (lowerDate.includes('saturday') || lowerDate.includes('السبت')) {
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
      const nextSaturday = new Date(today);
      nextSaturday.setDate(today.getDate() + daysUntilSaturday);
      dueDate = nextSaturday.toISOString().split('T')[0];
    } else if (lowerDate.includes('sunday') || lowerDate.includes('الأحد')) {
      const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
      const nextSunday = new Date(today);
      nextSunday.setDate(today.getDate() + daysUntilSunday);
      dueDate = nextSunday.toISOString().split('T')[0];
    }
    // Add more day conversions as needed...
  }
  
  return {
    ...taskData,
    dueDate: dueDate,
    parsedDateTime: `${dueDate}T${taskData.dueTime || '09:00'}:00Z`
  };
}

// Process reminder date/time
async function processReminderDateTime(reminderData) {
  // Similar processing for reminders
  return {
    ...reminderData,
    reminderDateTime: `${reminderData.reminderDate}T${reminderData.reminderTime || '09:00'}:00Z`
  };
}

// Create reminder in database
async function createReminderInDatabase(reminderData, userId) {
  try {
    const reminder = {
      user_id: userId,
      title: reminderData.title,
      description: reminderData.description || '',
      due_date: reminderData.reminderDate,
      due_time: reminderData.reminderTime || '09:00',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('tr_reminders')
      .insert([reminder])
      .select()
      .single();
      
    if (error) {
      console.error('Failed to create reminder:', error);
      return null;
    }
    
    console.log('✅ REMINDER CREATED IN DATABASE:', data.id);
    return data;
  } catch (error) {
    console.error('Database error creating reminder:', error);
    return null;
  }
}
