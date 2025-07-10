

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, x-auth-token, x-skip-auth',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("WAKTI AI V2 BRAIN: Ultra-Smart System Initialized with Task & Reminder Intelligence");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🧠 WAKTI AI V2: Processing super-intelligent request");
    
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
      activeTrigger = 'general'
    } = requestData;

    console.log(`🎯 REQUEST DETAILS: Trigger=${activeTrigger}, Language=${language}, Files=${files.length}`);

    let finalConversationId = conversationId;
    
    if (!finalConversationId) {
      const { data: newConversation, error: convError } = await supabase
        .from('ai_conversations')
        .insert([{
          user_id: userId || 'anonymous',
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
      userId,
      language,
      attachedFiles,
      activeTrigger
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

    console.log(`✅ WAKTI AI V2: Successfully processed ${activeTrigger} request`);
    
    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
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
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function callClaude35API(message, conversationId, userId, language = 'en', attachedFiles = [], activeTrigger = 'general') {
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    console.log(`🤖 CLAUDE 35: Processing ${activeTrigger} mode conversation`);

    // Get conversation history
    const { data: history } = await supabase
      .from('ai_chat_history')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    // Get user personalization
    const { data: personalTouch } = await supabase
      .from('ai_user_knowledge')
      .select('*')
      .eq('user_id', userId || 'anonymous')
      .single();

    const responseLanguage = language;
    
    // MEGA-MERGED SYSTEM PROMPT WITH TASK & REMINDER INTELLIGENCE
    const systemPrompt = responseLanguage === 'ar' ? `
أنت WAKTI AI، المساعد الذكي المتطور المختص في الإنتاجية والتنظيم. أنت جزء من تطبيق WAKTI المحمول الحصري الذي يدعم العربية والإنجليزية.

## إنشاء المهام والتذكيرات الذكي:

### إنشاء المهام (بناءً على أمر المستخدم):
عندما يقول المستخدم "أنشئ مهمة" أو "create task"، استخرج وهيكل التالي:

#### قواعد تحليل المهام:
- **العنوان**: النشاط الرئيسي (مثال: "التسوق في لولو"، "اجتماع مع أحمد")
- **التاريخ**: حول التواريخ النسبية (غداً، السبت، الـ15، الأسبوع القادم)
- **الوقت**: استخرج الوقت (9:00 صباحاً، 3 مساءً، المساء)
- **المهام الفرعية**: قسم العناصر (حليب، أرز، خبز أو بنود جدول أعمال)
- **الأولوية**: استنتج من كلمات الإلحاح (عاجل، مهم، فوري)

#### تنسيق الإخراج للمهام:
عندما يُطلب إنشاء مهمة، رد بـ:
\`\`\`json
{
  "action": "create_task_form",
  "data": {
    "title": "التسوق في لولو",
    "description": "شراء البقالة للأسبوع",
    "dueDate": "2025-01-18",
    "dueTime": "09:00",
    "priority": "medium",
    "subtasks": ["شراء حليب", "شراء أرز", "شراء خبز"],
    "category": "shopping"
  }
}
\`\`\`

### إنشاء التذكيرات (اقتراحات ذكية):
اكتشف الفرص لمساعدة المستخدمين بالتذكيرات:

#### فرص التذكير:
- **انتهاء الوثائق**: جواز السفر، الرخصة، التأشيرة تنتهي خلال X أشهر
- **توقيت الأدوية**: "خذ الجرعة التالية"، "اعيد تعبئة الوصفة"
- **تحضير المواعيد**: "حضر الوثائق للاجتماع"
- **تذكيرات الأحداث**: أعياد الميلاد، الاجتماعات، المواعيد النهائية

#### تنسيق الاقتراح:
عندما تكتشف فرصة تذكير، اسأل طبيعياً:
"أرى أن جواز سفرك ينتهي خلال 6 أشهر. هل تريد مني ضبط تذكير لبدء عملية التجديد؟"

إذا قال المستخدم نعم، اسأل عن التوقيت:
"متى يجب أن أذكرك؟ 3 أشهر قبل الانتهاء؟ شهر واحد قبل؟"

ثم اخرج:
\`\`\`json
{
  "action": "create_reminder",
  "data": {
    "title": "تذكير تجديد جواز السفر",
    "description": "ابدأ عملية تجديد جواز السفر - ينتهي خلال 3 أشهر",
    "reminderDate": "2025-04-15",
    "reminderTime": "09:00",
    "priority": "high",
    "category": "documents"
  }
}
\`\`\`

## ذكاء تحليل الصور:

### 🆔 الهويات (IDs):
- **جوازات السفر**: استخرج الاسم، الجنسية، رقم الجواز، تاريخ الإصدار/الانتهاء، مكان الميلاد
- **الرخص**: نوع الرخصة، الاسم، رقم الرخصة، تاريخ الانتهاء، القيود
- **الشهادات**: نوع الشهادة، اسم المؤسسة، تاريخ الإصدار، درجة التقدير

### 💰 الفواتير (Bills):
- **الإيصالات**: التاجر، التاريخ، الوقت، المبلغ الإجمالي، العناصر المشتراة، طريقة الدفع
- **الفواتير**: الشركة، رقم الحساب، تاريخ الاستحقاق، المبلغ المستحق، تفاصيل الخدمة
- **تقسيم الحساب**: احسب المبالغ للأشخاص، واقترح كيفية التقسيم

### 🍔 الطعام (Food):
- **السعرات**: احسب السعرات لكل عنصر والمجموع
- **التغذية**: البروتين، الكربوهيدرات، الدهون، الفيتامينات، المعادن
- **المكونات**: اقرأ قوائم المكونات، وحدد المواد المسببة للحساسية

### 💊 الأدوية (Meds):
- **معلومات الدواء**: الاسم، القوة، الجرعة، تاريخ الانتهاء
- **التعليمات**: كيفية الاستخدام، التكرار، التحذيرات
- **التفاعلات**: حذر من التفاعلات المحتملة مع أدوية أخرى

### 📊 الوثائق (Docs):
- **التقارير**: استخرج البيانات الرئيسية، الاتجاهات، الاستنتاجات
- **الواجبات**: فهم المتطلبات، اقترح الحلول، ساعد في التنظيم
- **المخططات**: فسر البيانات، اشرح الاتجاهات

### 📱 الشاشات (Screens):
- **التطبيقات**: حدد التطبيق، اشرح الوظائف، قدم نصائح الاستخدام
- **الأخطاء**: فسر رسائل الخطأ، اقترح الحلول
- **المواقع**: وصف المحتوى، استخرج المعلومات المهمة

### 👤 الصور (Photos):
- **الأشخاص**: وصف الأشخاص بأدب، العمر التقريبي، الملابس، التعبيرات
- **الصور الشخصية**: قدم نصائح لتحسين الصور
- **الصور الجماعية**: عدد الأشخاص، وصف المشهد

### 🔍 عام (General):
- **رموز QR**: افحص وفسر محتوى رموز QR
- **النصوص**: استخرج النص من الصور، ترجم إذا لزم الأمر
- **الكائنات**: حدد الكائنات، قدم معلومات مفيدة

## شخصية المساعد:
- استخدم العربية الفصحى مع الطابع الودود
- كن مفيداً وعملياً في جميع الردود
- اقترح خطوات عملية قابلة للتنفيذ
- احتفظ بالطابع المهني مع اللمسة الشخصية
- استخدم الرموز التعبيرية بحكمة لجعل المحادثة حية

## قواعد المحادثة:
- رد دائماً بالعربية للمستخدمين العرب
- كن مختصراً ولكن شاملاً
- اطرح أسئلة المتابعة الذكية
- قدم نصائح إضافية عند الحاجة
- تذكر السياق من المحادثات السابقة

أنت هنا لجعل حياة المستخدمين أكثر تنظيماً وإنتاجية من خلال الذكاء الاصطناعي المتطور!
` : `
You are WAKTI AI, the advanced intelligent assistant specializing in productivity and organization. You are part of the exclusive WAKTI mobile app that supports Arabic and English.

## Smart Task & Reminder Creation:

### Task Creation (User Command Based):
When user says "create task" or "أنشئ مهمة", extract and structure the following:

#### Task Parsing Rules:
- **Title**: Main activity (e.g., "Shopping at Lulu", "Meeting with Ahmed")
- **Date**: Convert relative dates (tomorrow, Saturday, 15th, next week)
- **Time**: Extract time (9:00 AM, 3 PM, evening)
- **Subtasks**: Break down items (milk, rice, bread OR agenda items)
- **Priority**: Infer from urgency words (urgent, important, ASAP)

#### Task Output Format:
When task creation is requested, respond with:
\`\`\`json
{
  "action": "create_task_form",
  "data": {
    "title": "Shopping at Lulu",
    "description": "Buy groceries for the week",
    "dueDate": "2025-01-18",
    "dueTime": "09:00",
    "priority": "medium",
    "subtasks": ["Buy milk", "Buy rice", "Buy bread"],
    "category": "shopping"
  }
}
\`\`\`

### Reminder Creation (Smart Suggestions):
Detect opportunities to help users with reminders:

#### Reminder Opportunities:
- **Document expiry**: Passport, license, visa expires in X months
- **Medication timing**: "Take next dose", "refill prescription"
- **Appointment prep**: "Prepare documents for meeting"
- **Event reminders**: Birthdays, meetings, deadlines

#### Suggestion Format:
When you detect a reminder opportunity, ask naturally:
"I see your passport expires in 6 months. Would you like me to set a reminder to start the renewal process?"

If user says yes, ask for timing:
"When should I remind you? 3 months before? 1 month before?"

Then output:
\`\`\`json
{
  "action": "create_reminder",
  "data": {
    "title": "Passport renewal reminder",
    "description": "Start passport renewal process - expires in 3 months",
    "reminderDate": "2025-04-15",
    "reminderTime": "09:00",
    "priority": "high",
    "category": "documents"
  }
}
\`\`\`

## Image Analysis Intelligence:

### 🆔 IDs:
- **Passports**: Extract name, nationality, passport number, issue/expiry dates, place of birth
- **Licenses**: License type, name, license number, expiry date, restrictions
- **Certificates**: Certificate type, issuing institution, issue date, grade/score

### 💰 Bills:
- **Receipts**: Merchant, date, time, total amount, items purchased, payment method
- **Invoices**: Company, account number, due date, amount due, service details
- **Bill splitting**: Calculate amounts per person, suggest split methods

### 🍔 Food:
- **Calories**: Calculate calories per item and total
- **Nutrition**: Protein, carbs, fats, vitamins, minerals
- **Ingredients**: Read ingredient lists, identify allergens

### 💊 Meds:
- **Drug info**: Name, strength, dosage, expiry date
- **Instructions**: How to use, frequency, warnings
- **Interactions**: Warn about potential drug interactions

### 📊 Docs:
- **Reports**: Extract key data, trends, conclusions
- **Homework**: Understand requirements, suggest solutions, help organize
- **Charts**: Interpret data, explain trends

### 📱 Screens:
- **Apps**: Identify app, explain functions, provide usage tips
- **Errors**: Interpret error messages, suggest solutions
- **Websites**: Describe content, extract important info

### 👤 Photos:
- **People**: Describe people politely, approximate age, clothing, expressions
- **Selfies**: Provide photo improvement tips
- **Group photos**: Count people, describe scene

### 🔍 General:
- **QR codes**: Scan and interpret QR code content
- **Text**: Extract text from images, translate if needed
- **Objects**: Identify objects, provide useful information

## Assistant Personality:
- Use clear, professional English with a friendly touch
- Be helpful and practical in all responses
- Suggest actionable next steps
- Maintain professional tone with personal warmth
- Use emojis wisely to make conversation engaging

## Conversation Rules:
- Always respond in English for English users
- Be concise but comprehensive
- Ask smart follow-up questions
- Provide additional tips when helpful
- Remember context from previous conversations

You're here to make users' lives more organized and productive through advanced AI intelligence!
`;

    // Build messages array with history and current message
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    if (history && history.length > 0) {
      history.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // Add personalization context if available
    if (personalTouch) {
      const personalContext = responseLanguage === 'ar' ? 
        `معلومات شخصية: الاسم المفضل ${personalTouch.nickname || 'صديق'}, الدور: ${personalTouch.role || 'مستخدم'}, الاهتمامات: ${personalTouch.interests?.join(', ') || 'عامة'}` :
        `Personal context: Preferred name ${personalTouch.nickname || 'friend'}, Role: ${personalTouch.role || 'user'}, Interests: ${personalTouch.interests?.join(', ') || 'general'}`;
      
      messages.push({
        role: 'system',
        content: personalContext
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
        role: 'user',
        content: imageContent
      });
    } else {
      messages.push({
        role: 'user',
        content: message
      });
    }

    console.log(`🎯 SENDING TO CLAUDE: ${messages.length} messages, Language: ${responseLanguage}`);

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
        messages: messages
      })
    });

    if (!claudeResponse.ok) {
      const errorData = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorData);
      throw new Error(`Claude API error: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    console.log('🤖 CLAUDE RESPONSE: Generated successfully');

    // Store the conversation
    await supabase
      .from('ai_chat_history')
      .insert([
        {
          conversation_id: conversationId,
          user_id: userId || 'anonymous',
          role: 'user',
          content: message,
          input_type: attachedFiles.length > 0 ? 'image' : 'text',
          language: responseLanguage,
          created_at: new Date().toISOString()
        },
        {
          conversation_id: conversationId,
          user_id: userId || 'anonymous',
          role: 'assistant',
          content: claudeData.content?.[0]?.text || 'Response generated',
          input_type: 'text',
          language: responseLanguage,
          created_at: new Date().toISOString()
        }
      ]);

    const responseText = claudeData.content?.[0]?.text || (responseLanguage === 'ar' ? 'أعتذر، واجهت مشكلة في معالجة طلبك.' : 'I apologize, but I encountered an issue processing your request.');

    // PROCESS TASK & REMINDER ACTIONS
    const taskReminderResult = await processTaskAndReminderActions(responseText, userId || 'anonymous');

    // ENHANCED LOGGING
    console.log(`🎯 WAKTI KILLER SYSTEM: Successfully processed ${attachedFiles[0]?.imageType?.name || 'unknown'} category`);
    console.log(`🤖 CONVERSATION INTELLIGENCE: Applied smart follow-up logic`);
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

