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

export type A4DocumentLane = "formal" | "visual";

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
  layout_blueprint?: string; // per-theme spatial zones (header/upper/middle/lower/footer) for the image model
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

const EDUCATION_LEVEL_OPTIONS = [
  "School / مدرسة",
  "High School / ثانوي",
  "College / كلية",
  "University / جامعة",
];

const FIELD_RAW_CONTENT = (label_en: string, label_ar: string, required = true): A4FormField => ({
  key: "raw_content",
  label_en,
  label_ar,
  type: "textarea",
  required,
});

// -----------------------------------------------------------------------------
// THEMES (12 themes)
// -----------------------------------------------------------------------------

  export const A4_THEMES: A4Theme[] = [
  // 1. OFFICIAL SCHOOL EXAM -----------------------------------------------------
  {
    id: "official_exam",
    name_en: "Academic Exam / Test",
    name_ar: "اختبار / تقييم أكاديمي",
    aspect_ratio: "2:3",
    per_page_char_budget: 1800,
    purpose_chips: [
      { id: "school", label_en: "School", label_ar: "مدرسة" },
      { id: "high_school", label_en: "High School", label_ar: "ثانوي" },
      { id: "college_university", label_en: "College / University", label_ar: "كلية / جامعة" },
      { id: "worksheet", label_en: "Worksheet", label_ar: "ورقة عمل" },
    ],
    form_schema_common: [
      { key: "institution_name", label_en: "Institution / School Name", label_ar: "اسم المؤسسة / المدرسة", type: "text", required: false },
      { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
      { key: "subject", label_en: "Subject / Course", label_ar: "المادة / المقرر", type: "text", required: false },
      { key: "teacher_name", label_en: "Teacher / Instructor", label_ar: "المعلم / المدرس", type: "text", required: false },
      FIELD_LOGO,
      FIELD_BILINGUAL,
    ],
    form_schema_by_purpose: {
      school: [
        { key: "grade", label_en: "Grade / Class", label_ar: "الصف / الفصل", type: "text", required: false },
        { key: "term", label_en: "Term / Semester", label_ar: "الفصل الدراسي", type: "text", required: false },
        { key: "duration", label_en: "Duration (minutes)", label_ar: "المدة (دقائق)", type: "number", required: false },
        { key: "total_marks", label_en: "Total Marks", label_ar: "الدرجة الكلية", type: "number", required: false },
        { key: "instructions", label_en: "Exam Instructions", label_ar: "تعليمات الاختبار", type: "textarea", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: false },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_grading_circle", label_en: "Grading Circle", label_ar: "دائرة الدرجة", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste your questions here", "الصق الأسئلة هنا"),
      ],
      high_school: [
        { key: "grade", label_en: "Grade / Level", label_ar: "الصف / المستوى", type: "text", required: false },
        { key: "term", label_en: "Term / Semester", label_ar: "الفصل / الفصل الدراسي", type: "text", required: false },
        { key: "duration", label_en: "Duration (minutes)", label_ar: "المدة (دقائق)", type: "number", required: false },
        { key: "total_marks", label_en: "Total Marks", label_ar: "الدرجة الكلية", type: "number", required: false },
        { key: "instructions", label_en: "Exam Instructions", label_ar: "تعليمات الاختبار", type: "textarea", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: false },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_grading_circle", label_en: "Grading Circle", label_ar: "دائرة الدرجة", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste your questions here", "الصق الأسئلة هنا"),
      ],
      college_university: [
        { key: "grade", label_en: "Year / Level", label_ar: "السنة / المستوى", type: "text", required: false },
        { key: "course_code", label_en: "Course Code", label_ar: "رمز المقرر", type: "text", required: false },
        { key: "term", label_en: "Semester", label_ar: "الفصل الدراسي", type: "text", required: false },
        { key: "duration", label_en: "Duration (minutes)", label_ar: "المدة (دقائق)", type: "number", required: false },
        { key: "total_marks", label_en: "Total Marks", label_ar: "الدرجة الكلية", type: "number", required: false },
        { key: "instructions", label_en: "Assessment Instructions", label_ar: "تعليمات التقييم", type: "textarea", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: false },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_grading_circle", label_en: "Grading Circle", label_ar: "دائرة الدرجة", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste your questions here", "الصق الأسئلة هنا"),
      ],
      worksheet: [
        { key: "grade", label_en: "Grade / Level", label_ar: "الصف / المستوى", type: "text", required: false },
        { key: "instructions", label_en: "Worksheet Instructions", label_ar: "تعليمات ورقة العمل", type: "textarea", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_grading_circle", label_en: "Grading Circle", label_ar: "دائرة الدرجة", type: "toggle", default: false },
        FIELD_RAW_CONTENT("Paste your worksheet questions or practice content", "الصق أسئلة أو محتوى ورقة العمل"),
      ],
    },
    style_block:
      "Formal academic assessment aesthetic. Sharp black ink on clean white stock, crisp vector ruled lines, disciplined spacing, and a serious print-ready feel suitable for school, high school, and university assessments.",
    layout_blueprint:
      "Top zone: structured assessment header strip. Top-left: uploaded logo if provided. Top-center: institution name. Top-right: fill-in name and date lines when the subtype is exam-like. Directly below: a compact meta row showing subject, grade or level, term or semester, duration, and total marks when provided. Body zone: numbered questions or worksheet tasks flow top-to-bottom with clear working space beneath each. Multiple-choice items use clean bordered boxes. Optional grading circle appears bottom-right only when requested.",
    diagram_default_style: "clean vector schematic or instructional diagram, labeled with leader lines",
    chart_default_style: "clean 2D bar or line chart, minimal colors, clearly labeled axes",
    search_aliases: ["exam", "test", "quiz", "worksheet", "assessment", "school", "university", "امتحان", "اختبار"],
  },

  // 2. SCHOOL PROJECT / ESSAY --------------------------------------------------
  {
    id: "school_project",
    name_en: "Academic Project / Essay / Report",
    name_ar: "مشروع / مقال / تقرير أكاديمي",
    aspect_ratio: "2:3",
    per_page_char_budget: 2000,
    purpose_chips: [
      { id: "project", label_en: "Project", label_ar: "مشروع" },
      { id: "essay", label_en: "Essay", label_ar: "مقال" },
      { id: "report", label_en: "Report", label_ar: "تقرير" },
      { id: "lab_report", label_en: "Lab Report", label_ar: "تقرير مختبر" },
      { id: "diy_infographic", label_en: "DIY Infographic", label_ar: "إنفوجرافيك يدوي" },
    ],
    form_schema_common: [
      { key: "institution_name", label_en: "Institution / School Name", label_ar: "اسم المؤسسة / المدرسة", type: "text", required: false },
      { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
      { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text", required: false },
      { key: "student_id", label_en: "Student ID", label_ar: "الرقم الجامعي / التعريفي", type: "text", required: false },
      { key: "grade", label_en: "Grade / Class / Year", label_ar: "الصف / الفصل / السنة", type: "text", required: false },
      { key: "department_or_faculty", label_en: "Department / Faculty", label_ar: "القسم / الكلية", type: "text", required: false },
      { key: "subject", label_en: "Subject / Course", label_ar: "المادة / المقرر", type: "text", required: false },
      { key: "teacher_or_supervisor", label_en: "Teacher / Supervisor", label_ar: "المعلم / المشرف", type: "text", required: false },
      { key: "submission_date", label_en: "Submission Date", label_ar: "تاريخ التسليم", type: "date", required: false },
      FIELD_LOGO,
      FIELD_BILINGUAL,
    ],
    form_schema_by_purpose: {
      project: [
        { key: "project_title", label_en: "Project Title", label_ar: "عنوان المشروع", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: false },
        FIELD_RAW_CONTENT("Paste your project content", "الصق محتوى المشروع"),
      ],
      essay: [
        { key: "project_title", label_en: "Essay Title", label_ar: "عنوان المقال", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: false },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: false },
        FIELD_RAW_CONTENT("Paste your essay content", "الصق محتوى المقال"),
      ],
      report: [
        { key: "project_title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste your report content", "الصق محتوى التقرير"),
      ],
      lab_report: [
        { key: "project_title", label_en: "Lab Report Title", label_ar: "عنوان تقرير المختبر", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste your lab report content", "الصق محتوى تقرير المختبر"),
      ],
      diy_infographic: [
        { key: "project_title", label_en: "Infographic Title", label_ar: "عنوان الإنفوجرافيك", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: false },
        FIELD_RAW_CONTENT("Paste your infographic content", "الصق محتوى الإنفوجرافيك"),
      ],
    },
    style_block:
      "Polished academic submission aesthetic. Clean white background, calm accent color, modern sans-serif typography, and structured sections suited to school through university coursework.",
    layout_blueprint:
      "Top zone: large H1 title centered. Compact meta row directly below in lighter weight showing student name, student ID, grade or year, subject or course, institution, supervisor, and submission date — only fields that exist appear. Body zone: section headings use thin accent underlines, body paragraphs have generous line-height, and optional diagrams, charts, or tables sit between logical sections. Lower zone: conclusion or final takeaway flows naturally toward the footer.",
    diagram_default_style: "friendly illustrated style, clean outlines, light fills, clearly labeled",
    chart_default_style: "friendly bar or line chart with soft accent colors",
    search_aliases: ["project", "essay", "report", "assignment", "lab", "homework", "مقال", "مشروع", "تقرير"],
  },

  {
    id: "academic_report",
    name_en: "Academic Report / University Work",
    name_ar: "تقرير أكاديمي / عمل جامعي",
    aspect_ratio: "2:3",
    per_page_char_budget: 1900,
    purpose_chips: [
      { id: "essay", label_en: "Essay", label_ar: "مقال" },
      { id: "report", label_en: "Report", label_ar: "تقرير" },
      { id: "lab_report", label_en: "Lab Report", label_ar: "تقرير مختبر" },
      { id: "research_summary", label_en: "Research Summary", label_ar: "ملخص بحث" },
      { id: "case_study", label_en: "Case Study", label_ar: "دراسة حالة" },
    ],
    form_schema_common: [
      { key: "institution_name", label_en: "Institution", label_ar: "اسم المؤسسة", type: "text", required: false },
      { key: "department_or_faculty", label_en: "Department / Faculty", label_ar: "القسم / الكلية", type: "text", required: false },
      { key: "course_name", label_en: "Course Name", label_ar: "اسم المقرر", type: "text", required: false },
      { key: "instructor_name", label_en: "Instructor / Professor", label_ar: "المحاضر / الأستاذ", type: "text", required: false },
      { key: "supervisor_name", label_en: "Supervisor", label_ar: "المشرف", type: "text", required: false },
      { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text", required: false },
      { key: "student_id", label_en: "Student ID", label_ar: "الرقم الجامعي", type: "text", required: false },
      { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
      { key: "year_or_semester", label_en: "Year / Semester", label_ar: "السنة / الفصل", type: "text", required: false },
      { key: "submission_date", label_en: "Submission Date", label_ar: "تاريخ التسليم", type: "date", required: false },
      FIELD_LOGO,
      FIELD_BILINGUAL,
    ],
    form_schema_by_purpose: {
      essay: [
        { key: "title", label_en: "Essay Title", label_ar: "عنوان المقال", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: false },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: false },
        FIELD_RAW_CONTENT("Paste your essay content", "الصق محتوى المقال"),
      ],
      report: [
        { key: "title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste your report content", "الصق محتوى التقرير"),
      ],
      lab_report: [
        { key: "title", label_en: "Lab Report Title", label_ar: "عنوان تقرير المختبر", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste your lab report content", "الصق محتوى تقرير المختبر"),
      ],
      research_summary: [
        { key: "title", label_en: "Research Summary Title", label_ar: "عنوان ملخص البحث", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste your research summary content", "الصق محتوى ملخص البحث"),
      ],
      case_study: [
        { key: "title", label_en: "Case Study Title", label_ar: "عنوان دراسة الحالة", type: "text", required: false },
        { key: "case_subject", label_en: "Case Subject / Organization", label_ar: "موضوع / جهة الحالة", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste your case study content", "الصق محتوى دراسة الحالة"),
      ],
    },
    style_block:
      "University-grade report aesthetic. Crisp academic typography, restrained accent color, strong section hierarchy, and professional whitespace that feels like a polished coursework or research submission.",
    layout_blueprint:
      "Top zone: centered or left-aligned academic title block with institution, department, course, instructor, student, and submission meta when provided. Body zone: section-led composition with clear headings and optional diagrams, tables, or charts placed beside or beneath relevant sections. Footer remains minimal and unobtrusive.",
    diagram_default_style: "clean academic explanatory diagram with precise labels",
    chart_default_style: "clean academic chart with subtle gridlines and clear labels",
    search_aliases: ["academic", "university", "college", "report", "research", "case study", "جامعة", "كلية", "بحث", "تقرير"],
  },

  {
    id: "study_handout",
    name_en: "Study Sheet / Handout",
    name_ar: "ورقة دراسة / مذكرة",
    aspect_ratio: "2:3",
    per_page_char_budget: 1200,
    purpose_chips: [
      { id: "study_sheet", label_en: "Study Sheet", label_ar: "ورقة دراسة" },
      { id: "lecture_handout", label_en: "Lecture Handout", label_ar: "مذكرة محاضرة" },
      { id: "revision_guide", label_en: "Revision Guide", label_ar: "دليل مراجعة" },
      { id: "cheat_sheet", label_en: "Cheat Sheet", label_ar: "ورقة تلخيص" },
    ],
    form_schema_common: [
      { key: "topic", label_en: "Topic", label_ar: "الموضوع", type: "text", required: false },
      { key: "course_name", label_en: "Subject / Course", label_ar: "المادة / المقرر", type: "text", required: false },
      { key: "teacher_name", label_en: "Teacher / Lecturer", label_ar: "المعلم / المحاضر", type: "text", required: false },
      { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
      { key: "grade", label_en: "Grade / Level", label_ar: "الصف / المستوى", type: "text", required: false },
      FIELD_LOGO,
      FIELD_BILINGUAL,
    ],
    form_schema_by_purpose: {
      study_sheet: [
        { key: "focus_area", label_en: "Focus Area", label_ar: "محور التركيز", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste the study sheet content", "الصق محتوى ورقة الدراسة"),
      ],
      lecture_handout: [
        { key: "session_title", label_en: "Lecture / Session Title", label_ar: "عنوان المحاضرة / الجلسة", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste the handout content", "الصق محتوى المذكرة"),
      ],
      revision_guide: [
        { key: "exam_scope", label_en: "Exam / Revision Scope", label_ar: "نطاق الاختبار / المراجعة", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste the revision guide content", "الصق محتوى دليل المراجعة"),
      ],
      cheat_sheet: [
        { key: "formula_focus", label_en: "Key Formulas / Rules", label_ar: "القواعد / المعادلات الرئيسية", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste the cheat sheet content", "الصق محتوى ورقة التلخيص"),
      ],
    },
    style_block:
      "Clear study-aid aesthetic. Structured learning blocks, crisp headings, soft accent highlights, and highly scannable academic typography designed for quick revision and classroom use.",
    layout_blueprint:
      "Top zone: topic title with small course and level metadata. Body zone: compact instructional sections, summary cards, comparison tables, and optional diagrams arranged for fast scanning. Keep the layout tidy, legible, and classroom-friendly.",
    diagram_default_style: "clean instructional diagram with simple labels and calm color accents",
    chart_default_style: "simple study-friendly chart with clear labels and restrained colors",
    search_aliases: ["study", "handout", "revision", "cheat sheet", "notes", "مذكرة", "مراجعة", "ملخص"],
  },

  {
    id: "research_poster",
    name_en: "Research Poster / Scientific Poster",
    name_ar: "ملصق بحثي / علمي",
    aspect_ratio: "3:4",
    per_page_char_budget: 900,
    max_pages_override: 1,
    purpose_chips: [
      { id: "science_fair", label_en: "School Science Fair", label_ar: "معرض علوم مدرسي" },
      { id: "university_research", label_en: "University Research", label_ar: "بحث جامعي" },
      { id: "project_showcase", label_en: "Project Showcase", label_ar: "عرض مشروع" },
      { id: "conference_poster", label_en: "Conference Poster", label_ar: "ملصق مؤتمر" },
    ],
    form_schema_common: [
      { key: "poster_title", label_en: "Poster Title", label_ar: "عنوان الملصق", type: "text", required: false },
      { key: "institution_name", label_en: "Institution", label_ar: "اسم المؤسسة", type: "text", required: false },
      { key: "department_or_faculty", label_en: "Department / Faculty", label_ar: "القسم / الكلية", type: "text", required: false },
      { key: "authors", label_en: "Author(s)", label_ar: "الباحث / الباحثون", type: "text", required: false },
      { key: "supervisor_name", label_en: "Supervisor", label_ar: "المشرف", type: "text", required: false },
      { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
      FIELD_LOGO,
      FIELD_BILINGUAL,
    ],
    form_schema_by_purpose: {
      science_fair: [
        { key: "event_name", label_en: "Fair / Event Name", label_ar: "اسم المعرض / الفعالية", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste the poster abstract, methods, and findings", "الصق الملخص والمنهجية والنتائج"),
      ],
      university_research: [
        { key: "research_area", label_en: "Research Area", label_ar: "مجال البحث", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste the research poster content", "الصق محتوى الملصق البحثي"),
      ],
      project_showcase: [
        { key: "project_title", label_en: "Project Name", label_ar: "اسم المشروع", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste the project showcase content", "الصق محتوى عرض المشروع"),
      ],
      conference_poster: [
        { key: "conference_name", label_en: "Conference Name", label_ar: "اسم المؤتمر", type: "text", required: false },
        { key: "event_date", label_en: "Conference Date", label_ar: "تاريخ المؤتمر", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste the conference poster content", "الصق محتوى ملصق المؤتمر"),
      ],
    },
    style_block:
      "Scientific poster aesthetic. Crisp academic typography, strong section headers, balanced data visuals, and a polished conference-ready composition that remains legible at a glance.",
    layout_blueprint:
      "Top zone: large poster title with institution, authors, and supervisor. Body zone: poster blocks arranged in a clean grid for abstract, methods, findings, visuals, and conclusion. Charts, tables, and diagrams should feel integrated, not decorative. Footer remains light.",
    diagram_default_style: "scientific explanatory figure with clear labels and professional color use",
    chart_default_style: "conference-style chart with crisp axes, legend, and restrained palette",
    search_aliases: ["poster", "research", "scientific", "conference", "science fair", "ملصق", "بحث", "علمي"],
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
        { key: "company_name", label_en: "Company Name", label_ar: "اسم الشركة", type: "text", required: false },
        { key: "department", label_en: "Department", label_ar: "القسم", type: "text", required: false },
        { key: "report_title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: false },
        { key: "period", label_en: "Period (e.g. Q1 2026)", label_ar: "الفترة", type: "text", required: false },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text", required: false },
        { key: "doc_ref", label_en: "Reference Code", label_ar: "رقم المرجع", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Paste your report content", "الصق محتوى التقرير"),
      ],
      board: [
        { key: "company_name", label_en: "Company Name", label_ar: "اسم الشركة", type: "text", required: false },
        { key: "report_title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: false },
        { key: "period", label_en: "Period", label_ar: "الفترة", type: "text", required: false },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text", required: false },
        { key: "doc_ref", label_en: "Reference Code", label_ar: "رقم المرجع", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Paste your board-level content", "الصق محتوى مجلس الإدارة"),
      ],
      client: [
        { key: "company_name", label_en: "Your Company", label_ar: "شركتك", type: "text", required: false },
        { key: "client_name", label_en: "Client Name", label_ar: "اسم العميل", type: "text", required: false },
        { key: "report_title", label_en: "Document Title", label_ar: "عنوان المستند", type: "text", required: false },
        { key: "period", label_en: "Period", label_ar: "الفترة", type: "text", required: false },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Paste your client-facing content", "الصق محتوى العميل"),
      ],
    },
    style_block:
      "Premium executive-report aesthetic. Pristine white background, deep navy or brand-accent bar across the top, crisp vector layout, shaded-header data tables with alternating subtle row shading. Conservative, executive, print-ready — feels like a consultancy-grade PDF prepared for a board meeting.",
    layout_blueprint:
      "Top zone: narrow solid accent bar flush against the top edge. Logo top-left. Company name next to logo. Small reference code top-right in monospaced style. Directly below header strip: full-width bold H1 report title. Thin meta row beneath the title showing period, author, and department when provided. Upper body: executive summary paragraph in slightly larger body size. Middle body: section headings with thin colored underline rules. If content holds multiple short sections, arrange them as a 2-column grid; if a single long section, flow full-width. Data zone: when tabular data exists, render a bordered table with shaded header row. When numerical data suitable for charting is present, render a clean 2D bar or line chart beside or below the table. Right-column sidebar (when content fits): one or two highlight cards carrying key callouts from the content.",
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
      { id: "academic", label_en: "Academic", label_ar: "أكاديمي" },
      { id: "training", label_en: "Training", label_ar: "تدريب" },
      { id: "achievement_award", label_en: "Achievement", label_ar: "إنجاز" },
      { id: "completion", label_en: "Completion", label_ar: "إتمام" },
    ],
    form_schema_common: [
      { key: "issuer_name", label_en: "Issuing Organization", label_ar: "الجهة المانحة", type: "text", required: false },
      { key: "recipient_name", label_en: "Recipient Name", label_ar: "اسم المستلم", type: "text", required: false },
      { key: "achievement", label_en: "Achievement / Reason", label_ar: "الإنجاز", type: "text", required: false },
      { key: "issue_date", label_en: "Date", label_ar: "التاريخ", type: "date", required: false },
      { key: "signatory_name", label_en: "Signatory Name", label_ar: "اسم الموقع", type: "text", required: false },
      { key: "signatory_title", label_en: "Signatory Title", label_ar: "المسمى الوظيفي", type: "text", required: false },
      { key: "logo", label_en: "Logo / Seal", label_ar: "الشعار / الختم", type: "image", required: false },
      FIELD_BILINGUAL,
    ],
    form_schema_by_purpose: {
      academic: [
        { key: "certificate_title", label_en: "Certificate Title", label_ar: "عنوان الشهادة", type: "text", required: false },
        { key: "program_name", label_en: "Program / Course", label_ar: "البرنامج / الدورة", type: "text", required: false },
        { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
        { key: "grade_or_result", label_en: "Grade / Result", label_ar: "النتيجة / التقدير", type: "text", required: false },
        { key: "certificate_id", label_en: "Certificate ID", label_ar: "رقم الشهادة", type: "text", required: false },
      ],
      training: [
        { key: "certificate_title", label_en: "Certificate Title", label_ar: "عنوان الشهادة", type: "text", required: false },
        { key: "program_name", label_en: "Training Name", label_ar: "اسم التدريب", type: "text", required: false },
        { key: "hours_completed", label_en: "Hours Completed", label_ar: "عدد الساعات", type: "text", required: false },
        { key: "certificate_id", label_en: "Certificate ID", label_ar: "رقم الشهادة", type: "text", required: false },
      ],
      achievement_award: [
        { key: "certificate_title", label_en: "Award Title", label_ar: "عنوان الجائزة", type: "text", required: false },
        { key: "category_or_reason", label_en: "Category / Reason", label_ar: "الفئة / السبب", type: "text", required: false },
        { key: "certificate_id", label_en: "Award ID", label_ar: "رقم الجائزة", type: "text", required: false },
      ],
      completion: [
        { key: "certificate_title", label_en: "Completion Title", label_ar: "عنوان الإتمام", type: "text", required: false },
        { key: "program_name", label_en: "Program Name", label_ar: "اسم البرنامج", type: "text", required: false },
        { key: "hours_completed", label_en: "Hours Completed", label_ar: "عدد الساعات", type: "text", required: false },
        { key: "certificate_id", label_en: "Completion ID", label_ar: "رقم الإتمام", type: "text", required: false },
      ],
    },
    style_block:
      "Award-grade ceremonial certificate aesthetic. Cream or pearl-white stock, thin gold or navy ornamental hairline border, calligraphic display typography on the recipient name. Premium, frame-worthy, feels like a formal diploma.",
    layout_blueprint:
      "Entire page is a fully centered single-column composition. Thin ornamental border (gold or navy hairline) frames the page inside the margins. Top zone: issuing organization name or logo, centered. Upper middle: italic phrase 'This is to certify that' (or the Arabic equivalent when language is Arabic). Center zone: recipient name rendered hero-size, elegant and prominent. Directly below recipient: achievement description line in graceful body type. Lower zone: issue date on the left, signature line on the right with the signatory name and title beneath. Bottom center: seal or logo small and centered.",
    search_aliases: ["certificate", "diploma", "award", "achievement", "training", "completion", "شهادة", "تكريم"],
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
      { key: "event_name", label_en: "Event Name", label_ar: "اسم الفعالية", type: "text", required: false },
      { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: false },
      { key: "time", label_en: "Time", label_ar: "الوقت", type: "text", required: false },
      { key: "venue", label_en: "Venue / Location", label_ar: "المكان", type: "text", required: false },
      { key: "tagline", label_en: "Tagline / Hook", label_ar: "العبارة الرئيسية", type: "text", required: false },
      { key: "description", label_en: "Short Description", label_ar: "وصف قصير", type: "textarea", required: false },
      { key: "cta", label_en: "Call to Action", label_ar: "الدعوة للتفاعل", type: "text", required: false },
      FIELD_LOGO,
      { key: "headline_image", label_en: "Headline Image (optional)", label_ar: "صورة رئيسية (اختياري)", type: "image", required: false },
      FIELD_BILINGUAL,
    ],
    style_block:
      "Bold social-share poster aesthetic. Full-bleed color or gradient background driven by the theme or brand colors, hero-size event typography, high-contrast information card. Modern, Instagram-ready, eye-grabbing.",
    layout_blueprint:
      "Top zone: optional small tagline sits above the event name in lighter weight. Event name rendered hero-size occupying the top third of the page. Middle zone: high-contrast information card containing date, time, and venue as a clean three-line block. If a headline image was provided, it sits above the info card as a large centered visual. Lower zone: short description paragraph in comfortable reading size. Near bottom: CTA rendered as a pill or rectangular button shape containing the call-to-action text. Footer corner: logo small when provided.",
    search_aliases: ["flyer", "poster", "event", "party", "invite", "ملصق", "فعالية", "دعوة"],
  },

  // 6. CRAFT INFOGRAPHIC -------------------------------------------------------
  {
    id: "craft_infographic",
    name_en: "Craft / Visual Infographic",
    name_ar: "إنفوجرافيك يدوي / مرئي",
    aspect_ratio: "2:3",
    per_page_char_budget: 800,
    purpose_chips: [
      { id: "school", label_en: "School", label_ar: "مدرسة" },
      { id: "high_school", label_en: "High School", label_ar: "ثانوي" },
      { id: "college_university", label_en: "College / University", label_ar: "كلية / جامعة" },
      { id: "work", label_en: "Work", label_ar: "عمل" },
      { id: "personal", label_en: "Personal", label_ar: "شخصي" },
    ],
    form_schema_common: [
      { key: "topic", label_en: "Topic", label_ar: "الموضوع", type: "text", required: false },
      { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
      { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
      { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
      { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: false },
      FIELD_LOGO,
      FIELD_BILINGUAL,
    ],
    form_schema_by_purpose: {
      school: [
        { key: "institution_name", label_en: "School Name", label_ar: "اسم المدرسة", type: "text", required: false },
        { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text", required: false },
        { key: "grade", label_en: "Grade / Class", label_ar: "الصف / الفصل", type: "text", required: false },
        { key: "subject", label_en: "Subject", label_ar: "المادة", type: "text", required: false },
        { key: "teacher_or_supervisor", label_en: "Teacher", label_ar: "المعلم", type: "text", required: false },
        { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
        FIELD_RAW_CONTENT("Explain the topic in your own words", "اشرح الموضوع بأسلوبك"),
      ],
      high_school: [
        { key: "institution_name", label_en: "School Name", label_ar: "اسم المدرسة", type: "text", required: false },
        { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text", required: false },
        { key: "grade", label_en: "Grade / Level", label_ar: "الصف / المستوى", type: "text", required: false },
        { key: "subject", label_en: "Subject", label_ar: "المادة", type: "text", required: false },
        { key: "teacher_or_supervisor", label_en: "Teacher", label_ar: "المعلم", type: "text", required: false },
        { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
        FIELD_RAW_CONTENT("Explain the topic in your own words", "اشرح الموضوع بأسلوبك"),
      ],
      college_university: [
        { key: "institution_name", label_en: "Institution", label_ar: "اسم المؤسسة", type: "text", required: false },
        { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text", required: false },
        { key: "student_id", label_en: "Student ID", label_ar: "الرقم الجامعي", type: "text", required: false },
        { key: "department_or_faculty", label_en: "Department / Faculty", label_ar: "القسم / الكلية", type: "text", required: false },
        { key: "subject", label_en: "Course", label_ar: "المقرر", type: "text", required: false },
        { key: "teacher_or_supervisor", label_en: "Instructor / Supervisor", label_ar: "المحاضر / المشرف", type: "text", required: false },
        { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
        FIELD_RAW_CONTENT("Explain the topic in your own words", "اشرح الموضوع بأسلوبك"),
      ],
      work: [
        { key: "company_name", label_en: "Company", label_ar: "الشركة", type: "text", required: false },
        { key: "department", label_en: "Department / Team", label_ar: "القسم / الفريق", type: "text", required: false },
        { key: "audience", label_en: "Audience", label_ar: "الجمهور", type: "text", required: false },
        FIELD_RAW_CONTENT("Key points to explain", "النقاط الرئيسية"),
      ],
      personal: [
        FIELD_RAW_CONTENT("Content", "المحتوى"),
      ],
    },
    style_block:
      "Paper-craft flat-lay infographic aesthetic. Soft paper-texture background, hand-cut paper shapes with subtle drop shadows, hand-drawn ink arrows and labels, small tactile craft accents. CRITICAL: every craft element, shape, and small accent MUST be semantically related to the document's actual subject matter — derived from words in the topic, title, or content. Examples (illustrative only, do not default to these): electricity topics use paper wires, batteries, bulbs, lightning bolts; biology topics use paper leaves, cells, animals; weather topics use clouds and raindrops; history topics use scrolls and artifacts. NEVER add clouds, raindrops, cotton, or water motifs unless the subject is literally about weather or water. Warm, educational, hands-on feel.",
    layout_blueprint:
      "Top zone: paper-cut title card holding the topic text inside. Small meta strip below showing student name and subject when provided. Middle body: information cards (3 to 4 when the page is portrait, 3 to 5 arranged horizontally when the page is landscape), each card holding a short label and one or two sentences of content. Hand-drawn ink arrows or twine lines connect cards in reading order. Final summary card or closing thought placed at the end of the reading flow. Small subject-appropriate 3D craft accents scattered tastefully between cards without competing with text — never generic clouds or water drops unless the subject requires them. All text on shapes stays razor-sharp and perfectly legible.",
    search_aliases: ["infographic", "diy", "craft", "visual", "university", "إنفوجرافيك", "شرح"],
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
      { key: "title", label_en: "Overall Title", label_ar: "العنوان الرئيسي", type: "text", required: false },
      {
        key: "panel_count",
        label_en: "Number of Panels",
        label_ar: "عدد اللوحات",
        type: "select",
        options: [3, 4],
        default: 3,
        required: false,
      },
      FIELD_RAW_CONTENT(
        "Describe each panel (label + 1-2 lines). Example:\n1) CUMULUS - Puffy fair-weather clouds.\n2) STRATUS - Low overcast layer.\n3) CIRRUS - High wispy clouds.",
        "اوصف كل لوحة (عنوان + سطر أو سطرين)",
      ),
      { key: "logo", label_en: "Logo (optional)", label_ar: "الشعار (اختياري)", type: "image", required: false },
    ],
    style_block:
      "Bold comic-book poster aesthetic. Vibrant saturated panel backgrounds, thick black outlines, dynamic illustrations, uppercase comic-lettering titles. High-contrast, energetic, ages 10+.",
    layout_blueprint:
      "The page is divided into a vertical grid of 3 or 4 equal panels inside the 2:3 frame, panel count per the form. Each panel contains: a bold uppercase title banner at the top in comic-lettering style, a dynamic illustration filling the panel body, and a clean sans-serif caption strip at the bottom with 1 or 2 lines of explanatory text. Panels are separated by thick black gutters. When an overall title is present, render it as a banner above panel 1 across the top of the page.",
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
        { key: "title", label_en: "Title", label_ar: "العنوان", type: "text", required: false },
        { key: "subtitle", label_en: "Subtitle", label_ar: "العنوان الفرعي", type: "text", required: false },
        { key: "author", label_en: "Author / Org", label_ar: "المؤلف / الجهة", type: "text", required: false },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Content", "المحتوى"),
      ],
      letter: [
        { key: "sender_name", label_en: "Sender (You / Org)", label_ar: "اسم المرسل", type: "text", required: false },
        { key: "recipient_name", label_en: "Recipient", label_ar: "المستلم", type: "text", required: false },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: false },
        { key: "subject", label_en: "Subject", label_ar: "الموضوع", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Letter body", "نص الخطاب"),
      ],
      notice: [
        { key: "title", label_en: "Notice Title", label_ar: "عنوان الإعلان", type: "text", required: false },
        { key: "issuer", label_en: "Issued By", label_ar: "جهة الإصدار", type: "text", required: false },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Notice body", "نص الإعلان"),
      ],
      flyer: [
        { key: "event_name", label_en: "Headline / Event", label_ar: "العنوان / الفعالية", type: "text", required: false },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: false },
        { key: "venue", label_en: "Venue", label_ar: "المكان", type: "text", required: false },
        { key: "cta", label_en: "Call to Action", label_ar: "الدعوة للتفاعل", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Short description", "وصف قصير", false),
      ],
      anything: [
        { key: "title", label_en: "Title", label_ar: "العنوان", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Content", "المحتوى"),
      ],
    },
    style_block:
      "Ultra-clean minimalist stationery aesthetic. Pure white background, generous whitespace, one tasteful single accent color (logo-derived or neutral dark by default), sans-serif typography throughout. Feels like premium Apple-grade modern stationery.",
    layout_blueprint:
      "Top zone: large H1 title. Subtitle or author/date line directly below in lighter weight, right-aligned when a date is present. Body zone: paragraphs at comfortable reading size, separated by thin hairline horizontal rules where section breaks occur. Generous whitespace around every block. Layout breathes — no heavy decorative elements.",
    search_aliases: ["simple", "minimal", "clean", "modern", "بسيط", "خطاب", "إعلان"],
  },

  {
    id: "invoice_receipt",
    name_en: "Invoice / Receipt",
    name_ar: "فاتورة / إيصال",
    aspect_ratio: "2:3",
    per_page_char_budget: 1000,
    max_pages_override: 2,
    purpose_chips: [
      { id: "invoice", label_en: "Invoice", label_ar: "فاتورة" },
      { id: "receipt", label_en: "Receipt", label_ar: "إيصال" },
    ],
    form_schema_by_purpose: {
      invoice: [
        { key: "company_name", label_en: "Business Name", label_ar: "اسم النشاط", type: "text", required: false },
        { key: "client_name", label_en: "Bill To", label_ar: "الفاتورة إلى", type: "text", required: false },
        { key: "invoice_number", label_en: "Invoice Number", label_ar: "رقم الفاتورة", type: "text", required: false },
        { key: "issue_date", label_en: "Issue Date", label_ar: "تاريخ الإصدار", type: "date", required: false },
        { key: "due_date", label_en: "Due Date", label_ar: "تاريخ الاستحقاق", type: "date", required: false },
        { key: "currency", label_en: "Currency", label_ar: "العملة", type: "text", required: false },
        { key: "payment_terms", label_en: "Payment Terms", label_ar: "شروط الدفع", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        { key: "include_table", label_en: "Include Items Table", label_ar: "تضمين جدول العناصر", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste line items, subtotal, tax, and notes", "الصق العناصر والمجموع والضريبة والملاحظات"),
      ],
      receipt: [
        { key: "company_name", label_en: "Business Name", label_ar: "اسم النشاط", type: "text", required: false },
        { key: "client_name", label_en: "Customer Name", label_ar: "اسم العميل", type: "text", required: false },
        { key: "receipt_number", label_en: "Receipt Number", label_ar: "رقم الإيصال", type: "text", required: false },
        { key: "issue_date", label_en: "Date", label_ar: "التاريخ", type: "date", required: false },
        { key: "paid_method", label_en: "Payment Method", label_ar: "طريقة الدفع", type: "text", required: false },
        { key: "currency", label_en: "Currency", label_ar: "العملة", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        { key: "include_table", label_en: "Include Items Table", label_ar: "تضمين جدول العناصر", type: "toggle", default: true },
        FIELD_RAW_CONTENT("Paste purchased items, totals, and notes", "الصق العناصر المشتراة والإجمالي والملاحظات"),
      ],
    },
    style_block:
      "Polished finance-document aesthetic. Clean white background, neutral palette with one restrained accent color, professional data-table styling, subtle divider lines. Feels trustworthy, print-ready, ready to send to a client.",
    layout_blueprint:
      "Top zone: logo top-left, business name beside it. Top-right: large 'INVOICE' or 'RECEIPT' label with the document number directly beneath it. Upper body: two-column information strip — left column labeled 'Bill To' or 'Customer' with client details, right column showing issue date, due date, currency, and payment terms or method when provided. Middle body: itemized table with columns for description, quantity, unit price, and total; shaded header row and hairline row dividers. Lower body: subtotal, tax, and total summary block positioned in the lower-right area with the final total inside a strong bordered highlight box. Footer: small notes or payment info line above the 'wakti.qa' footer.",
    search_aliases: ["invoice", "receipt", "bill", "payment", "فاتورة", "إيصال"],
  },

  {
    id: "menu_price_list",
    name_en: "Menu / Price List",
    name_ar: "قائمة أسعار / منيو",
    aspect_ratio: "3:4",
    per_page_char_budget: 700,
    max_pages_override: 1,
    form_schema: [
      { key: "business_name", label_en: "Business Name", label_ar: "اسم النشاط", type: "text", required: false },
      { key: "subtitle", label_en: "Subtitle / Tagline", label_ar: "العنوان الفرعي", type: "text", required: false },
      { key: "currency", label_en: "Currency", label_ar: "العملة", type: "text", required: false },
      { key: "contact_info", label_en: "Contact Info", label_ar: "معلومات التواصل", type: "text", required: false },
      { key: "working_hours", label_en: "Working Hours", label_ar: "ساعات العمل", type: "text", required: false },
      FIELD_LOGO,
      FIELD_BILINGUAL,
      { key: "include_table", label_en: "Use Price Table Layout", label_ar: "استخدام تخطيط جدول الأسعار", type: "toggle", default: true },
      FIELD_RAW_CONTENT("Paste sections, item names, descriptions, and prices", "الصق الأقسام والأصناف والوصف والأسعار"),
    ],
    style_block:
      "Refined menu-board aesthetic. Elegant portrait layout, graceful typography, clear category separation, subtle decorative accents. Feels like a premium cafe or restaurant printed menu, easy to scan from a distance.",
    layout_blueprint:
      "Top zone: elegant masthead with the business name centered, logo above or beside the name when provided. Subtitle or tagline line beneath. Small working-hours line in lighter weight when provided. Body: categories appear as section headings. Under each heading, items are listed one per line with the item name on the left and the price right-aligned, connected by a dotted leader line. Short description sits beneath item name in smaller lighter type when present. Footer: small contact line when not already shown in the header, above the 'wakti.qa' footer.",
    search_aliases: ["menu", "price", "restaurant", "cafe", "services", "منيو", "أسعار"],
  },

  {
    id: "thank_you_invitation_card",
    name_en: "Thank-you / Invitation Card",
    name_ar: "بطاقة شكر / دعوة",
    aspect_ratio: "3:4",
    per_page_char_budget: 500,
    max_pages_override: 1,
    purpose_chips: [
      { id: "thank_you", label_en: "Thank-you", label_ar: "شكر" },
      { id: "invitation", label_en: "Invitation", label_ar: "دعوة" },
    ],
    form_schema_by_purpose: {
      thank_you: [
        { key: "sender_name", label_en: "From", label_ar: "من", type: "text", required: false },
        { key: "recipient_name", label_en: "To", label_ar: "إلى", type: "text", required: false },
        { key: "card_title", label_en: "Card Title", label_ar: "عنوان البطاقة", type: "text", required: false },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Write your thank-you message", "اكتب رسالة الشكر"),
      ],
      invitation: [
        { key: "host_name", label_en: "Host / Organizer", label_ar: "المضيف / الجهة المنظمة", type: "text", required: false },
        { key: "event_name", label_en: "Event Name", label_ar: "اسم المناسبة", type: "text", required: false },
        { key: "event_date", label_en: "Event Date", label_ar: "تاريخ المناسبة", type: "text", required: false },
        { key: "time", label_en: "Time", label_ar: "الوقت", type: "text", required: false },
        { key: "venue", label_en: "Venue", label_ar: "المكان", type: "text", required: false },
        { key: "dress_code", label_en: "Dress Code", label_ar: "الزي", type: "text", required: false },
        { key: "rsvp", label_en: "RSVP / Contact", label_ar: "تأكيد الحضور / التواصل", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW_CONTENT("Write your invitation wording", "اكتب نص الدعوة", false),
      ],
    },
    style_block:
      "Elegant greeting-card aesthetic. Centered composition, refined ornamental touches, soft premium feel. Invitation mode celebratory and polished; thank-you mode warm, graceful, and sincere. Typography stays fully legible and premium.",
    layout_blueprint:
      "Entire page is a centered composition with tasteful ornamental flourishes framing the page inside the margins. Invitation mode: event name or title rendered large at center-top; host line beneath; date, time, and venue stacked centered in graceful spacing; RSVP or dress-code line near the bottom. Thank-you mode: card title centered near the top; recipient addressed below when provided; main message centered in graceful body type; signature or from-line near the bottom.",
    search_aliases: ["thank you", "invitation", "card", "wedding", "party", "شكر", "دعوة"],
  },

  {
    id: "resume_cv",
    name_en: "Resume / CV",
    name_ar: "سيرة ذاتية",
    aspect_ratio: "2:3",
    per_page_char_budget: 1400,
    max_pages_override: 2,
    purpose_chips: [
      { id: "student_cv", label_en: "Student CV", label_ar: "سيرة طالب" },
      { id: "graduate_cv", label_en: "Graduate CV", label_ar: "سيرة خريج" },
      { id: "professional_cv", label_en: "Professional CV", label_ar: "سيرة مهنية" },
    ],
    form_schema_common: [
      { key: "full_name", label_en: "Full Name", label_ar: "الاسم الكامل", type: "text", required: false },
      { key: "desired_role", label_en: "Job Title / Role", label_ar: "المسمى الوظيفي", type: "text", required: false },
      { key: "email", label_en: "Email", label_ar: "البريد الإلكتروني", type: "text", required: false },
      { key: "phone", label_en: "Phone", label_ar: "الهاتف", type: "text", required: false },
      { key: "location", label_en: "Location", label_ar: "الموقع", type: "text", required: false },
      { key: "website", label_en: "Website / Portfolio", label_ar: "الموقع / معرض الأعمال", type: "text", required: false },
      { key: "linkedin", label_en: "LinkedIn", label_ar: "لينكدإن", type: "text", required: false },
      { key: "summary", label_en: "Professional Summary", label_ar: "الملخص المهني", type: "textarea", required: false },
      FIELD_LOGO,
      FIELD_BILINGUAL,
    ],
    form_schema_by_purpose: {
      student_cv: [
        { key: "education", label_en: "Education", label_ar: "التعليم", type: "textarea", required: false },
        { key: "skills", label_en: "Skills", label_ar: "المهارات", type: "textarea", required: false },
        { key: "languages", label_en: "Languages", label_ar: "اللغات", type: "textarea", required: false },
        { key: "certifications", label_en: "Certifications", label_ar: "الشهادات", type: "textarea", required: false },
        FIELD_RAW_CONTENT("Paste projects, activities, awards, and extra details", "الصق المشاريع والأنشطة والجوائز والتفاصيل الإضافية", false),
      ],
      graduate_cv: [
        { key: "education", label_en: "Education", label_ar: "التعليم", type: "textarea", required: false },
        { key: "experience", label_en: "Experience", label_ar: "الخبرة", type: "textarea", required: false },
        { key: "skills", label_en: "Skills", label_ar: "المهارات", type: "textarea", required: false },
        { key: "languages", label_en: "Languages", label_ar: "اللغات", type: "textarea", required: false },
        { key: "certifications", label_en: "Certifications", label_ar: "الشهادات", type: "textarea", required: false },
        FIELD_RAW_CONTENT("Paste internships, projects, and extra details", "الصق التدريب والمشاريع والتفاصيل الإضافية", false),
      ],
      professional_cv: [
        { key: "experience", label_en: "Experience", label_ar: "الخبرة", type: "textarea", required: false },
        { key: "skills", label_en: "Skills", label_ar: "المهارات", type: "textarea", required: false },
        { key: "languages", label_en: "Languages", label_ar: "اللغات", type: "textarea", required: false },
        { key: "certifications", label_en: "Certifications", label_ar: "الشهادات", type: "textarea", required: false },
        FIELD_RAW_CONTENT("Paste achievements, responsibilities, and extra details", "الصق الإنجازات والمسؤوليات والتفاصيل الإضافية", false),
      ],
    },
    style_block:
      "Recruiter-grade modern resume aesthetic. Clean typography, restrained accent highlights, consistent section rules, elegant spacing. Feels serious, modern, employer-ready.",
    layout_blueprint:
      "Top zone: large candidate name rendered as a masthead. Role or desired-job-title subtitle directly beneath. Compact contact row in smaller type — email, phone, location, website, LinkedIn — separated by thin vertical dividers, only provided fields appear. Body: distinct section blocks in this order — Summary, Experience, Education, Skills, Certifications. Each section starts with a bold heading and a thin accent underline rule. Experience and education items follow a consistent pattern: role or title on the left, dates right-aligned, followed by company or institution and a short description beneath. Consistent gap between sections. Layout is recruiter-readable at a glance.",
    search_aliases: ["resume", "cv", "career", "job", "employment", "student cv", "graduate", "سيرة", "وظيفة"],
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
  const common = theme.form_schema_common ?? [];
  if (theme.form_schema_by_purpose && purposeId) {
    return [...common, ...(theme.form_schema_by_purpose[purposeId] ?? [])];
  }
  if (common.length) return common;
  return [];
}

export function themeRequiresPurpose(theme: A4Theme): boolean {
  return !!theme.purpose_chips && !!theme.form_schema_by_purpose && !theme.form_schema;
}

export function getThemeDocumentLane(themeId: string, purposeId?: string | null): A4DocumentLane {
  if (themeId === "clean_minimal") {
    if (purposeId === "report" || purposeId === "letter" || purposeId === "notice") {
      return "formal";
    }
    return "visual";
  }

  if (
    themeId === "official_exam" ||
    themeId === "school_project" ||
    themeId === "academic_report" ||
    themeId === "study_handout" ||
    themeId === "research_poster" ||
    themeId === "corporate_brief" ||
    themeId === "invoice_receipt" ||
    themeId === "menu_price_list" ||
    themeId === "resume_cv"
  ) {
    return "formal";
  }

  return "visual";
}

export function maxPagesForTheme(theme: A4Theme): 1 | 2 | 3 {
  return theme.max_pages_override ?? 3;
}
