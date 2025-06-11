import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

console.log("🚀 WAKTI AI V2 BRAIN: Enhanced Conversation Context Management");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI V2 BRAIN: Processing request with enhanced context");

    const requestBody = await req.json();
    console.log("🚀 WAKTI AI V2 BRAIN: Request body received:", {
      message: requestBody.message,
      userId: requestBody.userId,
      attachedFiles: requestBody.attachedFiles?.length || 0,
      conversationHistoryLength: requestBody.conversationHistory?.length || 0
    });

    const {
      message,
      userId,
      language = 'en',
      conversationId = null,
      inputType = 'text',
      confirmSearch = false,
      activeTrigger = 'chat',
      attachedFiles = [],
      conversationHistory = [] // Enhanced conversation context
    } = requestBody;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("🚀 WAKTI AI V2 BRAIN: Invalid message field");
      return new Response(JSON.stringify({ 
        error: "Message is required and must be a non-empty string",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!userId) {
      console.error("🚀 WAKTI AI V2 BRAIN: Missing userId");
      return new Response(JSON.stringify({ 
        error: "User ID is required",
        success: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("🚀 WAKTI AI V2 BRAIN: Processing message for user:", userId);
    console.log("🚀 WAKTI AI V2 BRAIN: Active trigger mode:", activeTrigger);
    console.log("🚀 WAKTI AI V2 BRAIN: Attached files count:", attachedFiles.length);
    console.log("🚀 WAKTI AI V2 BRAIN: Conversation history length:", conversationHistory.length);

    let response = '';
    let fileAnalysisResults = [];
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;
    let contextUtilized = false;

    // Process attached files with simplified handling
    if (attachedFiles && attachedFiles.length > 0) {
      console.log("📎 Processing files...");
      fileAnalysisResults = await processFilesSimplified(attachedFiles, language);
      console.log("📎 File analysis completed:", fileAnalysisResults.length);
    }

    // Get browsing quota
    quotaStatus = await checkBrowsingQuota(userId);

    // Generate response based on trigger and files with enhanced context
    if (fileAnalysisResults.length > 0) {
      // If files were analyzed, include analysis in the response using enhanced context
      response = await generateResponseWithFileAnalysisAndContext(
        message, 
        fileAnalysisResults, 
        conversationHistory, 
        language
      );
      actionTaken = 'file_analysis';
      actionResult = { fileAnalysis: fileAnalysisResults };
      contextUtilized = true;
    } else {
      // Regular chat response using enhanced conversation context
      response = await processWithEnhancedContext(
        message, 
        conversationHistory, 
        language, 
        activeTrigger
      );
      contextUtilized = conversationHistory.length > 0;
    }

    const result = {
      response,
      conversationId: conversationId || generateConversationId(),
      intent: 'general_chat',
      confidence: 'high',
      actionTaken,
      actionResult,
      browsingUsed,
      browsingData,
      quotaStatus,
      requiresSearchConfirmation: false,
      needsConfirmation: false,
      attachedFiles: attachedFiles,
      fileAnalysisResults,
      contextUtilized, // New field to indicate if context was used
      success: true
    };

    console.log("🚀 WAKTI AI V2 BRAIN: Sending response with context utilization:", contextUtilized);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("🚀 WAKTI AI V2 BRAIN: Error processing request:", error);
    
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

// Enhanced function to process message with full conversation context
async function processWithEnhancedContext(
  message: string, 
  conversationHistory: any[], 
  language: string = 'en', 
  activeTrigger: string = 'chat'
) {
  try {
    console.log("🧠 WAKTI AI V2 BRAIN: Processing with enhanced conversation context");
    console.log("🧠 Context details:", {
      historyLength: conversationHistory.length,
      activeTrigger,
      language
    });
    
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. 

تذكر دائماً سياق المحادثة السابق واربط إجاباتك بما تم مناقشته من قبل. إذا كان المستخدم يشير إلى شيء تم ذكره سابقاً، تأكد من ربط إجابتك بذلك السياق.

كن ودوداً ومفيداً ومختصراً في إجاباتك، واستخدم المعلومات السابقة لتقديم إجابات أكثر دقة وشخصية.`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. 

Always remember the previous conversation context and connect your responses to what has been discussed before. If the user refers to something mentioned earlier, make sure to link your response to that context.

Be friendly, helpful, and concise in your responses, and use previous information to provide more accurate and personalized answers.`;
    
    // Build conversation messages with full context
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history (maintain chronological order)
    if (conversationHistory && conversationHistory.length > 0) {
      // Take last 30 messages to avoid token limits while maintaining good context
      const recentHistory = conversationHistory.slice(-30);
      
      for (const historyMessage of recentHistory) {
        messages.push({
          role: historyMessage.role,
          content: historyMessage.content
        });
      }
      
      console.log("🧠 Added conversation context:", recentHistory.length, "messages");
    }

    // Add current message
    messages.push({ role: 'user', content: message });
    
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
        max_tokens: 1500
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`✅ Enhanced context response generated using: ${DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);
    
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🧠 WAKTI AI V2 BRAIN: Enhanced context processing error:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
  }
}

// Enhanced function to generate response with file analysis and conversation context
async function generateResponseWithFileAnalysisAndContext(
  message: string, 
  fileAnalysis: any[], 
  conversationHistory: any[], 
  language: string = 'en'
) {
  try {
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    console.log(`💬 Generating response with file analysis and context using: ${DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);

    const systemPrompt = language === 'ar' 
      ? 'أنت WAKTI، مساعد ذكي متقدم. المستخدم أرسل ملفات مع رسالته، واستخدم تاريخ المحادثة السابق وتحليل الملفات المرفق للإجابة على سؤاله بشكل شامل ومفيد. تذكر السياق السابق للمحادثة.'
      : 'You are WAKTI, an advanced AI assistant. The user sent files with their message. Use the previous conversation history and the attached file analysis to provide a comprehensive and helpful response to their question. Remember the previous conversation context.';

    // Build messages with conversation context
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent conversation history for context
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-20); // Keep recent context
      for (const historyMessage of recentHistory) {
        messages.push({
          role: historyMessage.role,
          content: historyMessage.content
        });
      }
    }

    // Prepare file analysis summary
    const fileAnalysisSummary = fileAnalysis.map(file => 
      `File: ${file.fileName} (${file.fileType})\nAnalysis: ${file.analysis.analysis}`
    ).join('\n\n');

    // Add current message with file analysis
    messages.push({ 
      role: 'user', 
      content: `${message}\n\nFile Analysis Results:\n${fileAnalysisSummary}` 
    });

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
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ File analysis with context synthesis successful using: ${DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);
    
    return result.choices[0].message.content;

  } catch (error) {
    console.error("Error generating response with file analysis and context:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `تم تحليل الملفات المرفقة بنجاح. ${fileAnalysis.length} ملف تم تحليله. يرجى إعادة صياغة سؤالك للحصول على معلومات أكثر تفصيلاً.`
      : `Successfully analyzed ${fileAnalysis.length} attached file(s). Please rephrase your question for more detailed information.`;
  }
}

// Simplified file processing - removed PDF specific handling
async function processFilesSimplified(files: any[], language: string = 'en') {
  const results = [];

  for (const file of files) {
    try {
      console.log(`📎 Processing file: ${file.name} (${file.type})`);
      
      let analysisResult;

      if (isImageFile(file.type)) {
        // Use OpenAI Vision for images
        console.log(`🖼️ Using Vision API for image: ${file.name}`);
        analysisResult = await analyzeImageWithVision(file, language);
      } else if (isTextFile(file.type)) {
        // Process text files directly
        console.log(`📝 Processing text file: ${file.name}`);
        analysisResult = await processTextFile(file, language);
      } else {
        // Unsupported file type
        console.log(`❌ Unsupported file type: ${file.type}`);
        analysisResult = {
          success: false,
          error: 'Unsupported file type',
          analysis: language === 'ar' ? 'نوع ملف غير مدعوم' : 'Unsupported file type'
        };
      }

      results.push({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: file.url,
        analysis: analysisResult
      });

    } catch (error) {
      console.error(`📎 Error processing file ${file.name}:`, error);
      results.push({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: file.url,
        analysis: {
          success: false,
          error: error.message,
          analysis: language === 'ar' ? 'فشل في تحليل الملف' : 'Failed to analyze file'
        }
      });
    }
  }

  return results;
}

// Check if file is an image
function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/') && 
         ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'].includes(mimeType.toLowerCase());
}

// Check if file is a text file
function isTextFile(mimeType: string): boolean {
  return mimeType === 'text/plain' || mimeType.includes('text/');
}

// Analyze images with OpenAI Vision
async function analyzeImageWithVision(file: any, language: string = 'en') {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured for image analysis");
    }

    console.log(`🔍 Analyzing image with OpenAI Vision: ${file.name}`);

    const systemPrompt = language === 'ar' 
      ? 'أنت مساعد ذكي متخصص في تحليل الصور. صف ما تراه في الصورة بالتفصيل واستخرج أي نص موجود. كن دقيقاً ومفصلاً في وصفك.'
      : 'You are an AI assistant specialized in image analysis. Describe what you see in the image in detail and extract any text present. Be accurate and detailed in your description.';

    const userPrompt = language === 'ar' ? 'حلل هذه الصورة بالتفصيل' : 'Analyze this image in detail';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: file.url } }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`OpenAI Vision API failed: ${response.status}`, errorData);
      throw new Error(`OpenAI Vision API failed: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    console.log(`✅ Vision analysis successful for: ${file.name}`);
    
    return {
      success: true,
      analysis: result.choices[0].message.content,
      model: 'gpt-4o-vision'
    };

  } catch (error) {
    console.error('Error analyzing image with Vision:', error);
    return {
      success: false,
      error: error.message,
      analysis: language === 'ar' ? 'فشل في تحليل الصورة' : 'Failed to analyze image'
    };
  }
}

// Process text files by reading content and analyzing with AI
async function processTextFile(file: any, language: string = 'en') {
  try {
    console.log(`📝 Processing text file: ${file.name}`);
    
    // Fetch the text content from the file URL
    const response = await fetch(file.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch text file: ${response.status}`);
    }
    
    const textContent = await response.text();
    
    // Analyze the text content with AI
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? 'أنت مساعد ذكي متخصص في تحليل النصوص والمستندات. حلل المحتوى واستخرج النقاط المهمة والملخص والبيانات الرئيسية.'
      : 'You are an AI assistant specialized in text and document analysis. Analyze the content and extract key points, summary, and main data.';

    const userPrompt = language === 'ar' 
      ? `حلل محتوى هذا الملف النصي:\n\n${textContent}`
      : `Analyze the content of this text file:\n\n${textContent}`;

    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const result = await aiResponse.json();
    console.log(`✅ Text analysis successful for: ${file.name}`);
    
    return {
      success: true,
      analysis: result.choices[0].message.content,
      model: model,
      textLength: textContent.length
    };

  } catch (error) {
    console.error('Error processing text file:', error);
    return {
      success: false,
      error: error.message,
      analysis: language === 'ar' ? 'فشل في معالجة الملف النصي' : 'Failed to process text file'
    };
  }
}

// Check browsing quota
async function checkBrowsingQuota(userId: string) {
  try {
    const { data, error } = await supabase.rpc('check_browsing_quota', {
      p_user_id: userId
    });
    
    if (error) {
      console.error("Quota check error:", error);
      return { count: 0, limit: 60, canBrowse: true, usagePercentage: 0, remaining: 60 };
    }
    
    const count = data || 0;
    const limit = 60;
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
    return { count: 0, limit: 60, canBrowse: true, usagePercentage: 0, remaining: 60 };
  }
}

function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
