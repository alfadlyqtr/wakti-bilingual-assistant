import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logAIFromRequest } from "../_shared/aiLogger.ts";

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

type DiagramFamily =
  | "auto"
  | "flow"
  | "timeline"
  | "process"
  | "map"
  | "system"
  | "mindmap"
  | "sequence"
  | "handdrawn";

type Language = "en" | "ar";

type KrokiStyleKey =
  | "auto"
  // Common Graphs
  | "flowchart"
  | "block-diagram"
  | "dag"
  | "mindmap-style"
  // UML / C4
  | "sequence-diagram"
  | "er-diagram"
  | "activity-diagram"
  | "use-case"
  | "uml-general"
  | "c4-diagram"
  // Project Management
  | "wbs"
  | "gantt"
  | "business-process"
  // Freestyle
  | "hand-drawn"
  | "ascii-art"
  // Hardware
  | "byte-field"
  | "digital-timing"
  // Network
  | "network-diagram"
  | "packets"
  | "rack"
  // Data Visualization
  | "word-cloud"
  | "bar-chart";

interface DiagramRequest {
  inputText?: string;
  fileContent?: string; // base64 or extracted text from uploaded file
  imageBase64?: string; // base64 image data for Vision extraction
  imageMimeType?: string; // e.g., "image/png", "image/jpeg"
  extractOnly?: boolean; // If true, just extract text from image and return it
  diagramFamily?: DiagramFamily;
  language: Language;
  maxDiagrams?: 1 | 2 | 3;
  userId?: string;
  krokiStyle?: KrokiStyleKey;
}

interface DiagramSpec {
  engine: string;
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
    console.log("📊 Wakti Diagrams v1.5 NEWLINE FIX: Request received");

    // Service role client – no per-request auth required
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request
    const body: DiagramRequest = await req.json();
    const { inputText, fileContent, imageBase64, imageMimeType, extractOnly, diagramFamily, language, maxDiagrams, userId, krokiStyle } = body;

    // ─────────────────────────────────────────────────────────────────────────
    // Extract-only mode: Just extract text from image and return it
    // ─────────────────────────────────────────────────────────────────────────
    if (extractOnly && imageBase64) {
      console.log("🖼️ Extract-only mode: Extracting text from image...");
      const extractedText = await extractTextFromImage(imageBase64, imageMimeType || "image/png");
      console.log(`📝 Extracted ${extractedText.length} characters`);
      
      return new Response(
        JSON.stringify({
          success: true,
          extractedText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ownerId = userId && userId.trim().length > 0 ? userId : `anon-${crypto.randomUUID().slice(0, 8)}`;

    let textToProcess = inputText || fileContent || "";

    // If image provided, extract text using Vision AI (GPT-4o-mini - cheap & fast)
    if (imageBase64 && !textToProcess.trim()) {
      console.log("🖼️ Image detected, extracting text with Vision AI...");
      textToProcess = await extractTextFromImage(imageBase64, imageMimeType || "image/png");
      console.log(`📝 Extracted ${textToProcess.length} characters from image`);
    }

    if (!textToProcess.trim()) {
      throw new Error("No input text or file content provided");
    }

    const numDiagrams = maxDiagrams || 1;
    if (numDiagrams < 1 || numDiagrams > 3) {
      throw new Error("maxDiagrams must be 1, 2, or 3");
    }

    console.log("📋 Request:", {
      textLength: textToProcess.length,
      diagramFamily,
      language,
      maxDiagrams: numDiagrams,
      krokiStyle,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Smart Auto - classify text and pick best diagram style
    // ─────────────────────────────────────────────────────────────────────────
    let effectiveStyle: KrokiStyleKey = krokiStyle || 'auto';
    
    if (effectiveStyle === 'auto') {
      console.log("🧠 Auto mode: Running hybrid text classifier...");
      effectiveStyle = await classifyTextForDiagram(textToProcess);
      console.log(`✅ Classifier picked style: ${effectiveStyle}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Call GPT-4o-mini to plan diagrams with the chosen style
    // ─────────────────────────────────────────────────────────────────────────
    console.log("🤖 Calling GPT-4o-mini for diagram planning...");

    const diagramSpecs = await planDiagrams(textToProcess, diagramFamily || 'auto', language, numDiagrams, effectiveStyle);

    console.log(`✅ GPT returned ${diagramSpecs.length} diagram spec(s)`);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2: Render each diagram via Kroki
    // ─────────────────────────────────────────────────────────────────────────
    console.log("🎨 Rendering diagrams via Kroki...");

    const generatedDiagrams: GeneratedDiagram[] = [];

    for (const spec of diagramSpecs) {
      try {
        console.log(`🔧 Rendering diagram: ${spec.title} (engine: ${spec.engine})`);
        console.log(`📝 Diagram source (first 200 chars): ${spec.diagramSource.substring(0, 200)}`);
        
        const pngBuffer = await renderWithKroki(spec.engine, spec.diagramSource);
        console.log(`✅ Kroki rendered PNG (${pngBuffer.length} bytes)`);

        // Upload PNG to Supabase Storage
        const diagramId = crypto.randomUUID();
        const fileName = `${diagramId}.png`;
        const storagePath = `${ownerId}/diagrams/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("generated-files")
          .upload(storagePath, pngBuffer, {
            contentType: "image/png",
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
        // Log the diagram source for debugging
        console.error(`📝 Failed diagram source: ${spec.diagramSource}`);
      }
    }

    console.log(`📊 Successfully generated ${generatedDiagrams.length} diagram(s)`);

    // Log successful AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-diagrams-v1",
      provider: "openai",
      model: "gpt-4o-mini",
      inputText: inputText || "[image input]",
      status: "success",
      metadata: { diagramCount: generatedDiagrams.length }
    });

    return new Response(
      JSON.stringify({
        success: true,
        count: generatedDiagrams.length,
        diagrams: generatedDiagrams,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Error:", err);
    
    // Log failed AI usage
    await logAIFromRequest(req, {
      functionName: "wakti-diagrams-v1",
      provider: "openai",
      model: "gpt-4o-mini",
      status: "error",
      errorMessage: err.message
    });

    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Hybrid Text Classifier - Picks best diagram style for Auto mode
// ─────────────────────────────────────────────────────────────────────────────

async function classifyTextForDiagram(text: string): Promise<KrokiStyleKey> {
  
  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Heuristic rules (fast, no API call)
  // ─────────────────────────────────────────────────────────────────────────
  
  // Legal/Policy/Terms → mindmap (extract key concepts)
  const legalKeywords = /\b(privacy|policy|terms|conditions|agreement|legal|copyright|disclaimer|liability|rights|consent|gdpr|data protection|cookie|refund|warranty)\b/i;
  if (legalKeywords.test(text)) {
    console.log("📋 Heuristic: Detected legal/policy text → mindmap");
    return "mindmap-style";
  }
  
  // Timeline/Schedule/Dates → gantt
  const timelineKeywords = /\b(schedule|timeline|deadline|milestone|phase|week|month|year|q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|2024|2025|2026|ramadan|eid)\b/i;
  const hasMultipleDates = (text.match(/\d{1,2}[\/\-]\d{1,2}|\d{4}/g) || []).length >= 2;
  if (timelineKeywords.test(text) || hasMultipleDates) {
    console.log("📅 Heuristic: Detected timeline/schedule → gantt");
    return "gantt";
  }
  
  // Process/Steps/Flow → flowchart
  const processKeywords = /\b(step|process|flow|workflow|procedure|stage|then|next|after|before|first|second|third|finally|start|end|begin|complete)\b/i;
  const hasNumberedSteps = /\b(1\.|2\.|3\.|step 1|step 2|الخطوة)/i.test(text);
  if (processKeywords.test(text) || hasNumberedSteps) {
    console.log("🔄 Heuristic: Detected process/steps → flowchart");
    return "flowchart";
  }
  
  // Org/Teams/Hierarchy → block-diagram
  const orgKeywords = /\b(team|department|manager|director|ceo|cto|employee|staff|organization|hierarchy|report|supervisor|lead|head of)\b/i;
  if (orgKeywords.test(text)) {
    console.log("🏢 Heuristic: Detected org/hierarchy → block-diagram");
    return "block-diagram";
  }
  
  // Sequence/Interaction → sequence-diagram
  const sequenceKeywords = /\b(request|response|send|receive|call|return|api|server|client|user|system|message|notify)\b/i;
  if (sequenceKeywords.test(text)) {
    console.log("🔀 Heuristic: Detected sequence/interaction → sequence-diagram");
    return "sequence-diagram";
  }
  
  // Database/Entities → er-diagram
  const dbKeywords = /\b(table|database|entity|relation|foreign key|primary key|column|field|record|schema|sql)\b/i;
  if (dbKeywords.test(text)) {
    console.log("🗄️ Heuristic: Detected database/entities → er-diagram");
    return "er-diagram";
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: AI fallback for unclear text (small, cheap call)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("🤖 Heuristic unclear, using AI classifier...");
  
  try {
    const classifierPrompt = `Analyze this text and pick the BEST diagram type. Return ONLY one of these exact values:
- "flowchart" (for processes, steps, workflows, decisions)
- "mindmap-style" (for concepts, topics, brainstorming, policies, terms)
- "gantt" (for schedules, timelines, project plans)
- "sequence-diagram" (for interactions, API calls, message flows)
- "block-diagram" (for systems, architecture, org charts)
- "er-diagram" (for databases, entities, relationships)

Text to analyze (first 500 chars):
${text.substring(0, 500)}

Return ONLY the diagram type, nothing else.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: classifierPrompt }],
        temperature: 0.1,
        max_tokens: 50,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const style = result.choices?.[0]?.message?.content?.trim().toLowerCase();
      
      // Validate the response
      const validStyles: KrokiStyleKey[] = ["flowchart", "mindmap-style", "gantt", "sequence-diagram", "block-diagram", "er-diagram"];
      if (validStyles.includes(style as KrokiStyleKey)) {
        console.log(`✅ AI classifier picked: ${style}`);
        return style as KrokiStyleKey;
      }
    }
  } catch (err) {
    console.error("AI classifier error:", err);
  }
  
  // Default fallback: mindmap (works for most general text)
  console.log("⚠️ Fallback to mindmap-style");
  return "mindmap-style";
}

// ─────────────────────────────────────────────────────────────────────────────
// GPT-4o-mini Vision: Extract text from image (cheap & fast)
// ─────────────────────────────────────────────────────────────────────────────

async function extractTextFromImage(base64Data: string, mimeType: string): Promise<string> {
  // Normalize mime type
  let normalizedMime = mimeType;
  if (normalizedMime === "image/jpg") normalizedMime = "image/jpeg";
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Cheap & fast vision model
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ALL text from this image. Return ONLY the extracted text, nothing else. If there's no text, describe the key concepts, items, or workflow shown in the image that could be turned into a diagram.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${normalizedMime};base64,${base64Data}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Vision API error:", errText);
    throw new Error(`Vision extraction failed: ${response.status}`);
  }

  const result = await response.json();
  const extractedText = result.choices?.[0]?.message?.content || "";
  
  return extractedText.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// GPT-4o-mini: Plan diagrams from text
// ─────────────────────────────────────────────────────────────────────────────

async function planDiagrams(
  text: string,
  family: DiagramFamily,
  language: Language,
  maxDiagrams: number,
  krokiStyle: KrokiStyleKey
): Promise<DiagramSpec[]> {
  const systemPrompt = buildSystemPrompt(family, language, maxDiagrams, krokiStyle);

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
  const diagrams = parsed.diagrams || [];
  
  // If no diagrams returned, create a fallback
  if (diagrams.length === 0) {
    console.log("⚠️ No diagrams from AI, creating fallback...");
    return [{
      engine: "mermaid",
      kind: "flowchart",
      title: "Content Overview",
      titleAr: "نظرة عامة على المحتوى",
      description: "A visual representation of the key concepts",
      descriptionAr: "تمثيل مرئي للمفاهيم الرئيسية",
      diagramSource: "flowchart TD\n    A[Input] --> B[Process]\n    B --> C[Output]"
    }];
  }
  
  return diagrams;
}

function buildSystemPrompt(_family: DiagramFamily, language: Language, maxDiagrams: number, krokiStyle: KrokiStyleKey): string {
  const langNote = language === "ar"
    ? "Use Arabic labels in the diagram. Provide titleAr and descriptionAr fields."
    : "Use English labels in the diagram.";

  // Get style-specific instructions (this is the key fix!)
  const styleInstructions = getKrokiStyleInstructions(krokiStyle);

  return `You are a professional diagram designer. Your job is to analyze text and create clear, meaningful diagrams.

TASK:
- Read the user's text carefully.
- Create EXACTLY ${maxDiagrams} diagram(s) that best represent the content.
- Each diagram should have 5-10 nodes/elements (not too simple, not too complex).

${styleInstructions}

LANGUAGE:
${langNote}

OUTPUT FORMAT (strict JSON):
{
  "diagrams": [
    {
      "engine": "<engine from style instructions>",
      "kind": "<diagram type>",
      "title": "Short English title",
      "titleAr": "Short Arabic title (if Arabic)",
      "description": "One sentence describing what this diagram shows",
      "descriptionAr": "Arabic description (if Arabic)",
      "diagramSource": "The actual diagram code for the chosen engine"
    }
  ]
}

CRITICAL FORMATTING RULES:
- Return ONLY valid JSON, nothing else.
- The diagramSource must be valid syntax for the chosen engine.
- EXTREMELY IMPORTANT: In diagramSource, use REAL NEWLINE CHARACTERS (actual line breaks in the JSON string).
- DO NOT use \\n escape sequences - they don't work! Use actual newlines.
- For Mermaid flowcharts, EACH element must be on a separate line.
- For Mermaid gantt, EACH line (title, dateFormat, section, task) must be on its own line.
- Keep node labels SHORT (max 4-5 words).
- Use simple ASCII characters, avoid special symbols that might break rendering.
- Do NOT use markdown code fences inside diagramSource.
- Do NOT put multiple elements on the same line - THIS WILL CAUSE ERRORS.

CORRECT diagramSource example (with real newlines):
"flowchart TD
    A[Step 1]
    A --> B[Step 2]
    B --> C[Step 3]"

WRONG (WILL FAIL):
"flowchart TD A[Step 1] A --> B[Step 2] B --> C[Step 3]"`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kroki Style Instructions - Maps user selection to specific engine + syntax
// ─────────────────────────────────────────────────────────────────────────────

function getKrokiStyleInstructions(style: KrokiStyleKey): string {
  switch (style) {
    // ─────────────────────────────────────────────────────────────────────────
    // Common Graphs
    // ─────────────────────────────────────────────────────────────────────────
    case "flowchart":
      return `MANDATORY STYLE: Flowchart (Mermaid)
Engine: "mermaid"
You MUST use Mermaid flowchart syntax. Example:
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
Create flowcharts showing processes, decisions, and workflows.
Use TD for top-down, LR for left-right. Use {} for decisions, [] for actions.
IMPORTANT: Each element MUST be on its own line.`;

    case "block-diagram":
      return `MANDATORY STYLE: Block Diagram
Engine: "graphviz"
You MUST use GraphViz DOT syntax. Example:
digraph G {
  rankdir=LR;
  node [shape=box, style=filled, fillcolor=lightblue];
  
  A [label="Input"];
  B [label="Process"];
  C [label="Output"];
  D [label="Storage"];
  
  A -> B;
  B -> C;
  B -> D;
}
Create block diagrams showing components and connections.
Use shape=box for rectangular blocks, arrows for relationships.`;

    case "dag":
      return `MANDATORY STYLE: Directed Acyclic Graph (GraphViz)
Engine: "graphviz"
You MUST use GraphViz DOT syntax. Example:
digraph G {
  rankdir=LR;
  A -> B;
  A -> C;
  B -> D;
  C -> D;
}
Create DAG showing dependencies, data flow, or task ordering.
Use arrows to show direction, no cycles allowed.`;

    case "mindmap-style":
      return `MANDATORY STYLE: Mind Map (PlantUML)
Engine: "plantuml"
You MUST use PlantUML mindmap syntax. Example:
@startmindmap
* Central Topic
** Branch 1
*** Sub-topic 1.1
*** Sub-topic 1.2
** Branch 2
*** Sub-topic 2.1
@endmindmap
Create mind maps with central topic and radiating branches.
Use * for levels, ** for sub-branches.`;

    // ─────────────────────────────────────────────────────────────────────────
    // UML / C4
    // ─────────────────────────────────────────────────────────────────────────
    case "sequence-diagram":
      return `MANDATORY STYLE: Sequence Diagram (Mermaid)
Engine: "mermaid"
You MUST use Mermaid sequenceDiagram syntax. Example:
sequenceDiagram
    participant A as User
    participant B as Server
    A->>B: Request
    B-->>A: Response
Show interactions between actors/systems over time.
Use ->> for sync calls, -->> for responses.`;

    case "er-diagram":
      return `MANDATORY STYLE: Entity-Relationship Diagram (Mermaid)
Engine: "mermaid"
You MUST use Mermaid erDiagram syntax. Example:
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    PRODUCT ||--o{ LINE-ITEM : "ordered in"
Show database entities and their relationships.
Use proper cardinality notation.`;

    case "activity-diagram":
      return `MANDATORY STYLE: Activity Diagram (PlantUML)
Engine: "plantuml"
You MUST use PlantUML activity syntax. Example:
@startuml
start
:Step 1;
if (condition?) then (yes)
  :Step 2a;
else (no)
  :Step 2b;
endif
:Step 3;
stop
@enduml
Show workflow with decisions, forks, and joins.
Use start/stop, if/else, fork/join.`;

    case "use-case":
      return `MANDATORY STYLE: Use Case Diagram (PlantUML)
Engine: "plantuml"
You MUST use PlantUML use case syntax. Example:
@startuml
left to right direction
actor User
actor Admin
rectangle System {
  User --> (Login)
  User --> (View Data)
  Admin --> (Manage Users)
}
@enduml
Show actors and their interactions with system use cases.
Use actors, rectangles for systems, ovals for use cases.`;

    case "uml-general":
      return `MANDATORY STYLE: UML Class Diagram (PlantUML)
Engine: "plantuml"
You MUST use PlantUML class syntax. Example:
@startuml
class User {
  +name: String
  +email: String
  +login()
}
class Order {
  +id: int
  +total: float
}
User "1" --> "*" Order : places
@enduml
Show classes, attributes, methods, and relationships.
Use proper UML notation.`;

    case "c4-diagram":
      return `MANDATORY STYLE: C4 Architecture Diagram
Engine: "plantuml"
You MUST use PlantUML component diagram for C4-style. Example:
@startuml
skinparam componentStyle rectangle
skinparam component {
  BackgroundColor<<person>> LightBlue
  BackgroundColor<<system>> LightGreen
  BackgroundColor<<container>> LightYellow
  BackgroundColor<<database>> LightCoral
}

actor "User" <<person>> as user

package "System Boundary" {
  component "Web App\n[React]" <<container>> as web
  component "API\n[Node.js]" <<container>> as api
  database "Database\n[PostgreSQL]" <<database>> as db
}

user --> web : Uses
web --> api : Calls
api --> db : Reads/Writes
@enduml
Show system architecture with components and relationships.
Use packages for boundaries, components for services.`;

    // ─────────────────────────────────────────────────────────────────────────
    // Project Management
    // ─────────────────────────────────────────────────────────────────────────
    case "wbs":
      return `MANDATORY STYLE: Work Breakdown Structure (PlantUML)
Engine: "plantuml"
You MUST use PlantUML WBS syntax. Example:
@startwbs
* Project
** Phase 1
*** Task 1.1
*** Task 1.2
** Phase 2
*** Task 2.1
*** Task 2.2
@endwbs
Show hierarchical breakdown of work.
Use * for levels, indent for hierarchy.`;

    case "gantt":
      return `MANDATORY STYLE: Gantt Chart (Mermaid)
Engine: "mermaid"

IMPORTANT: Gantt charts are for PROJECT TIMELINES with DATES, not daily schedules.
- If the user asks about daily routines (sleep, eat, gym, etc.), use a FLOWCHART instead.
- Only use Gantt for multi-day/week/month project planning.

For daily routines, use this flowchart format instead:
flowchart LR
    A[Sleep 8h] --> B[Eat 1h]
    B --> C[Gym 2h]
    C --> D[Work 8h]
    D --> E[Relax 3h]
    E --> F[Sleep]

For actual project timelines, use Gantt:
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Task 1 :a1, 2024-01-01, 7d
    Task 2 :a2, after a1, 5d
    section Phase 2
    Task 3 :b1, after a2, 10d

CRITICAL RULES:
- dateFormat MUST be YYYY-MM-DD (not HHmm or HH:mm)
- Task dates must be in YYYY-MM-DD format
- Each line must be on its own line (use real newlines)
- DO NOT use time-based formats like 00:00 or 8h for start times`;

    case "business-process":
      return `MANDATORY STYLE: Business Process (BPMN via PlantUML)
Engine: "plantuml"
You MUST use PlantUML activity syntax for BPMN-like diagrams. Example:
@startuml
|Customer|
start
:Submit Order;
|Sales|
:Review Order;
if (Approved?) then (yes)
  :Process Payment;
  |Warehouse|
  :Ship Order;
else (no)
  |Customer|
  :Notify Rejection;
endif
stop
@enduml
Show business processes with swimlanes.
Use |Lane| for swimlanes, activities, decisions.`;

    // ─────────────────────────────────────────────────────────────────────────
    // Freestyle
    // ─────────────────────────────────────────────────────────────────────────
    case "hand-drawn":
      return `MANDATORY STYLE: Hand-Drawn Sketch Style
Engine: "plantuml"
You MUST use PlantUML with handwritten style enabled. Example:
@startuml
skinparam handwritten true
skinparam backgroundColor #FFFEF0
skinparam roundcorner 15
skinparam ArrowColor #333333
skinparam ActivityBackgroundColor #FFF8DC
skinparam ActivityBorderColor #DEB887

start
:First Step;
:Second Step;
if (Decision?) then (yes)
  :Option A;
else (no)
  :Option B;
endif
:Final Step;
stop
@enduml

CRITICAL: You MUST include "skinparam handwritten true" at the start.
This creates a sketchy, hand-drawn appearance.
Use warm colors like #FFFEF0, #FFF8DC, #DEB887 for a paper-like feel.`;

    case "ascii-art":
      return `MANDATORY STYLE: Simple Text-Based Diagram
Engine: "plantuml"
You MUST use PlantUML with monospace/simple style. Example:
@startuml
skinparam monochrome true
skinparam defaultFontName Courier
skinparam shadowing false

rectangle "Step 1" as s1
rectangle "Step 2" as s2
rectangle "Step 3" as s3
rectangle "Step 4" as s4

s1 --> s2
s1 --> s3
s2 --> s4
s3 --> s4
@enduml
Create simple, clean diagrams with minimal styling.
Use monochrome true for ASCII-like appearance.`;

    // ─────────────────────────────────────────────────────────────────────────
    // Hardware
    // ─────────────────────────────────────────────────────────────────────────
    case "byte-field":
      return `MANDATORY STYLE: Byte Field / Data Structure
Engine: "plantuml"
You MUST use PlantUML to show data structures. Example:
@startuml
skinparam rectangle {
  BackgroundColor<<header>> LightBlue
  BackgroundColor<<data>> LightYellow
}

rectangle "Packet Header" <<header>> {
  rectangle "Version\n(4 bits)" as v
  rectangle "IHL\n(4 bits)" as ihl
  rectangle "Type of Service\n(8 bits)" as tos
  rectangle "Total Length\n(16 bits)" as len
}

v -right-> ihl
ihl -right-> tos
tos -right-> len
@enduml
Show data structures with labeled fields.
Use rectangles to represent byte/bit fields.`;

    case "digital-timing":
      return `MANDATORY STYLE: Digital Timing / Sequence
Engine: "mermaid"
You MUST use Mermaid sequenceDiagram for timing. Example:
sequenceDiagram
    participant CLK as Clock
    participant DATA as Data
    participant EN as Enable
    
    Note over CLK,EN: T0
    CLK->>CLK: Rising Edge
    EN->>EN: HIGH
    DATA->>DATA: Valid
    
    Note over CLK,EN: T1
    CLK->>CLK: Falling Edge
    DATA->>DATA: Change
    
    Note over CLK,EN: T2
    CLK->>CLK: Rising Edge
    EN->>EN: LOW
Show timing relationships between signals.
Use notes for time markers.`;

    // ─────────────────────────────────────────────────────────────────────────
    // Network
    // ─────────────────────────────────────────────────────────────────────────
    case "network-diagram":
      return `MANDATORY STYLE: Network Diagram
Engine: "plantuml"
You MUST use PlantUML nwdiag syntax. Example:
@startuml
nwdiag {
  network internet {
    address = "Internet"
    router [address = "Gateway"];
  }
  network internal {
    address = "192.168.1.x/24"
    router [address = ".1"];
    server [address = ".10"];
    client [address = ".20"];
  }
}
@enduml
Show network topology with devices and connections.
Wrap nwdiag in @startuml/@enduml tags.
Use network blocks and device addresses.`;

    case "packets":
      return `MANDATORY STYLE: Packet / Protocol Structure
Engine: "plantuml"
You MUST use PlantUML to show packet structure. Example:
@startuml
skinparam rectangle {
  BackgroundColor<<field>> LightBlue
}

title "IP Packet Header"

rectangle "Bit 0-3\nVersion" <<field>> as f1
rectangle "Bit 4-7\nIHL" <<field>> as f2
rectangle "Bit 8-15\nType of Service" <<field>> as f3
rectangle "Bit 16-31\nTotal Length" <<field>> as f4

f1 -right-> f2
f2 -right-> f3
f3 -right-> f4
@enduml
Show packet/protocol structure with labeled bit fields.
Use rectangles arranged horizontally.`;

    case "rack":
      return `MANDATORY STYLE: Rack / Server Layout
Engine: "plantuml"
You MUST use PlantUML to show rack layout. Example:
@startuml
skinparam rectangle {
  BackgroundColor<<server>> LightGreen
  BackgroundColor<<network>> LightBlue
  BackgroundColor<<storage>> LightYellow
  BackgroundColor<<power>> LightCoral
}

title "Server Rack Layout"

rectangle "U16: Empty" as u16
rectangle "U15: Empty" as u15
rectangle "U13-14: Storage Array" <<storage>> as u13
rectangle "U11-12: Server 2" <<server>> as u11
rectangle "U9-10: Server 1" <<server>> as u9
rectangle "U8: Empty" as u8
rectangle "U7: Network Switch" <<network>> as u7
rectangle "U1-6: UPS" <<power>> as u1

u16 -down-> u15
u15 -down-> u13
u13 -down-> u11
u11 -down-> u9
u9 -down-> u8
u8 -down-> u7
u7 -down-> u1
@enduml
Show server rack layout with equipment in U positions.
Stack rectangles vertically to represent rack units.`;

    // ─────────────────────────────────────────────────────────────────────────
    // Data Visualization
    // ─────────────────────────────────────────────────────────────────────────
    case "word-cloud":
      return `MANDATORY STYLE: Word Cloud / Key Terms
Engine: "plantuml"
You MUST use PlantUML mindmap to show key terms. Example:
@startmindmap
<style>
mindmapDiagram {
  node {
    BackgroundColor lightblue
  }
  :depth(1) {
    BackgroundColor lightgreen
    FontSize 18
  }
  :depth(2) {
    BackgroundColor lightyellow
    FontSize 14
  }
}
</style>
* Main Topic
** Important Term 1
*** Related word
*** Another word
** Key Concept 2
*** Detail
** Theme 3
@endmindmap
Extract key terms from the text and organize as a mindmap.
Larger/more important terms should be closer to center.`;

    case "bar-chart":
      return `MANDATORY STYLE: Bar Chart / Data Visualization
Engine: "mermaid"
You MUST use Mermaid xychart-beta syntax. Example:
xychart-beta
    title "Sales by Quarter"
    x-axis [Q1, Q2, Q3, Q4]
    y-axis "Revenue (thousands)" 0 --> 100
    bar [30, 45, 60, 80]
Extract numerical data from the text and create a bar chart.
Use descriptive axis labels and title.`;

    // ─────────────────────────────────────────────────────────────────────────
    // Auto / Default
    // ─────────────────────────────────────────────────────────────────────────
    case "auto":
    default:
      return `DIAGRAM STYLE: Auto (AI chooses best)

You MUST analyze the text and create a meaningful diagram. Follow these rules:

1. ALWAYS create a diagram, even for short or vague text.
2. Extract key concepts, names, actions, or topics from the text.
3. Use Mermaid flowchart as your DEFAULT - it works for everything.

FOR SHORT/VAGUE TEXT (emails, signatures, greetings, brief notes):
- Extract any names, topics, or actions mentioned
- Create a simple flowchart showing relationships or steps
- Example for "Best regards, Abdullah":
  flowchart TD
      A[Message] --> B[From: Abdullah]
      B --> C[Best Regards]

FOR LONGER TEXT:
- Meeting notes, workflows → Mermaid flowchart
- Schedules, timelines → Mermaid gantt  
- Conversations, APIs → Mermaid sequenceDiagram
- Hierarchies → GraphViz digraph
- Ideas, brainstorming → PlantUML mindmap

Mermaid flowchart (DEFAULT - use this most often):
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E

Mermaid sequenceDiagram:
sequenceDiagram
    participant A as User
    participant B as Server
    A->>B: Request
    B-->>A: Response

GraphViz digraph:
digraph G {
    rankdir=LR;
    node [shape=box];
    A [label="Item 1"];
    B [label="Item 2"];
    A -> B;
}

PlantUML mindmap:
@startmindmap
* Central Topic
** Branch 1
** Branch 2
@endmindmap

CRITICAL RULES:
1. NEVER return empty diagrams array - always create at least one diagram
2. Keep diagrams SIMPLE with 3-8 nodes
3. Use SHORT labels (max 4 words per node)
4. Use only ASCII characters in labels
5. EACH ARROW MUST BE ON ITS OWN LINE - use \\n in diagramSource
6. Example correct format: "flowchart TD\\n    A[Step 1]\\n    A --> B[Step 2]\\n    B --> C[Step 3]"
7. WRONG: "flowchart TD A[Step 1] --> B[Step 2] B --> C[Step 3]" (no newlines = WILL FAIL)`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Kroki: Render diagram to PNG (binary)
// ─────────────────────────────────────────────────────────────────────────────

async function renderWithKroki(engine: string, diagramSource: string): Promise<Uint8Array> {
  // Map our engine names to Kroki endpoints
  // See https://kroki.io/#support for full list
  const engineMap: Record<string, string> = {
    // Common
    mermaid: "mermaid",
    graphviz: "graphviz",
    plantuml: "plantuml",
    // Block diagrams
    blockdiag: "blockdiag",
    // Freestyle
    excalidraw: "excalidraw",
    svgbob: "svgbob",
    // Hardware
    bytefield: "bytefield",
    wavedrom: "wavedrom",
    // Network
    nwdiag: "nwdiag",
    packetdiag: "packetdiag",
    rackdiag: "rackdiag",
    // Data viz
    vega: "vega",
    vegalite: "vegalite",
  };

  const krokiEngine = engineMap[engine] || engine || "mermaid";
  
  // Clean up diagram source - remove markdown code fences if present
  let cleanSource = diagramSource.trim();
  if (cleanSource.startsWith("```")) {
    // Remove opening fence (e.g., ```mermaid or ```plantuml)
    cleanSource = cleanSource.replace(/^```[a-zA-Z]*\n?/, "");
    // Remove closing fence
    cleanSource = cleanSource.replace(/\n?```$/, "");
  }
  
  // CRITICAL FIX: Convert ALL forms of escaped newlines to actual newlines
  // The AI may return \\n, \n as literal strings, or other escape sequences
  
  // Handle literal backslash-n sequences (most common from JSON)
  cleanSource = cleanSource.split('\\n').join('\n');
  
  // Handle double-escaped (from JSON stringify)
  cleanSource = cleanSource.split('\\\\n').join('\n');
  
  // Handle any remaining literal \n that didn't get converted
  cleanSource = cleanSource.replace(/\\n/g, '\n');
  
  // GANTT CHART FIX: Add newlines before keywords if missing
  if (krokiEngine === 'mermaid' && cleanSource.toLowerCase().includes('gantt')) {
    console.log("🔧 Applying Gantt chart fixes...");
    
    // Fix invalid dateFormat - HHmm doesn't work, use YYYY-MM-DD
    cleanSource = cleanSource.replace(/dateFormat\s+HHmm/gi, 'dateFormat HH:mm');
    cleanSource = cleanSource.replace(/dateFormat\s+HH:mm/gi, 'dateFormat YYYY-MM-DD');
    
    // Add newline before each gantt keyword
    cleanSource = cleanSource.replace(/\s+(title\s)/gi, '\n    $1');
    cleanSource = cleanSource.replace(/\s+(dateFormat\s)/gi, '\n    $1');
    cleanSource = cleanSource.replace(/\s+(section\s)/gi, '\n    $1');
    cleanSource = cleanSource.replace(/\s+(excludes\s)/gi, '\n    $1');
    
    // Add newline before task definitions (word followed by space, colon, id pattern)
    // Match patterns like "Sleep :a1" or "Task 1 :t1"
    cleanSource = cleanSource.replace(/\s+(\w+(?:\s+\d+)?\s*:\s*\w+)/g, '\n    $1');
    
    // Fix time-based tasks to use dates instead
    // Convert "00:00, 8h" style to "2024-01-01, 8h" style
    cleanSource = cleanSource.replace(/:(\w+),\s*(\d{2}:\d{2}),/g, ':$1, 2024-01-01,');
    
    console.log("🔧 Gantt after fixes:\n" + cleanSource.substring(0, 500));
  }
  
  // FLOWCHART FIX: Add newlines before arrows if missing
  if (krokiEngine === 'mermaid' && cleanSource.toLowerCase().includes('flowchart')) {
    // Add newline before each node definition or arrow
    cleanSource = cleanSource.replace(/\s+([A-Z]\[)/g, '\n    $1');
    cleanSource = cleanSource.replace(/\s+([A-Z]\s*-->)/g, '\n    $1');
    cleanSource = cleanSource.replace(/\s+([A-Z]\s*---)/g, '\n    $1');
  }
  
  console.log(`🔧 Cleaned diagram source for ${krokiEngine}:\n${cleanSource.substring(0, 500)}`);
  
  // Request PNG from Kroki (binary response)
  const response = await fetch(`${KROKI_BASE_URL}/${krokiEngine}/png`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: cleanSource,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Kroki error (${krokiEngine}): ${response.status} - ${errText}`);
  }

  // Return PNG as binary Uint8Array
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
