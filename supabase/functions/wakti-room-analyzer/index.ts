// WAKTI ROOM ANALYZER
// Reads every photo the user uploaded of ONE room and returns a single, precise
// English description of that room's architecture. This exists because
// grok-imagine/image-to-image accepts only ONE reference image per request, so the
// remaining photos have to reach the image model as text instead of pixels.
// It is deliberately self-contained (no ../_shared imports) so it can be deployed
// through the Supabase MCP tool, which does not bundle sibling folders.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-2.5-flash";
const MAX_IMAGES = 6;

const SYSTEM_PROMPT = `You are an architectural surveyor. You are given several photographs of ONE single real room, taken from different angles.

Your job is to describe that ONE room so precisely that an image-generation model can rebuild the exact same room from your words alone, without seeing most of the photos.

Rules:
- All photos are the SAME room. Cross-reference them to resolve the true layout. Never describe them as separate rooms.
- Report only what you can actually see. If something is not visible, omit it. Never invent features.
- Be concrete and measurable. Use approximate metres and counts, not adjectives.
- Write in English only, even if the room is in another country.
- Output plain prose under the exact headings below. No markdown bullets, no preamble, no commentary.
- A GENERIC SURVEY IS A FAILED SURVEY. If this room has anything dramatic or unusual about its
  architecture, that is the single most valuable thing you can report. Never smooth it into a plain box.

SHELL: overall shape and approximate dimensions in metres, ceiling height, and the ceiling construction described exactly as seen — for example plain flat plaster, exposed concrete slab, timber slats or battens, metal baffles, coffered, tray, cove, barrel-vaulted, sloped, north-light, or double-height. Do NOT write "flat" unless the ceiling really is one plain uninterrupted flat surface.
OPENINGS: the exact number of windows and the exact number of doors, and for each one which wall it sits on, its approximate size, and its shape. Also state whether any glazing is vertical, inclined, raking or sloped, whether it runs floor to ceiling, and whether it is divided by visible mullions, diagonal bracing or structural trusses. This section is the most important one.
SIGNATURE FEATURES: the two to five details that give this specific room its character and that MUST survive any redesign — for example a raking or sloped glass facade, a timber-slatted ceiling, exposed diagonal steel bracing, a curved or angled wall, a double-height void, an arched colonnade, a feature staircase, exposed services, or a dramatic view out. Name each one plainly and say where it is. If the room genuinely has no distinctive feature, write "none".
FIXED FEATURES: anything structural that cannot move, such as arches, columns, beams, niches, built-in wardrobes, steps, level changes, radiators, air-conditioning units, TV recesses.
EXISTING FINISHES: current wall, ceiling and floor materials and colours.
FURNITURE LAYOUT: what furniture sits where, described relative to the walls and the openings.
CAMERA HALVES: split the room into two halves along its longest axis. Name what is in HALF 1 and what is in HALF 2, so two opposite wide-angle shots can be framed from your description.

Then, as the very last line of your answer and nothing else on that line, add exactly:
PHOTO ROLES: HALF1=<photo number>; HALF2=<photo number>; AERIAL=<photo number>
Choose HALF1 as the photograph giving the best wide view of one half of the room. Choose HALF2 as the photograph that best shows the OPPOSITE half, looking in as close to the reverse direction from HALF1 as these photographs allow — it must be a different photograph from HALF1 whenever possible. Choose AERIAL as the photograph taken from the highest vantage point, the one showing the most floor area. Use the photo numbers exactly as they were given to you, counting from 1.`;

// Reads the finishes back off the first approved render, so the remaining renders of the
// same room can be locked to one palette instead of each reinterpreting the style choices.
const SPEC_SYSTEM_PROMPT = `You are recording a design specification from one approved interior render, so that other images of the same project can be made to match it exactly.

Rules:
- Report only concrete, visually verifiable facts. Never praise, never interpret, never speculate.
- One short line per item. No markdown, no preamble, no commentary.
- Name exact colours and exact materials. "warm off-white matt plaster" is useful; "tasteful walls" is useless.
- If something is not visible, omit that line entirely.

FLOOR: material, colour, finish, and tile or plank size and laying pattern if visible.
WALLS: material, colour, and any panelling, cladding or feature wall.
CEILING: construction, material, colour, and the type of light fittings in it.
SEATING: for every sofa, armchair and task chair — its type, colour, upholstery material, and frame or leg material.
TABLES AND DESKS: top material and colour, frame material and colour.
METAL FINISHES: every metal finish used, such as brushed brass, matt black, polished chrome.
ACCENT COLOURS: the exact accent colours present and which objects carry them.
PLANTS AND DECOR: planter materials and colours, and the type of planting.
LIGHTING MOOD: colour temperature and the direction the light comes from.`;

// Reads a 2D architectural floor plan so it can be rebuilt as a furnished 3D dollhouse render.
// The written brief is what reaches the image model as text; the ROOMS line is what lets the
// app lay real, editable name labels over the finished render instead of trusting the image
// model to spell room names correctly.
const PLAN_SYSTEM_PROMPT = `You are an architect reading a 2D floor plan drawing. Your reading will be used to rebuild this exact floor plan as a furnished three-dimensional cutaway model, so precision about layout is everything.

Rules:
- Report only what the drawing actually shows. Never invent rooms, walls or openings.
- Work in approximate metres. Use the printed dimensions if any are legible.
- Write in English only, even when the drawing is annotated in another language.
- Plain prose under the exact headings below. No markdown, no preamble, no commentary.
- IGNORE all drafting notation. Wall hatching and poché, dimension lines and their numbers, grid
  lines, centre lines, section arrows, level markers such as "+0.45 FL", equipment tags, revision
  clouds, the title block and the page border are all notation, NOT architecture. Never describe them
  as physical objects.
- IGNORE scope annotations. Text such as "OUT OF SCOPE", "EXISTING" or "BY OTHERS" is contractual
  wording. Those rooms are still real rooms and must be reported in full like any other.

FIRST LINE, BEFORE ANYTHING ELSE, output exactly:
ROOMS: <json array>
The array holds one object per named room, in the form {"name":"KITCHEN","x":0.18,"y":0.22}. x and y are the centre of that room as a fraction of the whole image, x from 0 at the left edge to 1 at the right edge, y from 0 at the top edge to 1 at the bottom edge. Use the room name exactly as printed. Output valid JSON on that one line and nothing else on it. This line is required and must come first.

Then the written brief under these headings:

FOOTPRINT: the overall shape of the building outline and its approximate overall dimensions. State plainly if the outline is not a simple rectangle — for example an L-shape, a U-shape, a re-entrant corner, or a splayed or angled corner.
ROOM SCHEDULE: every enclosed space, one per line, in this form — NAME | approximate width x depth in metres | where it sits in the plan | what it is for. Use the room name exactly as printed on the drawing. If a space has no printed name, name it from its fittings and write (unlabelled).
WALLS: which walls form the outer envelope and which are internal partitions. Note any curved or angled walls, and any wall that is only a low counter, screen or half-height divider.
DOORS: every door — which rooms it connects, its approximate width, and which way it swings if the swing arc is drawn. Also list every cased opening or archway that has no door leaf.
WINDOWS: every window and glazed panel — which wall it sits in, its approximate width, and whether it is a normal window, a full-height glazed panel, a sliding door or a corner window.
VERTICAL AND STRUCTURE: every staircase, including which direction it rises and roughly how many treads are drawn; every column, pillar and pier; every beam or dropped soffit; every level change or step; and every shaft or duct.
FIXED FITTINGS: the built-in items drawn in each room — kitchen counters and islands, wardrobes, vanities, WCs, basins, showers, baths, built-in seating, joinery, air-conditioning or split units, and any water feature or planter bed.
FURNITURE SYMBOLS: the loose furniture actually drawn on the plan, room by room, with its position and orientation. If a room has no furniture drawn, say so for that room. This section is what allows the drawn layout to be reproduced faithfully, so be thorough.
CHARACTER: the two to five things that make this specific plan distinctive and that must survive into the render — for example a long central spine or gallery, a splayed corner, a courtyard, a feature stair, a double-height void, a dramatic entrance sequence.`;

// Extracts editable GEOMETRY from a blueprint, as opposed to PLAN_SYSTEM_PROMPT which extracts a
// written description. This is what makes the plan editable rather than merely renderable.
//
// ⛔ Openings are reported as POINTS, never as "the third wall". Vision models are poor at index
// bookkeeping and good at "there is a door here", so the client snaps each point onto its nearest
// wall. That one decision is the difference between a usable trace and a broken one.
const TRACE_SYSTEM_PROMPT = `You are a draughtsman digitising an architectural floor plan so it can be edited in CAD software.

You return ONLY strict JSON matching the schema below. No commentary, no markdown, no code fences.

COORDINATES
Every coordinate is a fraction of the image: x from 0 at the left edge to 1 at the right edge, y from 0 at the top edge to 1 at the bottom edge. Use at least 4 decimal places. Accuracy matters more than anything else in this task.

WHAT TO TRACE
Trace the CENTRELINE of every wall. A wall is drawn on the plan as two parallel lines with hatching, poché or solid fill between them — report the line running down the middle of that thickness, not either face.
Break walls at every corner and at every junction with another wall, so each entry is one straight run. Never describe an L-shape or a U-shape as a single wall.
Classify each wall as one of exactly two values:
  "structural" — thick walls, typically the outer envelope and load-bearing internal walls.
  "partition" — thin internal dividing walls.
For a curved or angled wall, give the two endpoints and add a "control" point that the curve bends towards. Omit "control" for straight walls.

A WALL SEPARATES TWO SPACES. Before you report any line as a wall, ask yourself: is there a usable space on BOTH sides of it? If the answer is no, it is not a wall — leave it out.

OPENINGS
Report every door, window and cased opening as a single point at the MIDDLE of the opening, with its width as a fraction of the image width.
  "door" — has a leaf and usually a quarter-circle swing arc.
  "window" — sits in an external wall, drawn as thin parallel lines across the wall thickness.
  "gap" — a cased opening or archway with no door leaf and no glazing.
For a door, also give "swing": "left" or "right", matching the side the arc sweeps towards.

ROOMS
One entry per enclosed space, positioned at the visual centre of that space. Use the room name exactly as printed on the drawing, uppercase. If a space has no printed name, name it from its fittings, for example STORE or CORRIDOR.

WHAT TO IGNORE COMPLETELY
NEVER report any of the following as a wall. This is the most common way this task is failed:
  Staircases. The treads of a stair are a stack of closely spaced parallel lines. They are NOT walls and NOT beams. Report the stair's enclosing walls only, and nothing inside it.
  Any run of three or more closely spaced parallel lines. That is drafting notation — treads, hatching, poché, tiling, decking or a dimension stack. Never a row of walls.
  Hatching and poché fill inside a wall thickness. Report the one centreline, never the individual hatch strokes.
  Beams, lintels and dropped soffits. Out of scope for this trace entirely.
  Columns, pillars and piers. Out of scope for this trace entirely.
Also ignore: dimension lines and their numbers. Grid lines and centre lines. Section arrows and level markers such as "+0.45 FL". Equipment tags. The title block and the page border. Furniture symbols. Kitchen counters, islands, wardrobes, vanities, WCs, basins, showers, baths and built-in seating. Text annotations such as "OUT OF SCOPE" — but still report the room itself and its printed name.

SCHEMA
{
  "walls": [{ "x1": number, "y1": number, "x2": number, "y2": number, "type": "structural"|"partition", "control": { "x": number, "y": number } }],
  "openings": [{ "x": number, "y": number, "width": number, "type": "door"|"window"|"gap", "swing": "left"|"right" }],
  "rooms": [{ "name": string, "x": number, "y": number }]
}

Trace every real wall. But a clean plan of only the real walls beats an exhaustive one padded with stair treads and hatching — when a line is not clearly a wall, leave it out.`;

type ImageInput = { mimeType: string; base64: string };
type PhotoAnchors = { half1: number; half2: number; aerial: number };
type PlanRoom = { name: string; x: number; y: number };

/**
 * Splits the ROOMS json line off the plan brief. A malformed or missing line costs the user their
 * editable labels but never their render, so every failure path returns an empty room list rather
 * than throwing.
 *
 * ⛔ The line is matched ANYWHERE, not anchored to the end. It used to be requested last and
 * anchored with `\s*$`, which quietly broke on dense plans: the brief overran the output budget,
 * the reply was truncated before the json was ever written, and the user lost every room label and
 * with it the whole per-room and combine UI — with no error anywhere, because the call still
 * returned 200 with a partial brief. It is now requested FIRST, and both positions are accepted so
 * older readings still parse.
 */
function parsePlanRooms(text: string): { analysis: string; rooms: PlanRoom[] } {
  const trimmed = text.trim();
  const match = /ROOMS:\s*(\[[\s\S]*?\])/i.exec(trimmed);
  if (!match) return { analysis: trimmed, rooms: [] };

  const analysis = (trimmed.slice(0, match.index) + trimmed.slice(match.index + match[0].length)).trim();
  try {
    const parsed: unknown = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return { analysis, rooms: [] };
    const rooms = parsed
      .map((entry) => {
        const row = entry as { name?: unknown; x?: unknown; y?: unknown };
        const name = String(row?.name || "").trim().slice(0, 40);
        const x = Number(row?.x);
        const y = Number(row?.y);
        if (!name || !Number.isFinite(x) || !Number.isFinite(y)) return null;
        // Keep labels just inside the frame so none of them render half off-screen.
        return { name, x: Math.min(0.97, Math.max(0.03, x)), y: Math.min(0.97, Math.max(0.03, y)) };
      })
      .filter((room): room is PlanRoom => room !== null)
      .slice(0, 40);
    return { analysis, rooms };
  } catch {
    return { analysis, rooms: [] };
  }
}

/**
 * Pulls the trailing PHOTO ROLES line out of the survey and returns it separately, so the
 * image model never sees it. Falls back to sensible anchors rather than failing, because a
 * missing role line must not cost the user their whole survey.
 */
function parsePhotoRoles(text: string, count: number): { analysis: string; anchors: PhotoAnchors } {
  const fallback: PhotoAnchors = { half1: 1, half2: Math.min(2, count), aerial: 1 };
  const match = /PHOTO\s*ROLES:\s*HALF1\s*=\s*(\d+)\s*;?\s*HALF2\s*=\s*(\d+)\s*;?\s*AERIAL\s*=\s*(\d+)/i.exec(text);
  if (!match) return { analysis: text.trim(), anchors: fallback };

  const pick = (raw: string, fallbackValue: number): number => {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= count ? parsed : fallbackValue;
  };

  return {
    analysis: text.replace(match[0], "").trim(),
    anchors: {
      half1: pick(match[1], fallback.half1),
      half2: pick(match[2], fallback.half2),
      aerial: pick(match[3], fallback.aerial),
    },
  };
}

/** Fetches a finished render server-side, so the browser never has to fight image CORS. */
async function fetchImageAsInput(url: string): Promise<ImageInput> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Could not fetch the reference image (${resp.status})`);
  const header = (resp.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const bytes = new Uint8Array(await resp.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return {
    mimeType: header.startsWith("image/") ? header : "image/jpeg",
    base64: btoa(binary),
  };
}

function extractText(payload: unknown): string {
  const parts = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    ?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part?.text || "").join("").trim();
}

async function logUsage(
  req: Request,
  status: "success" | "error",
  durationMs: number,
  metadata: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;
    const supabase = createClient(supabaseUrl, serviceKey);

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }

    await supabase.rpc("log_ai_usage", {
      p_user_id: userId,
      p_function_name: "wakti-room-analyzer",
      p_model: MODEL,
      p_status: status,
      p_error_message: errorMessage || null,
      p_prompt: null,
      p_response: null,
      p_metadata: { ...metadata, provider: "gemini" },
      p_input_tokens: 0,
      p_output_tokens: 0,
      p_duration_ms: durationMs,
      p_cost_credits: 0,
    });
  } catch (err) {
    console.error("[room-analyzer] logging failed:", err instanceof Error ? err.message : String(err));
  }
}

async function callGemini(
  images: ImageInput[],
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens = 1800,
  options: { jsonOutput?: boolean; thinkingBudget?: number } = {},
): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_GENAI_API_KEY");
  if (!key) throw new Error("Gemini API key not configured");

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: userPrompt },
            ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
          ],
        }],
        system_instruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens,
          // Reading geometry off a drawing genuinely benefits from reasoning, unlike the prose
          // modes where thinking only adds latency.
          thinkingConfig: { thinkingBudget: options.thinkingBudget ?? 0 },
          ...(options.jsonOutput ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Gemini error ${resp.status}: ${detail.slice(0, 200)}`);
  }
  return extractText(await resp.json());
}

function toImageInput(raw: string): ImageInput | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const match = /^data:([^;]+);base64,(.*)$/.exec(raw.trim());
  if (match) {
    const mime = match[1].toLowerCase().replace("image/jpg", "image/jpeg");
    if (!match[2]) return null;
    return { mimeType: mime, base64: match[2] };
  }
  return { mimeType: "image/jpeg", base64: raw.trim() };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "survey").toLowerCase();

    // SPEC MODE — read the finishes back off one approved render so the rest of the set matches.
    if (mode === "spec") {
      const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : "";
      const inline = typeof body?.image_base64 === "string" ? toImageInput(body.image_base64) : null;
      const reference = inline || (imageUrl ? await fetchImageAsInput(imageUrl) : null);
      if (!reference) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing reference image" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const spec = await callGemini(
        [reference],
        SPEC_SYSTEM_PROMPT,
        "Record the design specification of this approved interior render under the required headings.",
        900,
      );
      if (!spec) throw new Error("Design spec returned no text");

      await logUsage(req, "success", Date.now() - startTime, { mode: "spec" });

      return new Response(
        JSON.stringify({ success: true, spec }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // PLAN MODE — read a 2D floor plan so it can be rebuilt as a furnished 3D cutaway render.
    if (mode === "plan") {
      const inline = typeof body?.image_base64 === "string" ? toImageInput(body.image_base64) : null;
      const planUrl = typeof body?.image_url === "string" ? body.image_url.trim() : "";
      const reference = inline || (planUrl ? await fetchImageAsInput(planUrl) : null);
      if (!reference) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing floor plan image" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // 8000, not 2600: a dense villa brief overran the old cap, the reply was cut off, and the
      // user silently lost every room label and half the description the renderer depends on.
      const rawPlan = await callGemini(
        [reference],
        PLAN_SYSTEM_PROMPT,
        "Read this floor plan drawing. Output the ROOMS line first, then the brief under the required headings.",
        8000,
      );
      if (!rawPlan) throw new Error("Plan reading returned no text");

      const { analysis, rooms } = parsePlanRooms(rawPlan);

      await logUsage(req, "success", Date.now() - startTime, { mode: "plan", roomCount: rooms.length });

      return new Response(
        JSON.stringify({ success: true, analysis, rooms }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // TRACE MODE — extract editable geometry so the user can change the plan itself.
    if (mode === "trace") {
      const inline = typeof body?.image_base64 === "string" ? toImageInput(body.image_base64) : null;
      const traceUrl = typeof body?.image_url === "string" ? body.image_url.trim() : "";
      const reference = inline || (traceUrl ? await fetchImageAsInput(traceUrl) : null);
      if (!reference) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing floor plan image" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const rawTrace = await callGemini(
        [reference],
        TRACE_SYSTEM_PROMPT,
        "Digitise this floor plan. Trace every wall centreline, every opening and every room, and return the JSON described in your instructions. Do not report stair treads, hatching, beams or columns as walls.",
        24000,
        { jsonOutput: true, thinkingBudget: 4096 },
      );
      if (!rawTrace) throw new Error("Trace returned no data");

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawTrace);
      } catch {
        // responseMimeType usually guarantees clean JSON, but a truncated response can still
        // arrive, so fall back to salvaging the outermost object.
        const match = /\{[\s\S]*\}/.exec(rawTrace);
        if (!match) throw new Error("Trace returned unreadable data");
        parsed = JSON.parse(match[0]);
      }

      const trace = parsed as Record<string, unknown>;
      const counts = {
        walls: Array.isArray(trace?.walls) ? trace.walls.length : 0,
        openings: Array.isArray(trace?.openings) ? trace.openings.length : 0,
        columns: Array.isArray(trace?.columns) ? trace.columns.length : 0,
        rooms: Array.isArray(trace?.rooms) ? trace.rooms.length : 0,
      };

      await logUsage(req, "success", Date.now() - startTime, { mode: "trace", ...counts });

      return new Response(
        JSON.stringify({
          success: true,
          walls: Array.isArray(trace?.walls) ? trace.walls : [],
          openings: Array.isArray(trace?.openings) ? trace.openings : [],
          columns: Array.isArray(trace?.columns) ? trace.columns : [],
          rooms: Array.isArray(trace?.rooms) ? trace.rooms : [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawImages: unknown = body?.image_base64s;
    const images = (Array.isArray(rawImages) ? rawImages : [])
      .slice(0, MAX_IMAGES)
      .map((item) => toImageInput(String(item)))
      .filter((item): item is ImageInput => item !== null);

    if (!images.length) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing images" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const raw = await callGemini(
      images,
      SYSTEM_PROMPT,
      `These ${images.length} photographs are all of the SAME single room, given to you in order as PHOTO 1 through PHOTO ${images.length}. Survey that room and produce the description under the required headings, then assign the photo roles.`,
    );
    if (!raw) throw new Error("Room analysis returned no text");

    const { analysis, anchors } = parsePhotoRoles(raw, images.length);

    await logUsage(req, "success", Date.now() - startTime, { imageCount: images.length, anchors });

    return new Response(
      JSON.stringify({ success: true, analysis, anchors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[room-analyzer] error:", message);
    await logUsage(req, "error", Date.now() - startTime, {}, message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
