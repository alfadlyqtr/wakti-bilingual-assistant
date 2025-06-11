import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

console.log("🚀 WAKTI AI V2 BRAIN: Enhanced File Analysis - Fixed Vision API for images, text extraction for docs");

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🚀 WAKTI AI V2 BRAIN: Processing request with fixed file handling");

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

    // Process attached files with proper file type handling
    if (attachedFiles && attachedFiles.length > 0) {
      console.log("📎 Processing files with proper type handling...");
      fileAnalysisResults = await processFilesWithProperHandling(attachedFiles, language);
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

    console.log("🚀 WAKTI AI V2 BRAIN: Sending response with fixed file analysis");

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

// Process files with proper type handling - images use Vision, docs use text extraction
async function processFilesWithProperHandling(files: any[], language: string = 'en') {
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
        // Extract text from PDF and analyze with regular AI
        console.log(`📄 Processing PDF: ${file.name}`);
        analysisResult = await processPDFFile(file, language);
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

// Analyze images with OpenAI Vision (FIXED - only for images)
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

// Process PDF files by extracting text using PDF.js or fallback to OCR
async function processPDFFile(file: any, language: string = 'en') {
  try {
    console.log(`📄 Processing PDF file: ${file.name}`);
    
    // Import PDF.js from CDN
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@3.11.174');
    
    // Fetch the PDF file
    const response = await fetch(file.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    
    const pdfData = await response.arrayBuffer();
    
    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    console.log(`📄 PDF loaded successfully: ${pdf.numPages} pages`);
    
    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) { // Limit to first 10 pages
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += `Page ${pageNum}:\n${pageText}\n\n`;
    }
    
    if (fullText.trim().length === 0) {
      // If no text extracted, fall back to OCR using Vision API
      console.log(`📄 No text found in PDF, attempting OCR fallback for: ${file.name}`);
      return await fallbackPDFToOCR(file, language);
    }
    
    console.log(`📄 Extracted ${fullText.length} characters from PDF: ${file.name}`);
    
    // Analyze the extracted text with AI
    const analysisResult = await analyzeExtractedText(fullText, file.name, language);
    
    return {
      success: true,
      analysis: analysisResult,
      model: 'pdf-text-extraction',
      textLength: fullText.length,
      extractedText: fullText.substring(0, 1000) + (fullText.length > 1000 ? '...' : '') // Include sample
    };

  } catch (error) {
    console.error('Error processing PDF:', error);
    
    // Fallback to OCR if PDF text extraction fails
    console.log(`📄 PDF text extraction failed, trying OCR fallback for: ${file.name}`);
    return await fallbackPDFToOCR(file, language);
  }
}

// Fallback: Use Vision API for OCR when PDF text extraction fails
async function fallbackPDFToOCR(file: any, language: string = 'en') {
  try {
    if (!OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured for OCR fallback");
    }

    console.log(`🔍 Using Vision API for PDF OCR: ${file.name}`);

    const systemPrompt = language === 'ar' 
      ? 'أنت مساعد ذكي متخصص في استخراج النصوص من ملفات PDF. استخرج كل النص الموجود في هذا المستند بدقة.'
      : 'You are an AI assistant specialized in extracting text from PDF documents. Extract all text content from this document accurately.';

    const userPrompt = language === 'ar' 
      ? 'استخرج وحلل محتوى هذا المستند PDF'
      : 'Extract and analyze the content of this PDF document';

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
      throw new Error(`OpenAI Vision OCR failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ PDF OCR analysis successful for: ${file.name}`);
    
    return {
      success: true,
      analysis: result.choices[0].message.content,
      model: 'gpt-4o-vision-ocr'
    };

  } catch (error) {
    console.error('Error in PDF OCR fallback:', error);
    return {
      success: false,
      error: error.message,
      analysis: language === 'ar' 
        ? `فشل في معالجة ملف PDF: ${error.message}. يرجى التأكد من أن الملف ليس محمياً بكلمة مرور وقابل للقراءة.`
        : `Failed to process PDF file: ${error.message}. Please ensure the file is not password protected and is readable.`
    };
  }
}

// Analyze extracted text with AI
async function analyzeExtractedText(text: string, fileName: string, language: string = 'en') {
  try {
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
      ? `حلل محتوى هذا المستند PDF "${fileName}":\n\n${text}`
      : `Analyze the content of this PDF document "${fileName}":\n\n${text}`;

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
    return result.choices[0].message.content;

  } catch (error) {
    console.error('Error analyzing extracted text:', error);
    return language === 'ar' 
      ? `تم استخراج النص من المستند بنجاح (${text.length} حرف) ولكن فشل التحليل: ${error.message}`
      : `Successfully extracted text from document (${text.length} characters) but analysis failed: ${error.message}`;
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
