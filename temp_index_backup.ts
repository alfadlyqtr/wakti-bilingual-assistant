import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateRealPowerPoint, generateRealWordDocument, generateRealPDF, generateRealExcel, generatePlainText } from "./file-generators.ts";

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
  outputType: 'pptx' | 'docx' | 'pdf' | 'xlsx' | 'txt';
  outputSize: number;
  includeImages?: boolean;
  language: 'en' | 'ar';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("≡ƒôä Smart File Generator V2: Request received");

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

    console.log("Γ£à User authenticated:", user.id);

    const body: GenerationRequest = await req.json();
    const { inputText, fileUrl, fileName, outputType, outputSize, includeImages, language } = body;

    console.log("≡ƒôï Request params:", { 
      hasInputText: !!inputText, 
      hasFileUrl: !!fileUrl, 
      outputType, 
      outputSize,
      includeImages,
      language 
    });

    if (!inputText && !fileUrl) {
      throw new Error("Either inputText or fileUrl is required");
    }

    if (!['pptx', 'docx', 'pdf', 'xlsx', 'txt'].includes(outputType)) {
      throw new Error("Invalid output type");
    }

    if (outputSize < 1 || outputSize > 10) {
      throw new Error("Output size must be between 1 and 10");
    }

    const generationId = crypto.randomUUID();
    const { error: insertError } = await supabase
      .from('generated_files')
      .insert({
        id: generationId,
        user_id: user.id,
        input_type: fileUrl ? 'pdf' : 'text',
        input_file_name: fileName,
        output_type: outputType,
        output_size: outputSize,
        output_language: language,
        status: 'processing',
        file_name: `generating...`,
        file_path: '',
      });

    if (insertError) {
      console.error("Γ¥î Failed to create generation record:", insertError);
      throw new Error("Failed to create generation record");
    }

    console.log("Γ£à Generation record created:", generationId);

    // Extract text from input
    let extractedText = inputText || "";
    
    if (fileUrl) {
      console.log("≡ƒôÑ Downloading file from:", fileUrl);
      try {
        extractedText = await extractTextFromFile(fileUrl, fileName || "");
        console.log("Γ£à Text extracted, length:", extractedText.length);
      } catch (error) {
        console.error("Γ¥î File extraction failed:", error);
        await updateGenerationStatus(supabase, generationId, 'failed', `File extraction failed: ${error.message}`);
        throw error;
      }
    }

    if (inputText && fileUrl) {
      extractedText = `${inputText}\n\n---\n\n${extractedText}`;
    }

    // Call OpenAI to generate structured content
    console.log("≡ƒñû Calling OpenAI for content generation...");
    let structuredContent;
    try {
      structuredContent = await generateStructuredContent(
        extractedText,
        outputType,
        outputSize,
        language,
        includeImages || false
      );
      console.log("Γ£à Structured content generated");
    } catch (error) {
      console.error("Γ¥î OpenAI generation failed:", error);
      await updateGenerationStatus(supabase, generationId, 'failed', `AI generation failed: ${error.message}`);
      throw error;
    }

    // Generate file based on output type
    console.log("≡ƒôª Generating file...");
    let fileBuffer: Uint8Array;
    let mimeType: string;
    let fileExtension: string;

    try {
      switch (outputType) {
        case 'pptx':
          fileBuffer = await generateRealPowerPoint(structuredContent, language, includeImages || false);
          mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          fileExtension = 'pptx';
          break;
        case 'docx':
          fileBuffer = await generateRealWordDocument(structuredContent, language, includeImages || false);
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          fileExtension = 'docx';
          break;
        case 'xlsx':
          fileBuffer = await generateRealExcel(structuredContent, language, includeImages || false);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileExtension = 'csv'; // CSV format that Excel can open
          break;
        case 'pdf':
          fileBuffer = await generateRealPDF(structuredContent, language, includeImages || false);
          mimeType = 'application/pdf';
          fileExtension = 'pdf';
          break;
        case 'txt':
          fileBuffer = await generatePlainText(structuredContent, language, includeImages || false);
          mimeType = 'text/plain';
          fileExtension = 'txt';
          break;
        default:
          throw new Error("Unsupported output type");
      }
      console.log("Γ£à File generated, size:", fileBuffer.length, "bytes");
    } catch (error) {
      console.error("Γ¥î File generation failed:", error);
      await updateGenerationStatus(supabase, generationId, 'failed', `File generation failed: ${error.message}`);
      throw error;
    }

    // Upload to Storage
    const timestamp = new Date().toISOString().split('T')[0];
    const generatedFileName = `${outputType}_${timestamp}_${generationId.slice(0, 8)}.${fileExtension}`;
    const storagePath = `${user.id}/${generatedFileName}`;

    console.log("Γÿü∩╕Å Uploading to storage:", storagePath);
    const { error: uploadError } = await supabase.storage
      .from('generated-files')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Γ¥î Storage upload failed:", uploadError);
      await updateGenerationStatus(supabase, generationId, 'failed', `Storage upload failed: ${uploadError.message}`);
      throw uploadError;
    }

    console.log("Γ£à File uploaded to storage");

    // Generate signed URL (valid for 24 hours)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('generated-files')
      .createSignedUrl(storagePath, 86400);

    if (urlError || !signedUrlData) {
      console.error("Γ¥î Failed to create signed URL:", urlError);
      await updateGenerationStatus(supabase, generationId, 'failed', 'Failed to create download URL');
      throw new Error("Failed to create download URL");
    }

    const downloadUrl = signedUrlData.signedUrl;
    console.log("Γ£à Signed URL created");

    // Update database record
    const { error: updateError } = await supabase
      .from('generated_files')
      .update({
        status: 'completed',
        file_name: generatedFileName,
        file_path: storagePath,
        file_size_bytes: fileBuffer.length,
        download_url: downloadUrl,
        completed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .eq('id', generationId);

    if (updateError) {
      console.error("Γ¥î Failed to update generation record:", updateError);
    }

    console.log("Γ£à Generation completed successfully");

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

  } catch (error: any) {
    console.error("Γ¥î Smart File Generator error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "File generation failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

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

async function extractTextFromFile(fileUrl: string, fileName: string): Promise<string> {
  console.log("≡ƒôä Extracting text from file:", fileName);
  
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileExtension = fileName.split('.').pop()?.toLowerCase();

  if (fileExtension === 'txt') {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(arrayBuffer);
  }

  if (fileExtension === 'pdf') {
    return "[PDF content extraction not yet implemented. Please use text input or .txt files for now.]";
  }

  if (fileExtension === 'docx' || fileExtension === 'doc') {
    return "[DOCX content extraction not yet implemented. Please use text input or .txt files for now.]";
  }

  throw new Error(`Unsupported file type: ${fileExtension}`);
}

async function generateStructuredContent(
  inputText: string,
  outputType: string,
  outputSize: number,
  language: string,
  includeImages: boolean
): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const systemPrompt = getSystemPrompt(outputType, outputSize, language, includeImages);
  
  console.log("≡ƒñû OpenAI request:", {
    model: "gpt-4o",
    inputLength: inputText.length,
    outputType,
    outputSize,
    includeImages,
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
    console.error("Γ¥î OpenAI API error:", errorText);
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content generated from OpenAI");
  }

  return JSON.parse(content);
}

function getSystemPrompt(outputType: string, outputSize: number, language: string, includeImages: boolean): string {
  const isArabic = language === 'ar';
  const imageInstruction = includeImages 
    ? (isArabic ? '\n- ╪ú╪╢┘ü imagePrompt ┘ä┘â┘ä ╪┤╪▒┘è╪¡╪⌐/┘é╪│┘à (┘ê╪╡┘ü ┘é╪╡┘è╪▒ ┘ä┘ä╪╡┘ê╪▒╪⌐ ╪¿╪º┘ä╪Ñ┘å╪¼┘ä┘è╪▓┘è╪⌐)' : '\n- Add imagePrompt for each slide/section (short English description for AI image generation)')
    : '';

  if (outputType === 'pptx') {
    return isArabic
      ? `╪ú┘å╪¬ ┘à╪╡┘à┘à ╪╣╪▒┘ê╪╢ ╪¬┘é╪»┘è┘à┘è╪⌐ ┘à╪¡╪¬╪▒┘ü. ┘é┘à ╪¿╪Ñ┘å╪┤╪º╪í ╪╣╪▒╪╢ ╪¬┘é╪»┘è┘à┘è ┘à┘å╪╕┘à ╪¿╪╣╪»╪» ${outputSize} ╪┤╪▒┘è╪¡╪⌐ ╪¿╪º┘ä╪╢╪¿╪╖.

╪ú╪╣╪» JSON ╪¿┘ç╪░╪º ╪º┘ä╪¬┘å╪│┘è┘é:
{
  "title": "╪╣┘å┘ê╪º┘å ╪º┘ä╪╣╪▒╪╢ ╪º┘ä╪¬┘é╪»┘è┘à┘è",
  "slides": [
    {
      "slideNumber": 1,
      "title": "╪╣┘å┘ê╪º┘å ╪º┘ä╪┤╪▒┘è╪¡╪⌐",
      "content": ["┘å┘é╪╖╪⌐ 1", "┘å┘é╪╖╪⌐ 2", "┘å┘é╪╖╪⌐ 3"],
      "notes": "┘à┘ä╪º╪¡╪╕╪º╪¬ ╪º┘ä┘à╪¬╪¡╪»╪½ (╪º╪«╪¬┘è╪º╪▒┘è)"${includeImages ? ',\n      "imagePrompt": "description for AI image"' : ''}
    }
  ]
}

╪º┘ä┘à╪¬╪╖┘ä╪¿╪º╪¬:
- ╪º╪│╪¬╪«╪»┘à ┘ä╪║╪⌐ ╪╣╪▒╪¿┘è╪⌐ ┘ê╪º╪╢╪¡╪⌐ ┘ê┘à┘ç┘å┘è╪⌐
- ╪º╪¼╪╣┘ä ┘â┘ä ╪┤╪▒┘è╪¡╪⌐ ┘à┘ê╪¼╪▓╪⌐ ┘ê┘é╪º╪¿┘ä╪⌐ ┘ä┘ä┘é╪▒╪º╪í╪⌐
- ╪º╪│╪¬╪«╪»┘à 3-5 ┘å┘é╪º╪╖ ┘ä┘â┘ä ╪┤╪▒┘è╪¡╪⌐
- ╪ú╪╢┘ü ┘à┘ä╪º╪¡╪╕╪º╪¬ ╪º┘ä┘à╪¬╪¡╪»╪½ ╪╣┘å╪» ╪º┘ä╪¡╪º╪¼╪⌐${imageInstruction}`
      : `You are a professional presentation designer. Create a structured presentation with exactly ${outputSize} slides.

Return JSON in this format:
{
  "title": "Presentation Title",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide Title",
      "content": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
      "notes": "Speaker notes (optional)"${includeImages ? ',\n      "imagePrompt": "description for AI image"' : ''}
    }
  ]
}

Requirements:
- Use clear, professional language
- Keep each slide concise and readable
- Use 3-5 bullet points per slide
- Add speaker notes when helpful${imageInstruction}`;
  }

  if (outputType === 'docx') {
    return isArabic
      ? `╪ú┘å╪¬ ┘â╪º╪¬╪¿ ┘à╪│╪¬┘å╪»╪º╪¬ ┘à╪¡╪¬╪▒┘ü. ┘é┘à ╪¿╪Ñ┘å╪┤╪º╪í ┘à╪│╪¬┘å╪» ┘à┘å╪╕┘à ╪¿╪╣╪»╪» ${outputSize} ╪╡┘ü╪¡╪º╪¬ ╪¬┘é╪▒┘è╪¿╪º┘ï.

╪ú╪╣╪» JSON ╪¿┘ç╪░╪º ╪º┘ä╪¬┘å╪│┘è┘é:
{
  "title": "╪╣┘å┘ê╪º┘å ╪º┘ä┘à╪│╪¬┘å╪»",
  "sections": [
    {
      "heading": "╪╣┘å┘ê╪º┘å ╪º┘ä┘é╪│┘à",
      "content": "┘à╪¡╪¬┘ê┘ë ╪º┘ä┘ü┘é╪▒╪⌐..."${includeImages ? ',\n      "imagePrompt": "description for AI image"' : ''}
    }
  ]
}

╪º┘ä┘à╪¬╪╖┘ä╪¿╪º╪¬:
- ╪º╪│╪¬╪«╪»┘à ┘ä╪║╪⌐ ╪╣╪▒╪¿┘è╪⌐ ┘ê╪º╪╢╪¡╪⌐ ┘ê┘à┘ç┘å┘è╪⌐
- ┘å╪╕┘à ╪º┘ä┘à╪¡╪¬┘ê┘ë ┘ü┘è ╪ú┘é╪│╪º┘à ┘à┘å╪╖┘é┘è╪⌐
- ╪º╪│╪¬╪«╪»┘à ┘ü┘é╪▒╪º╪¬ ┘à╪¬┘à╪º╪│┘â╪⌐
- ╪ú╪╢┘ü ╪╣┘å╪º┘ê┘è┘å ┘ü╪▒╪╣┘è╪⌐ ╪╣┘å╪» ╪º┘ä╪¡╪º╪¼╪⌐${imageInstruction}`
      : `You are a professional document writer. Create a structured document with approximately ${outputSize} pages.

Return JSON in this format:
{
  "title": "Document Title",
  "sections": [
    {
      "heading": "Section Heading",
      "content": "Paragraph content..."${includeImages ? ',\n      "imagePrompt": "description for AI image"' : ''}
    }
  ]
}

Requirements:
- Use clear, professional language
- Organize content into logical sections
- Use coherent paragraphs
- Add subheadings when helpful${imageInstruction}`;
  }

  return getSystemPrompt('docx', outputSize, language, includeImages);
}
