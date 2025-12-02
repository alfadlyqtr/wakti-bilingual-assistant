import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const FAL_KEY = Deno.env.get("FAL_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DOCUMENT_BUILDER_URL = Deno.env.get("DOCUMENT_BUILDER_URL") || "http://localhost:3001";
const DOCUMENT_BUILDER_API_KEY = Deno.env.get("DOCUMENT_BUILDER_API_KEY") || "wakti-doc-builder-secret-2024";

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
    console.log("📄 Smart File Generator V3: Request received");

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

    const body: GenerationRequest = await req.json();
    const { inputText, fileUrl, fileName, outputType, outputSize, includeImages, language } = body;

    console.log("📋 Request params:", { 
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
      console.error("❌ Failed to create generation record:", insertError);
      throw new Error("Failed to create generation record");
    }

    console.log("✅ Generation record created:", generationId);

    // Extract text from input
    let extractedText = inputText || "";
    
    if (fileUrl) {
      console.log("📥 Downloading file from:", fileUrl);
      try {
        const fileResponse = await fetch(fileUrl);
        if (!fileResponse.ok) {
          throw new Error(`Failed to download file: ${fileResponse.statusText}`);
        }
        // For now, just use the input text if provided, or a placeholder
        extractedText = inputText || "Content extracted from uploaded file";
      } catch (error: any) {
        console.error("❌ File download failed:", error);
        extractedText = inputText || "Unable to extract file content";
      }
    }

    // STEP 1: Generate structured content with OpenAI
    console.log("🤖 Calling OpenAI for content generation...");
    const structuredContent = await generateStructuredContent(
      extractedText,
      outputType,
      outputSize,
      language
    );

    console.log("✅ Content generated:", {
      title: structuredContent.title,
      sectionsCount: structuredContent.sections?.length || structuredContent.slides?.length || 0
    });

    // STEP 2: Generate images with FAL AI (if requested)
    let imageUrls: string[] = [];
    if (includeImages && structuredContent.imagePrompts && structuredContent.imagePrompts.length > 0) {
      console.log(`🎨 Generating ${structuredContent.imagePrompts.length} images with FAL AI...`);
      
      try {
        imageUrls = await Promise.all(
          structuredContent.imagePrompts.slice(0, 3).map((prompt: string) => 
            generateImageWithFAL(prompt)
          )
        );
        console.log(`✅ Generated ${imageUrls.length} images`);
      } catch (error: any) {
        console.error("⚠️ Image generation failed:", error.message);
        // Continue without images
      }
    }

    // SPECIAL HANDLING: PowerPoint = Return images only (Napkin style)
    if (outputType === 'pptx') {
      console.log("📸 PowerPoint mode: Returning visual images only (Napkin style)");
      
      // Update database with image URLs
      const { error: updateError } = await supabase
        .from('generated_files')
        .update({
          status: 'completed',
          file_name: 'visual-images.json',
          file_path: JSON.stringify(imageUrls),
          download_url: imageUrls[0] || '',
          file_size: imageUrls.length,
          completed_at: new Date().toISOString()
        })
        .eq('id', generationId);

      if (updateError) {
        console.error("⚠️ Failed to update generation record:", updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'images',
          imageUrls,
          message: 'Visual images generated successfully. Download and insert into your PowerPoint.',
          generationId
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // STEP 3: Call Document Builder Service for PDF/Word/Excel/Text
    console.log("📞 Calling Document Builder Service...");
    
    const docBuilderResponse = await fetch(`${DOCUMENT_BUILDER_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DOCUMENT_BUILDER_API_KEY
      },
      body: JSON.stringify({
        content: structuredContent,
        outputType,
        theme: 'business',
        imageUrls,
        userId: user.id
      })
    });

    if (!docBuilderResponse.ok) {
      const errorText = await docBuilderResponse.text();
      throw new Error(`Document Builder failed: ${docBuilderResponse.statusText} - ${errorText}`);
    }

    const result = await docBuilderResponse.json();
    
    console.log("✅ Document generated:", {
      fileName: result.fileName,
      fileSize: result.fileSize,
      visualElements: result.visualElements
    });

    // STEP 4: Update database record
    const { error: updateError } = await supabase
      .from('generated_files')
      .update({
        status: 'completed',
        file_name: result.fileName,
        file_path: result.downloadUrl,
        download_url: result.downloadUrl,
        file_size: result.fileSize,
        completed_at: new Date().toISOString()
      })
      .eq('id', generationId);

    if (updateError) {
      console.error("⚠️ Failed to update generation record:", updateError);
    }

    console.log("✅ Generation complete!");

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl: result.downloadUrl,
        fileName: result.fileName,
        fileSize: result.fileSize,
        fileType: result.fileType,
        generationId,
        visualElements: result.visualElements
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error" 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});

// Generate structured content with OpenAI
async function generateStructuredContent(
  text: string,
  outputType: string,
  outputSize: number,
  language: string
): Promise<any> {
  
  const isArabic = language === 'ar';
  const sizeMultiplier = outputSize;

  let systemPrompt = "";
  let userPrompt = "";

  if (outputType === 'pptx') {
    systemPrompt = isArabic
      ? `أنت خبير في إنشاء عروض تقديمية احترافية. قم بإنشاء محتوى منظم لعرض تقديمي PowerPoint بناءً على النص المقدم.`
      : `You are an expert at creating professional presentations. Generate structured content for a PowerPoint presentation based on the provided text.`;

    userPrompt = isArabic
      ? `أنشئ عرضًا تقديميًا احترافيًا من ${sizeMultiplier * 3} إلى ${sizeMultiplier * 5} شرائح بناءً على هذا النص:\n\n${text}\n\nقم بتضمين:\n- عنوان جذاب\n- شرائح مع عناوين ونقاط رئيسية\n- اقتراحات للمخططات (نوع، عنوان، بيانات)\n- أوصاف للصور المناسبة\n\nأرجع JSON بهذا التنسيق:\n{\n  "title": "عنوان العرض",\n  "slides": [\n    {\n      "slideNumber": 1,\n      "title": "عنوان الشريحة",\n      "content": ["نقطة 1", "نقطة 2", "نقطة 3"],\n      "notes": "ملاحظات المتحدث"\n    }\n  ],\n  "chartData": [\n    {\n      "type": "bar",\n      "title": "عنوان المخطط",\n      "categories": ["الفئة 1", "الفئة 2"],\n      "series": [{"name": "السلسلة", "values": [10, 20]}]\n    }\n  ],\n  "imagePrompts": ["وصف الصورة 1", "وصف الصورة 2"]\n}`
      : `Create a professional presentation with ${sizeMultiplier * 3} to ${sizeMultiplier * 5} slides based on this text:\n\n${text}\n\nInclude:\n- Compelling title\n- Slides with headings and bullet points\n- Chart suggestions (type, title, data)\n- Image descriptions\n\nReturn JSON in this format:\n{\n  "title": "Presentation Title",\n  "slides": [\n    {\n      "slideNumber": 1,\n      "title": "Slide Title",\n      "content": ["Point 1", "Point 2", "Point 3"],\n      "notes": "Speaker notes"\n    }\n  ],\n  "chartData": [\n    {\n      "type": "bar",\n      "title": "Chart Title",\n      "categories": ["Cat 1", "Cat 2"],\n      "series": [{"name": "Series", "values": [10, 20]}]\n    }\n  ],\n  "imagePrompts": ["Image description 1", "Image description 2"]\n}`;
  } else {
    // For other formats (docx, pdf, xlsx, txt)
    systemPrompt = isArabic
      ? `أنت خبير في إنشاء مستندات احترافية. قم بإنشاء محتوى منظم بناءً على النص المقدم.`
      : `You are an expert at creating professional documents. Generate structured content based on the provided text.`;

    userPrompt = isArabic
      ? `أنشئ مستندًا احترافيًا من ${sizeMultiplier * 2} إلى ${sizeMultiplier * 4} أقسام بناءً على هذا النص:\n\n${text}\n\nأرجع JSON بهذا التنسيق:\n{\n  "title": "عنوان المستند",\n  "sections": [\n    {\n      "heading": "عنوان القسم",\n      "content": ["فقرة 1", "فقرة 2"]\n    }\n  ],\n  "chartData": [...],\n  "imagePrompts": [...]\n}`
      : `Create a professional document with ${sizeMultiplier * 2} to ${sizeMultiplier * 4} sections based on this text:\n\n${text}\n\nReturn JSON in this format:\n{\n  "title": "Document Title",\n  "sections": [\n    {\n      "heading": "Section Heading",\n      "content": ["Paragraph 1", "Paragraph 2"]\n    }\n  ],\n  "chartData": [...],\n  "imagePrompts": [...]\n}`;
  }

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
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = JSON.parse(data.choices[0].message.content);
  
  return content;
}

// Generate image with FAL AI
async function generateImageWithFAL(prompt: string): Promise<string> {
  const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${FAL_KEY}`
    },
    body: JSON.stringify({
      prompt,
      image_size: "landscape_16_9",
      num_inference_steps: 4,
      num_images: 1
    })
  });

  if (!response.ok) {
    throw new Error(`FAL AI error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.images[0].url;
}
