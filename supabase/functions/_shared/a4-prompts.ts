// A4 Document Builder — Prompt Compiler (Direct Form-to-Prompt)
// -----------------------------------------------------------------------------
// No Gemini middleman. The form IS the prompt builder. What the user clicks is
// what gets sent to Nano Banana 2.
// -----------------------------------------------------------------------------

import type { A4Theme } from "./a4-themes.ts";

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

// -----------------------------------------------------------------------------
// CREATIVE CONTROL TYPES — each form control maps to a specific prompt fragment.
// -----------------------------------------------------------------------------
export type A4VisualRecipe =
  | "paper_craft_flatlay"
  | "executive_tech_spec"
  | "comic_triptych"
  | "ministry_exam"
  | "menu_board"
  | "craft_diy_explainer"
  | "minimal_stationery"
  | "bold_poster";

export type A4IllustrationStyle =
  | "none"
  | "icons"
  | "flat_vector"
  | "paper_craft"
  | "watercolor"
  | "comic_bold"
  | "photo_realistic";

export type A4AccentElement =
  | "hand_drawn_arrows"
  | "ribbons"
  | "stars"
  | "corner_ornaments"
  | "callout_badges"
  | "dotted_dividers"
  | "paper_tape"
  | "thread_connectors";

export type A4BackgroundTreatment =
  | "plain_white"
  | "soft_paper_texture"
  | "light_gradient"
  | "subtle_grid"
  | "botanical_motif"
  | "confetti"
  | "photographic_backdrop";

export type A4ContentComponent =
  | "chart_bar"
  | "chart_line"
  | "chart_donut"
  | "chart_radar"
  | "data_table"
  | "timeline"
  | "step_flow"
  | "side_by_side"
  | "vitality_wheel"
  | "info_cards"
  | "grading_circle"
  | "pull_quote"
  | "callout_boxes";

export type A4LayoutPattern =
  | "single_column"
  | "two_column_split"
  | "sidebar_main"
  | "three_panel_grid"
  | "hero_body"
  | "centered_composition";

export interface A4CreativeSettings {
  visual_recipe?: A4VisualRecipe | null;
  illustration_style?: A4IllustrationStyle | null;
  accent_elements?: A4AccentElement[] | null;
  background_treatment?: A4BackgroundTreatment | null;
  content_components?: A4ContentComponent[] | null;
  layout_pattern?: A4LayoutPattern | null;
}

export interface A4CompileInput {
  theme: A4Theme;
  purposeId: string | null;
  formState: Record<string, unknown>;
  rawContent: string; // user's textarea body — passed through verbatim
  pageNumber: number;
  totalPages: number;
  languageMode: "en" | "ar" | "bilingual";
  brandColors: { primary?: string | null; secondary?: string | null } | null;
  hasLogoReference: boolean;
  hasPrevPageReference: boolean;
  designSettings?: A4DesignSettings | null;
  creativeSettings?: A4CreativeSettings | null;
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
      const title = String(formState.report_title ?? formState.__fallback_title__ ?? "").trim();
      const period = String(formState.period ?? "").trim();
      const author = String(formState.author ?? "").trim();
      const ref = String(formState.doc_ref ?? "").trim();
      const lines: string[] = [];
      if (logoClause) lines.push(logoClause);
      lines.push("Narrow accent bar across the very top.");
      if (company) lines.push(`Next to logo: company name "${company}"${dept ? ' | "' + dept + '"' : ""}.`);
      if (ref) lines.push(`Top-right: reference code "${ref}" in small monospaced style.`);
      if (title) lines.push(`Below header, full-width H1 title: "${title}".`);
      const meta: string[] = [];
      if (period) meta.push(`"Period: ${period}"`);
      if (author) meta.push(`"Prepared by: ${author}"`);
      if (meta.length) lines.push(`Meta row: ${meta.join(" | ")}.`);
      return `Header: ${lines.join(" ")}`;
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

function getVisualAssetsBlock(
  formState: Record<string, unknown>,
  theme: A4Theme,
): string {
  const diagram = !!formState.include_diagram;
  const chart = !!formState.include_chart;
  const table = !!formState.include_table;
  const grading = !!formState.include_grading_circle;

  const parts: string[] = [];

  if (diagram) {
    parts.push(
      `Include a contextually relevant diagram illustrating the subject matter. Place it in a logical spot within the layout. Style: ${theme.diagram_default_style ?? "clean vector schematic, labeled with leader lines"}. Label parts clearly.`,
    );
  }
  if (chart) {
    parts.push(
      `If the content contains numerical data, render a ${theme.chart_default_style ?? "clean 2D bar or line chart"} visualising it. Include axis labels drawn from the content. Use only numbers that are present \u2014 never invent values.`,
    );
  }
  if (table) {
    parts.push(
      "If the content contains tabular data, render it as a clean bordered table with a shaded header row, hairline row dividers, and alternating subtle row shading.",
    );
  }
  if (grading) {
    const totalMarks = Number(formState.total_marks ?? 0);
    const denominator = totalMarks === 100 ? "100" : "10";
    parts.push(
      `Bottom-right corner: render a bold circle. Inside the circle place a short blank line followed by "/ ${denominator}" for the teacher to fill in. Small label above the circle: "Final Grade".`,
    );
  }

  if (parts.length === 0) return "";
  return parts.join("\n");
}

// -----------------------------------------------------------------------------
// CREATIVE FRAGMENT BUILDERS — each translates a user-clicked control into a
// specific natural-language instruction for Nano Banana 2. No AI in between.
// -----------------------------------------------------------------------------
function getVisualRecipeBlock(recipe: A4VisualRecipe | null | undefined): string {
  if (!recipe) return "";
  switch (recipe) {
    case "paper_craft_flatlay":
      return "High-quality flat-lay photography aesthetic. Paper-craft cut-outs arranged on a clean light-gray textured paper background. Small tactile 3D accents (folded paper, cotton-ball clouds, twine, blue water drops) where relevant. Shot from a top-down bird's-eye view with soft even lighting that minimises shadows. Educational, modern, easy to understand.";
    case "executive_tech_spec":
      return "Premium executive-report tech-specification aesthetic. Organised information panels with strong section dividers, subtle gradient fills, a prominent centered circular chart or capability wheel, and a system-capabilities data table. Consultancy-grade feel.";
    case "comic_triptych":
      return "Bold comic-book poster aesthetic organised as 3 vertical panels. Thick black outlines, dramatic vibrant saturated backgrounds, uppercase comic-lettering titles in banner shapes, clean caption strips at the bottom of each panel.";
    case "ministry_exam":
      return "Official ministry-style exam paper aesthetic. Sharp black ink on pure white stock, conservative ruled lines, generous answering space beneath every numbered question, bordered checkbox rows for multiple-choice options.";
    case "menu_board":
      return "Refined menu-board aesthetic. Elegant masthead at the top, categorised sections, items listed with name on the left and price right-aligned connected by dotted leader lines, subtle decorative accents between categories.";
    case "craft_diy_explainer":
      return "Hands-on DIY craft infographic aesthetic. Hand-cut paper shapes arranged in a flow, hand-drawn ink arrows connecting steps, short text captions on each card, warm educational handmade feel.";
    case "minimal_stationery":
      return "Ultra-clean minimalist stationery aesthetic. Pure white background, generous whitespace, single tasteful accent color, clean sans-serif typography, hairline section dividers. Premium modern feel.";
    case "bold_poster":
      return "Bold social-share poster aesthetic. Full-bleed color or gradient background, hero-size headline typography, high-contrast information card floating on the background, Instagram-ready eye-grabbing composition.";
    default:
      return "";
  }
}

function getIllustrationStyleBlock(style: A4IllustrationStyle | null | undefined): string {
  if (!style || style === "none") return "";
  switch (style) {
    case "icons":
      return "Illustration approach: minimal line or filled icons only. No larger illustrations. Icons support bullets, section headings, and small callouts.";
    case "flat_vector":
      return "Illustration approach: clean flat vector illustrations with soft fills and crisp outlines. Modern and friendly.";
    case "paper_craft":
      return "Illustration approach: paper-craft cut-outs with subtle drop shadows. Tactile, handmade feel. Folded paper, twine, cotton-ball clouds where relevant.";
    case "watercolor":
      return "Illustration approach: soft watercolor illustrations with gentle bleeds and warm earthy tones.";
    case "comic_bold":
      return "Illustration approach: bold comic-book illustrations with thick black outlines and vibrant saturated fills.";
    case "photo_realistic":
      return "Illustration approach: photo-realistic imagery integrated naturally into the layout where the subject calls for a photograph.";
    default:
      return "";
  }
}

function getAccentElementsBlock(elements: A4AccentElement[] | null | undefined): string {
  if (!elements || elements.length === 0) return "";
  const map: Record<A4AccentElement, string> = {
    hand_drawn_arrows: "hand-drawn ink arrows connecting sequential or related elements",
    ribbons: "small ribbon banners behind key labels or achievements",
    stars: "small decorative stars for emphasis around awards or highlights",
    corner_ornaments: "elegant ornamental flourishes at the page corners",
    callout_badges: "circular or pill-shape callout badges drawing attention to key numbers or labels",
    dotted_dividers: "dotted or dashed hairline dividers between sections",
    paper_tape: "washi-tape or paper-tape strips fastening key elements to the page",
    thread_connectors: "decorative thread or twine lines linking related items",
  };
  const pieces = elements.map((e) => map[e]).filter(Boolean);
  if (pieces.length === 0) return "";
  return `Accent elements to include: ${pieces.join(", ")}. Use them tastefully so they enhance rather than compete with the content.`;
}

function getBackgroundTreatmentBlock(bg: A4BackgroundTreatment | null | undefined): string {
  if (!bg) return "";
  switch (bg) {
    case "plain_white":
      return "Background: pure flat white, edge-to-edge.";
    case "soft_paper_texture":
      return "Background: soft off-white or light-gray paper texture with subtle grain, edge-to-edge.";
    case "light_gradient":
      return "Background: gentle light gradient softly shifting between two close hues, edge-to-edge.";
    case "subtle_grid":
      return "Background: very subtle grid or graph-paper pattern in a near-invisible tint, edge-to-edge.";
    case "botanical_motif":
      return "Background: delicate botanical motif (soft leaves or floral line art) faded to near-watermark opacity, edge-to-edge.";
    case "confetti":
      return "Background: tasteful confetti pattern in muted accent-color dots, edge-to-edge, never overpowering the content.";
    case "photographic_backdrop":
      return "Background: photographic backdrop relevant to the subject (wood desk, linen, marble, etc.) with a soft vignette keeping text readable.";
    default:
      return "";
  }
}

// Themes where topic elaboration is welcome (educational / explanatory).
// For these themes we soften the "never invent" rule so the model can fill
// sparse content with accurate facts about the stated topic instead of
// falling back to Lorem Ipsum.
const ELABORATION_FRIENDLY_THEMES = new Set<string>([
  "craft_infographic",
  "comic_explainer",
  "school_project",
  "school_exam",
  "clean_minimal",
]);

// Themes where grading_circle makes sense. Everywhere else it gets stripped.
const GRADING_CIRCLE_THEMES = new Set<string>(["official_exam"]);

function getContentComponentsBlock(
  components: A4ContentComponent[] | null | undefined,
  rawContent: string,
  themeId: string,
): string {
  if (!components || components.length === 0) return "";
  const map: Record<A4ContentComponent, string> = {
    chart_bar: "a clean 2D bar chart visualising numerical data found in the content (axis labels drawn from the content; never invent numbers)",
    chart_line: "a clean 2D line chart visualising numerical data found in the content (axis labels drawn from the content; never invent numbers)",
    chart_donut: "a donut chart visualising proportional data found in the content, with a clean legend",
    chart_radar: "a radar / spider chart visualising multi-axis data found in the content",
    data_table: "a bordered data table with a shaded header row, hairline row dividers, and alternating subtle row shading",
    timeline: "a horizontal or vertical timeline with clear markers for each step or milestone",
    step_flow: "a step-by-step flow diagram with hand-drawn or clean vector arrows connecting each step",
    side_by_side: "a side-by-side comparison panel with clear column headers and aligned rows",
    vitality_wheel: "a prominent centered circular vitality / capability wheel with labeled spokes",
    info_cards: "a grid of information cards, each card holding a short label and one or two lines of content",
    grading_circle: "a bold circle in the bottom-right corner containing a blank line followed by a denominator (for example '___ / 10'), labeled 'Final Grade' above it",
    pull_quote: "one or two large pull-quote blocks emphasising key phrases from the content",
    callout_boxes: "small callout boxes highlighting key facts or warnings beside their relevant sections",
  };

  // Anti-hallucination guard: if the content carries no numeric data, strip
  // components that require numbers so the model cannot invent them.
  const hasNumbers = /\d/.test(rawContent ?? "");
  const numericOnly = new Set<A4ContentComponent>([
    "chart_bar",
    "chart_line",
    "chart_donut",
    "chart_radar",
  ]);
  let filtered = components.slice();

  // Theme compatibility gate: grading_circle only belongs in actual exam themes.
  if (!GRADING_CIRCLE_THEMES.has(themeId)) {
    filtered = filtered.filter((c) => c !== "grading_circle");
  }

  if (!hasNumbers) {
    filtered = filtered.filter((c) => !numericOnly.has(c));
    const hadChart = components.some((c) => numericOnly.has(c));
    if (hadChart && !filtered.includes("info_cards")) {
      filtered.push("info_cards");
    }
  }

  const pieces = filtered.map((c) => map[c]).filter(Boolean);
  if (pieces.length === 0) return "";

  const isElaborationFriendly = ELABORATION_FRIENDLY_THEMES.has(themeId);

  const rules = isElaborationFriendly
    ? [
        `Content components to include: ${pieces.join("; ")}.`,
        "Integrate each component into the layout where it logically fits.",
        "RULE: If the provided content is brief, elaborate each card using short, accurate, age-appropriate facts about the stated topic, written in the SAME LANGUAGE as the content.",
        "Stay factually correct. Do NOT fabricate brand names, product names, company names, numeric statistics, dates, or specific integrations that are not common knowledge about the topic.",
      ]
    : [
        `Content components to include: ${pieces.join("; ")}.`,
        "Integrate each component into the layout where it logically fits.",
        "CRITICAL: Populate every component ONLY with data that already exists in the content above.",
        "Do NOT invent numbers, labels, company names, product names, technology names, brand names, integrations, or examples.",
        "If a component has no matching data source in the content, OMIT that component entirely and replace it with a short qualitative summary card built from words that ARE in the content.",
      ];

  return rules.join(" ");
}

function getLayoutPatternBlock(pattern: A4LayoutPattern | null | undefined): string {
  if (!pattern) return "";
  switch (pattern) {
    case "single_column":
      return "Layout pattern: single full-width column, top-to-bottom reading flow.";
    case "two_column_split":
      return "Layout pattern: two equal columns side by side inside the body zone.";
    case "sidebar_main":
      return "Layout pattern: narrow sidebar on one side carrying meta or highlights, wider main column carrying the primary content.";
    case "three_panel_grid":
      return "Layout pattern: three equal panels (vertical strip or horizontal row) inside the body zone.";
    case "hero_body":
      return "Layout pattern: tall hero zone at the top (oversized headline or feature visual), body content flows beneath it.";
    case "centered_composition":
      return "Layout pattern: entirely centered composition, every element balanced around the page axis.";
    default:
      return "";
  }
}

export function compileMasterPrompt(input: A4CompileInput): string {
  const {
    theme,
    formState,
    rawContent,
    pageNumber,
    totalPages,
    languageMode,
    brandColors,
    hasLogoReference,
    hasPrevPageReference,
  } = input;

  // Title fallback: if the user left document title empty, synthesise one from
  // the most likely entity field + theme label so the model never invents a title.
  const entityName = String(
    formState.company_name
      ?? formState.business_name
      ?? formState.school_name
      ?? formState.issuer_name
      ?? formState.sender_name
      ?? formState.full_name
      ?? "",
  ).trim();
  const themeLabel = (theme as unknown as { name_en?: string }).name_en ?? "Document";
  const fallbackTitle = entityName ? `${entityName} — ${themeLabel}` : themeLabel;
  const formStateForHeader: Record<string, unknown> = {
    ...formState,
    __fallback_title__: fallbackTitle,
  };

  const languageRules = getLanguageRules(languageMode);
  const pageContext = getPageContextClause(pageNumber, totalPages, hasPrevPageReference);
  const brandColorDirective = getBrandColorDirective(brandColors);
  const headerBlock = getHeaderBlock(theme, formStateForHeader, hasLogoReference, pageNumber);
  const visualAssets = getVisualAssetsBlock(formState, theme);
  const design = input.designSettings ?? null;
  const creative = input.creativeSettings ?? null;
  const resolvedAspect = resolveAspectRatio(theme, design?.orientation);
  const designPrefs = getDesignPreferencesBlock(design);
  const orientationLabel = design?.orientation ?? "portrait";

  const visualRecipe = getVisualRecipeBlock(creative?.visual_recipe);
  const illustrationStyle = getIllustrationStyleBlock(creative?.illustration_style);
  const accentElements = getAccentElementsBlock(creative?.accent_elements);
  const backgroundTreatment = getBackgroundTreatmentBlock(creative?.background_treatment);
  const contentComponents = getContentComponentsBlock(
    creative?.content_components,
    rawContent,
    theme.id,
  );
  const layoutPattern = getLayoutPatternBlock(creative?.layout_pattern);

  // Orientation override: when user picks landscape, prepend an aggressive
  // directive so the theme's portrait-flavoured blueprint does not override it.
  const orientation = design?.orientation ?? "portrait";
  const orientationOverride = orientation === "landscape"
    ? "ORIENTATION\nThis is a LANDSCAPE page (wider than tall). Fill the full frame edge-to-edge. Arrange body sections HORIZONTALLY — cards or panels should flow left-to-right in a row (or multi-row grid), not stack vertically. The header sits across the top, body fills the wide middle, footer across the bottom. If any downstream instruction describes a vertical reading flow, adapt it to a horizontal flow while preserving the visual style."
    : "";

  // Subject-aware imagery rule: forbid generic fallback motifs that don't
  // relate to the actual document topic.
  const subjectAwareImagery =
    "SUBJECT-AWARE IMAGERY\nAll decorative elements, icons, spot illustrations, craft shapes, and small accents MUST be semantically tied to the document's subject matter (derived from the header, topic, title, or content). Do NOT use generic weather motifs (clouds, rain, water drops, cotton) unless the subject is literally about weather or water. Do NOT reuse the same stock motifs across different topics. If a motif has no connection to the subject, omit it.";

  // No-Lorem guard: prevents the classic placeholder-text fallback when the
  // provided content is sparse.
  const noLoremGuard =
    "NO PLACEHOLDER TEXT\nNEVER render Lorem Ipsum, placeholder Latin, 'sample text', or meaningless filler inside any card, label, or body block. Every rendered character must be meaningful text. If the provided content is brief and a card would otherwise be empty, write a short, accurate, on-topic sentence in the SAME LANGUAGE as the content.";

  const backgroundDirective = backgroundTreatment
    || (design?.background_color
      ? `Background: solid ${design.background_color}, edge-to-edge.`
      : `Background: ${theme.id === "certificate" ? "cream or pearl-white" : "pure white"} (unless the theme aesthetic above specifies otherwise).`);

  const layoutBlueprint = theme.layout_blueprint
    ?? "Use a clean top-to-bottom layout: header zone, body zone, footer zone. Keep margins consistent and spacing generous.";

  // Prompt is composed per Google's Nano Banana prompting guide:
  //   - Strong verb opening ("Generate...")
  //   - Positive framing throughout (describe what you want, never what to avoid)
  //   - Content to render passes through verbatim so the model renders it exactly
  //   - Spatial blueprint + creative direction like a creative director would

  const sections: string[] = [];

  sections.push(
    `Generate a flat 2D digital A4 ${orientationLabel} document \u2014 the final image should look indistinguishable from a crisp PDF export viewed on screen. Aspect ratio ${resolvedAspect}.`,
  );

  sections.push(
    `VISUAL STYLE\n${theme.style_block}\n${backgroundDirective}\nAll text renders razor-sharp and anti-aliased, with consistent kerning, legible at 400% zoom.`,
  );

  if (visualRecipe) sections.push(`VISUAL RECIPE\n${visualRecipe}`);
  if (illustrationStyle) sections.push(`ILLUSTRATION APPROACH\n${illustrationStyle}`);
  if (accentElements) sections.push(`ACCENT ELEMENTS\n${accentElements}`);

  // Slim TYPOGRAPHY: only send Arabic rules when the document actually uses Arabic.
  if (languageMode === "ar" || languageMode === "bilingual") {
    sections.push(
      `TYPOGRAPHY\nEnglish and Latin text uses clean modern sans-serif (Inter, Helvetica, or Arial). Arabic text uses Noto Sans Arabic or an equivalent modern Arabic sans-serif with proper letter joining. Numbers use Western digits (0123456789) unless the source content itself uses Arabic-Indic digits. Within any single text block, typography stays consistent.`,
    );
  } else {
    sections.push(
      `TYPOGRAPHY\nClean modern sans-serif (Inter, Helvetica, or Arial). Consistent kerning. Western digits. Proper typographic punctuation and fractions. No mixed fonts within the same block.`,
    );
  }

  sections.push(`LANGUAGE\n${languageRules}`);
  sections.push(`PAGE CONTEXT\n${pageContext}`);
  if (orientationOverride) sections.push(orientationOverride);
  sections.push(`LAYOUT BLUEPRINT\n${layoutBlueprint}`);
  if (layoutPattern) sections.push(`LAYOUT PATTERN\n${layoutPattern}`);
  sections.push(`HEADER\n${headerBlock}`);
  sections.push(subjectAwareImagery);
  sections.push(noLoremGuard);

  if (designPrefs) sections.push(designPrefs);
  if (brandColorDirective) sections.push(`BRAND ACCENT COLORS\n${brandColorDirective}`);

  const trimmedContent = (rawContent ?? "").trim();
  if (trimmedContent) {
    sections.push(
      `CONTENT TO RENDER\nRender the following content inside the body zone of the layout. Preserve every word, number, punctuation mark, and symbol exactly as written. Respect every paragraph, list, question, and heading. Keep it razor-sharp and perfectly legible.\n\n${trimmedContent}`,
    );
  }

  if (contentComponents) sections.push(`CONTENT COMPONENTS\n${contentComponents}`);
  if (visualAssets) sections.push(`VISUAL ASSETS\n${visualAssets}`);

  const footerLine = totalPages > 1
    ? `FOOTER\nBottom center of the page, in small 7pt light gray text: "wakti.qa"\nBottom right, small matching type: "Page ${pageNumber} of ${totalPages}"`
    : `FOOTER\nBottom center of the page, in small 7pt light gray text: "wakti.qa"`;
  sections.push(footerLine);

  sections.push("Render the final image now.");

  return sections.join("\n\n");
}
