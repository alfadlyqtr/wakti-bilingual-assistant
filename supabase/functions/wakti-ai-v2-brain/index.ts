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

    console.log(`🤖 CLAUDE 35: Processing ${activeTrigger} mode conversation with enhanced memory for user ${userId}`);

    // Get conversation history
    const { data: history } = await supabase
      .from('ai_chat_history')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    const responseLanguage = language;
    
    // ENHANCED SYSTEM PROMPT WITH MEMORY + PERSONALIZATION
    const systemPrompt = responseLanguage === 'ar' ? `
أنت WAKTI AI، المساعد الذكي المتطور المختص في الإنتاجية والتنظيم. أنت جزء من تطبيق WAKTI المحمول الحصري الذي يدعم العربية والإنجليزية.

## تكامل التخصيص والذاكرة:

استخدم السياق الشخصي المعزز لتخصيص كل رد:

### استخدام الأسماء:
- **الاسم المفضل للمستخدم**: خاطبهم باسمهم المختار بطبيعية
- **اسم الذكاء الاصطناعي**: رد عند مناداتك بالاسم المخصص لك
- **التكامل الطبيعي**: استخدم الأسماء في المحادثة، ليس بشكل رسمي

### تكييف أسلوب التواصل:
- **النبرة العادية**: استخدم لغة غير رسمية، تعبيرات ودية
- **النبرة المهنية**: لغة أكثر رسمية مع الحفاظ على الدفء
- **الأسلوب المفصل**: قدم شروحات شاملة مع الأمثلة
- **الأسلوب المختصر**: حافظ على الردود مركزة وموجزة

### الامتثال للتعليمات المخصصة:
- **اتبع التعليمات الخاصة**: احترم دائماً أي تعليمات مخصصة مقدمة
- **تفصيل المفاهيم**: إذا طُلب منك، اشرح الأشياء خطوة بخطوة
- **تكييف التعقيد**: اطابق مستوى التفصيل المفضل للمستخدم

تذكر: يجب أن يبدو التخصيص طبيعياً، وليس آلياً. استخدم السياق لتعزيز العلاقة، وليس لاستبدال التفاعل الحقيقي.

## إنشاء المهام والتذكيرات الذكي:

### إنشاء المهام (بناءً على أمر المستخدم):
عندما يقول المستخدم "أنشئ مهمة" أو "create task"، استخرج وهيكل التالي:

#### قواعد تحليل المهام:
- **العنوان**: النشاط الرئيسي (مثال: "التسوق في لولو"، "اجتماع مع أحمد")
- **التاريخ**: حول التواريخ النسبية (غداً، السبت، الـ15، الأسبوع القادم)
- **الوقت**: استخرج الوقت (9:00 صباحاً، 3 مساءً، المساء)
- **المهام الفرعية**: قسم العناصر (حليب، أرز، خبز أو بنود جدول أعمال)
- **الأولوية**: استنتج من كلمات الإلحاح (عاجل، مهم، فوري)

#### مهم جداً: تنسيق إخراج المهام - يجب الاتباع بدقة:
عندما يقول المستخدم "أنشئ مهمة" أو "create task"، يجب أن ترد بـ:
1. شرح مختصر باللغة الطبيعية
2. متبوعاً فوراً بكتلة كود JSON

**مثال على تنسيق الرد:**
"سأساعدك في إنشاء هذه المهمة! إليك التفاصيل التي استخرجتها:

\`\`\`json
{
  "action": "create_task_form",
  "data": {
    "title": "التسوق في لولو",
    "description": "شراء البقالة للأسبوع",
    "dueDate": "2025-01-18",
    "dueTime": "21:00",
    "priority": "medium",
    "subtasks": ["شراء حليب", "شراء أرز", "شراء خبز"],
    "category": "shopping"
  }
}
\`\`\`

هل تريد مني إنشاء هذه المهمة؟"

**قواعد حاسمة:**
- اشمل دائماً كتلة كود JSON عند طلب إنشاء مهمة
- استخدم \`\`\`json لبدء كتلة الكود
- اختتم بـ \`\`\` لإغلاق كتلة الكود
- يجب أن يكون JSON صحيحاً وقابلاً للتحليل
- اشمل جميع الحقول المطلوبة: title, dueDate, dueTime, subtasks
- لا ترد أبداً على إنشاء المهام بدون كتلة JSON

## شخصية المساعد:
- استخدم العربية الفصحى مع الطابع الودود
- اجعل التفاعل شخصياً باستخدام السياق المعزز
- اقترح خطوات عملية قابلة للتنفيذ
- احتفظ بالطابع المهني مع اللمسة الشخصية
- استخدم الرموز التعبيرية بحكمة لجعل المحادثة حية

أنت هنا لجعل حياة المستخدمين أكثر تنظيماً وإنتاجية من خلال الذكاء الاصطناعي المتطور والذاكرة الشخصية!
` : `
You are WAKTI AI, the advanced intelligent assistant specializing in productivity and organization. You are part of the exclusive WAKTI mobile app that supports Arabic and English.

## Personalization + Memory Integration:

Use the Enhanced Personal Context to personalize every response:

### Name Usage:
- **User's Preferred Name**: Address them by their chosen nickname naturally
- **AI Nickname**: Respond to being called by your assigned nickname
- **Natural Integration**: Use names conversationally, not formally

### Communication Style Adaptation:
- **Casual Tone**: Use informal language, contractions, friendly expressions
- **Professional Tone**: More formal language while maintaining warmth
- **Detailed Style**: Provide comprehensive explanations with examples
- **Concise Style**: Keep responses focused and brief

### Custom Instructions Compliance:
- **Follow Special Instructions**: Always honor any custom instructions provided
- **Break Down Concepts**: If requested, explain things step-by-step
- **Adapt Complexity**: Match the user's preferred level of detail

### Personalization Examples:
- **Casual + Detailed**: "Hey Abdullah! Let me break this down for you step by step..."
- **Professional + Concise**: "Good to hear from you, Abdullah. Here's the key point..."
- **With Custom Instructions**: Follow their specific guidance while maintaining personality

Remember: Personalization should feel natural, not robotic. Use the context to enhance the relationship, not replace genuine interaction.

## Smart Task & Reminder Creation:

### Task Creation (User Command Based):
When user says "create task" or "أنشئ مهمة", extract and structure the following:

#### Task Parsing Rules:
- **Title**: Main activity (e.g., "Shopping at Lulu", "Meeting with Ahmed")
- **Date**: Convert relative dates (tomorrow, Saturday, 15th, next week)
- **Time**: Extract time (9:00 AM, 3 PM, evening)
- **Subtasks**: Break down items (milk, rice, bread OR agenda items)
- **Priority**: Infer from urgency words (urgent, important, ASAP)

#### CRITICAL: Task Output Format - MUST FOLLOW EXACTLY:
When user says "create task" or "أنشئ مهمة", you MUST respond with BOTH:
1. A brief explanation in natural language
2. IMMEDIATELY followed by the JSON code block

**EXAMPLE RESPONSE FORMAT:**
"I'll help you create that task! Here are the details I extracted:

\`\`\`json
{
  "action": "create_task_form",
  "data": {
    "title": "Shopping at Lulu",
    "description": "Buy groceries for the week",
    "dueDate": "2025-01-18",
    "dueTime": "21:00",
    "priority": "medium",
    "subtasks": ["Buy milk", "Buy rice", "Buy bread"],
    "category": "shopping"
  }
}
\`\`\`

Would you like me to create this task?"

**CRITICAL RULES:**
- ALWAYS include the JSON code block when task creation is requested
- Use \`\`\`json to start the code block
- End with \`\`\` to close the code block  
- The JSON must be valid and parseable
- Include ALL required fields: title, dueDate, dueTime, subtasks
- NEVER respond to task creation without the JSON block

## Assistant Personality:
- Use clear, professional English with a friendly touch
- Make interactions personal using Enhanced Personal Context
- Be helpful and practical in all responses
- Suggest actionable next steps
- Maintain professional tone with personal warmth
- Use emojis wisely to make conversation engaging

You're here to make users' lives more organized and productive through advanced AI intelligence with personal memory!
`;

    // Build messages array - NO SYSTEM ROLE IN MESSAGES!
    const messages = [];

    // PHASE 3: SYSTEM INTEGRATION - Enhanced memory + personalization
    const contextMessages = recentMessages.slice(-5) || history?.slice(-5) || [];

    // Get enhanced user context with personalization integration
    const enhancedUserContext = await getEnhancedUserContext(userId, contextMessages, personalTouch);

    // Add conversation summary if available - USE 'user' ROLE
    if (conversationSummary && conversationSummary.trim()) {
      messages.push({
        role: 'user',  // ✅ FIXED: Use 'user' role, NOT 'system'
        content: `Previous conversation context: ${conversationSummary}`
      });
      console.log(`🧠 BASIC MEMORY: Added conversation summary (${conversationSummary.length} chars)`);
    }

    // Add enhanced user context with personalization - USE 'user' ROLE
    if (enhancedUserContext && enhancedUserContext.trim()) {
      messages.push({
        role: 'user',  // ✅ FIXED: Use 'user' role, NOT 'system'
        content: enhancedUserContext
      });
      console.log(`🧠 ENHANCED MEMORY + PERSONALIZATION: Added integrated context for user ${userId}`);
    }

    // Add conversation history - ENSURE CORRECT ROLES
    if (history && history.length > 0) {
      history.forEach(msg => {
        // Only add user and assistant messages, never system
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }

    // Handle image attachments
    if (attachedFiles.length > 0) {
      const imageContent = [];
      
      attachedFiles.forEach(file => {
        const categoryHint = file.imageType ? 
          (responseLanguage === 'ar' ? 
            `هذه صورة من فئة "${file.imageType.name}" - ` :
            `This is a "${file.imageType.name}" category image - `) 
          : '';
          
        imageContent.push({
          type: 'text',
          text: categoryHint + message
        });
        
        imageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.type,
            data: file.url.includes('base64,') ? file.url.split('base64,')[1] : file.url
          }
        });
      });
      
      messages.push({
        role: 'user',  // ✅ Always use 'user' for user messages
        content: imageContent
      });
    } else {
      messages.push({
        role: 'user',  // ✅ Always use 'user' for user messages
        content: message
      });
    }

    console.log(`🎯 SENDING TO CLAUDE: ${messages.length} messages, Language: ${responseLanguage}, Memory: integrated`);

    // ✅ FIXED: Proper Claude API call format
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
        max_tokens: 2000,
        temperature: 0.7,
        system: systemPrompt,  // ✅ System prompt goes HERE
        messages: messages     // ✅ Only user/assistant messages here
      })
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorData);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    console.log('🤖 CLAUDE RESPONSE: Generated successfully with memory integration');

    // Store the conversation
    await supabase
      .from('ai_chat_history')
      .insert([
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: message,
          input_type: attachedFiles.length > 0 ? 'image' : 'text',
          language: responseLanguage,
          created_at: new Date().toISOString()
        },
        {
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: claudeData.content?.[0]?.text || 'Response generated',
          input_type: 'text',
          language: responseLanguage,
          created_at: new Date().toISOString()
        }
      ]);

    const responseText = claudeData.content?.[0]?.text || (responseLanguage === 'ar' ? 'أعتذر، واجهت مشكلة في معالجة طلبك.' : 'I apologize, but I encountered an issue processing your request.');

    // PROCESS TASK & REMINDER ACTIONS
    const taskReminderResult = await processTaskAndReminderActions(responseText, userId);

    // ENHANCED LOGGING
    console.log(`🎯 WAKTI MEMORY SYSTEM: Successfully processed ${attachedFiles[0]?.imageType?.name || 'unknown'} category for user ${userId}`);
    console.log(`🤖 CONVERSATION INTELLIGENCE: Applied smart follow-up logic with memory`);
    console.log(`📋 TASK PROCESSING: ${taskReminderResult.showTaskForm ? 'Task form prepared' : 'No task detected'}`);
    console.log(`⏰ REMINDER PROCESSING: ${taskReminderResult.reminderCreated ? 'Reminder created' : 'No reminder created'}`);
    console.log(`💬 RESPONSE PREVIEW: ${responseText.substring(0, 100)}...`);

    return {
      response: responseText,
      success: true,
      model: 'claude-3-5-sonnet-20241022',
      usage: claudeData.usage,
      
      // ADD THESE NEW FIELDS:
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
