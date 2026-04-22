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
    name_en: "Official School Exam",
    name_ar: "اختبار مدرسي رسمي",
    aspect_ratio: "2:3",
    max_pages: 3,
    form_schema: [
      { key: "school_name", label_en: "School Name", label_ar: "اسم المدرسة", type: "text", required: true },
      { key: "subject", label_en: "Subject", label_ar: "المادة", type: "text", required: true },
      { key: "grade", label_en: "Grade / Class", label_ar: "الصف", type: "text", required: true },
      { key: "term", label_en: "Term / Semester", label_ar: "الفصل الدراسي", type: "text" },
      { key: "duration", label_en: "Duration (minutes)", label_ar: "المدة (دقائق)", type: "number" },
      { key: "total_marks", label_en: "Total Marks", label_ar: "الدرجة الكلية", type: "number" },
      FIELD_LOGO,
      FIELD_BILINGUAL,
      { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: false },
      { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
      { key: "include_grading_circle", label_en: "Grading Circle", label_ar: "دائرة الدرجة", type: "toggle", default: true },
      FIELD_RAW("Paste your questions here", "الصق الأسئلة هنا"),
    ],
    search_aliases: ["exam", "test", "quiz", "امتحان", "اختبار"],
  },

  {
    id: "school_project",
    name_en: "School Project / Essay",
    name_ar: "مشروع مدرسي / مقال",
    aspect_ratio: "2:3",
    max_pages: 3,
    form_schema: [
      { key: "school_name", label_en: "School Name", label_ar: "اسم المدرسة", type: "text" },
      { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text", required: true },
      { key: "grade", label_en: "Grade / Class", label_ar: "الصف", type: "text" },
      { key: "subject", label_en: "Subject", label_ar: "المادة", type: "text" },
      { key: "project_title", label_en: "Project Title", label_ar: "عنوان المشروع", type: "text", required: true },
      { key: "submission_date", label_en: "Submission Date", label_ar: "تاريخ التسليم", type: "date" },
      FIELD_LOGO,
      FIELD_BILINGUAL,
      { key: "include_diagram", label_en: "Include Diagram", label_ar: "تضمين رسم توضيحي", type: "toggle", default: true },
      { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: false },
      FIELD_RAW("Paste your project / essay content", "الصق محتوى المشروع"),
    ],
    search_aliases: ["project", "essay", "homework", "مقال", "مشروع"],
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
        { key: "company_name", label_en: "Company Name", label_ar: "اسم الشركة", type: "text", required: true },
        { key: "department", label_en: "Department", label_ar: "القسم", type: "text" },
        { key: "report_title", label_en: "Report Title", label_ar: "عنوان التقرير", type: "text", required: true },
        { key: "period", label_en: "Period (e.g. Q1 2026)", label_ar: "الفترة", type: "text" },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text" },
        { key: "doc_ref", label_en: "Reference Code", label_ar: "رقم المرجع", type: "text" },
        FIELD_LOGO,
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: true },
        FIELD_BILINGUAL,
        FIELD_RAW("Paste your report content", "الصق محتوى التقرير"),
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
        FIELD_RAW("Paste your board-level content", "الصق محتوى مجلس الإدارة"),
      ],
      client: [
        { key: "company_name", label_en: "Your Company", label_ar: "شركتك", type: "text", required: true },
        { key: "client_name", label_en: "Client Name", label_ar: "اسم العميل", type: "text", required: true },
        { key: "report_title", label_en: "Document Title", label_ar: "عنوان المستند", type: "text", required: true },
        { key: "period", label_en: "Period", label_ar: "الفترة", type: "text" },
        { key: "author", label_en: "Prepared By", label_ar: "إعداد", type: "text" },
        FIELD_LOGO,
        { key: "include_chart", label_en: "Include Chart", label_ar: "تضمين رسم بياني", type: "toggle", default: true },
        { key: "include_table", label_en: "Include Table", label_ar: "تضمين جدول", type: "toggle", default: false },
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
      { id: "school", label_en: "School", label_ar: "مدرسي" },
      { id: "work", label_en: "Work", label_ar: "عمل" },
      { id: "personal", label_en: "Personal", label_ar: "شخصي" },
    ],
    form_schema_common: [
      { key: "issuer_name", label_en: "Issuing Organization", label_ar: "الجهة المانحة", type: "text", required: true },
      { key: "recipient_name", label_en: "Recipient Name", label_ar: "اسم المستلم", type: "text", required: true },
      { key: "achievement", label_en: "Achievement / Reason", label_ar: "الإنجاز", type: "text", required: true },
      { key: "issue_date", label_en: "Date", label_ar: "التاريخ", type: "date", required: true },
      { key: "signatory_name", label_en: "Signatory Name", label_ar: "اسم الموقع", type: "text" },
      { key: "signatory_title", label_en: "Signatory Title", label_ar: "المسمى الوظيفي", type: "text" },
      { key: "logo", label_en: "Logo / Seal", label_ar: "الشعار / الختم", type: "image" },
      FIELD_BILINGUAL,
    ],
    search_aliases: ["certificate", "diploma", "award", "شهادة"],
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
      { key: "event_name", label_en: "Event Name", label_ar: "اسم الفعالية", type: "text", required: true },
      { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: true },
      { key: "time", label_en: "Time", label_ar: "الوقت", type: "text", required: true },
      { key: "venue", label_en: "Venue / Location", label_ar: "المكان", type: "text", required: true },
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
    name_en: "Craft Infographic",
    name_ar: "إنفوجرافيك يدوي",
    aspect_ratio: "2:3",
    max_pages: 3,
    purpose_chips: [
      { id: "school", label_en: "School Project", label_ar: "مشروع مدرسي" },
      { id: "work", label_en: "Work", label_ar: "عمل" },
      { id: "personal", label_en: "Personal", label_ar: "شخصي" },
    ],
    form_schema_by_purpose: {
      school: [
        { key: "school_name", label_en: "School Name", label_ar: "اسم المدرسة", type: "text" },
        { key: "student_name", label_en: "Student Name", label_ar: "اسم الطالب", type: "text" },
        { key: "subject", label_en: "Subject", label_ar: "المادة", type: "text" },
        { key: "topic", label_en: "Topic", label_ar: "الموضوع", type: "text", required: true },
        FIELD_BILINGUAL,
        FIELD_RAW("Explain the topic in your own words", "اشرح الموضوع بأسلوبك"),
      ],
      work: [
        { key: "company_name", label_en: "Company", label_ar: "الشركة", type: "text" },
        { key: "department", label_en: "Department / Team", label_ar: "القسم / الفريق", type: "text" },
        { key: "audience", label_en: "Audience", label_ar: "الجمهور", type: "text" },
        { key: "topic", label_en: "Topic / Message", label_ar: "الموضوع / الرسالة", type: "text", required: true },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Key points to explain", "النقاط الرئيسية"),
      ],
      personal: [
        { key: "topic", label_en: "Topic / Title", label_ar: "العنوان", type: "text", required: true },
        FIELD_BILINGUAL,
        FIELD_RAW("Content", "المحتوى"),
      ],
    },
    search_aliases: ["infographic", "craft", "إنفوجرافيك"],
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
      { key: "title", label_en: "Overall Title", label_ar: "العنوان الرئيسي", type: "text", required: true },
      { key: "panel_count", label_en: "Number of Panels", label_ar: "عدد اللوحات", type: "select", options: [3, 4], default: 3, required: true },
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
        { key: "title", label_en: "Title", label_ar: "العنوان", type: "text", required: true },
        { key: "subtitle", label_en: "Subtitle", label_ar: "العنوان الفرعي", type: "text" },
        { key: "author", label_en: "Author / Org", label_ar: "المؤلف / الجهة", type: "text" },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Content", "المحتوى"),
      ],
      letter: [
        { key: "sender_name", label_en: "Sender (You / Org)", label_ar: "اسم المرسل", type: "text", required: true },
        { key: "recipient_name", label_en: "Recipient", label_ar: "المستلم", type: "text", required: true },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text", required: true },
        { key: "subject", label_en: "Subject", label_ar: "الموضوع", type: "text", required: true },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Letter body", "نص الخطاب"),
      ],
      notice: [
        { key: "title", label_en: "Notice Title", label_ar: "عنوان الإعلان", type: "text", required: true },
        { key: "issuer", label_en: "Issued By", label_ar: "جهة الإصدار", type: "text" },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Notice body", "نص الإعلان"),
      ],
      flyer: [
        { key: "event_name", label_en: "Headline / Event", label_ar: "العنوان / الفعالية", type: "text", required: true },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text" },
        { key: "venue", label_en: "Venue", label_ar: "المكان", type: "text" },
        { key: "cta", label_en: "Call to Action", label_ar: "الدعوة للتفاعل", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Short description", "وصف قصير", false),
      ],
      anything: [
        { key: "title", label_en: "Title", label_ar: "العنوان", type: "text", required: true },
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
        { key: "company_name", label_en: "Business Name", label_ar: "اسم النشاط", type: "text", required: true },
        { key: "client_name", label_en: "Bill To", label_ar: "الفاتورة إلى", type: "text", required: true },
        { key: "invoice_number", label_en: "Invoice Number", label_ar: "رقم الفاتورة", type: "text", required: true },
        { key: "issue_date", label_en: "Issue Date", label_ar: "تاريخ الإصدار", type: "date", required: true },
        { key: "due_date", label_en: "Due Date", label_ar: "تاريخ الاستحقاق", type: "date" },
        { key: "currency", label_en: "Currency", label_ar: "العملة", type: "text" },
        { key: "payment_terms", label_en: "Payment Terms", label_ar: "شروط الدفع", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        { key: "include_table", label_en: "Include Items Table", label_ar: "تضمين جدول العناصر", type: "toggle", default: true },
        FIELD_RAW("Paste line items, subtotal, tax, and notes", "الصق العناصر والمجموع والضريبة والملاحظات"),
      ],
      receipt: [
        { key: "company_name", label_en: "Business Name", label_ar: "اسم النشاط", type: "text", required: true },
        { key: "client_name", label_en: "Customer Name", label_ar: "اسم العميل", type: "text" },
        { key: "receipt_number", label_en: "Receipt Number", label_ar: "رقم الإيصال", type: "text", required: true },
        { key: "issue_date", label_en: "Date", label_ar: "التاريخ", type: "date", required: true },
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
      { key: "business_name", label_en: "Business Name", label_ar: "اسم النشاط", type: "text", required: true },
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
        { key: "sender_name", label_en: "From", label_ar: "من", type: "text", required: true },
        { key: "recipient_name", label_en: "To", label_ar: "إلى", type: "text" },
        { key: "card_title", label_en: "Card Title", label_ar: "عنوان البطاقة", type: "text" },
        { key: "date", label_en: "Date", label_ar: "التاريخ", type: "text" },
        FIELD_LOGO,
        FIELD_BILINGUAL,
        FIELD_RAW("Write your thank-you message", "اكتب رسالة الشكر"),
      ],
      invitation: [
        { key: "host_name", label_en: "Host / Organizer", label_ar: "المضيف / الجهة المنظمة", type: "text", required: true },
        { key: "event_name", label_en: "Event Name", label_ar: "اسم المناسبة", type: "text", required: true },
        { key: "event_date", label_en: "Event Date", label_ar: "تاريخ المناسبة", type: "text", required: true },
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
    form_schema: [
      { key: "full_name", label_en: "Full Name", label_ar: "الاسم الكامل", type: "text", required: true },
      { key: "desired_role", label_en: "Job Title / Role", label_ar: "المسمى الوظيفي", type: "text", required: true },
      { key: "email", label_en: "Email", label_ar: "البريد الإلكتروني", type: "text" },
      { key: "phone", label_en: "Phone", label_ar: "الهاتف", type: "text" },
      { key: "location", label_en: "Location", label_ar: "الموقع", type: "text" },
      { key: "website", label_en: "Website / Portfolio", label_ar: "الموقع / معرض الأعمال", type: "text" },
      { key: "linkedin", label_en: "LinkedIn", label_ar: "لينكدإن", type: "text" },
      FIELD_LOGO,
      FIELD_BILINGUAL,
      FIELD_RAW("Paste your summary, experience, education, skills, and certifications", "الصق الملخص والخبرة والتعليم والمهارات والشهادات"),
    ],
    search_aliases: ["resume", "cv", "career", "job", "سيرة", "وظيفة"],
  },
];

export function findTheme(id: string): A4Theme | null {
  return A4_THEMES.find((t) => t.id === id) ?? null;
}

export function getFormSchema(theme: A4Theme, purposeId: string | null): A4FormField[] {
  if (theme.form_schema) return theme.form_schema;
  if (theme.form_schema_common) return theme.form_schema_common;
  if (theme.form_schema_by_purpose && purposeId) {
    return theme.form_schema_by_purpose[purposeId] ?? [];
  }
  return [];
}

export function themeRequiresPurpose(theme: A4Theme): boolean {
  return !!theme.purpose_chips && !theme.form_schema_common && !theme.form_schema;
}

export function searchThemes(query: string): A4Theme[] {
  const q = query.trim().toLowerCase();
  if (!q) return A4_THEMES;
  return A4_THEMES.filter((t) => {
    if (t.name_en.toLowerCase().includes(q) || t.name_ar.includes(q)) return true;
    return (t.search_aliases ?? []).some((a) => a.toLowerCase().includes(q));
  });
}
