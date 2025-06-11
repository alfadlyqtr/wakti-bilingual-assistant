
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

console.log("🚀 WAKTI AI V2 BRAIN: Phase 5 - Enhanced File Analysis with DeepSeek");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI V2 BRAIN: Processing Phase 5 request with file analysis");

    const requestBody = await req.json();
    console.log("🚀 WAKTI AI V2 BRAIN: Request body received:", {
      message: requestBody.message,
      userId: requestBody.userId,
      attachedFiles: requestBody.attachedFiles?.length || 0
    });

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

    let response = '';
    let fileAnalysisResults = [];
    let browsingUsed = false;
    let browsingData = null;
    let quotaStatus = null;
    let actionTaken = null;
    let actionResult = null;

    // Process attached files with DeepSeek
    if (attachedFiles && attachedFiles.length > 0) {
      console.log("📎 Processing attached files with DeepSeek...");
      fileAnalysisResults = await processFilesWithDeepSeek(attachedFiles, language);
      console.log("📎 File analysis completed:", fileAnalysisResults.length);
    }

    // Get browsing quota
    quotaStatus = await checkBrowsingQuota(userId);

    // Generate response based on trigger and files
    if (fileAnalysisResults.length > 0) {
      // If files were analyzed, include analysis in the response
      response = await generateResponseWithFileAnalysis(message, fileAnalysisResults, language);
      actionTaken = 'file_analysis';
      actionResult = { fileAnalysis: fileAnalysisResults };
    } else {
      // Regular chat response
      response = await processWithAI(message, null, language, activeTrigger);
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
      attachedFiles: attachedFiles, // Include files in response
      fileAnalysisResults,
      success: true
    };

    console.log("🚀 WAKTI AI V2 BRAIN: Sending enhanced response with file analysis");

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

// Process files with DeepSeek AI
async function processFilesWithDeepSeek(files: any[], language: string = 'en') {
  const results = [];

  for (const file of files) {
    try {
      console.log(`📎 Analyzing file: ${file.name} (${file.type})`);
      
      let analysisResult = null;

      if (file.type.startsWith('image/')) {
        // Image analysis with DeepSeek Vision
        analysisResult = await analyzeImageWithDeepSeek(file, language);
      } else if (file.type === 'application/pdf') {
        // PDF analysis
        analysisResult = await analyzePDFWithDeepSeek(file, language);
      } else if (file.type === 'text/plain') {
        // Text file analysis
        analysisResult = await analyzeTextFileWithDeepSeek(file, language);
      } else {
        // Unsupported file type
        analysisResult = {
          success: false,
          error: language === 'ar' ? 'نوع الملف غير مدعوم' : 'Unsupported file type',
          analysis: language === 'ar' ? 'لا يمكن تحليل هذا النوع من الملفات' : 'Cannot analyze this file type'
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
      console.error(`📎 Error analyzing file ${file.name}:`, error);
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

// Analyze image with DeepSeek Vision
async function analyzeImageWithDeepSeek(file: any, language: string = 'en') {
  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key not configured");
    }

    const systemPrompt = language === 'ar' 
      ? 'أنت مساعد ذكي متخصص في تحليل الصور. صف ما تراه في الصورة بالتفصيل واستخرج أي نص موجود.'
      : 'You are an AI assistant specialized in image analysis. Describe what you see in the image in detail and extract any text present.';

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: language === 'ar' ? 'حلل هذه الصورة' : 'Analyze this image' },
              { type: 'image_url', image_url: { url: file.url } }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API failed: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      analysis: result.choices[0].message.content,
      model: 'deepseek-chat'
    };

  } catch (error) {
    console.error('Error analyzing image with DeepSeek:', error);
    return {
      success: false,
      error: error.message,
      analysis: language === 'ar' ? 'فشل في تحليل الصورة' : 'Failed to analyze image'
    };
  }
}

// Analyze PDF with DeepSeek (simplified - would need PDF parsing)
async function analyzePDFWithDeepSeek(file: any, language: string = 'en') {
  try {
    // For now, return a placeholder since PDF parsing requires additional libraries
    return {
      success: true,
      analysis: language === 'ar' 
        ? 'ملف PDF تم اكتشافه. تحليل المحتوى النصي قيد التطوير.' 
        : 'PDF file detected. Text content analysis is under development.',
      model: 'deepseek-chat'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      analysis: language === 'ar' ? 'فشل في تحليل ملف PDF' : 'Failed to analyze PDF'
    };
  }
}

// Analyze text file with DeepSeek
async function analyzeTextFileWithDeepSeek(file: any, language: string = 'en') {
  try {
    if (!DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key not configured");
    }

    // Fetch the text content
    const textResponse = await fetch(file.url);
    const textContent = await textResponse.text();

    const systemPrompt = language === 'ar' 
      ? 'أنت مساعد ذكي متخصص في تحليل النصوص. حلل المحتوى واستخرج النقاط المهمة.'
      : 'You are an AI assistant specialized in text analysis. Analyze the content and extract key points.';

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${language === 'ar' ? 'حلل هذا النص' : 'Analyze this text'}:\n\n${textContent}` }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API failed: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      analysis: result.choices[0].message.content,
      model: 'deepseek-chat'
    };

  } catch (error) {
    console.error('Error analyzing text with DeepSeek:', error);
    return {
      success: false,
      error: error.message,
      analysis: language === 'ar' ? 'فشل في تحليل النص' : 'Failed to analyze text'
    };
  }
}

// Generate response that includes file analysis
async function generateResponseWithFileAnalysis(message: string, fileAnalysis: any[], language: string = 'en') {
  try {
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? 'أنت WAKTI، مساعد ذكي متقدم. المستخدم أرسل ملفات مع رسالته. استخدم تحليل الملفات للإجابة على سؤاله بشكل شامل ومفيد.'
      : 'You are WAKTI, an advanced AI assistant. The user sent files with their message. Use the file analysis to provide a comprehensive and helpful response to their question.';

    // Prepare file analysis summary for the AI
    const fileAnalysisSummary = fileAnalysis.map(file => 
      `File: ${file.fileName} (${file.fileType})\nAnalysis: ${file.analysis.analysis}`
    ).join('\n\n');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${message}\n\nFile Analysis Results:\n${fileAnalysisSummary}` }
    ];

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
    return result.choices[0].message.content;

  } catch (error) {
    console.error("Error generating response with file analysis:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `تم تحليل الملفات المرفقة بنجاح. ${fileAnalysis.length} ملف تم تحليله. يرجى إعادة صياغة سؤالك للحصول على معلومات أكثر تفصيلاً.`
      : `Successfully analyzed ${fileAnalysis.length} attached file(s). Please rephrase your question for more detailed information.`;
  }
}

// Regular AI processing function
async function processWithAI(message: string, context: string | null, language: string = 'en', activeTrigger: string = 'chat') {
  try {
    console.log("🤖 WAKTI AI V2 BRAIN: Processing with enhanced conversational AI");
    
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';
    
    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    const systemPrompt = language === 'ar' 
      ? `أنت WAKTI، مساعد ذكي متقدم يتحدث العربية بطلاقة. تتخصص في المساعدة في المهام اليومية وتقديم معلومات دقيقة ومفيدة. كن ودوداً ومفيداً ومختصراً في إجاباتك.`
      : `You are WAKTI, an advanced AI assistant. You specialize in helping with daily tasks and providing accurate, helpful information. Be friendly, helpful, and concise in your responses.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
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
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🤖 WAKTI AI V2 BRAIN: AI processing error:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `أعتذر، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.`
      : `Sorry, there was an error processing your request. Please try again.`;
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
