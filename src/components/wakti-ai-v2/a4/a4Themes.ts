// A4 Document Builder — Frontend Theme Registry (Display-only)
// -----------------------------------------------------------------------------
// Mirrors the subset of supabase/functions/_shared/a4-themes.ts that the UI
// needs to render theme picker + purpose chips + dynamic form. Style blocks,
// prompt-builder logic, and char budgets stay server-side only.
// Keep theme IDs, purpose IDs, and field keys in sync with the backend file.
// -----------------------------------------------------------------------------

export type A4FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "toggle"
  | "select"
  | "image";

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
  max_pages: 1 | 2 | 3;
  purpose_chips?: A4PurposeChip[];
  form_schema?: A4FormField[];
  form_schema_common?: A4FormField[];
  form_schema_by_purpose?: Record<string, A4FormField[]>;
  search_aliases?: string[];
}

// -----------------------------------------------------------------------------
// Reusable field fragments (kept identical to backend)
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

const FIELD_RAW = (
  label_en: string,
  label_ar: string,
  required = true,
): A4FormField => ({
  key: "raw_content",
  label_en,
  label_ar,
  type: "textarea",
  required,
});

// -----------------------------------------------------------------------------
// 12 themes (display metadata + form schemas only)
// -----------------------------------------------------------------------------

export const A4_THEMES: A4Theme[] = [
  {
    id: "official_exam",
    name_en: "Academic Exam / Test",
    name_ar: "اختبار / تقييم أكاديمي",
    aspect_ratio: "2:3",
    max_pages: 3,
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
        FIELD_RAW("Paste your questions here", "الصق الأسئلة هنا"),
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
        FIELD_RAW("Paste your questions here", "الصق الأسئلة هنا"),
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
        FIELD_RAW("Paste your questions here", "الصق الأسئلة هنا"),
      ],
      worksheet: [
        { key: "grade", label_en: "Grade / Level", label_ar: "الصف / المستوى", type: "text", required: false },
        { key: "instructions", label_en: "Worksheet Instructions", label_ar: "تعليمات ورقة العمل", type: "textarea", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_grading_circle", label_en: "Grading Circle", label_ar: "دائرة الدرجة", type: "toggle", default: false },
        FIELD_RAW("Paste your worksheet questions or practice content", "الصق أسئلة أو محتوى ورقة العمل"),
      ],
    },
    search_aliases: ["exam", "test", "quiz", "worksheet", "assessment", "امتحان", "اختبار", "ورقة عمل"],
  },

  {
    id: "school_project",
    name_en: "Academic Project / Essay / Report",
    name_ar: "مشروع / مقال / تقرير أكاديمي",
    aspect_ratio: "2:3",
    max_pages: 3,
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
        FIELD_RAW("Paste your project content", "الصق محتوى المشروع"),
      ],
      essay: [
        { key: "project_title", label_en: "Essay Title", label_ar: "عنوان المقال", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: false },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: false },
        FIELD_RAW("Paste your essay content", "الصق محتوى المقال"),
      ],
      report: [
        { key: "project_title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste your report content", "الصق محتوى التقرير"),
      ],
      lab_report: [
        { key: "project_title", label_en: "Lab Report Title", label_ar: "عنوان تقرير المختبر", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste your lab report content", "الصق محتوى تقرير المختبر"),
      ],
      diy_infographic: [
        { key: "project_title", label_en: "Infographic Title", label_ar: "عنوان الإنفوجرافيك", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: false },
        FIELD_RAW("Paste your infographic content", "الصق محتوى الإنفوجرافيك"),
      ],
    },
    search_aliases: ["project", "essay", "report", "assignment", "lab", "infographic", "مقال", "مشروع", "تقرير"],
  },

  {
    id: "academic_report",
    name_en: "Academic Report / University Work",
    name_ar: "تقرير أكاديمي / عمل جامعي",
    aspect_ratio: "2:3",
    max_pages: 3,
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
        FIELD_RAW("Paste your essay content", "الصق محتوى المقال"),
      ],
      report: [
        { key: "title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste your report content", "الصق محتوى التقرير"),
      ],
      lab_report: [
        { key: "title", label_en: "Lab Report Title", label_ar: "عنوان تقرير المختبر", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste your lab report content", "الصق محتوى تقرير المختبر"),
      ],
      research_summary: [
        { key: "title", label_en: "Research Summary Title", label_ar: "عنوان ملخص البحث", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste your research summary content", "الصق محتوى ملخص البحث"),
      ],
      case_study: [
        { key: "title", label_en: "Case Study Title", label_ar: "عنوان دراسة الحالة", type: "text", required: false },
        { key: "case_subject", label_en: "Case Subject / Organization", label_ar: "موضوع / جهة الحالة", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste your case study content", "الصق محتوى دراسة الحالة"),
      ],
    },
    search_aliases: ["academic", "university", "college", "report", "research", "case study", "جامعة", "كلية", "بحث", "تقرير"],
  },

  {
    id: "study_handout",
    name_en: "Study Sheet / Handout",
    name_ar: "ورقة دراسة / مذكرة",
    aspect_ratio: "2:3",
    max_pages: 3,
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
        FIELD_RAW("Paste the study sheet content", "الصق محتوى ورقة الدراسة"),
      ],
      lecture_handout: [
        { key: "session_title", label_en: "Lecture / Session Title", label_ar: "عنوان المحاضرة / الجلسة", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste the handout content", "الصق محتوى المذكرة"),
      ],
      revision_guide: [
        { key: "exam_scope", label_en: "Exam / Revision Scope", label_ar: "نطاق الاختبار / المراجعة", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste the revision guide content", "الصق محتوى دليل المراجعة"),
      ],
      cheat_sheet: [
        { key: "formula_focus", label_en: "Key Formulas / Rules", label_ar: "القواعد / المعادلات الرئيسية", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste the cheat sheet content", "الصق محتوى ورقة التلخيص"),
      ],
    },
    search_aliases: ["study", "handout", "revision", "cheat sheet", "notes", "مذكرة", "مراجعة", "ملخص"],
  },

  {
    id: "research_poster",
    name_en: "Research Poster / Scientific Poster",
    name_ar: "ملصق بحثي / علمي",
    aspect_ratio: "3:4",
    max_pages: 1,
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
        FIELD_RAW("Paste the poster abstract, methods, and findings", "الصق الملخص والمنهجية والنتائج"),
      ],
      university_research: [
        { key: "research_area", label_en: "Research Area", label_ar: "مجال البحث", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste the research poster content", "الصق محتوى الملصق البحثي"),
      ],
      project_showcase: [
        { key: "project_title", label_en: "Project Name", label_ar: "اسم المشروع", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste the project showcase content", "الصق محتوى عرض المشروع"),
      ],
      conference_poster: [
        { key: "conference_name", label_en: "Conference Name", label_ar: "اسم المؤتمر", type: "text", required: false },
        { key: "event_date", label_en: "Conference Date", label_ar: "تاريخ المؤتمر", type: "text", required: false },
        { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
        { key: "diagram_colored", label_en: "Colored Diagram", label_ar: "رسم ملوّن", type: "toggle", default: true },
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_RAW("Paste the conference poster content", "الصق محتوى ملصق المؤتمر"),
      ],
    },
    search_aliases: ["poster", "research", "scientific", "conference", "science fair", "ملصق", "بحث", "علمي"],
  },

  {
    id: "corporate_brief",
    name_en: "Corporate Brief / Report",
    name_ar: "موجز مؤسسي",
    aspect_ratio: "2:3",
    max_pages: 3,
    purpose_chips: [
      { id: "internal", label_en: "Internal", label_ar: "داخلي" },
      { id: "board", label_en: "Board", label_ar: "مجلس الإدارة" },
      { id: "client", label_en: "Client", label_ar: "عميل" },
    ],
    form_schema_by_purpose: {
      internal: [
        { key: "company_name", label_en: "Company Name", label_ar: "اسم الشركة", type: "text", required: false },
        { key: "department", label_en: "Department", label_ar: "القسم", type: "text" },
        { key: "report_title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: false },
        { key: "period", label_en: "Period (e.g. Q1 2026)", label_ar: "الفترة", type: "text" },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text" },
        { key: "doc_ref", label_en: "Reference Code", label_ar: "رقم المرجع", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Paste your report content", "الصق محتوى التقرير"),
      ],
      board: [
        { key: "company_name", label_en: "Company Name", label_ar: "اسم الشركة", type: "text", required: false },
        { key: "report_title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: false },
        { key: "period", label_en: "Period", label_ar: "الفترة", type: "text", required: false },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text", required: false },
        { key: "doc_ref", label_en: "Reference Code", label_ar: "رقم المرجع", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Paste your board-level content", "الصق محتوى مجلس الإدارة"),
      ],
      client: [
        { key: "company_name", label_en: "Your Company", label_ar: "شركتك", type: "text", required: false },
        { key: "client_name", label_en: "Client Name", label_ar: "اسم العميل", type: "text", required: false },
        { key: "report_title", label_en: "Document Title", label_ar: "عنوان المستند", type: "text", required: false },
        { key: "period", label_en: "Period", label_ar: "الفترة", type: "text" },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Paste your client-facing content", "الصق محتوى العميل"),
      ],
    },
    search_aliases: ["report", "brief", "corporate", "تقرير", "موجز"],
  },

  {
    id: "certificate",
    name_en: "Certificate / Diploma",
    name_ar: "شهادة",
    aspect_ratio: "3:4",
    max_pages: 1,
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
      { key: "signatory_name", label_en: "Signatory Name", label_ar: "اسم الموقع", type: "text" },
      { key: "signatory_title", label_en: "Signatory Title", label_ar: "المسمى الوظيفي", type: "text" },
      { key: "logo", label_en: "Logo / Seal", label_ar: "الشعار / الختم", type: "image" },
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
    search_aliases: ["certificate", "diploma", "award", "training", "completion", "شهادة"],
  },

  {
    id: "event_flyer",
    name_en: "Event Flyer / Poster",
    name_ar: "ملصق فعالية",
    aspect_ratio: "3:4",
    max_pages: 1,
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
      { key: "tagline", label_en: "Tagline / Hook", label_ar: "العبارة الرئيسية", type: "text" },
      { key: "description", label_en: "Short Description", label_ar: "وصف قصير", type: "textarea" },
      { key: "cta", label_en: "Call to Action", label_ar: "الدعوة للتفاعل", type: "text" },
      FIELD_LOGO,
      { key: "headline_image", label_en: "Headline Image (optional)", label_ar: "صورة رئيسية (اختياري)", type: "image" },
      FIELD_BILINGUAL,
    ],
    search_aliases: ["flyer", "poster", "event", "ملصق", "فعالية"],
  },

  {
    id: "craft_infographic",
    name_en: "Craft / Visual Infographic",
    name_ar: "إنفوجرافيك يدوي / مرئي",
    aspect_ratio: "2:3",
    max_pages: 3,
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
        FIELD_RAW("Explain the topic in your own words", "اشرح الموضوع بأسلوبك"),
      ],
      high_school: [
        { key: "institution_name", label_en: "School Name", label_ar: "اسم المدرسة", type: "text", required: false },
        { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text", required: false },
        { key: "grade", label_en: "Grade / Level", label_ar: "الصف / المستوى", type: "text", required: false },
        { key: "subject", label_en: "Subject", label_ar: "المادة", type: "text", required: false },
        { key: "teacher_or_supervisor", label_en: "Teacher", label_ar: "المعلم", type: "text", required: false },
        { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
        FIELD_RAW("Explain the topic in your own words", "اشرح الموضوع بأسلوبك"),
      ],
      college_university: [
        { key: "institution_name", label_en: "Institution", label_ar: "اسم المؤسسة", type: "text", required: false },
        { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text", required: false },
        { key: "student_id", label_en: "Student ID", label_ar: "الرقم الجامعي", type: "text", required: false },
        { key: "department_or_faculty", label_en: "Department / Faculty", label_ar: "القسم / الكلية", type: "text", required: false },
        { key: "subject", label_en: "Course", label_ar: "المقرر", type: "text", required: false },
        { key: "teacher_or_supervisor", label_en: "Instructor / Supervisor", label_ar: "المحاضر / المشرف", type: "text", required: false },
        { key: "education_level", label_en: "Education Level", label_ar: "المرحلة التعليمية", type: "select", options: EDUCATION_LEVEL_OPTIONS, required: false },
        FIELD_RAW("Explain the topic in your own words", "اشرح الموضوع بأسلوبك"),
      ],
      work: [
        { key: "company_name", label_en: "Company", label_ar: "الشركة", type: "text" },
        { key: "department", label_en: "Department / Team", label_ar: "القسم / الفريق", type: "text" },
        { key: "audience", label_en: "Audience", label_ar: "الجمهور", type: "text" },
        FIELD_RAW("Key points to explain", "النقاط الرئيسية"),
      ],
      personal: [
        FIELD_RAW("Content", "المحتوى"),
      ],
    },
    search_aliases: ["infographic", "craft", "diy", "visual", "university", "إنفوجرافيك"],
  },

  {
    id: "comic_explainer",
    name_en: "Comic Explainer",
    name_ar: "شرح بأسلوب الكوميكس",
    aspect_ratio: "2:3",
    max_pages: 1,
    purpose_chips: [
      { id: "school", label_en: "School", label_ar: "مدرسي" },
      { id: "training", label_en: "Training", label_ar: "تدريب" },
      { id: "social", label_en: "Social", label_ar: "محتوى اجتماعي" },
    ],
    form_schema_common: [
      { key: "title", label_en: "Overall Title", label_ar: "العنوان الرئيسي", type: "text", required: false },
      { key: "panel_count", label_en: "Number of Panels", label_ar: "عدد اللوحات", type: "select", options: [3, 4], default: 3, required: false },
      FIELD_RAW(
        "Describe each panel (label + 1-2 lines). Example:\n1) CUMULUS - Puffy fair-weather clouds.\n2) STRATUS - Low overcast layer.\n3) CIRRUS - High wispy clouds.",
        "اوصف كل لوحة (عنوان + سطر أو سطرين)",
      ),
      { key: "logo", label_en: "Logo (optional)", label_ar: "الشعار (اختياري)", type: "image" },
    ],
    search_aliases: ["comic", "explainer", "panels", "كوميكس"],
  },

  {
    id: "clean_minimal",
    name_en: "Clean Minimal",
    name_ar: "بسيط وأنيق",
    aspect_ratio: "2:3",
    max_pages: 3,
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
        { key: "subtitle", label_en: "Subtitle", label_ar: "العنوان الفرعي", type: "text" },
        { key: "author", label_en: "Author / Org", label_ar: "المؤلف / الجهة", type: "text" },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Content", "المحتوى"),
      ],
      letter: [
        { key: "sender_name", label_en: "Sender (You / Org)", label_ar: "اسم المرسل", type: "text", required: false },
        { key: "recipient_name", label_en: "Recipient", label_ar: "المستلم", type: "text", required: false },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: false },
        { key: "subject", label_en: "Subject", label_ar: "الموضوع", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Letter body", "نص الخطاب"),
      ],
      notice: [
        { key: "title", label_en: "Notice Title", label_ar: "عنوان الإعلان", type: "text", required: false },
        { key: "issuer", label_en: "Issued By", label_ar: "جهة الإصدار", type: "text" },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Notice body", "نص الإعلان"),
      ],
      flyer: [
        { key: "event_name", label_en: "Headline / Event", label_ar: "العنوان / الفعالية", type: "text", required: false },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text" },
        { key: "venue", label_en: "Venue", label_ar: "المكان", type: "text" },
        { key: "cta", label_en: "Call to Action", label_ar: "الدعوة للتفاعل", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Short description", "وصف قصير", false),
      ],
      anything: [
        { key: "title", label_en: "Title", label_ar: "العنوان", type: "text", required: false },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Content", "المحتوى"),
      ],
    },
    search_aliases: ["simple", "minimal", "clean", "بسيط"],
  },

  {
    id: "invoice_receipt",
    name_en: "Invoice / Receipt",
    name_ar: "فاتورة / إيصال",
    aspect_ratio: "2:3",
    max_pages: 2,
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
        { key: "due_date", label_en: "Due Date", label_ar: "تاريخ الاستحقاق", type: "date" },
        { key: "currency", label_en: "Currency", label_ar: "العملة", type: "text" },
        { key: "payment_terms", label_en: "Payment Terms", label_ar: "شروط الدفع", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        { key: "include_table", label_en: "Include Items Table", label_ar: "تضمين جدول العناصر", type: "toggle", default: true },
        FIELD_RAW("Paste line items, subtotal, tax, and notes", "الصق العناصر والمجموع والضريبة والملاحظات"),
      ],
      receipt: [
        { key: "company_name", label_en: "Business Name", label_ar: "اسم النشاط", type: "text", required: false },
        { key: "client_name", label_en: "Customer Name", label_ar: "اسم العميل", type: "text" },
        { key: "receipt_number", label_en: "Receipt Number", label_ar: "رقم الإيصال", type: "text", required: false },
        { key: "issue_date", label_en: "Date", label_ar: "التاريخ", type: "date", required: false },
        { key: "paid_method", label_en: "Payment Method", label_ar: "طريقة الدفع", type: "text" },
        { key: "currency", label_en: "Currency", label_ar: "العملة", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        { key: "include_table", label_en: "Include Items Table", label_ar: "تضمين جدول العناصر", type: "toggle", default: true },
        FIELD_RAW("Paste purchased items, totals, and notes", "الصق العناصر المشتراة والإجمالي والملاحظات"),
      ],
    },
    search_aliases: ["invoice", "receipt", "bill", "فاتورة", "إيصال"],
  },

  {
    id: "menu_price_list",
    name_en: "Menu / Price List",
    name_ar: "قائمة أسعار / منيو",
    aspect_ratio: "3:4",
    max_pages: 1,
    form_schema: [
      { key: "business_name", label_en: "Business Name", label_ar: "اسم النشاط", type: "text", required: false },
      { key: "subtitle", label_en: "Subtitle / Tagline", label_ar: "العنوان الفرعي", type: "text" },
      { key: "currency", label_en: "Currency", label_ar: "العملة", type: "text" },
      { key: "contact_info", label_en: "Contact Info", label_ar: "معلومات التواصل", type: "text" },
      { key: "working_hours", label_en: "Working Hours", label_ar: "ساعات العمل", type: "text" },
      FIELD_LOGO,
      FIELD_BILINGUAL,
      { key: "include_table", label_en: "Use Price Table Layout", label_ar: "استخدام تخطيط جدول الأسعار", type: "toggle", default: true },
      FIELD_RAW("Paste sections, item names, descriptions, and prices", "الصق الأقسام والأصناف والوصف والأسعار"),
    ],
    search_aliases: ["menu", "price", "restaurant", "cafe", "منيو", "أسعار"],
  },

  {
    id: "thank_you_invitation_card",
    name_en: "Thank-you / Invitation Card",
    name_ar: "بطاقة شكر / دعوة",
    aspect_ratio: "3:4",
    max_pages: 1,
    purpose_chips: [
      { id: "thank_you", label_en: "Thank-you", label_ar: "شكر" },
      { id: "invitation", label_en: "Invitation", label_ar: "دعوة" },
    ],
    form_schema_by_purpose: {
      thank_you: [
        { key: "sender_name", label_en: "From", label_ar: "من", type: "text", required: false },
        { key: "recipient_name", label_en: "To", label_ar: "إلى", type: "text" },
        { key: "card_title", label_en: "Card Title", label_ar: "عنوان البطاقة", type: "text" },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Write your thank-you message", "اكتب رسالة الشكر"),
      ],
      invitation: [
        { key: "host_name", label_en: "Host / Organizer", label_ar: "المضيف / الجهة المنظمة", type: "text", required: false },
        { key: "event_name", label_en: "Event Name", label_ar: "اسم المناسبة", type: "text", required: false },
        { key: "event_date", label_en: "Event Date", label_ar: "تاريخ المناسبة", type: "text", required: false },
        { key: "time", label_en: "Time", label_ar: "الوقت", type: "text" },
        { key: "venue", label_en: "Venue", label_ar: "المكان", type: "text" },
        { key: "dress_code", label_en: "Dress Code", label_ar: "الزي", type: "text" },
        { key: "rsvp", label_en: "RSVP / Contact", label_ar: "تأكيد الحضور / التواصل", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Write your invitation wording", "اكتب نص الدعوة", false),
      ],
    },
    search_aliases: ["thank you", "invitation", "card", "شكر", "دعوة"],
  },

  {
    id: "resume_cv",
    name_en: "Resume / CV",
    name_ar: "سيرة ذاتية",
    aspect_ratio: "2:3",
    max_pages: 2,
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
        FIELD_RAW("Paste projects, activities, awards, and extra details", "الصق المشاريع والأنشطة والجوائز والتفاصيل الإضافية", false),
      ],
      graduate_cv: [
        { key: "education", label_en: "Education", label_ar: "التعليم", type: "textarea", required: false },
        { key: "experience", label_en: "Experience", label_ar: "الخبرة", type: "textarea", required: false },
        { key: "skills", label_en: "Skills", label_ar: "المهارات", type: "textarea", required: false },
        { key: "languages", label_en: "Languages", label_ar: "اللغات", type: "textarea", required: false },
        { key: "certifications", label_en: "Certifications", label_ar: "الشهادات", type: "textarea", required: false },
        FIELD_RAW("Paste internships, projects, and extra details", "الصق التدريب والمشاريع والتفاصيل الإضافية", false),
      ],
      professional_cv: [
        { key: "experience", label_en: "Experience", label_ar: "الخبرة", type: "textarea", required: false },
        { key: "skills", label_en: "Skills", label_ar: "المهارات", type: "textarea", required: false },
        { key: "languages", label_en: "Languages", label_ar: "اللغات", type: "textarea", required: false },
        { key: "certifications", label_en: "Certifications", label_ar: "الشهادات", type: "textarea", required: false },
        FIELD_RAW("Paste achievements, responsibilities, and extra details", "الصق الإنجازات والمسؤوليات والتفاصيل الإضافية", false),
      ],
    },
    search_aliases: ["resume", "cv", "career", "job", "student cv", "graduate", "سيرة", "وظيفة"],
  },
];

export function findTheme(id: string): A4Theme | null {
  return A4_THEMES.find((t) => t.id === id) ?? null;
}

export function getFormSchema(theme: A4Theme, purposeId: string | null): A4FormField[] {
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

const BASIC_FIELD_KEYS_BY_THEME: Record<string, string[]> = {
  official_exam: [
    "institution_name",
    "education_level",
    "subject",
    "teacher_name",
    "grade",
    "term",
    "duration",
    "total_marks",
    "instructions",
    "logo",
    "bilingual",
    "raw_content",
  ],
  school_project: [
    "institution_name",
    "education_level",
    "student_name",
    "student_id",
    "grade",
    "department_or_faculty",
    "subject",
    "teacher_or_supervisor",
    "submission_date",
    "project_title",
    "logo",
    "bilingual",
    "raw_content",
  ],
  academic_report: [
    "institution_name",
    "department_or_faculty",
    "course_name",
    "student_name",
    "student_id",
    "instructor_name",
    "supervisor_name",
    "year_or_semester",
    "submission_date",
    "title",
    "logo",
    "bilingual",
    "raw_content",
  ],
  study_handout: [
    "topic",
    "course_name",
    "teacher_name",
    "grade",
    "education_level",
    "focus_area",
    "session_title",
    "exam_scope",
    "formula_focus",
    "logo",
    "bilingual",
    "raw_content",
  ],
  research_poster: [
    "poster_title",
    "institution_name",
    "department_or_faculty",
    "authors",
    "supervisor_name",
    "conference_name",
    "event_name",
    "logo",
    "bilingual",
    "raw_content",
  ],
  corporate_brief: [
    "company_name",
    "department",
    "client_name",
    "report_title",
    "period",
    "author",
    "doc_ref",
    "logo",
    "bilingual",
    "raw_content",
  ],
  certificate: [
    "issuer_name",
    "recipient_name",
    "achievement",
    "issue_date",
    "signatory_name",
    "signatory_title",
    "certificate_title",
    "program_name",
    "category_or_reason",
    "logo",
    "bilingual",
  ],
  event_flyer: [
    "event_name",
    "date",
    "time",
    "venue",
    "tagline",
    "description",
    "cta",
    "headline_image",
    "logo",
    "bilingual",
  ],
  craft_infographic: [
    "topic",
    "institution_name",
    "student_name",
    "grade",
    "subject",
    "teacher_or_supervisor",
    "company_name",
    "department",
    "audience",
    "logo",
    "bilingual",
    "raw_content",
  ],
  comic_explainer: [
    "title",
    "panel_count",
    "raw_content",
    "logo",
  ],
  clean_minimal: [
    "title",
    "subtitle",
    "author",
    "date",
    "sender_name",
    "recipient_name",
    "subject",
    "issuer",
    "event_name",
    "venue",
    "cta",
    "logo",
    "bilingual",
    "raw_content",
  ],
  invoice_receipt: [
    "company_name",
    "client_name",
    "invoice_number",
    "receipt_number",
    "issue_date",
    "due_date",
    "paid_method",
    "currency",
    "payment_terms",
    "logo",
    "bilingual",
    "raw_content",
  ],
  menu_price_list: [
    "business_name",
    "subtitle",
    "currency",
    "contact_info",
    "working_hours",
    "logo",
    "bilingual",
    "raw_content",
  ],
  thank_you_invitation_card: [
    "sender_name",
    "recipient_name",
    "card_title",
    "date",
    "host_name",
    "event_name",
    "event_date",
    "time",
    "venue",
    "dress_code",
    "rsvp",
    "logo",
    "bilingual",
    "raw_content",
  ],
  resume_cv: [
    "full_name",
    "desired_role",
    "email",
    "phone",
    "location",
    "website",
    "linkedin",
    "summary",
    "education",
    "experience",
    "skills",
    "languages",
    "certifications",
    "logo",
    "bilingual",
    "raw_content",
  ],
};

export function isBasicFieldForTheme(
  themeId: string,
  fieldKey: string,
): boolean {
  const keys = BASIC_FIELD_KEYS_BY_THEME[themeId];
  if (!keys) return true;
  return keys.includes(fieldKey);
}

export function searchThemes(query: string): A4Theme[] {
  const q = query.trim().toLowerCase();
  if (!q) return A4_THEMES;
  return A4_THEMES.filter((t) => {
    if (t.name_en.toLowerCase().includes(q) || t.name_ar.includes(q)) return true;
    return (t.search_aliases ?? []).some((a) => a.toLowerCase().includes(q));
  });
}
