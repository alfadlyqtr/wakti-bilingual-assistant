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
export type A4FontFamily = "modern_sans" | "classic_serif" | "elegant_script" | "bold_display" | "playful_hand" | "rounded_sans" | "editorial_serif" | "luxury_script" | "notebook_hand" | "marker_hand" | "monoline_hand";
export type A4BorderStyle = "none" | "thin" | "thick" | "rounded" | "decorative" | "double_line" | "dashed" | "corner_frame";
export type A4Density = "ultra_compact" | "compact" | "balanced" | "airy" | "spacious";
export type A4Tone = "professional" | "friendly" | "playful" | "formal" | "elegant" | "bold" | "romantic";

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
  | "bold_poster"
  | "luxury_editorial"
  | "study_notes"
  | "scrapbook_story"
  | "museum_catalog";

export type A4IllustrationStyle =
  | "none"
  | "icons"
  | "flat_vector"
  | "paper_craft"
  | "watercolor"
  | "comic_bold"
  | "photo_realistic"
  | "line_art"
  | "sketch_handdrawn"
  | "collage_cutout"
  | "pastel_gouache";

export type A4AccentElement =
  | "hand_drawn_arrows"
  | "ribbons"
  | "stars"
  | "corner_ornaments"
  | "callout_badges"
  | "dotted_dividers"
  | "paper_tape"
  | "thread_connectors"
  | "underlines"
  | "sticky_notes"
  | "spark_lines"
  | "ink_stamps"
  | "washi_corners";

export type A4BackgroundTreatment =
  | "plain_white"
  | "soft_paper_texture"
  | "light_gradient"
  | "subtle_grid"
  | "botanical_motif"
  | "confetti"
  | "photographic_backdrop"
  | "dark_solid"
  | "linen_texture"
  | "marble_surface"
  | "chalkboard";

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
  | "callout_boxes"
  | "metric_tiles"
  | "faq_block"
  | "numbered_steps"
  | "process_chevrons";

export type A4LayoutPattern =
  | "single_column"
  | "two_column_split"
  | "sidebar_main"
  | "three_panel_grid"
  | "hero_body"
  | "centered_composition"
  | "top_bottom_split"
  | "magazine_editorial"
  | "zigzag_story"
  | "card_mosaic";

export interface A4CreativeSettings {
  visual_recipe?: A4VisualRecipe | null;
  illustration_style?: A4IllustrationStyle | null;
  accent_elements?: A4AccentElement[] | null;
  background_treatment?: A4BackgroundTreatment | null;
  content_components?: A4ContentComponent[] | null;
  layout_pattern?: A4LayoutPattern | null;
}

export type A4ReferenceImageRole = "portrait" | "logo" | "product" | "sample" | "none";

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
  // NEW — user's free-text wishes, injected verbatim into the prompt.
  // Whatever the user types here must reach the image model unmodified.
  userWishes?: string | null;
  // NEW — what role the uploaded reference image plays in the final document.
  // Drives the REFERENCE IMAGE directive so the image model knows what to do
  // with the attachment (put it as a portrait, small logo, product photo, etc.).
  referenceImageRole?: A4ReferenceImageRole | null;
  // NEW (F1) — user-picked decoration chips ("botanical leaves", "gold foil",
  // custom strings, etc.). Consumed verbatim by the compiler so the user's
  // choices reach the image model. Capped upstream to A4_MAX_CHIPS_PER_SIDE.
  decorationsWanted?: string[] | null;
  // NEW (F1) — decoration motifs the user explicitly does NOT want. Rendered
  // as a short positive-framing exclusion line so the image model avoids them.
  decorationsUnwanted?: string[] | null;
}

function _getLanguageRules(mode: "en" | "ar" | "bilingual"): string {
  if (mode === "ar") {
    return "Entire document in Arabic. Right-to-left (RTL) alignment throughout. Arabic text flows RTL. Western digits (0123) and Latin brand names remain left-to-right within their local context. Use Noto Sans Arabic or equivalent modern Arabic sans-serif with correct letter joining.";
  }
  if (mode === "bilingual") {
    return "Bilingual document (English + Arabic). Where both languages appear side-by-side, English (LTR) on the LEFT column and Arabic (RTL) on the RIGHT column. Each language maintains strict alignment within its column. NEVER mix characters of two scripts inside a single word or phrase. Use appropriate fonts per script.";
  }
  return "Entire document in English. Left-to-right (LTR) alignment throughout. Clean sans-serif typography (Inter, Helvetica, or Arial).";
}

function _getPageContextClause(pageNumber: number, totalPages: number, hasPrevPageRef: boolean): string {
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

function _getHeaderBlock(
  theme: A4Theme,
  formState: Record<string, unknown>,
  hasLogoRef: boolean,
  referenceImageRole: A4ReferenceImageRole | null | undefined,
  pageNumber: number,
  languageMode: "en" | "ar" | "bilingual" = "en",
): string {
  const L = (en: string, ar: string) => {
    if (languageMode === "ar") return ar;
    if (languageMode === "bilingual") return `${en} / ${ar}`;
    return en;
  };
  // For multi-page, page 2+ uses a slim running header
  if (pageNumber > 1) {
    const title = String(formState.project_title ?? formState.report_title ?? formState.poster_title ?? formState.business_name ?? formState.company_name ?? formState.full_name ?? formState.card_title ?? formState.subject ?? formState.course_name ?? formState.title ?? formState.event_name ?? "").trim();
    if (!title) {
      return `Slim running header only if page 1 already established a visible title. Do not invent a new running title on this page.`;
    }
    return `Slim running header only: document title "${title}" aligned per language direction. Do not repeat the reference image unless the user explicitly uses it as a logo.`;
  }

  const logoClause = hasLogoRef && referenceImageRole === "logo"
    ? "Top-left area: render the reference logo EXACTLY as provided — do not stylize, recolor, or redesign it. Keep its original proportions and colors."
    : "";

  // Theme-specific header assembly
  switch (theme.id) {
    case "official_exam": {
      const school = String(formState.institution_name ?? formState.school_name ?? "").trim();
      const subject = String(formState.subject ?? "").trim();
      const grade = String(formState.grade ?? "").trim();
      const level = String(formState.education_level ?? "").trim();
      const term = String(formState.term ?? "").trim();
      const duration = String(formState.duration ?? "").trim();
      const marks = String(formState.total_marks ?? "").trim();
      const teacher = String(formState.teacher_name ?? "").trim();
      const courseCode = String(formState.course_code ?? "").trim();
      const lblName = L("Name", "الاسم");
      const lblDate = L("Date", "التاريخ");
      const lblSubject = L("Subject", "المادة");
      const lblGrade = L("Grade", "الصف");
      const lblLevel = L("Level", "المستوى");
      const lblTerm = L("Term", "الفصل");
      const lblDuration = L("Duration", "المدة");
      const lblMin = L("min", "دقيقة");
      const lblMarks = L("Total Marks", "الدرجة الكلية");
      const meta: string[] = [];
      if (subject) meta.push(`"${lblSubject}: ${subject}"`);
      if (grade) meta.push(`"${lblGrade}: ${grade}"`);
      if (level && level !== grade) meta.push(`"${lblLevel}: ${level}"`);
      if (term) meta.push(`"${lblTerm}: ${term}"`);
      if (teacher) meta.push(`"${L("Teacher", "المعلم")}: ${teacher}"`);
      if (courseCode) meta.push(`"${L("Course Code", "رمز المقرر")}: ${courseCode}"`);
      return `Header: ${logoClause} Top-center: institution name "${school}". Meta row labels MUST be written exactly as follows in the active document language: ${meta.join(" | ") || `"${lblSubject}: ${subject || "..."}"`}. Top-right: fill-in lines labeled "${lblName}" and "${lblDate}" with underlines for handwriting when the layout is exam-like.${duration ? ` Also show "${lblDuration}: ${duration} ${lblMin}".` : ""}${marks ? ` Show "${lblMarks}: ${marks}".` : ""} CRITICAL: Every label in the header must render in the EXACT script selected above — never substitute English labels inside Arabic output.`;
    }
    case "school_project": {
      const school = String(formState.institution_name ?? formState.school_name ?? "").trim();
      const student = String(formState.student_name ?? "").trim();
      const studentId = String(formState.student_id ?? "").trim();
      const subject = String(formState.subject ?? "").trim();
      const grade = String(formState.grade ?? "").trim();
      const level = String(formState.education_level ?? "").trim();
      const faculty = String(formState.department_or_faculty ?? "").trim();
      const supervisor = String(formState.teacher_or_supervisor ?? "").trim();
      const title = String(formState.project_title ?? "").trim();
      const date = String(formState.submission_date ?? "").trim();
      const meta = [
        student ? `${L("Student", "الطالب")}: ${student}` : "",
        studentId ? `${L("Student ID", "الرقم الجامعي")}: ${studentId}` : "",
        grade ? `${L("Grade", "الصف")}: ${grade}` : "",
        level && level !== grade ? `${L("Level", "المستوى")}: ${level}` : "",
        subject ? `${L("Subject", "المادة")}: ${subject}` : "",
        faculty ? `${L("Department", "القسم")}: ${faculty}` : "",
        supervisor ? `${L("Supervisor", "المشرف")}: ${supervisor}` : "",
        school,
        date ? `${L("Date", "التاريخ")}: ${date}` : "",
      ].filter(Boolean).join(" | ");
      return `Header: ${logoClause}${title ? ` Large H1 title centered: "${title}".` : ""}${meta ? ` Meta row below title: "${meta}".` : ""}`;
    }
    case "academic_report": {
      const title = String(formState.title ?? "").trim();
      const institution = String(formState.institution_name ?? "").trim();
      const department = String(formState.department_or_faculty ?? "").trim();
      const course = String(formState.course_name ?? "").trim();
      const instructor = String(formState.instructor_name ?? "").trim();
      const supervisor = String(formState.supervisor_name ?? "").trim();
      const student = String(formState.student_name ?? "").trim();
      const studentId = String(formState.student_id ?? "").trim();
      const level = String(formState.education_level ?? "").trim();
      const semester = String(formState.year_or_semester ?? "").trim();
      const date = String(formState.submission_date ?? "").trim();
      const meta = [
        institution,
        department,
        course,
        instructor ? `${L("Instructor", "المحاضر")}: ${instructor}` : "",
        supervisor ? `${L("Supervisor", "المشرف")}: ${supervisor}` : "",
        student ? `${L("Student", "الطالب")}: ${student}` : "",
        studentId ? `${L("Student ID", "الرقم الجامعي")}: ${studentId}` : "",
        level ? `${L("Level", "المستوى")}: ${level}` : "",
        semester ? `${L("Semester", "الفصل الدراسي")}: ${semester}` : "",
        date ? `${L("Date", "التاريخ")}: ${date}` : "",
      ].filter(Boolean).join(" | ");
      return `Header: ${logoClause}${title ? ` Academic title block with the main title "${title}".` : ""}${meta ? ` Secondary meta line: "${meta}".` : ""}`;
    }
    case "study_handout": {
      const topic = String(formState.topic ?? "").trim();
      const course = String(formState.course_name ?? "").trim();
      const teacher = String(formState.teacher_name ?? "").trim();
      const grade = String(formState.grade ?? "").trim();
      const level = String(formState.education_level ?? "").trim();
      const focus = String(formState.focus_area ?? formState.session_title ?? formState.exam_scope ?? formState.formula_focus ?? "").trim();
      const meta = [
        course ? `${L("Course", "المقرر")}: ${course}` : "",
        teacher ? `${L("Teacher", "المعلم")}: ${teacher}` : "",
        grade ? `${L("Grade", "الصف")}: ${grade}` : "",
        level && level !== grade ? `${L("Level", "المستوى")}: ${level}` : "",
        focus ? `${L("Focus", "التركيز")}: ${focus}` : "",
      ].filter(Boolean).join(" | ");
      return `Header: ${logoClause}${topic ? ` Clear study-handout title at the top: "${topic}".` : ""}${meta ? ` Compact supporting meta row: "${meta}".` : ""}`;
    }
    case "research_poster": {
      const title = String(formState.poster_title ?? "").trim();
      const institution = String(formState.institution_name ?? "").trim();
      const department = String(formState.department_or_faculty ?? "").trim();
      const authors = String(formState.authors ?? "").trim();
      const supervisor = String(formState.supervisor_name ?? "").trim();
      const event = String(formState.event_name ?? formState.conference_name ?? "").trim();
      const meta = [institution, department, authors, supervisor ? `${L("Supervisor", "المشرف")}: ${supervisor}` : "", event].filter(Boolean).join(" | ");
      return `Header: ${logoClause}${title ? ` Large scientific poster title across the top: "${title}".` : ""}${meta ? ` Author and affiliation line below: "${meta}".` : ""}`;
    }
    case "corporate_brief": {
      const company = String(formState.company_name ?? "").trim();
      const dept = String(formState.department ?? formState.client_name ?? "").trim();
      const title = String(formState.report_title ?? "").trim();
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
      if (period) meta.push(`"${L("Period", "الفترة")}: ${period}"`);
      if (author) meta.push(`"${L("Prepared by", "إعداد")}: ${author}"`);
      if (meta.length) lines.push(`Meta row: ${meta.join(" | ")}. CRITICAL: All default labels must render in the active document language.`);
      return `Header: ${lines.join(" ")}`;
    }
    case "certificate": {
      const issuer = String(formState.issuer_name ?? "").trim();
      const recipient = String(formState.recipient_name ?? "").trim();
      const achievement = String(formState.achievement ?? formState.program_name ?? formState.category_or_reason ?? "").trim();
      const certTitle = String(formState.certificate_title ?? "").trim();
      const date = String(formState.issue_date ?? "").trim();
      const sigName = String(formState.signatory_name ?? "").trim();
      const sigTitle = String(formState.signatory_title ?? "").trim();
      const lblCertify = L("This is to certify that", "يشهد هذا بأن");
      const lblDateCert = L("Date", "التاريخ");
      const lblSignature = L("Signature", "التوقيع");
      return `Layout: fully centered. Top: "${issuer}".${certTitle ? ` Prominent certificate title beneath the issuer: "${certTitle}".` : ""} Middle: an elegant "${lblCertify}" line, then recipient name "${recipient}" rendered large and beautifully. Below: "${achievement}". Bottom-left: ${lblDateCert} "${date}". Bottom-right: ${lblSignature} line with "${sigName}${sigTitle ? ", " + sigTitle : ""}" beneath. ${logoClause ? "Logo or seal centered at the very bottom." : ""} CRITICAL: All default labels must render in the active document language.`;
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
      const institution = String(formState.institution_name ?? "").trim();
      const level = String(formState.education_level ?? "").trim();
      return `Header: crisp paper-cut title card at top with the topic "${topic}". ${student || subject || institution || level ? 'Small meta strip: "' + [student, subject, institution, level].filter(Boolean).join(" | ") + '". ' : ""}${logoClause}`;
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
      const docNumber = invoiceNo || receiptNo;
      const lblInvoice = L("Invoice", "فاتورة");
      const lblReceipt = L("Receipt", "إيصال");
      const lblCustomer = L("Customer", "العميل");
      const lblDueDate = L("Due date", "تاريخ الاستحقاق");
      const lblCurrency = L("Currency", "العملة");
      const docLabelLocalized = invoiceNo ? lblInvoice : lblReceipt;
      return `Header: ${logoClause} Top-left: business name "${business}". Top-right: ${docLabelLocalized}${docNumber ? ' number "' + docNumber + '"' : ""}. Below header: customer line "${client || lblCustomer}" and date "${issueDate}".${dueDate ? ` Also show ${lblDueDate} "${dueDate}".` : ""}${currency ? ` Show ${lblCurrency} "${currency}" in the totals block.` : ""}${paymentTerms ? ` Add small payment info line: "${paymentTerms}".` : ""} CRITICAL: Render every default label in the EXACT script of the document language — do not substitute English labels in Arabic output.`;
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
      const lblInvitation = L("Invitation", "دعوة");
      const lblThankYou = L("Thank You", "شكراً لكم");
      if (host || event) {
        return `Layout: elegant invitation card. ${logoClause} Main centered title: "${event || lblInvitation}". Supporting host line: "${host}".${eventDate ? ` Event date line: "${eventDate}".` : ""}${venue ? ` Venue line: "${venue}".` : ""}${rsvp ? ` RSVP line near bottom: "${rsvp}".` : ""} CRITICAL: All default labels must render in the active document language.`;
      }
      return `Layout: elegant thank-you card. ${logoClause} Main centered heading: "${cardTitle || lblThankYou}".${recipient ? ` Addressed to "${recipient}".` : ""}${sender ? ` Signature or from-line near the bottom: "${sender}".` : ""}${eventDate ? ` Small date line: "${eventDate}".` : ""} CRITICAL: All default labels must render in the active document language.`;
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
      const summary = String(formState.summary ?? "").trim();
      void summary;
      return `Header: professional resume masthead.${logoClause ? ` ${logoClause}` : ""} Large candidate name "${fullName}" at top.${role ? ` Role subtitle directly beneath: "${role}".` : ""}${contactBits ? ` Compact contact row below: "${contactBits}".` : ""}`;
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
    case "rounded_sans":
      return "Rounded Sans (soft rounded sans-serif with friendly modern shapes)";
    case "editorial_serif":
      return "Editorial Serif (high-contrast magazine-style serif for premium headings)";
    case "luxury_script":
      return "Luxury Script (refined premium calligraphy for elegant headings; pair with a restrained body font)";
    case "notebook_hand":
      return "Notebook Handwriting (neat handwritten notebook feel, warm and personal)";
    case "marker_hand":
      return "Marker Handwriting (bold marker-style hand lettering for energetic headings and labels)";
    case "monoline_hand":
      return "Monoline Handwriting (clean monoline handwritten style, stylish and readable)";
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
    case "double_line":
      return "Double-line borders around key sections and/or the page frame for a formal premium feel.";
    case "dashed":
      return "Dashed or stitched borders used selectively around cards, notes, or process areas for a crafted feel.";
    case "corner_frame":
      return "Minimal frame defined mainly by elegant corner brackets or corner ornaments instead of a full border.";
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
    case "ultra_compact":
      return "Ultra-compact density: highly efficient layout, tighter blocks, minimal whitespace, maximum information while preserving legibility.";
    case "compact":
      return "Compact density: tighter line-height, smaller gaps between sections, more content per page, still fully readable.";
    case "airy":
      return "Airy density: generous whitespace, relaxed line-height, breathing room between every section.";
    case "spacious":
      return "Spacious density: editorial breathing room, larger margins, larger gaps between sections, intentionally premium and calm.";
    case "balanced":
    default:
      return "Balanced density: comfortable reading rhythm, moderate spacing between sections.";
  }
}

function toneLabel(tone?: A4Tone): string {
  switch (tone) {
    case "elegant":
      return "Elegant tone: refined hierarchy, premium spacing, graceful accents, polished upscale feel.";
    case "bold":
      return "Bold tone: assertive hierarchy, high contrast, strong shapes, confident visual energy.";
    case "romantic":
      return "Romantic tone: soft graceful accents, warm emotional atmosphere, delicate decorative touches.";
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

  if (design.background_color) parts.push(`Background: ${design.background_color}`);
  if (design.text_color) parts.push(`Text color: ${design.text_color}`);
  if (design.accent_color) {
    parts.push(`Accent color: ${design.accent_color} (used consistently for dividers, highlights, bullets, borders)`);
  }
  if (design.font_family) parts.push(`Font: ${fontFamilyLabel(design.font_family)}`);
  if (design.border_style) parts.push(`Borders: ${borderStyleLabel(design.border_style)}`);
  if (typeof design.include_decorative_images === "boolean") {
    parts.push(design.include_decorative_images
      ? "Decorative images: yes, contextually relevant and never competing with text"
      : "Decorative images: no, text-first layout");
  }
  if (design.density) parts.push(`Density: ${densityLabel(design.density)}`);
  if (design.tone) parts.push(`Tone: ${toneLabel(design.tone)}`);

  if (parts.length === 0) return "";

  return `USER DESIGN PREFERENCES\n${parts.join("\n")}`;
}

function getVisualAssetsBlock(
  formState: Record<string, unknown>,
  theme: A4Theme,
  languageMode: "en" | "ar" | "bilingual" = "en",
): string {
  const diagram = !!formState.include_diagram;
  const chart = !!formState.include_chart;
  const table = !!formState.include_table;
  const grading = !!formState.include_grading_circle;
  const diagramColored = formState.diagram_colored !== false; // default: color

  const parts: string[] = [];

  if (diagram) {
    const colorDirective = diagramColored
      ? "Render the diagram in FULL COLOR: use clear natural colors appropriate to the subject (for example green leaves, brown roots, blue water, warm skin tones, realistic biology colors). Do NOT render a black-and-white schematic. Use soft clean vector fills with crisp labeled leader lines."
      : "Render the diagram as clean black-and-white line art with crisp leader lines; no fills, no colors.";
    parts.push(
      `Include a contextually relevant diagram illustrating the subject matter. Place it in a logical spot within the layout. ${colorDirective} Label parts clearly.`,
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
    const totalMarksRaw = Number(formState.total_marks ?? 0);
    const denominator = Number.isFinite(totalMarksRaw) && totalMarksRaw > 0 ? String(Math.round(totalMarksRaw)) : "10";
    const finalGradeLabel = languageMode === "ar"
      ? "الدرجة النهائية"
      : languageMode === "bilingual"
        ? "Final Grade / الدرجة النهائية"
        : "Final Grade";
    parts.push(
      `Bottom-right corner: render a bold circle. Inside the circle place a short blank line followed by "/ ${denominator}" for the teacher to fill in. Small label above the circle: "${finalGradeLabel}". The denominator MUST be exactly "${denominator}" — do not change it to 10 or 100.`,
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
    case "luxury_editorial":
      return "Luxury editorial magazine aesthetic. Sophisticated oversized headings, restrained premium palette, elegant serif pairing, balanced negative space, and polished art-direction.";
    case "study_notes":
      return "High-performing study-notes aesthetic. Clear highlighted sections, exam-prep structure, neat marker emphasis, tidy labels, and a smart student-friendly layout.";
    case "scrapbook_story":
      return "Creative scrapbook storytelling aesthetic. Layered paper pieces, taped notes, handwritten labels, and charming collage composition with good readability.";
    case "museum_catalog":
      return "Museum-catalog aesthetic. Curated object labels, elegant captions, refined grid, premium whitespace, and archival sophistication.";
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
    case "line_art":
      return "Illustration approach: clean line-art drawings with minimal fills, precise outlines, and editorial clarity.";
    case "sketch_handdrawn":
      return "Illustration approach: hand-drawn sketch style, lightly imperfect lines, notebook-like human warmth.";
    case "collage_cutout":
      return "Illustration approach: collage cut-out composition mixing paper snippets, clipped shapes, and layered image fragments.";
    case "pastel_gouache":
      return "Illustration approach: soft gouache / pastel painted look with velvety color blocks and gentle handcrafted character.";
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
    underlines: "hand-drawn or brush underlines emphasizing key headings or phrases",
    sticky_notes: "small sticky-note style callouts pinned beside important points",
    spark_lines: "small burst or spark accent lines around highlighted elements",
    ink_stamps: "tasteful ink-stamp style seals or labels for emphasis",
    washi_corners: "decorative washi-tape corners anchoring select cards or images",
  };
  const pieces = elements.map((e) => map[e]).filter(Boolean);
  if (pieces.length === 0) return "";
  return `Accent elements to include: ${pieces.join(", ")}. Use them tastefully so they enhance rather than compete with the content.`;
}

function getBackgroundTreatmentBlock(bg: A4BackgroundTreatment | null | undefined): string {
  if (!bg) return "";
  switch (bg) {
    case "dark_solid":
      return "Background: deep dark solid tone, premium and cinematic, with strong readable contrast for text and cards.";
    case "linen_texture":
      return "Background: subtle linen or fabric texture, premium and tactile, lightly visible behind the layout.";
    case "marble_surface":
      return "Background: soft light marble or stone surface texture with restrained luxury feel.";
    case "chalkboard":
      return "Background: chalkboard-style dark surface with subtle chalk texture, while keeping all text crisp and readable.";
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
    metric_tiles: "a row or grid of metric tiles featuring short labels with bold headline values only when those values are present in the content",
    faq_block: "a concise FAQ block with short question-and-answer pairs derived directly from the content",
    numbered_steps: "a numbered step list with strong visual numbering and compact supporting text",
    process_chevrons: "a chevron-based process strip or directional process row showing ordered phases or steps",
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
  }

  const pieces = filtered.map((c) => map[c]).filter(Boolean);
  if (pieces.length === 0) return "";

  const rules = [
    `Content components to include: ${pieces.join("; ")}.`,
    "Integrate each component into the layout where it logically fits.",
    "CRITICAL: Populate every component ONLY with data that already exists in the provided content and structured form fields.",
    "Do NOT invent numbers, labels, company names, product names, technology names, brand names, integrations, examples, or supporting sentences.",
    "If a component has no matching data source in the provided content, OMIT that component entirely.",
  ];

  return rules.join(" ");
}

function getLayoutPatternBlock(pattern: A4LayoutPattern | null | undefined): string {
  if (!pattern) return "";
  switch (pattern) {
    case "top_bottom_split":
      return "Layout pattern: clear top section and bottom section split, with strong horizontal separation between the two zones.";
    case "magazine_editorial":
      return "Layout pattern: editorial magazine composition with varied block sizes, refined asymmetry, and strong hierarchy.";
    case "zigzag_story":
      return "Layout pattern: staggered zigzag storytelling path guiding the eye across alternating sections.";
    case "card_mosaic":
      return "Layout pattern: mosaic of cards with varied sizes but aligned edges and strong rhythm.";
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

function getReferenceImageDirective(
  role: A4ReferenceImageRole | null | undefined,
  hasLogoRef: boolean,
): string {
  if (!hasLogoRef) return "";
  switch (role) {
    case "portrait":
      return "REFERENCE IMAGE ROLE\nThe attached reference image is the SUBJECT'S PORTRAIT PHOTO. Place it prominently in the HEADER ZONE (top-left or top-center depending on layout) as a clean portrait thumbnail — circular or rounded-square crop, face centered, consistent with the document's visual style. Do NOT treat the attached image as a logo, background texture, product, or stylistic inspiration. Do NOT recolor, illustrate, or redraw the person — render the photograph itself.";
    case "logo":
      return "REFERENCE IMAGE ROLE\nThe attached reference image is the ORGANIZATION'S LOGO. Place it small and clean in the top-left area (or top-right for RTL layouts). Preserve its exact colors, shape, and proportions. Do NOT stylize, recolor, redraw, or replace it.";
    case "product":
      return "REFERENCE IMAGE ROLE\nThe attached reference image is a PRODUCT PHOTO. Feature it inside the body zone where the layout naturally highlights a product (hero area, menu item, catalog card). Keep its colors and shape faithful. Do NOT use it as a logo or background.";
    case "sample":
      return "REFERENCE IMAGE ROLE\nThe attached reference image is a STYLE / LAYOUT SAMPLE provided only for visual reference. Match its overall mood, color palette, and structural rhythm, but do NOT copy its text, do NOT embed the sample image itself in the output, and do NOT treat it as a portrait or logo.";
    case "none":
      return "REFERENCE IMAGE ROLE\nIgnore the attached reference image. Do not place it anywhere in the rendered document.";
    default:
      // Safe default: treat as logo (legacy behavior)
      return "REFERENCE IMAGE ROLE\nThe attached reference image is the ORGANIZATION'S LOGO. Place it small and clean in the top-left area (or top-right for RTL layouts). Preserve its exact colors, shape, and proportions. Do NOT stylize, recolor, redraw, or replace it.";
  }
}

// Build a single "DECORATIONS" block from the user's chip selections (F1).
// Wanted chips are merged into a positive-framing instruction; unwanted chips
// become a short exclusion line at the end. Empty arrays => empty block.
function getDecorationsBlock(
  wanted: string[] | null | undefined,
  unwanted: string[] | null | undefined,
): string {
  const cleanList = (arr: string[] | null | undefined): string[] => {
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of arr) {
      const v = String(raw ?? "").trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(v);
      if (out.length >= 8) break;
    }
    return out;
  };
  const w = cleanList(wanted);
  const u = cleanList(unwanted);
  if (w.length === 0 && u.length === 0) return "";
  const lines: string[] = [];
  if (w.length > 0) {
    lines.push(
      `USER-PICKED DECORATIONS (HIGH PRIORITY) — Integrate these motifs naturally into the design where they fit the subject and theme: ${w.join(", ")}. Use them tastefully so they enhance rather than compete with the content.`,
    );
  }
  if (u.length > 0) {
    lines.push(
      `EXCLUDED DECORATIONS — Do not include any of the following motifs anywhere in the rendered page: ${u.join(", ")}.`,
    );
  }
  return lines.join("\n");
}

function getUserWishesBlock(wishes: string | null | undefined): string {
  const text = (wishes ?? "").trim();
  if (!text) return "";
  return `USER WISHES\nThe following text comes directly from the user. Preserve its meaning exactly and do not ignore any part of it unless it directly conflicts with another explicit frontend input.\n\n${text}`;
}

// =============================================================================
// PROMPT ENGINEER — PURE STRUCTURER (no creative opinions)
// =============================================================================
// Contract:
//   1. The frontend captures everything the user picks/types.
//   2. This function arranges that input into clean labeled sections.
//   3. The image model renders the document.
//
// Rules:
//   - We do NOT add theme style paragraphs, layout lectures, or imagery
//     guidance the user didn't ask for.
//   - Every block below is gated on real user input. If the user didn't pick
//     it, it does not appear in the prompt.
//   - The user's structured fields are already concatenated into rawContent
//     by buildNormalizedA4Content(), so we don't re-emit them as prose.
//   - User wishes and content are passed through verbatim.
// =============================================================================
export function compileMasterPrompt(input: A4CompileInput): string {
  const {
    theme,
    rawContent,
    pageNumber,
    totalPages,
    languageMode,
    brandColors,
    hasLogoReference,
    hasPrevPageReference,
    userWishes,
    referenceImageRole,
  } = input;

  const design = input.designSettings ?? null;
  const creative = input.creativeSettings ?? null;
  const orientation = design?.orientation ?? "portrait";
  const resolvedAspect = resolveAspectRatio(theme, design?.orientation);

  const sections: string[] = [];

  // 1. Opening — what the user is asking for, in one line.
  const themeLabel = theme.name_en === theme.name_ar
    ? theme.name_en
    : `${theme.name_en} (${theme.name_ar})`;
  sections.push(
    `Generate a single flat 2D digital A4 ${orientation} document image. The final image must look like a crisp, professional PDF export — sharp text, clean layout, real document feel. Aspect ratio ${resolvedAspect}. Document type: ${themeLabel}.`,
  );

  // 2. Language — short, direct.
  if (languageMode === "ar") {
    sections.push(
      "LANGUAGE\nArabic. Render all text in Arabic with proper RTL direction and a modern Arabic sans-serif font with correct letter joining (e.g. Noto Sans Arabic).",
    );
  } else if (languageMode === "bilingual") {
    sections.push(
      "LANGUAGE\nBilingual (English + Arabic). Render English text in modern Latin sans-serif and Arabic text in modern Arabic sans-serif, each in its own block with proper LTR/RTL direction per language.",
    );
  } else {
    sections.push("LANGUAGE\nEnglish. Render text in modern Latin sans-serif typography.");
  }

  // 3. Page context — only when multi-page.
  if (totalPages > 1) {
    if (pageNumber === 1) {
      sections.push(
        `PAGE CONTEXT\nThis is page 1 of ${totalPages}. Establish the visual style, header layout, font sizes, margins, and color palette that pages 2 and 3 must match.`,
      );
    } else {
      const refClause = hasPrevPageReference
        ? " The reference image provided is page 1. Match its visual style, header layout, font sizes, margins, and color palette EXACTLY."
        : "";
      sections.push(`PAGE CONTEXT\nThis is page ${pageNumber} of ${totalPages}.${refClause}`);
    }
  }

  // 4. Reference image role — only when the user actually uploaded one.
  if (hasLogoReference) {
    const roleDirective = getReferenceImageDirective(referenceImageRole, hasLogoReference);
    if (roleDirective) sections.push(roleDirective);
  }

  // 5. Brand colors — only when extracted from a real logo upload.
  const brandColorDirective = getBrandColorDirective(brandColors);
  if (brandColorDirective) sections.push(`BRAND COLORS\n${brandColorDirective}`);

  // 6. User design preferences — only what the user actually picked.
  const designPrefs = getDesignPreferencesBlock(design);
  if (designPrefs) sections.push(designPrefs);

  // 7. User creative selections — each block is empty when the user didn't pick.
  const visualRecipe = getVisualRecipeBlock(creative?.visual_recipe);
  if (visualRecipe) sections.push(`VISUAL RECIPE\n${visualRecipe}`);

  const illustrationStyle = getIllustrationStyleBlock(creative?.illustration_style);
  if (illustrationStyle) sections.push(`ILLUSTRATION APPROACH\n${illustrationStyle}`);

  const accentElements = getAccentElementsBlock(creative?.accent_elements);
  if (accentElements) sections.push(`ACCENT ELEMENTS\n${accentElements}`);

  const backgroundTreatment = getBackgroundTreatmentBlock(creative?.background_treatment);
  if (backgroundTreatment) sections.push(`BACKGROUND\n${backgroundTreatment}`);

  const layoutPattern = getLayoutPatternBlock(creative?.layout_pattern);
  if (layoutPattern) sections.push(`LAYOUT PATTERN\n${layoutPattern}`);

  const contentComponents = getContentComponentsBlock(
    creative?.content_components,
    rawContent,
    theme.id,
  );
  if (contentComponents) sections.push(`CONTENT COMPONENTS\n${contentComponents}`);

  // 8. User-picked visual asset toggles (include diagram / chart / table /
  //    grading circle). Only when the user toggled them on.
  const visualAssets = getVisualAssetsBlock(input.formState, theme, languageMode);
  if (visualAssets) sections.push(`VISUAL ASSETS\n${visualAssets}`);

  // 9. Decorations — only what the user explicitly picked.
  const decorationsBlock = getDecorationsBlock(input.decorationsWanted, input.decorationsUnwanted);
  if (decorationsBlock) sections.push(decorationsBlock);

  // 10. User wishes — verbatim. Highest priority.
  const userWishesBlock = getUserWishesBlock(userWishes);
  if (userWishesBlock) sections.push(userWishesBlock);

  // 11. CONTENT TO RENDER — every structured field + raw content the user
  //     provided, passed through verbatim.
  const trimmedContent = (rawContent ?? "").trim();
  if (trimmedContent) {
    sections.push(
      `CONTENT TO RENDER (preserve every word, number, and punctuation mark exactly as written):\n\n${trimmedContent}`,
    );
  }

  // 12. Footer — small wakti.qa attribution + page indicator on multi-page.
  const footerLine = totalPages > 1
    ? `FOOTER\nBottom center, small light gray text: "wakti.qa"\nBottom right, small matching type: "Page ${pageNumber} of ${totalPages}"`
    : `FOOTER\nBottom center, small light gray text: "wakti.qa"`;
  sections.push(footerLine);

  // 13. Final render instruction.
  sections.push("Render the final A4 document image now. All text must be razor-sharp, anti-aliased, and legible. The output should look like a polished professional document.");

  return sections.join("\n\n");
}
