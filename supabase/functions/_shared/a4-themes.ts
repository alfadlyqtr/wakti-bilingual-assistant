// A4 Document Builder — Theme Registry (Backend)
// -----------------------------------------------------------------------------
// Source of truth for the 8 launch themes. Each theme bundles:
//   - visual DNA (style block injected into master prompt)
//   - aspect ratio
//   - per-page content budget (characters)
//   - optional purpose chips and per-chip form schemas
//   - default diagram/chart style hints
//
// NOTE: a parallel copy exists at src/components/wakti-ai-v2/a4/themes.ts for
// the frontend form renderer. Keep them in sync when editing.
// -----------------------------------------------------------------------------

export type A4FormFieldType = "text" | "textarea" | "number" | "date" | "toggle" | "select" | "image";

export interface A4FormField {
  key: string;
  label_en: string;
  label_ar: string;
  type: A4FormFieldType;
  required?: boolean;
  default?: string | number | boolean;
  options?: Array<string | number>;
  placeholder_en?: string;
  placeholder_ar?: string;
}

export interface A4PurposeChip {
  id: string;
  label_en: string;
  label_ar: string;
}

export interface A4Theme {
  id: string;
  name_en: string;
  name_ar: string;
  aspect_ratio: "2:3" | "3:4";
  per_page_char_budget: number;
  max_pages_override?: 1 | 2 | 3; // If set, user cannot pick more than this
  purpose_chips?: A4PurposeChip[];
  form_schema_common?: A4FormField[];
  form_schema_by_purpose?: Record<string, A4FormField[]>;
  form_schema?: A4FormField[]; // used when no purpose chips
  style_block: string;
  diagram_default_style?: string;
  chart_default_style?: string;
  search_aliases?: string[]; // for the searchable picker
}

// -----------------------------------------------------------------------------
// Shared reusable field groups (to keep DRY)
// -----------------------------------------------------------------------------
const FIELD_BILINGUAL: A4FormField = {
  key: "bilingual",
  label_en: "Bilingual (EN + AR)",
  label_ar: "ثنائي اللغة",
  type: "toggle",
  default: false,
};

const FIELD_LOGO: A4FormField = {
  key: "logo",
  label_en: "Logo",
  label_ar: "الشعار",
  type: "image",
  required: false,
};

const FIELD_RAW_CONTENT = (label_en: string, label_ar: string, required = true): A4FormField => ({
  key: "raw_content",
  label_en,
  label_ar,
  type: "textarea",
  required,
});

// -----------------------------------------------------------------------------
// THEMES (8 launch themes)
// -----------------------------------------------------------------------------

export const A4_THEMES: A4Theme[] = [
  // 1. OFFICIAL SCHOOL EXAM -----------------------------------------------------
  {
    id: "official_exam",
    name_en: "Official School Exam",
    name_ar: "اختبار مدرسي رسمي",
    aspect_ratio: "2:3",
    per_page_char_budget: 1800,
    form_schema: [
      { key: "school_name", label_en: "School Name", label_ar: "اسم المدرسة", type: "text", required: true },
      { key: "subject", label_en: "Subject", label_ar: "المادة", type: "text", required: true },
      { key: "grade", label_en: "Grade / Class", label_ar: "الصف", type: "text", required: true },
      { key: "term", label_en: "Term / Semester", label_ar: "الفصل الدراسي", type: "text", required: false },
      { key: "duration", label_en: "Duration (minutes)", label_ar: "المدة (دقائق)", type: "number", required: false },
      { key: "total_marks", label_en: "Total Marks", label_ar: "الدرجة الكلية", type: "number", required: false },
      FIELD_LOGO,
      FIELD_BILINGUAL,
      { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: false },
      { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
      { key: "include_grading_circle", label_en: "Grading Circle", label_ar: "دائرة الدرجة", type: "toggle", default: true },
      FIELD_RAW_CONTENT("Paste your questions here", "الصق الأسئلة هنا"),
    ],
    style_block:
      "Render in formal official-exam style: pure white background, clean bordered header across the top (logo top-left, school/ministry name center, name+date fill-in fields top-right). Sharp black ink text. Questions clearly numbered with adequate blank space for handwritten answers. Multiple-choice options in bordered checkboxes. Any diagrams/charts rendered in clean vector-schematic black-and-white line art. Feels like a ministry-issued test paper, print-ready.",
    diagram_default_style: "clean vector schematic, black-and-white line art, labeled with leader lines",
    chart_default_style: "clean 2D bar or line chart, minimal colors, clearly labeled axes",
    search_aliases: ["exam", "test", "quiz", "school", "ministry", "امتحان", "اختبار"],
  },

  // 2. SCHOOL PROJECT / ESSAY --------------------------------------------------
  {
    id: "school_project",
    name_en: "School Project / Essay",
    name_ar: "مشروع مدرسي / مقال",
    aspect_ratio: "2:3",
    per_page_char_budget: 2000,
    form_schema: [
      { key: "school_name", label_en: "School Name", label_ar: "اسم المدرسة", type: "text", required: false },
      { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text", required: true },
      { key: "grade", label_en: "Grade / Class", label_ar: "الصف", type: "text", required: false },
      { key: "subject", label_en: "Subject", label_ar: "المادة", type: "text", required: false },
      { key: "project_title", label_en: "Project Title", label_ar: "عنوان المشروع", type: "text", required: true },
      { key: "submission_date", label_en: "Submission Date", label_ar: "تاريخ التسليم", type: "date", required: false },
      FIELD_LOGO,
      FIELD_BILINGUAL,
      { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
      { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
      FIELD_RAW_CONTENT("Paste your project / essay content", "الصق محتوى المشروع"),
    ],
    style_block:
      "Render in educational-friendly student-project style: clean white background, warm approachable headers, accent color derived from logo (or soft blue default). Project title prominent at top. Student info as a tidy header block. Section headings with subtle colored underlines. Body text comfortable reading size. Diagrams feel illustrative and friendly, not clinical. Designed for ages 10 through 18.",
    diagram_default_style: "friendly illustrated style, clean outlines, light fills, clearly labeled",
    chart_default_style: "friendly bar or line chart with soft accent colors",
    search_aliases: ["project", "essay", "homework", "assignment", "مقال", "مشروع"],
  },

  // 3. CORPORATE BRIEF / REPORT ------------------------------------------------
  {
    id: "corporate_brief",
    name_en: "Corporate Brief / Report",
    name_ar: "موجز مؤسسي",
    aspect_ratio: "2:3",
    per_page_char_budget: 1600,
    purpose_chips: [
      { id: "internal", label_en: "Internal", label_ar: "داخلي" },
      { id: "board", label_en: "Board / Leadership", label_ar: "مجلس الإدارة" },
      { id: "client", label_en: "Client-Facing", label_ar: "عميل" },
    ],
    form_schema_by_purpose: {
      internal: [
        { key: "company_name", label_en: "Company Name", label_ar: "اسم الشركة", type: "text", required: true },
        { key: "department", label_en: "Department", label_ar: "القسم", type: "text", required: false },
        { key: "report_title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: true },
        { key: "period", label_en: "Period (e.g. Q1 2026)", label_ar: "الفترة", type: "text", required: false },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text", required: false },
        { key: "doc_ref", label_en: "Reference Code", label_ar: "رقم المرجع", type: "text", required: false },
        FIELD_LOGO,
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Paste your report content", "الصق محتوى التقرير"),
      ],
      board: [
        { key: "company_name", label_en: "Company Name", label_ar: "اسم الشركة", type: "text", required: true },
        { key: "report_title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: true },
        { key: "period", label_en: "Period", label_ar: "الفترة", type: "text", required: true },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text", required: true },
        { key: "doc_ref", label_en: "Reference Code", label_ar: "رقم المرجع", type: "text", required: true },
        FIELD_LOGO,
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Paste your board-level content", "الصق محتوى مجلس الإدارة"),
      ],
      client: [
        { key: "company_name", label_en: "Your Company", label_ar: "شركتك", type: "text", required: true },
        { key: "client_name", label_en: "Client Name", label_ar: "اسم العميل", type: "text", required: true },
        { key: "report_title", label_en: "Document Title", label_ar: "عنوان المستند", type: "text", required: true },
        { key: "period", label_en: "Period", label_ar: "الفترة", type: "text", required: false },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text", required: false },
        FIELD_LOGO,
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: false },
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Paste your client-facing content", "الصق محتوى العميل"),
      ],
    },
    style_block:
      "Render in premium corporate-report style: pristine white background, a narrow accent bar across the top in brand color (or deep navy by default), logo top-left, reference code top-right, bold H1 title below the header. Section headings underlined with a thin colored rule. Clean data tables with a shaded header row and alternating subtle row shading. Crisp bar or line charts where requested. Leadership or highlight items in right-column sidebar cards. Conservative, executive, print-ready.",
    chart_default_style: "clean corporate bar or line chart, accent brand color, gridlines subtle",
    search_aliases: ["report", "brief", "corporate", "business", "quarterly", "تقرير", "موجز"],
  },

  // 4. CERTIFICATE / DIPLOMA ---------------------------------------------------
  {
    id: "certificate",
    name_en: "Certificate / Diploma",
    name_ar: "شهادة",
    aspect_ratio: "3:4",
    per_page_char_budget: 400,
    max_pages_override: 1,
    purpose_chips: [
      { id: "school", label_en: "School", label_ar: "مدرسي" },
      { id: "work", label_en: "Work", label_ar: "عمل" },
      { id: "personal", label_en: "Personal", label_ar: "شخصي" },
    ],
    form_schema_common: [
      { key: "issuer_name", label_en: "Issuing Organization", label_ar: "الجهة المانحة", type: "text", required: true },
      { key: "recipient_name", label_en: "Recipient Name", label_ar: "اسم المستلم", type: "text", required: true },
      { key: "achievement", label_en: "Achievement / Reason", label_ar: "الإنجاز", type: "text", required: true },
      { key: "issue_date", label_en: "Date", label_ar: "التاريخ", type: "date", required: true },
      { key: "signatory_name", label_en: "Signatory Name", label_ar: "اسم الموقع", type: "text", required: false },
      { key: "signatory_title", label_en: "Signatory Title", label_ar: "المسمى الوظيفي", type: "text", required: false },
      { key: "logo", label_en: "Logo / Seal", label_ar: "الشعار / الختم", type: "image", required: false },
      FIELD_BILINGUAL,
    ],
    style_block:
      "Render in elegant formal certificate style: cream or pure white background, tasteful decorative border (thin gold or navy linework), centered composition. Top: issuing organization name. Middle: 'This is to certify that' line, recipient name large and elegant (serif or tasteful script-style), achievement text below. Bottom: date on left, signature line on right, seal or logo centered. Premium, award-worthy, portrait 3:4 orientation.",
    search_aliases: ["certificate", "diploma", "award", "achievement", "شهادة", "تكريم"],
  },

  // 5. EVENT FLYER / POSTER ----------------------------------------------------
  {
    id: "event_flyer",
    name_en: "Event Flyer / Poster",
    name_ar: "ملصق فعالية",
    aspect_ratio: "3:4",
    per_page_char_budget: 600,
    max_pages_override: 1,
    purpose_chips: [
      { id: "school", label_en: "School", label_ar: "مدرسي" },
      { id: "work", label_en: "Work", label_ar: "عمل" },
      { id: "personal", label_en: "Personal", label_ar: "شخصي" },
    ],
    form_schema_common: [
      { key: "event_name", label_en: "Event Name", label_ar: "اسم الفعالية", type: "text", required: true },
      { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: true },
      { key: "time", label_en: "Time", label_ar: "الوقت", type: "text", required: true },
      { key: "venue", label_en: "Venue / Location", label_ar: "المكان", type: "text", required: true },
      { key: "tagline", label_en: "Tagline / Hook", label_ar: "العبارة الرئيسية", type: "text", required: false },
      { key: "description", label_en: "Short Description", label_ar: "وصف قصير", type: "textarea", required: false },
      { key: "cta", label_en: "Call to Action", label_ar: "الدعوة للتفاعل", type: "text", required: false },
      FIELD_LOGO,
      { key: "headline_image", label_en: "Headline Image (optional)", label_ar: "صورة رئيسية (اختياري)", type: "image", required: false },
      FIELD_BILINGUAL,
    ],
    style_block:
      "Render in bold event-poster style: full-bleed color or gradient background driven by brand/theme colors. Event name rendered hero-size at the top. Key info block (date, time, venue) in a high-contrast card below. Short tagline above event name. Optional headline image large and centered. CTA rendered as a button shape near the bottom. Modern, social-share ready, eye-grabbing, portrait 3:4.",
    search_aliases: ["flyer", "poster", "event", "party", "invite", "ملصق", "فعالية", "دعوة"],
  },

  // 6. CRAFT INFOGRAPHIC -------------------------------------------------------
  {
    id: "craft_infographic",
    name_en: "Craft Infographic",
    name_ar: "إنفوجرافيك يدوي",
    aspect_ratio: "2:3",
    per_page_char_budget: 800,
    purpose_chips: [
      { id: "school", label_en: "School Project", label_ar: "مشروع مدرسي" },
      { id: "work", label_en: "Work", label_ar: "عمل" },
      { id: "personal", label_en: "Personal", label_ar: "شخصي" },
    ],
    form_schema_by_purpose: {
      school: [
        { key: "school_name", label_en: "School Name", label_ar: "اسم المدرسة", type: "text", required: false },
        { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text", required: false },
        { key: "subject", label_en: "Subject", label_ar: "المادة", type: "text", required: false },
        { key: "topic", label_en: "Topic", label_ar: "الموضوع", type: "text", required: true },
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Explain the topic in your own words", "اشرح الموضوع بأسلوبك"),
      ],
      work: [
        { key: "company_name", label_en: "Company", label_ar: "الشركة", type: "text", required: false },
        { key: "department", label_en: "Department / Team", label_ar: "القسم / الفريق", type: "text", required: false },
        { key: "audience", label_en: "Audience", label_ar: "الجمهور", type: "text", required: false },
        { key: "topic", label_en: "Topic / Message", label_ar: "الموضوع / الرسالة", type: "text", required: true },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Key points to explain", "النقاط الرئيسية"),
      ],
      personal: [
        { key: "topic", label_en: "Topic / Title", label_ar: "العنوان", type: "text", required: true },
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Content", "المحتوى"),
      ],
    },
    style_block:
      "Render in craft-paper flat-lay infographic style: soft light-gray textured background, hand-cut paper-shape elements with subtle drop shadows, hand-drawn-ink arrows and labels, small 3D-craft elements (cotton clouds, folded paper arrows, twine, blue water drops). Warm educational tone. Clear top-to-bottom visual flow. Labels printed crisply on paper-cut cards. All text overlaid on shapes must remain razor-sharp and perfectly legible.",
    search_aliases: ["infographic", "diy", "craft", "visual", "إنفوجرافيك", "شرح"],
  },

  // 7. COMIC EXPLAINER ---------------------------------------------------------
  {
    id: "comic_explainer",
    name_en: "Comic Explainer",
    name_ar: "شرح بأسلوب الكوميكس",
    aspect_ratio: "2:3",
    per_page_char_budget: 500,
    max_pages_override: 1,
    purpose_chips: [
      { id: "school", label_en: "School", label_ar: "مدرسي" },
      { id: "training", label_en: "Training", label_ar: "تدريب" },
      { id: "social", label_en: "Social Content", label_ar: "محتوى اجتماعي" },
    ],
    form_schema_common: [
      { key: "title", label_en: "Overall Title", label_ar: "العنوان الرئيسي", type: "text", required: true },
      {
        key: "panel_count",
        label_en: "Number of Panels",
        label_ar: "عدد اللوحات",
        type: "select",
        options: [3, 4],
        default: 3,
        required: true,
      },
      FIELD_RAW_CONTENT(
        "Describe each panel (label + 1-2 lines). Example:\n1) CUMULUS - Puffy fair-weather clouds.\n2) STRATUS - Low overcast layer.\n3) CIRRUS - High wispy clouds.",
        "اوصف كل لوحة (عنوان + سطر أو سطرين)",
      ),
      { key: "logo", label_en: "Logo (optional)", label_ar: "الشعار (اختياري)", type: "image", required: false },
    ],
    style_block:
      "Render in bold comic-book poster style: vibrant saturated backgrounds distinct per panel, thick black outlines, dynamic compositions, dramatic scene in each panel. Large uppercase panel titles in comic-lettering style at the top of each panel (every title word spelled correctly). Short explanatory caption below each panel in clean readable sans-serif. High-contrast, energetic, ages 10+. Laid out as a 3-panel or 4-panel portrait grid inside a 2:3 frame.",
    search_aliases: ["comic", "explainer", "triptych", "panels", "كوميكس"],
  },

  // 8. CLEAN MINIMAL -----------------------------------------------------------
  {
    id: "clean_minimal",
    name_en: "Clean Minimal",
    name_ar: "بسيط وأنيق",
    aspect_ratio: "2:3",
    per_page_char_budget: 1500,
    purpose_chips: [
      { id: "report", label_en: "Report", label_ar: "تقرير" },
      { id: "letter", label_en: "Letter", label_ar: "خطاب" },
      { id: "notice", label_en: "Notice", label_ar: "إعلان" },
      { id: "flyer", label_en: "Flyer", label_ar: "ملصق" },
      { id: "anything", label_en: "Anything", label_ar: "أي شيء" },
    ],
    form_schema_by_purpose: {
      report: [
        { key: "title", label_en: "Title", label_ar: "العنوان", type: "text", required: true },
        { key: "subtitle", label_en: "Subtitle", label_ar: "العنوان الفرعي", type: "text", required: false },
        { key: "author", label_en: "Author / Org", label_ar: "المؤلف / الجهة", type: "text", required: false },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Content", "المحتوى"),
      ],
      letter: [
        { key: "sender_name", label_en: "Sender (You / Org)", label_ar: "اسم المرسل", type: "text", required: true },
        { key: "recipient_name", label_en: "Recipient", label_ar: "المستلم", type: "text", required: true },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: true },
        { key: "subject", label_en: "Subject", label_ar: "الموضوع", type: "text", required: true },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Letter body", "نص الخطاب"),
      ],
      notice: [
        { key: "title", label_en: "Notice Title", label_ar: "عنوان الإعلان", type: "text", required: true },
        { key: "issuer", label_en: "Issued By", label_ar: "جهة الإصدار", type: "text", required: false },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Notice body", "نص الإعلان"),
      ],
      flyer: [
        { key: "event_name", label_en: "Headline / Event", label_ar: "العنوان / الفعالية", type: "text", required: true },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: false },
        { key: "venue", label_en: "Venue", label_ar: "المكان", type: "text", required: false },
        { key: "cta", label_en: "Call to Action", label_ar: "الدعوة للتفاعل", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Short description", "وصف قصير", false),
      ],
      anything: [
        { key: "title", label_en: "Title", label_ar: "العنوان", type: "text", required: true },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Content", "المحتوى"),
      ],
    },
    style_block:
      "Render in ultra-clean minimalist style: pure white background, generous whitespace, one single accent color (from logo extraction or a neutral dark by default), thin consistent horizontal rules between sections, sans-serif typography throughout, tasteful visual hierarchy. Feels like premium modern stationery or an Apple-style document.",
    search_aliases: ["simple", "minimal", "clean", "modern", "بسيط", "خطاب", "إعلان"],
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function findTheme(themeId: string): A4Theme | null {
  return A4_THEMES.find((t) => t.id === themeId) ?? null;
}

export function getThemeFormSchema(theme: A4Theme, purposeId: string | null | undefined): A4FormField[] {
  if (theme.form_schema) return theme.form_schema;
  if (theme.form_schema_common) return theme.form_schema_common;
  if (theme.form_schema_by_purpose && purposeId) {
    return theme.form_schema_by_purpose[purposeId] ?? [];
  }
  return [];
}

export function maxPagesForTheme(theme: A4Theme): 1 | 2 | 3 {
  return theme.max_pages_override ?? 3;
}
