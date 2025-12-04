import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
  diagramFamily: DiagramFamily;
  language: Language;
  maxDiagrams: 1 | 2 | 3;
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
    console.log("📊 Wakti Diagrams v1: Request received");

    // Service role client – no per-request auth required
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request
    const body: DiagramRequest = await req.json();
    const { inputText, fileContent, diagramFamily, language, maxDiagrams, userId, krokiStyle } = body;

    const ownerId = userId && userId.trim().length > 0 ? userId : `anon-${crypto.randomUUID().slice(0, 8)}`;

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
      krokiStyle,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1: Call GPT-4o-mini to plan diagrams
    // ─────────────────────────────────────────────────────────────────────────
    console.log("🤖 Calling GPT-4o-mini for diagram planning...");

    const diagramSpecs = await planDiagrams(textToProcess, diagramFamily, language, maxDiagrams, krokiStyle || 'auto');

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
        const storagePath = `${ownerId}/diagrams/${fileName}`;

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
  return parsed.diagrams || [];
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

IMPORTANT:
- Return ONLY valid JSON, nothing else.
- The diagramSource must be valid syntax for the chosen engine.
- Keep node labels SHORT (max 4-5 words).
- Use simple ASCII characters, avoid special symbols that might break rendering.
- Do NOT use markdown code fences inside diagramSource.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kroki Style Instructions - Maps user selection to specific engine + syntax
// ─────────────────────────────────────────────────────────────────────────────

function getKrokiStyleInstructions(style: KrokiStyleKey): string {
  switch (style) {
    // ─────────────────────────────────────────────────────────────────────────
    // Common Graphs
    // ─────────────────────────────────────────────────────────────────────────
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
You MUST use Mermaid gantt syntax. Example:
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Task 1 :a1, 2024-01-01, 7d
    Task 2 :a2, after a1, 5d
    section Phase 2
    Task 3 :b1, after a2, 10d
Show project schedule with tasks and dependencies.
Use sections, task names, durations.`;

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
You MUST use a simple PlantUML activity diagram. Example:
@startuml
skinparam backgroundColor #FFFEF0
skinparam defaultFontName "Comic Sans MS"

start
:Wake up;
:Have breakfast;
if (Sunny?) then (yes)
  :Go outside;
else (no)
  :Stay home;
endif
:End day;
stop
@enduml
Create flowcharts with a soft, sketch-style color palette.
Use activity diagram syntax for flows.`;

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
Analyze the text and pick the most appropriate diagram type.
Choose the engine and syntax that best fits the content:
- For flows/processes: Use Mermaid flowchart
- For timelines: Use Mermaid gantt
- For sequences: Use Mermaid sequenceDiagram
- For relationships: Use GraphViz digraph
- For hierarchies: Use PlantUML mindmap or WBS
- For architecture: Use PlantUML C4

Mermaid flowchart example:
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E

GraphViz example:
digraph G {
    rankdir=LR;
    A -> B -> C;
    A -> D -> C;
}

PlantUML example:
@startuml
start
:Step 1;
:Step 2;
stop
@enduml`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Kroki: Render diagram to SVG
// ─────────────────────────────────────────────────────────────────────────────

async function renderWithKroki(engine: string, diagramSource: string): Promise<string> {
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
