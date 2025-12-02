import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { deflate } from "https://deno.land/x/compress@v0.4.5/zlib/deflate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KROKI_BASE_URL = "https://kroki.io";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DiagramFamily = "auto" | "flow" | "timeline" | "process" | "map" | "system";
type Language = "en" | "ar";

interface DiagramRequest {
  inputText?: string;
  fileContent?: string; // base64 or extracted text from uploaded file
  diagramFamily: DiagramFamily;
  language: Language;
  maxDiagrams: 1 | 2 | 3;
}

interface DiagramSpec {
  engine: "mermaid" | "graphviz" | "plantuml" | "excalidraw";
  kind: string;
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  diagramSource: string;
}

interface GeneratedDiagram {
  id: string;
  title: string;
  description: string;
  type: string;
  engine: string;
  imageUrl: string;
  diagramSource: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📊 Wakti Diagrams v1: Request received");

    // Auth
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
    const body: DiagramRequest = await req.json();
    const { inputText, fileContent, diagramFamily, language, maxDiagrams } = body;

    const textToProcess = inputText || fileContent || "";

    if (!textToProcess.trim()) {
      throw new Error("No input text or file content provided");
    }

    if (maxDiagrams < 1 || maxDiagrams > 3) {
      throw new Error("maxDiagrams must be 1, 2, or 3");
    }

    console.log("📋 Request:", {
      textLength: textToProcess.length,
      diagramFamily,
      language,
      maxDiagrams,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Call GPT-4o-mini to plan diagrams
    // ─────────────────────────────────────────────────────────────────────────
    console.log("🤖 Calling GPT-4o-mini for diagram planning...");

    const diagramSpecs = await planDiagrams(textToProcess, diagramFamily, language, maxDiagrams);

    console.log(`✅ GPT returned ${diagramSpecs.length} diagram spec(s)`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Render each diagram via Kroki
    // ─────────────────────────────────────────────────────────────────────────
    console.log("🎨 Rendering diagrams via Kroki...");

    const generatedDiagrams: GeneratedDiagram[] = [];

    for (const spec of diagramSpecs) {
      try {
        const svgContent = await renderWithKroki(spec.engine, spec.diagramSource);

        // Upload to Supabase Storage
        const diagramId = crypto.randomUUID();
        const fileName = `${diagramId}.svg`;
        const storagePath = `${user.id}/diagrams/${fileName}`;

        const encoder = new TextEncoder();
        const svgBuffer = encoder.encode(svgContent);

        const { error: uploadError } = await supabase.storage
          .from("generated-files")
          .upload(storagePath, svgBuffer, {
            contentType: "image/svg+xml",
            upsert: true,
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const { data: signedUrlData } = await supabase.storage
          .from("generated-files")
          .createSignedUrl(storagePath, 86400 * 7); // 7 days

        generatedDiagrams.push({
          id: diagramId,
          title: language === "ar" && spec.titleAr ? spec.titleAr : spec.title,
          description: language === "ar" && spec.descriptionAr ? spec.descriptionAr : spec.description,
          type: spec.kind,
          engine: spec.engine,
          imageUrl: signedUrlData?.signedUrl || "",
          diagramSource: spec.diagramSource,
        });

        console.log(`✅ Diagram "${spec.title}" rendered and stored`);
      } catch (err) {
        console.error(`❌ Failed to render diagram "${spec.title}":`, err);
      }
    }

    console.log(`📊 Successfully generated ${generatedDiagrams.length} diagram(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        count: generatedDiagrams.length,
        diagrams: generatedDiagrams,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GPT-4o-mini: Plan diagrams from text
// ─────────────────────────────────────────────────────────────────────────────

async function planDiagrams(
  text: string,
  family: DiagramFamily,
  language: Language,
  maxDiagrams: number
): Promise<DiagramSpec[]> {
  const systemPrompt = buildSystemPrompt(family, language, maxDiagrams);

  // Truncate text if too long (keep it cheap)
  const maxChars = 6000;
  const truncatedText = text.length > maxChars ? text.slice(0, maxChars) + "\n\n[...truncated]" : text;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: truncatedText },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content returned from OpenAI");
  }

  const parsed = JSON.parse(content);
  return parsed.diagrams || [];
}

function buildSystemPrompt(family: DiagramFamily, language: Language, maxDiagrams: number): string {
  const familyInstructions = getFamilyInstructions(family);
  const langNote = language === "ar"
    ? "Use Arabic labels in the diagram. Provide titleAr and descriptionAr fields."
    : "Use English labels in the diagram.";

  return `You are a professional diagram designer. Your job is to analyze text and create clear, meaningful diagrams.

TASK:
- Read the user's text carefully.
- Create EXACTLY ${maxDiagrams} diagram(s) that best represent the content.
- Each diagram should have 5-10 nodes/elements (not too simple, not too complex).

${familyInstructions}

LANGUAGE:
${langNote}

OUTPUT FORMAT (strict JSON):
{
  "diagrams": [
    {
      "engine": "mermaid" | "graphviz" | "plantuml",
      "kind": "flow" | "timeline" | "process" | "map" | "sequence" | "gantt" | "org" | "system",
      "title": "Short English title",
      "titleAr": "Short Arabic title (if Arabic)",
      "description": "One sentence describing what this diagram shows",
      "descriptionAr": "Arabic description (if Arabic)",
      "diagramSource": "The actual diagram code for the chosen engine"
    }
  ]
}

DIAGRAM CODE RULES:
- For Mermaid flowcharts: use "flowchart LR" or "flowchart TD"
- For Mermaid timeline: use "gantt" or "timeline"
- For Mermaid sequence: use "sequenceDiagram"
- For GraphViz: use "digraph G { ... }" syntax
- For PlantUML: use "@startuml ... @enduml" syntax
- Keep node labels SHORT (max 4-5 words)
- Use simple ASCII characters, avoid special symbols that might break rendering
- Do NOT use markdown code fences inside diagramSource

IMPORTANT:
- Return ONLY valid JSON, nothing else.
- The diagramSource must be valid syntax for the chosen engine.`;
}

function getFamilyInstructions(family: DiagramFamily): string {
  switch (family) {
    case "flow":
      return `DIAGRAM TYPE: Flow / Journey
Create flowcharts showing steps, processes, or user journeys.
Use Mermaid "flowchart LR" or "flowchart TD".
Show clear progression from start to end.`;

    case "timeline":
      return `DIAGRAM TYPE: Timeline / Roadmap
Create timeline or Gantt-style diagrams showing events over time.
Use Mermaid "gantt" or "timeline" syntax.
Show chronological progression.`;

    case "process":
      return `DIAGRAM TYPE: Process / Decisions
Create process diagrams with decision points (yes/no branches).
Use Mermaid "flowchart" with diamond shapes for decisions.
Show conditions and different paths.`;

    case "map":
      return `DIAGRAM TYPE: Map / Org / Stakeholders
Create relationship maps, org charts, or stakeholder diagrams.
Use GraphViz "digraph" or Mermaid "flowchart" for relationships.
Show who connects to whom, hierarchies, or influence.`;

    case "system":
      return `DIAGRAM TYPE: System / Architecture
Create system architecture or technical diagrams.
Use PlantUML C4 or Mermaid flowchart for components.
Show systems, APIs, databases, and how they connect.`;

    case "auto":
    default:
      return `DIAGRAM TYPE: Auto (choose the best)
Analyze the text and pick the most appropriate diagram type(s).
You may mix different types if the content warrants it.
Choose from: flow, timeline, process, map, sequence, system.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Kroki: Render diagram to SVG
// ─────────────────────────────────────────────────────────────────────────────

async function renderWithKroki(engine: string, diagramSource: string): Promise<string> {
  // Map our engine names to Kroki endpoints
  const engineMap: Record<string, string> = {
    mermaid: "mermaid",
    graphviz: "graphviz",
    plantuml: "plantuml",
    excalidraw: "excalidraw",
  };

  const krokiEngine = engineMap[engine] || "mermaid";

  // Kroki accepts POST with JSON body
  const response = await fetch(`${KROKI_BASE_URL}/${krokiEngine}/svg`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: diagramSource,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Kroki error (${krokiEngine}): ${response.status} - ${errText}`);
  }

  return await response.text();
}
