// A4 Document Builder — Prompt Compiler
// -----------------------------------------------------------------------------
// Exports:
//   - buildGeminiPreprocessSystemPrompt(): strict-JSON system prompt for Gemini
//   - buildGeminiPreprocessUserPayload(): the user payload text
//   - compileMasterPrompt(): assembles the final 20k-budget Nano Banana 2 prompt
// -----------------------------------------------------------------------------

import type { A4Theme } from "./a4-themes.ts";

// =============================================================================
// GEMINI PREPROCESSOR PROMPT
// =============================================================================

export function buildGeminiPreprocessSystemPrompt(): string {
  return `You are the A4 document preprocessor. You transform messy user input into a clean, page-aware, structured layout plan. You do NOT render images. You output JSON only — no prose, no markdown fences, no explanation.

YOUR THREE JOBS:

1. CLEAN the raw_content:
   - Remove redundant whitespace, broken bullets, stray characters, and duplicate lines.
   - Preserve every meaningful word, number, formula, and symbol. NEVER paraphrase or translate.
   - Detect natural structure: title, section headings, paragraphs, bullet lists, numbered questions, tables, chemical equations, fractions.
   - Tag each structural element using the block types in the schema below.

2. DECIDE page count + SPLIT content:
   - If requested_pages is a number (1, 2, or 3): honor it. If content exceeds the budget at that page count, gently trim the least-critical sections to fit. Never drop user-authored numbered items (like exam questions).
   - If requested_pages is "auto":
     - Calculate needed pages using per_page_char_budget. Clamp between 1 and 3.
     - Split at clean boundaries: never mid-question, never mid-paragraph, never mid-section.
   - For multi-page output, repeat ONLY the header metadata blocks (title, subtitle) on every page if they make sense as a running header; otherwise page 1 has the full header and subsequent pages just have a slim "continued" header.

3. EMIT a layout JSON matching the OUTPUT SCHEMA exactly.

OUTPUT SCHEMA (strict JSON, no prose, no markdown fences):

{
  "status": "ok" | "too_long" | "content_unclear",
  "detected_language": "en" | "ar" | "bilingual",
  "suggested_pages": 1 | 2 | 3,
  "honored_pages": 1 | 2 | 3,
  "pages": [
    {
      "page_number": 1,
      "blocks": [
        { "type": "title", "text": "...", "lang": "en" | "ar" },
        { "type": "subtitle", "text": "...", "lang": "en" | "ar" },
        { "type": "section_heading", "text": "...", "lang": "en" | "ar" },
        { "type": "paragraph", "text": "...", "lang": "en" | "ar" },
        { "type": "bullet_list", "items": ["...", "..."], "lang": "en" | "ar" },
        { "type": "numbered_list", "items": ["...", "..."], "lang": "en" | "ar" },
        { "type": "question", "number": 1, "text": "...", "options": ["A) ...", "B) ...", "C) ..."], "marks": 2, "lang": "en" | "ar" },
        { "type": "equation", "latex_or_text": "6CO2 + 6H2O -> C6H12O6 + 6O2" },
        { "type": "table", "headers": ["...","..."], "rows": [["...","..."]] },
        { "type": "bilingual_row", "en": "...", "ar": "..." },
        { "type": "spacer", "size": "small" | "medium" | "large" }
      ]
    }
  ],
  "notes_for_renderer": "Short special-handling hints or empty string."
}

VALIDATION RULES:
- Always return valid JSON. No markdown fences. No prose. Just JSON.
- Fields "options" and "marks" on question blocks are optional — omit them if not applicable.
- If raw_content is empty, return one page of just the form-derived title/subtitle blocks.
- If status="too_long", still return your best-effort split at honored_pages=3 but flag it in notes_for_renderer.
- If status="content_unclear", explain briefly in notes_for_renderer.
- Use block type "bilingual_row" only when language_mode is "bilingual" AND the two languages are clear parallels.
- Never emit HTML tags, LaTeX fences, or markdown inside block text.
`;
}

export interface A4PreprocessInput {
  theme_id: string;
  purpose_id: string | null;
  form_state: Record<string, unknown>;
  raw_content: string;
  language_mode: "en" | "ar" | "bilingual";
  requested_pages: "auto" | 1 | 2 | 3;
  per_page_char_budget: number;
  max_pages: 1 | 2 | 3;
}

export function buildGeminiPreprocessUserPayload(input: A4PreprocessInput): string {
  // Strip very large binary/image-ish values and internal keys from form_state so we don't blow the context
  const cleanForm: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input.form_state || {})) {
    if (k.startsWith("__")) continue; // internal stash keys (e.g. __design_settings__)
    if (typeof v === "string" && v.length > 2000) continue;
    if (typeof v === "string" && v.startsWith("data:")) continue;
    cleanForm[k] = v;
  }

  return `INPUT:
- theme_id: ${input.theme_id}
- purpose_id: ${input.purpose_id ?? "null"}
- language_mode: ${input.language_mode}
- requested_pages: ${input.requested_pages}
- per_page_char_budget: ${input.per_page_char_budget}
- max_pages: ${input.max_pages}
- form_state (JSON): ${JSON.stringify(cleanForm)}

raw_content (between markers, preserve every character verbatim):
[RAW BEGIN]
${input.raw_content ?? ""}
[RAW END]

Return ONLY the JSON per the schema. No prose. No markdown.`;
}

// =============================================================================
// MASTER PROMPT COMPILER (Nano Banana 2)
// =============================================================================

export type A4Orientation = "portrait" | "landscape";
export type A4FontFamily = "modern_sans" | "classic_serif" | "elegant_script" | "bold_display" | "playful_hand";
export type A4BorderStyle = "none" | "thin" | "thick" | "rounded" | "decorative";
export type A4Density = "compact" | "balanced" | "airy";
export type A4Tone = "professional" | "friendly" | "playful" | "formal";

export interface A4DesignSettings {
  orientation?: A4Orientation;
  background_color?: string | null;   // hex like #FFFFFF
  text_color?: string | null;         // hex
  accent_color?: string | null;       // hex
  font_family?: A4FontFamily;
  border_style?: A4BorderStyle;
  include_decorative_images?: boolean;
  density?: A4Density;
  tone?: A4Tone;
}

export interface A4CompileInput {
  theme: A4Theme;
  purposeId: string | null;
  formState: Record<string, unknown>;
  geminiPages: GeminiPage[]; // full page array from Gemini output
  pageNumber: number;
  totalPages: number;
  languageMode: "en" | "ar" | "bilingual";
  brandColors: { primary?: string | null; secondary?: string | null } | null;
  hasLogoReference: boolean;
  hasPrevPageReference: boolean; // true for page >=2 when chaining style anchor
  designSettings?: A4DesignSettings | null;
}

export interface GeminiBlock {
  type: string;
  [k: string]: unknown;
}

export interface GeminiPage {
  page_number: number;
  blocks: GeminiBlock[];
}

// Render a single block as plain structured text the image model can parse.
function renderBlock(b: GeminiBlock): string {
  const t = b.type as string;
  switch (t) {
    case "title":
      return `[TITLE][${b.lang ?? "en"}] ${String(b.text ?? "")}`;
    case "subtitle":
      return `[SUBTITLE][${b.lang ?? "en"}] ${String(b.text ?? "")}`;
    case "section_heading":
      return `[SECTION][${b.lang ?? "en"}] ${String(b.text ?? "")}`;
    case "paragraph":
      return `[PARAGRAPH][${b.lang ?? "en"}] ${String(b.text ?? "")}`;
    case "bullet_list": {
      const items = Array.isArray(b.items) ? (b.items as string[]) : [];
      return `[BULLETS][${b.lang ?? "en"}]\n${items.map((i) => `- ${i}`).join("\n")}`;
    }
    case "numbered_list": {
      const items = Array.isArray(b.items) ? (b.items as string[]) : [];
      return `[NUMBERED][${b.lang ?? "en"}]\n${items.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}`;
    }
    case "question": {
      const num = b.number ?? "?";
      const txt = String(b.text ?? "");
      const options = Array.isArray(b.options) ? (b.options as string[]) : [];
      const marks = typeof b.marks === "number" ? ` (${b.marks} marks)` : "";
      const optsRendered = options.length ? `\n  Options: ${options.join(" | ")}` : "";
      return `[Q${num}${marks}][${b.lang ?? "en"}] ${txt}${optsRendered}`;
    }
    case "equation":
      return `[EQUATION] ${String(b.latex_or_text ?? "")}`;
    case "table": {
      const headers = Array.isArray(b.headers) ? (b.headers as string[]) : [];
      const rows = Array.isArray(b.rows) ? (b.rows as string[][]) : [];
      const headerLine = headers.join(" | ");
      const rowsRendered = rows.map((r) => r.join(" | ")).join("\n");
      return `[TABLE]\n  Headers: ${headerLine}\n  Rows:\n${rowsRendered}`;
    }
    case "bilingual_row":
      return `[BILINGUAL_ROW] EN: ${String(b.en ?? "")} || AR: ${String(b.ar ?? "")}`;
    case "spacer":
      return `[SPACER:${String(b.size ?? "medium")}]`;
    default:
      return `[${t.toUpperCase()}] ${JSON.stringify(b)}`;
  }
}

function renderPage(page: GeminiPage): string {
  return page.blocks.map(renderBlock).join("\n");
}

function getLanguageRules(mode: "en" | "ar" | "bilingual"): string {
  if (mode === "ar") {
    return "Entire document in Arabic. Right-to-left (RTL) alignment throughout. Arabic text flows RTL. Western digits (0123) and Latin brand names remain left-to-right within their local context. Use Noto Sans Arabic or equivalent modern Arabic sans-serif with correct letter joining.";
  }
  if (mode === "bilingual") {
    return "Bilingual document (English + Arabic). Where both languages appear side-by-side, English (LTR) on the LEFT column and Arabic (RTL) on the RIGHT column. Each language maintains strict alignment within its column. NEVER mix characters of two scripts inside a single word or phrase. Use appropriate fonts per script.";
  }
  return "Entire document in English. Left-to-right (LTR) alignment throughout. Clean sans-serif typography (Inter, Helvetica, or Arial).";
}

function getPageContextClause(pageNumber: number, totalPages: number, hasPrevPageRef: boolean): string {
  if (totalPages === 1) return "This is a single-page document.";
  if (pageNumber === 1) {
    return `This is PAGE 1 of ${totalPages}. Establish the visual style, header layout, font sizes, margins, and color palette that pages 2 and 3 will match.`;
  }
  const refClause = hasPrevPageRef
    ? " The reference image provided is PAGE 1. Match its visual style, header layout, font sizes, margins, and color palette EXACTLY. Consistency with page 1 is mandatory."
    : "";
  return `This is PAGE ${pageNumber} of ${totalPages}.${refClause}`;
}

function getBrandColorDirective(
  brandColors: A4CompileInput["brandColors"],
): string {
  if (!brandColors?.primary) return "";
  const secondary = brandColors.secondary ? `Secondary accent: ${brandColors.secondary}. ` : "";
  return `Primary accent color: ${brandColors.primary}. ${secondary}Apply to headers, accent bars, borders, and table header rows. Do NOT color body text — body text stays near-black for readability.`;
}

function getHeaderBlock(
  theme: A4Theme,
  formState: Record<string, unknown>,
  hasLogoRef: boolean,
  pageNumber: number,
): string {
  // For multi-page, page 2+ uses a slim running header
  if (pageNumber > 1) {
    const title = String(formState.project_title ?? formState.report_title ?? formState.business_name ?? formState.company_name ?? formState.full_name ?? formState.card_title ?? formState.subject ?? formState.title ?? formState.event_name ?? "").trim();
    return `Slim running header only: document title "${title || "Document"}" aligned per language direction. No logo repetition needed unless it fits elegantly.`;
  }

  const logoClause = hasLogoRef
    ? "Top-left area: render the reference logo EXACTLY as provided — do not stylize, recolor, or redesign it. Keep its original proportions and colors."
    : "";

  // Theme-specific header assembly
  switch (theme.id) {
    case "official_exam": {
      const school = String(formState.school_name ?? "").trim();
      const subject = String(formState.subject ?? "").trim();
      const grade = String(formState.grade ?? "").trim();
      const term = String(formState.term ?? "").trim();
      const duration = String(formState.duration ?? "").trim();
      const marks = String(formState.total_marks ?? "").trim();
      return `Header: ${logoClause} Top-center: school name "${school}". Subject + grade row: "${subject} - ${grade}${term ? " (" + term + ")" : ""}". Top-right: two fill-in lines labeled "Name" and "Date" with underlines for handwriting.${duration ? ` Also show "Duration: ${duration} min".` : ""}${marks ? ` Show "Total Marks: ${marks}".` : ""}`;
    }
    case "school_project": {
      const school = String(formState.school_name ?? "").trim();
      const student = String(formState.student_name ?? "").trim();
      const subject = String(formState.subject ?? "").trim();
      const grade = String(formState.grade ?? "").trim();
      const title = String(formState.project_title ?? "").trim();
      const date = String(formState.submission_date ?? "").trim();
      return `Header: ${logoClause} Large H1 title centered: "${title}". Meta row below title: "Student: ${student}${grade ? " | Grade: " + grade : ""}${subject ? " | Subject: " + subject : ""}${school ? " | " + school : ""}${date ? " | Date: " + date : ""}".`;
    }
    case "corporate_brief": {
      const company = String(formState.company_name ?? "").trim();
      const dept = String(formState.department ?? formState.client_name ?? "").trim();
      const title = String(formState.report_title ?? "").trim();
      const period = String(formState.period ?? "").trim();
      const author = String(formState.author ?? "").trim();
      const ref = String(formState.doc_ref ?? "").trim();
      return `Header: ${logoClause} Narrow accent bar across the very top. Next to logo: company name "${company}"${dept ? " | " + dept : ""}. Top-right: reference code "${ref}" in small monospaced style. Below header, full-width H1 title: "${title}". Meta row: ${period ? '"Period: ' + period + '"' : ""}${author ? ' | "Prepared by: ' + author + '"' : ""}.`;
    }
    case "certificate": {
      const issuer = String(formState.issuer_name ?? "").trim();
      const recipient = String(formState.recipient_name ?? "").trim();
      const achievement = String(formState.achievement ?? "").trim();
      const date = String(formState.issue_date ?? "").trim();
      const sigName = String(formState.signatory_name ?? "").trim();
      const sigTitle = String(formState.signatory_title ?? "").trim();
      return `Layout: fully centered. Top: "${issuer}". Middle: an elegant "This is to certify that" line, then recipient name "${recipient}" rendered large and beautifully. Below: "${achievement}". Bottom-left: date "${date}". Bottom-right: signature line with "${sigName}${sigTitle ? ", " + sigTitle : ""}" beneath. ${logoClause ? "Logo or seal centered at the very bottom." : ""}`;
    }
    case "event_flyer": {
      const event = String(formState.event_name ?? "").trim();
      const date = String(formState.date ?? "").trim();
      const time = String(formState.time ?? "").trim();
      const venue = String(formState.venue ?? "").trim();
      const tagline = String(formState.tagline ?? "").trim();
      const cta = String(formState.cta ?? "").trim();
      return `Layout: bold hero poster. ${tagline ? 'Small tagline above event name: "' + tagline + '". ' : ""}Event name hero-size at top: "${event}". Info block below: Date "${date}" | Time "${time}" | Venue "${venue}". ${cta ? 'CTA button near bottom: "' + cta + '". ' : ""}${logoClause}`;
    }
    case "craft_infographic": {
      const topic = String(formState.topic ?? "").trim();
      const student = String(formState.student_name ?? "").trim();
      const subject = String(formState.subject ?? "").trim();
      return `Header: crisp paper-cut title card at top with the topic "${topic}". ${student || subject ? 'Small meta strip: "' + [student, subject].filter(Boolean).join(" | ") + '". ' : ""}${logoClause}`;
    }
    case "comic_explainer": {
      const title = String(formState.title ?? "").trim();
      return `Header: bold comic-lettering title banner across the top: "${title}".`;
    }
    case "invoice_receipt": {
      const business = String(formState.business_name ?? formState.company_name ?? "").trim();
      const client = String(formState.client_name ?? "").trim();
      const invoiceNo = String(formState.invoice_number ?? "").trim();
      const receiptNo = String(formState.receipt_number ?? "").trim();
      const issueDate = String(formState.issue_date ?? "").trim();
      const dueDate = String(formState.due_date ?? "").trim();
      const currency = String(formState.currency ?? "").trim();
      const paymentTerms = String(formState.payment_terms ?? formState.paid_method ?? "").trim();
      const docLabel = invoiceNo ? "Invoice" : "Receipt";
      const docNumber = invoiceNo || receiptNo;
      return `Header: ${logoClause} Top-left: business name "${business}". Top-right: ${docLabel.toUpperCase()}${docNumber ? ' number "' + docNumber + '"' : ""}. Below header: customer line "${client || "Customer"}" and date "${issueDate}".${dueDate ? ` Also show due date "${dueDate}".` : ""}${currency ? ` Show currency "${currency}" in the totals block.` : ""}${paymentTerms ? ` Add small payment info line: "${paymentTerms}".` : ""}`;
    }
    case "menu_price_list": {
      const business = String(formState.business_name ?? "").trim();
      const subtitle = String(formState.subtitle ?? "").trim();
      const contact = String(formState.contact_info ?? "").trim();
      const hours = String(formState.working_hours ?? "").trim();
      return `Header: elegant menu masthead. ${logoClause} Large centered business name "${business}".${subtitle ? ` Subtitle below: "${subtitle}".` : ""}${hours ? ` Small hours line: "${hours}".` : ""}${contact ? ` Small contact line near footer or lower header: "${contact}".` : ""}`;
    }
    case "thank_you_invitation_card": {
      const sender = String(formState.sender_name ?? "").trim();
      const recipient = String(formState.recipient_name ?? "").trim();
      const cardTitle = String(formState.card_title ?? "").trim();
      const host = String(formState.host_name ?? "").trim();
      const event = String(formState.event_name ?? "").trim();
      const eventDate = String(formState.event_date ?? formState.date ?? "").trim();
      const venue = String(formState.venue ?? "").trim();
      const rsvp = String(formState.rsvp ?? "").trim();
      if (host || event) {
        return `Layout: elegant invitation card. ${logoClause} Main centered title: "${event || "Invitation"}". Supporting host line: "${host}".${eventDate ? ` Event date line: "${eventDate}".` : ""}${venue ? ` Venue line: "${venue}".` : ""}${rsvp ? ` RSVP line near bottom: "${rsvp}".` : ""}`;
      }
      return `Layout: elegant thank-you card. ${logoClause} Main centered heading: "${cardTitle || "Thank You"}".${recipient ? ` Addressed to "${recipient}".` : ""}${sender ? ` Signature or from-line near the bottom: "${sender}".` : ""}${eventDate ? ` Small date line: "${eventDate}".` : ""}`;
    }
    case "resume_cv": {
      const fullName = String(formState.full_name ?? "").trim();
      const role = String(formState.desired_role ?? "").trim();
      const email = String(formState.email ?? "").trim();
      const phone = String(formState.phone ?? "").trim();
      const location = String(formState.location ?? "").trim();
      const website = String(formState.website ?? "").trim();
      const linkedin = String(formState.linkedin ?? "").trim();
      const contactBits = [email, phone, location, website, linkedin].filter(Boolean).join(" | ");
      return `Header: professional resume masthead. ${logoClause} Large candidate name "${fullName}" at top.${role ? ` Role subtitle directly beneath: "${role}".` : ""}${contactBits ? ` Compact contact row below: "${contactBits}".` : ""}`;
    }
    case "clean_minimal": {
      const title = String(formState.title ?? formState.event_name ?? formState.subject ?? "").trim();
      const subtitle = String(formState.subtitle ?? formState.sender_name ?? formState.issuer ?? "").trim();
      const date = String(formState.date ?? "").trim();
      return `Header: minimal. ${logoClause} Large H1 title: "${title}". ${subtitle ? 'Subtitle: "' + subtitle + '". ' : ""}${date ? 'Date right-aligned: "' + date + '".' : ""}`;
    }
    default:
      return logoClause;
  }
}

function resolveAspectRatio(theme: A4Theme, orientation?: A4Orientation): string {
  if (!orientation || orientation === "portrait") return theme.aspect_ratio;
  if (orientation === "landscape") {
    // Flip common portrait ratios
    if (theme.aspect_ratio === "2:3") return "3:2";
    if (theme.aspect_ratio === "3:4") return "4:3";
    return "3:2";
  }
  return theme.aspect_ratio;
}

function fontFamilyLabel(font?: A4FontFamily): string {
  switch (font) {
    case "classic_serif":
      return "Classic Serif (Georgia, Garamond, or similar elegant serif)";
    case "elegant_script":
      return "Elegant Script (refined italic/script font for headings; pair with a clean sans-serif for body)";
    case "bold_display":
      return "Bold Display (heavy geometric display type for titles; strong confident feel)";
    case "playful_hand":
      return "Playful Handwritten (friendly handwritten-style font; casual, warm)";
    case "modern_sans":
    default:
      return "Modern Sans-Serif (Inter, Helvetica, or similar — clean and contemporary)";
  }
}

function borderStyleLabel(border?: A4BorderStyle): string {
  switch (border) {
    case "none":
      return "No decorative borders. Use only whitespace and subtle rules for structure.";
    case "thick":
      return "Thick bold borders around key sections and around the overall page margin.";
    case "rounded":
      return "Rounded, softly curved borders on cards, boxes, and accent panels.";
    case "decorative":
      return "Tasteful decorative borders (ornamental corners, elegant flourishes) that match the document tone — used sparingly so they never compete with content.";
    case "thin":
    default:
      return "Thin clean borders around tables, callouts, and section cards.";
  }
}

function densityLabel(density?: A4Density): string {
  switch (density) {
    case "compact":
      return "Compact density: tighter line-height, smaller gaps between sections, more content per page, still fully readable.";
    case "airy":
      return "Airy density: generous whitespace, relaxed line-height, breathing room between every section.";
    case "balanced":
    default:
      return "Balanced density: comfortable reading rhythm, moderate spacing between sections.";
  }
}

function toneLabel(tone?: A4Tone): string {
  switch (tone) {
    case "friendly":
      return "Friendly tone: warm, approachable design; soft shapes; inviting visuals.";
    case "playful":
      return "Playful tone: fun accents, vibrant pops of color (within chosen palette), lighter illustrations.";
    case "formal":
      return "Formal tone: traditional layout, conservative spacing, classical feel.";
    case "professional":
    default:
      return "Professional tone: polished corporate feel, refined typography, restrained decoration.";
  }
}

function getDesignPreferencesBlock(
  design: A4DesignSettings | null | undefined,
): string {
  if (!design) return "";
  const parts: string[] = [];

  if (design.background_color) {
    parts.push(
      `- DOCUMENT BACKGROUND COLOR: ${design.background_color}. Fill the entire page background with this color. Do NOT default to pure white if this is set.`,
    );
  }
  if (design.text_color) {
    parts.push(
      `- BODY TEXT COLOR: ${design.text_color}. Apply to all body text and default headings. Ensure strong readable contrast against the background.`,
    );
  }
  if (design.accent_color) {
    parts.push(
      `- ACCENT / BORDER COLOR: ${design.accent_color}. Apply to borders, section dividers, accent bars, table header rows, bullet markers, and small emphasis elements. Use it consistently, never randomly.`,
    );
  }
  if (design.font_family) {
    parts.push(`- FONT FAMILY: ${fontFamilyLabel(design.font_family)}. Use this consistently for headings and body text.`);
  }
  if (design.border_style) {
    parts.push(`- BORDER STYLE: ${borderStyleLabel(design.border_style)}`);
  }
  if (typeof design.include_decorative_images === "boolean") {
    if (design.include_decorative_images) {
      parts.push(
        "- DECORATIVE IMAGES: YES. Integrate contextually relevant illustrations, icons, or small spot images that match the subject matter. Keep them clean, on-brand, and non-photographic unless the theme explicitly calls for photos. They must never compete with text or reduce readability.",
      );
    } else {
      parts.push(
        "- DECORATIVE IMAGES: NO. Render a text-first layout. Only allow minimal iconography if it clarifies meaning (like bullet icons or section markers).",
      );
    }
  }
  if (design.density) {
    parts.push(`- PAGE DENSITY: ${densityLabel(design.density)}`);
  }
  if (design.tone) {
    parts.push(`- DESIGN TONE: ${toneLabel(design.tone)}`);
  }

  if (parts.length === 0) return "";

  return `USER DESIGN PREFERENCES (HIGH PRIORITY — these OVERRIDE the theme's default palette and typography where they conflict, while preserving the theme's layout DNA):
${parts.join("\n")}`;
}

function getVisualAssetsBlock(formState: Record<string, unknown>, theme: A4Theme): string {
  const diagram = !!formState.include_diagram;
  const chart = !!formState.include_chart;
  const table = !!formState.include_table;
  const grading = !!formState.include_grading_circle;

  const parts: string[] = [];
  if (diagram) {
    parts.push(
      `DIAGRAM: YES. Render a contextually relevant, accurate diagram for the subject matter, placed in a logical position within the layout (centered between sections or in a dedicated visual block). Style: ${theme.diagram_default_style ?? "clean vector schematic, labeled with leader lines"}. Label parts clearly. If language_mode includes Arabic, label in both languages.`,
    );
  } else {
    parts.push("DIAGRAM: NO.");
  }
  if (chart) {
    parts.push(
      `CHART: YES. If numerical data is present anywhere in the content, render a clean ${theme.chart_default_style ?? "2D bar or line chart"} illustrating it. Include axis labels. Do not invent data that is not in the content.`,
    );
  } else {
    parts.push("CHART: NO.");
  }
  if (table) {
    parts.push(
      "TABLE: YES. If tabular data or side-by-side comparisons appear in the content, render them as a clean bordered table with a shaded header row.",
    );
  }
  if (grading) {
    parts.push(
      "GRADING CIRCLE: YES. Bottom-right corner, draw a bold circle. Inside the circle, render a blank space followed by '/ 10' (or '/ 100' if total_marks is 100) for the teacher to fill in. Small label above: 'Final Grade'.",
    );
  }
  return parts.join("\n");
}

export function compileMasterPrompt(input: A4CompileInput): string {
  const {
    theme,
    formState,
    geminiPages,
    pageNumber,
    totalPages,
    languageMode,
    brandColors,
    hasLogoReference,
    hasPrevPageReference,
  } = input;

  const thisPage = geminiPages.find((p) => p.page_number === pageNumber) ?? geminiPages[0];
  const contentRendered = thisPage ? renderPage(thisPage) : "";
  const languageRules = getLanguageRules(languageMode);
  const pageContext = getPageContextClause(pageNumber, totalPages, hasPrevPageReference);
  const brandColorDirective = getBrandColorDirective(brandColors);
  const headerBlock = getHeaderBlock(theme, formState, hasLogoReference, pageNumber);
  const visualAssets = getVisualAssetsBlock(formState, theme);
  const design = input.designSettings ?? null;
  const resolvedAspect = resolveAspectRatio(theme, design?.orientation);
  const designPrefs = getDesignPreferencesBlock(design);
  const backgroundDirective = design?.background_color
    ? `Page background filled with ${design.background_color} edge-to-edge (unless the theme explicitly requires a different treatment for a specific block).`
    : "Pure solid white page (unless the theme style block explicitly dictates otherwise).";

  return `ROLE:
You are "A4", a precision digital document architect. Your only output is a pristine, flat 2D digital A4 document, indistinguishable from a professionally designed PDF export. You never produce photos of paper on desks, shadows, wood, hands, fingers, curled corners, staples, or any physical object. You are a vector layout engine, not a photographer.

NON-NEGOTIABLE VISUAL LAWS:
1. PERSPECTIVE: Absolute top-down, flat, 2D vector layout. Zero perspective, zero 3D, zero depth. Aspect ratio ${resolvedAspect}${design?.orientation ? ` (user chose ${design.orientation} orientation)` : ""}.
2. BACKGROUND: ${backgroundDirective} No paper texture, no shadows behind the page, no vignettes, no borders around the page edge unless the theme or user border style calls for it.
3. TEXT CLARITY: Every single character must be razor-sharp, properly kerned, anti-aliased cleanly, and readable at 400% zoom. No blurred, warped, wavy, or smudged text anywhere.
4. TEXT FIDELITY (CRITICAL): Every word, number, punctuation mark, subscript, superscript, chemical formula, fraction, and symbol inside the CONTENT section below must be rendered EXACTLY as written. Do NOT paraphrase. Do NOT shorten. Do NOT translate. Do NOT substitute synonyms. Do NOT "improve" or "correct" the content. Preserve every character verbatim, including punctuation and spacing.
5. NO HALLUCINATED TEXT: Do not invent text anywhere on the page. If a region has no assigned content, leave it clean or fill with requested visuals only. Zero lorem ipsum, zero placeholder copy, zero sample watermarks, zero gibberish.

TYPOGRAPHY STACK:
- English / Latin text: clean sans-serif (Inter, Helvetica, or Arial). Consistent throughout the document.
- Arabic text: Noto Sans Arabic or an equivalent modern Arabic sans-serif. Proper letter joining. No broken or isolated glyphs.
- Numbers: use Western digits (0123456789) with English content; use them with Arabic content too unless the source content explicitly uses Arabic-Indic digits (٠١٢٣...).
- Never mix two different font families within the same text block.
- Chemical formulas use proper subscripts (CO2 should render as CO with subscript 2). Fractions use proper typographic fractions or clean horizontal-bar fractions.

VISUAL HIERARCHY:
- H1 (document title): largest, bold, placed per header instructions.
- H2 (section headings): clearly smaller than H1, bold or semi-bold, consistent spacing between sections.
- Body text: comfortable reading size, generous line-height, left-aligned (or right-aligned for Arabic).
- Tables: bordered, with a distinct header row. Alternating subtle row shading allowed.
- Bullet and numbered lists: clean, properly indented, consistent markers.

LANGUAGE & ALIGNMENT RULES:
${languageRules}

VISUAL THEME (DESIGN DNA):
${theme.style_block}

${designPrefs ? designPrefs + "\n" : ""}${brandColorDirective ? "BRAND COLORS:\n" + brandColorDirective + "\n" : ""}
PAGE CONTEXT:
${pageContext}

HEADER SECTION:
${headerBlock}

MAIN CONTENT:
Render the following structured content with perfect spacing, grouping, and emphasis. Respect every label, section break, list, and question. Preserve every word.

[CONTENT START]
${contentRendered}
[CONTENT END]

VISUAL ASSETS:
${visualAssets}

FOOTER (MANDATORY ON EVERY PAGE):
Render at the very bottom center of the page, in 7pt light gray text, non-distracting, never overlapping any content:
"wakti.qa"
${totalPages > 1 ? `Also render small page numbering at the bottom right: "Page ${pageNumber} of ${totalPages}".` : ""}

SELF-CORRECTION (EXECUTE BEFORE RENDERING):
Before finalizing the image, mentally verify:
- Is every word from CONTENT START to CONTENT END present and spelled identically to the source?
- Are all chemical formulas, fractions, and equations technically correct and properly typeset?
- Are Arabic characters correctly joined and right-aligned per the language rules?
- Are there zero hallucinated or invented words anywhere on the page?
- Is every line perfectly straight, every margin consistent, every color crisp?
- Does the page feel like a flat PDF export, NOT a photograph of paper?
- Does the bottom-center "wakti.qa" footer appear exactly once, light gray, non-intrusive?

Render now.`;
}
