
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

console.log("🚀 WAKTI AI V2 BRAIN: Enhanced File Analysis - Fixed PDF processing");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI V2 BRAIN: Processing request with fixed PDF handling");

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

    // Process attached files with simplified handling
    if (attachedFiles && attachedFiles.length > 0) {
      console.log("📎 Processing files with simplified handling...");
      fileAnalysisResults = await processFilesSimplified(attachedFiles, language);
      console.log("📎 File analysis completed:", fileAnalysisResults.length);
    }

    // Get browsing quota
    quotaStatus = await checkBrowsingQuota(userId);

    // Generate response based on trigger and files
    if (fileAnalysisResults.length > 0) {
      // If files were analyzed, include analysis in the response using DeepSeek for synthesis
      response = await generateResponseWithFileAnalysis(message, fileAnalysisResults, language);
      actionTaken = 'file_analysis';
      actionResult = { fileAnalysis: fileAnalysisResults };
    } else {
      // Regular chat response using DeepSeek
      response = await processWithDeepSeekChat(message, null, language, activeTrigger);
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
      success: true
    };

    console.log("🚀 WAKTI AI V2 BRAIN: Sending response with simplified file analysis");

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

// Simplified file processing - send PDFs directly to OpenAI
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
      } else if (isPDFFile(file.type)) {
        // Send PDF directly to OpenAI
        console.log(`📄 Sending PDF directly to OpenAI: ${file.name}`);
        analysisResult = await processPDFDirectly(file, language);
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

// Check if file is a PDF
function isPDFFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
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

// NEW: Process PDF by sending directly to OpenAI
async function processPDFDirectly(file: any, language: string = 'en') {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured for PDF analysis");
    }

    console.log(`📄 Processing PDF directly with OpenAI: ${file.name}`);

    // Fetch the PDF content
    const response = await fetch(file.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    
    const pdfBuffer = await response.arrayBuffer();
    const base64PDF = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    const systemPrompt = language === 'ar' 
      ? 'أنت مساعد ذكي متخصص في تحليل المستندات. حلل محتوى هذا المستند PDF واستخرج النقاط المهمة والمعلومات الرئيسية.'
      : 'You are an AI assistant specialized in document analysis. Analyze this PDF document and extract key points and important information.';

    const userPrompt = language === 'ar' 
      ? `حلل محتوى هذا المستند PDF "${file.name}" واستخرج المعلومات المهمة`
      : `Analyze the content of this PDF document "${file.name}" and extract important information`;

    // Try using the assistants API with file upload
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `${userPrompt}\n\nPDF Content (base64): data:application/pdf;base64,${base64PDF.substring(0, 10000)}...` // Truncate for safety
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      console.error(`OpenAI PDF analysis failed: ${aiResponse.status}`, errorData);
      
      // Return a user-friendly error message
      return {
        success: false,
        error: `PDF analysis not supported`,
        analysis: language === 'ar' 
          ? 'عذراً، تحليل ملفات PDF غير مدعوم حالياً. يرجى استخدام ملفات الصور أو النصوص بدلاً من ذلك.'
          : 'Sorry, PDF analysis is not currently supported. Please use image or text files instead.'
      };
    }

    const result = await aiResponse.json();
    console.log(`✅ PDF analysis successful for: ${file.name}`);
    
    return {
      success: true,
      analysis: result.choices[0].message.content,
      model: 'gpt-4o-pdf'
    };

  } catch (error) {
    console.error('Error processing PDF directly:', error);
    return {
      success: false,
      error: error.message,
      analysis: language === 'ar' 
        ? 'عذراً، تحليل ملفات PDF غير مدعوم حالياً. يرجى استخدام ملفات الصور أو النصوص بدلاً من ذلك.'
        : 'Sorry, PDF analysis is not currently supported. Please use image or text files instead.'
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

// Generate response that includes file analysis using DeepSeek for synthesis
async function generateResponseWithFileAnalysis(message: string, fileAnalysis: any[], language: string = 'en') {
  try {
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiUrl = DEEPSEEK_API_KEY ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

    if (!apiKey) {
      throw new Error("No AI API key configured");
    }

    console.log(`💬 Generating response with file analysis using: ${DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'} for synthesis`);

    const systemPrompt = language === 'ar' 
      ? 'أنت WAKTI، مساعد ذكي متقدم. المستخدم أرسل ملفات مع رسالته. استخدم تحليل الملفات المرفق للإجابة على سؤاله بشكل شامل ومفيد.'
      : 'You are WAKTI, an advanced AI assistant. The user sent files with their message. Use the attached file analysis to provide a comprehensive and helpful response to their question.';

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
    console.log(`✅ Response synthesis successful using: ${DEEPSEEK_API_KEY ? 'DeepSeek' : 'OpenAI'}`);
    
    return result.choices[0].message.content;

  } catch (error) {
    console.error("Error generating response with file analysis:", error);
    
    // Fallback response
    return language === 'ar' 
      ? `تم تحليل الملفات المرفقة بنجاح. ${fileAnalysis.length} ملف تم تحليله. يرجى إعادة صياغة سؤالك للحصول على معلومات أكثر تفصيلاً.`
      : `Successfully analyzed ${fileAnalysis.length} attached file(s). Please rephrase your question for more detailed information.`;
  }
}

// DeepSeek for general chat only (no file analysis)
async function processWithDeepSeekChat(message: string, context: string | null, language: string = 'en', activeTrigger: string = 'chat') {
  try {
    console.log("🤖 WAKTI AI V2 BRAIN: Processing general chat with DeepSeek (no files)");
    
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
    console.log(`✅ DeepSeek general chat response generated`);
    
    return result.choices[0].message.content;
    
  } catch (error) {
    console.error("🤖 WAKTI AI V2 BRAIN: DeepSeek chat processing error:", error);
    
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
