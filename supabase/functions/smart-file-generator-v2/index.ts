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

interface GenerationRequest {
  inputText: string;
  outputType: 'visuals' | 'pdf';
  outputSize: number;
  language: 'en' | 'ar';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🎨 Visual & PDF Generator: Request received");

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
    const { inputText, outputType, outputSize, language } = body;

    console.log("📋 Request params:", { 
      inputLength: inputText?.length,
      outputType, 
      outputSize,
      language 
    });

    if (!inputText) {
      throw new Error("inputText is required");
    }

    if (!['visuals', 'pdf'].includes(outputType)) {
      throw new Error("Invalid output type. Must be 'visuals' or 'pdf'");
    }

    if (outputSize < 1 || outputSize > 10) {
      throw new Error("Output size must be between 1 and 10");
    }

    const generationId = crypto.randomUUID();

    // Call OpenAI
    console.log("🤖 Calling OpenAI...");
    const structuredContent = await generateStructuredContent(inputText, outputType, outputSize, language);
    console.log("✅ Content generated");

    if (outputType === 'visuals') {
      // VISUALS MODE
      console.log("🎨 Generating visuals...");
      
      const chartUrls: string[] = [];
      const imageUrls: string[] = [];

      // Generate charts
      if (structuredContent.visuals) {
        for (const visual of structuredContent.visuals) {
          if (visual.type === 'chart' && visual.chartConfig) {
            const chartUrl = generateQuickChartUrl(visual.chartConfig);
            chartUrls.push(chartUrl);
          } else if (visual.type === 'illustration' && visual.imagePrompt && FAL_KEY) {
            try {
              const imageUrl = await generateFALImage(visual.imagePrompt);
              imageUrls.push(imageUrl);
            } catch (error) {
              console.error("⚠️ Image generation failed:", error);
            }
          }
        }
      }

      console.log(`✅ Generated ${chartUrls.length} charts, ${imageUrls.length} images`);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'visuals',
          chartUrls,
          imageUrls,
          visuals: structuredContent.visuals,
          message: `Generated ${chartUrls.length + imageUrls.length} visuals`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      // PDF MODE
      console.log("📄 Generating PDF...");

      const chartUrls: string[] = [];
      const imageUrls: string[] = [];

      // Generate visuals for PDF
      if (structuredContent.pages) {
        for (const page of structuredContent.pages) {
          for (const section of page.sections) {
            if (section.type === 'chart' && section.chartConfig) {
              chartUrls.push(generateQuickChartUrl(section.chartConfig));
            } else if (section.type === 'image' && section.imagePrompt && FAL_KEY) {
              try {
                const imageUrl = await generateFALImage(section.imagePrompt);
                imageUrls.push(imageUrl);
              } catch (error) {
                console.error("⚠️ Image generation failed:", error);
              }
            }
          }
        }
      }

      console.log(`✅ Generated ${chartUrls.length} charts, ${imageUrls.length} images for PDF`);

      // Generate beautiful PDF HTML
      const pdfHTML = generateBeautifulPDF(structuredContent, language, chartUrls, imageUrls);
      const encoder = new TextEncoder();
      const pdfBuffer = encoder.encode(pdfHTML);

      // Upload to storage
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `pdf_${timestamp}_${generationId.slice(0, 8)}.html`;
      const storagePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('generated-files')
        .upload(storagePath, pdfBuffer, {
          contentType: 'text/html',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: signedUrlData } = await supabase.storage
        .from('generated-files')
        .createSignedUrl(storagePath, 86400);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'pdf',
          downloadUrl: signedUrlData?.signedUrl,
          fileName,
          fileSize: pdfBuffer.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateStructuredContent(inputText: string, outputType: string, outputSize: number, language: string): Promise<any> {
  const systemPrompt = outputType === 'visuals' 
    ? getVisualsPrompt(outputSize, language)
    : getPDFPrompt(outputSize, language);

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

  if (!response.ok) throw new Error(`OpenAI error: ${response.statusText}`);
  
  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
}

function getVisualsPrompt(count: number, language: string): string {
  return language === 'ar'
    ? `أنت مصمم رسوميات محترف. قم بإنشاء ${count} رسومات بصرية بالضبط.

أعد JSON:
{
  "title": "العنوان",
  "visuals": [
    {
      "type": "chart",
      "title": "عنوان المخطط",
      "description": "وصف",
      "chartConfig": {
        "type": "bar",
        "title": "عنوان",
        "labels": ["تسمية1", "تسمية2"],
        "datasets": [{"label": "البيانات", "data": [10, 20]}]
      }
    },
    {
      "type": "illustration",
      "title": "عنوان الصورة",
      "description": "وصف",
      "imagePrompt": "وصف تفصيلي بالإنجليزية"
    }
  ]
}

أنواع المخططات: bar, line, pie, doughnut, radar`
    : `You are a professional graphics designer. Create exactly ${count} visuals.

Return JSON:
{
  "title": "Title",
  "visuals": [
    {
      "type": "chart",
      "title": "Chart Title",
      "description": "Description",
      "chartConfig": {
        "type": "bar",
        "title": "Title",
        "labels": ["Label1", "Label2"],
        "datasets": [{"label": "Data", "data": [10, 20]}]
      }
    },
    {
      "type": "illustration",
      "title": "Image Title",
      "description": "Description",
      "imagePrompt": "Detailed English description"
    }
  ]
}

Chart types: bar, line, pie, doughnut, radar`;
}

function getPDFPrompt(pages: number, language: string): string {
  return language === 'ar'
    ? `أنت كاتب محترف. قم بإنشاء مستند PDF من ${pages} صفحات بالضبط.

أعد JSON:
{
  "title": "عنوان المستند",
  "pages": [
    {
      "pageNumber": 1,
      "sections": [
        {"type": "heading", "content": "عنوان"},
        {"type": "text", "content": "نص مفصل"},
        {"type": "chart", "content": "وصف", "chartConfig": {...}},
        {"type": "image", "content": "وصف", "imagePrompt": "وصف بالإنجليزية"},
        {"type": "table", "content": "عنوان", "tableData": {"headers": ["عمود1"], "rows": [["قيمة1"]]}}
      ]
    }
  ]
}

قواعد:
- عدد الصفحات = ${pages} بالضبط
- وزع المحتوى بالتساوي
- كل صفحة: 3-5 أقسام
- استخدم مزيج من النصوص والمخططات والصور والجداول`
    : `You are a professional writer. Create a PDF with exactly ${pages} pages.

Return JSON:
{
  "title": "Document Title",
  "pages": [
    {
      "pageNumber": 1,
      "sections": [
        {"type": "heading", "content": "Heading"},
        {"type": "text", "content": "Detailed text"},
        {"type": "chart", "content": "Description", "chartConfig": {...}},
        {"type": "image", "content": "Description", "imagePrompt": "English description"},
        {"type": "table", "content": "Title", "tableData": {"headers": ["Col1"], "rows": [["Val1"]]}}
      ]
    }
  ]
}

Rules:
- Pages = ${pages} exactly
- Distribute content evenly
- Each page: 3-5 sections
- Mix text, charts, images, tables`;
}

function generateQuickChartUrl(config: any): string {
  const chartConfig = {
    type: config.type,
    data: {
      labels: config.labels,
      datasets: config.datasets.map((ds: any) => ({
        label: ds.label,
        data: ds.data,
        backgroundColor: ['rgba(102,126,234,0.8)', 'rgba(118,75,162,0.8)', 'rgba(237,100,166,0.8)'],
        borderColor: 'rgba(102,126,234,1)',
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: true, text: config.title, font: { size: 18, weight: 'bold' } },
      },
    },
  };
  
  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&width=800&height=500&backgroundColor=white`;
}

async function generateFALImage(prompt: string): Promise<string> {
  const response = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "landscape_16_9",
      num_inference_steps: 4,
      num_images: 1,
    }),
  });
  
  if (!response.ok) throw new Error(`FAL error: ${response.statusText}`);
  
  const result = await response.json();
  return result.images[0].url;
}

function generateBeautifulPDF(content: any, language: string, chartUrls: string[], imageUrls: string[]): string {
  const isRTL = language === 'ar';
  let chartIndex = 0;
  let imageIndex = 0;
  
  let pagesHTML = '';
  
  for (const page of content.pages || []) {
    let pageContent = '';
    
    for (const section of page.sections || []) {
      if (section.type === 'heading') {
        pageContent += `<h2 class="section-heading">${escapeHTML(section.content)}</h2>`;
      } else if (section.type === 'text') {
        pageContent += `<p class="section-text">${escapeHTML(section.content)}</p>`;
      } else if (section.type === 'chart' && chartIndex < chartUrls.length) {
        pageContent += `<div class="chart-container"><img src="${chartUrls[chartIndex]}" class="chart-image" /></div>`;
        chartIndex++;
      } else if (section.type === 'image' && imageIndex < imageUrls.length) {
        pageContent += `<div class="image-container"><img src="${imageUrls[imageIndex]}" class="visual-image" /></div>`;
        imageIndex++;
      } else if (section.type === 'table' && section.tableData) {
        pageContent += `<div class="table-container"><table class="data-table">
          <thead><tr>${section.tableData.headers.map((h: string) => `<th>${escapeHTML(h)}</th>`).join('')}</tr></thead>
          <tbody>${section.tableData.rows.map((row: string[]) => 
            `<tr>${row.map((cell: string) => `<td>${escapeHTML(cell)}</td>`).join('')}</tr>`
          ).join('')}</tbody>
        </table></div>`;
      }
    }
    
    pagesHTML += `<div class="pdf-page">
      <div class="page-header"><div class="page-number">Page ${page.pageNumber} of ${content.pages.length}</div></div>
      <div class="page-content">${pageContent}</div>
    </div>`;
  }
  
  return `<!DOCTYPE html>
<html lang="${language}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(content.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; color: #2d3748; }
    .pdf-page { width: 210mm; min-height: 297mm; background: white; margin: 0 auto 20px; padding: 25mm; box-shadow: 0 4px 6px rgba(0,0,0,0.1); page-break-after: always; position: relative; }
    .page-header { position: absolute; top: 15mm; right: 25mm; left: 25mm; padding-bottom: 10mm; border-bottom: 3px solid; border-image: linear-gradient(90deg, #667eea 0%, #764ba2 100%) 1; }
    .page-number { text-align: right; font-size: 11px; color: #718096; font-weight: 600; }
    .page-content { margin-top: 20mm; }
    .section-heading { font-size: 24px; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 15px; margin-top: 20px; }
    .section-text { font-size: 14px; line-height: 1.8; color: #4a5568; margin-bottom: 15px; text-align: justify; }
    .chart-container, .image-container { margin: 20px 0; text-align: center; page-break-inside: avoid; }
    .chart-image, .visual-image { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .table-container { margin: 20px 0; overflow-x: auto; page-break-inside: avoid; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .data-table th { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: left; font-weight: 600; }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    .data-table tr:nth-child(even) { background: #f7fafc; }
    @media print { body { background: white; } .pdf-page { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <div style="text-align: center; padding: 40px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 20px;">
    <h1 style="font-size: 36px; font-weight: 700; margin: 0;">${escapeHTML(content.title)}</h1>
  </div>
  ${pagesHTML}
</body>
</html>`;
}

function escapeHTML(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
