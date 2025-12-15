import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface GenerationRequest {
  inputText?: string;
  fileUrl?: string;
  fileName?: string;
  outputType: 'pptx' | 'docx' | 'pdf';
  outputSize: number;
  language: 'en' | 'ar';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📄 Smart File Generator: Request received");

    // Verify JWT and get user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("✅ User authenticated:", user.id);

    // Parse request
    const body: GenerationRequest = await req.json();
    const { inputText, fileUrl, fileName, outputType, outputSize, language } = body;

    console.log("📋 Request params:", { 
      hasInputText: !!inputText, 
      hasFileUrl: !!fileUrl, 
      outputType, 
      outputSize, 
      language 
    });

    // Validate inputs
    if (!inputText && !fileUrl) {
      throw new Error("Either inputText or fileUrl is required");
    }

    if (!['pptx', 'docx', 'pdf'].includes(outputType)) {
      throw new Error("Invalid output type");
    }

    if (outputSize < 1 || outputSize > 20) {
      throw new Error("Output size must be between 1 and 20");
    }

    // Create database record
    const generationId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('generated_files')
      .insert({
        id: generationId,
        user_id: user.id,
        input_type: fileUrl ? 'pdf' : 'text', // Will be updated after parsing
        input_file_name: fileName,
        output_type: outputType,
        output_size: outputSize,
        output_language: language,
        status: 'processing',
        file_name: `generating...`,
        file_path: '',
      });

    if (insertError) {
      console.error("❌ Failed to create generation record:", insertError);
      throw new Error("Failed to create generation record");
    }

    console.log("✅ Generation record created:", generationId);

    // Step 1: Extract text from input
    let extractedText = inputText || "";
    
    if (fileUrl) {
      console.log("📥 Downloading file from:", fileUrl);
      try {
        extractedText = await extractTextFromFile(fileUrl, fileName || "");
        console.log("✅ Text extracted, length:", extractedText.length);
      } catch (error) {
        console.error("❌ File extraction failed:", error);
        await updateGenerationStatus(supabase, generationId, 'failed', `File extraction failed: ${error.message}`);
        throw error;
      }
    }

    // Combine both if both provided
    if (inputText && fileUrl) {
      extractedText = `${inputText}\n\n---\n\n${extractedText}`;
    }

    // Step 2: Call OpenAI to generate structured content
    console.log("🤖 Calling OpenAI for content generation...");
    let structuredContent;
    try {
      structuredContent = await generateStructuredContent(
        extractedText,
        outputType,
        outputSize,
        language
      );
      console.log("✅ Structured content generated");
    } catch (error) {
      console.error("❌ OpenAI generation failed:", error);
      await updateGenerationStatus(supabase, generationId, 'failed', `AI generation failed: ${error.message}`);
      throw error;
    }

    // Step 3: Generate file based on output type
    console.log("📦 Generating file...");
    let fileBuffer: Uint8Array;
    let mimeType: string;
    let fileExtension: string;

    try {
      switch (outputType) {
        case 'pptx':
          fileBuffer = await generatePowerPoint(structuredContent, language);
          mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          fileExtension = 'pptx';
          break;
        case 'docx':
          fileBuffer = await generateWordDocument(structuredContent, language);
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          fileExtension = 'docx';
          break;
        case 'pdf':
          // For MVP, generate Word first then convert to PDF
          // Or use a direct PDF generation library
          fileBuffer = await generatePDF(structuredContent, language);
          mimeType = 'application/pdf';
          fileExtension = 'pdf';
          break;
        default:
          throw new Error("Unsupported output type");
      }
      console.log("✅ File generated, size:", fileBuffer.length, "bytes");
    } catch (error) {
      console.error("❌ File generation failed:", error);
      await updateGenerationStatus(supabase, generationId, 'failed', `File generation failed: ${error.message}`);
      throw error;
    }

    // Step 4: Upload to Storage
    const timestamp = new Date().toISOString().split('T')[0];
    const generatedFileName = `${outputType}_${timestamp}_${generationId.slice(0, 8)}.${fileExtension}`;
    const storagePath = `${user.id}/${generatedFileName}`;

    console.log("☁️ Uploading to storage:", storagePath);
    const { error: uploadError } = await supabase.storage
      .from('generated-files')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ Storage upload failed:", uploadError);
      await updateGenerationStatus(supabase, generationId, 'failed', `Storage upload failed: ${uploadError.message}`);
      throw uploadError;
    }

    console.log("✅ File uploaded to storage");

    // Step 5: Generate signed URL (valid for 24 hours)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('generated-files')
      .createSignedUrl(storagePath, 86400); // 24 hours

    if (urlError || !signedUrlData) {
      console.error("❌ Failed to create signed URL:", urlError);
      await updateGenerationStatus(supabase, generationId, 'failed', 'Failed to create download URL');
      throw new Error("Failed to create download URL");
    }

    const downloadUrl = signedUrlData.signedUrl;
    console.log("✅ Signed URL created");

    // Step 6: Update database record
    const { error: updateError } = await supabase
      .from('generated_files')
      .update({
        status: 'completed',
        file_name: generatedFileName,
        file_path: storagePath,
        file_size_bytes: fileBuffer.length,
        download_url: downloadUrl,
        completed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(), // 24 hours
      })
      .eq('id', generationId);

    if (updateError) {
      console.error("❌ Failed to update generation record:", updateError);
    }

    console.log("✅ Generation completed successfully");

    // Log successful AI usage
    await logAIFromRequest(req, {
      functionName: "smart-file-generator",
      provider: "openai",
      model: "gpt-4o-mini",
      inputText: inputText || fileName || "",
      status: "success",
      metadata: { outputType, outputSize, fileSize: fileBuffer.length }
    });

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl,
        fileName: generatedFileName,
        fileSize: fileBuffer.length,
        fileType: mimeType,
        generationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Smart File Generator error:", err);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "smart-file-generator",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "error",
      errorMessage: err.message
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "File generation failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper: Update generation status
async function updateGenerationStatus(
  supabase: any,
  generationId: string,
  status: string,
  errorMessage?: string
) {
  await supabase
    .from('generated_files')
    .update({
      status,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', generationId);
}

// Helper: Extract text from uploaded file
async function extractTextFromFile(fileUrl: string, fileName: string): Promise<string> {
  console.log("📄 Extracting text from file:", fileName);
  
  // Download file
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileExtension = fileName.split('.').pop()?.toLowerCase();

  // For MVP, we'll use simple text extraction
  // In production, you'd use libraries like pdf-parse, mammoth, etc.
  
  if (fileExtension === 'txt') {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(arrayBuffer);
  }

  if (fileExtension === 'pdf') {
    // TODO: Implement PDF text extraction
    // For now, return placeholder
    return "[PDF content extraction not yet implemented. Please use text input or .txt files for now.]";
  }

  if (fileExtension === 'docx' || fileExtension === 'doc') {
    // TODO: Implement DOCX text extraction
    return "[DOCX content extraction not yet implemented. Please use text input or .txt files for now.]";
  }

  throw new Error(`Unsupported file type: ${fileExtension}`);
}

// Helper: Generate structured content using OpenAI
async function generateStructuredContent(
  inputText: string,
  outputType: string,
  outputSize: number,
  language: string
): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const systemPrompt = getSystemPrompt(outputType, outputSize, language);
  
  console.log("🤖 OpenAI request:", {
    model: "gpt-4o",
    inputLength: inputText.length,
    outputType,
    outputSize,
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputText }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("❌ OpenAI API error:", errorText);
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content generated from OpenAI");
  }

  return JSON.parse(content);
}

// Helper: Get system prompt based on output type
function getSystemPrompt(outputType: string, outputSize: number, language: string): string {
  const isArabic = language === 'ar';

  if (outputType === 'pptx') {
    return isArabic
      ? `أنت مصمم عروض تقديمية محترف. قم بإنشاء عرض تقديمي منظم بعدد ${outputSize} شريحة بالضبط.

أعد JSON بهذا التنسيق:
{
  "title": "عنوان العرض التقديمي",
  "slides": [
    {
      "slideNumber": 1,
      "title": "عنوان الشريحة",
      "content": ["نقطة 1", "نقطة 2", "نقطة 3"],
      "notes": "ملاحظات المتحدث (اختياري)"
    }
  ]
}

المتطلبات:
- استخدم لغة عربية واضحة ومهنية
- اجعل كل شريحة موجزة وقابلة للقراءة
- استخدم 3-5 نقاط لكل شريحة
- أضف ملاحظات المتحدث عند الحاجة`
      : `You are a professional presentation designer. Create a structured presentation with exactly ${outputSize} slides.

Return JSON in this format:
{
  "title": "Presentation Title",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide Title",
      "content": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
      "notes": "Speaker notes (optional)"
    }
  ]
}

Requirements:
- Use clear, professional language
- Keep each slide concise and readable
- Use 3-5 bullet points per slide
- Add speaker notes when helpful`;
  }

  if (outputType === 'docx') {
    return isArabic
      ? `أنت كاتب مستندات محترف. قم بإنشاء مستند منظم بعدد ${outputSize} صفحات تقريباً.

أعد JSON بهذا التنسيق:
{
  "title": "عنوان المستند",
  "sections": [
    {
      "heading": "عنوان القسم",
      "content": "محتوى الفقرة..."
    }
  ]
}

المتطلبات:
- استخدم لغة عربية واضحة ومهنية
- نظم المحتوى في أقسام منطقية
- استخدم فقرات متماسكة
- أضف عناوين فرعية عند الحاجة`
      : `You are a professional document writer. Create a structured document with approximately ${outputSize} pages.

Return JSON in this format:
{
  "title": "Document Title",
  "sections": [
    {
      "heading": "Section Heading",
      "content": "Paragraph content..."
    }
  ]
}

Requirements:
- Use clear, professional language
- Organize content into logical sections
- Use coherent paragraphs
- Add subheadings when helpful`;
  }

  // PDF uses same structure as DOCX
  return getSystemPrompt('docx', outputSize, language);
}

// Helper: Generate PowerPoint file
async function generatePowerPoint(structuredContent: any, language: string): Promise<Uint8Array> {
  console.log("📊 Generating PowerPoint presentation...");
  
  // For MVP, we'll create a simple text-based representation
  // In production, use a library like pptxgenjs
  
  // This is a placeholder - you'll need to implement actual PPTX generation
  // using a library that works in Deno
  
  const textContent = `
PRESENTATION: ${structuredContent.title || "Untitled"}

${structuredContent.slides?.map((slide: any, index: number) => `
SLIDE ${index + 1}: ${slide.title}
${slide.content?.map((point: string) => `• ${point}`).join('\n')}
${slide.notes ? `\nNotes: ${slide.notes}` : ''}
`).join('\n---\n')}
  `.trim();

  // For now, return as text file
  // TODO: Implement actual PPTX generation
  const encoder = new TextEncoder();
  return encoder.encode(textContent);
}

// Helper: Generate Word document
async function generateWordDocument(structuredContent: any, language: string): Promise<Uint8Array> {
  console.log("📝 Generating Word document...");
  
  // For MVP, we'll create a simple text-based representation
  // In production, use a library like docx
  
  const textContent = `
${structuredContent.title || "Untitled Document"}

${structuredContent.sections?.map((section: any) => `
${section.heading}

${section.content}
`).join('\n')}
  `.trim();

  // For now, return as text file
  // TODO: Implement actual DOCX generation
  const encoder = new TextEncoder();
  return encoder.encode(textContent);
}

// Helper: Generate PDF
async function generatePDF(structuredContent: any, language: string): Promise<Uint8Array> {
  console.log("📄 Generating PDF...");
  
  // For MVP, generate as text
  // In production, use a PDF library or convert from DOCX
  
  const textContent = `
${structuredContent.title || "Untitled Document"}

${structuredContent.sections?.map((section: any) => `
${section.heading}

${section.content}
`).join('\n')}
  `.trim();

  // For now, return as text file
  // TODO: Implement actual PDF generation
  const encoder = new TextEncoder();
  return encoder.encode(textContent);
}
