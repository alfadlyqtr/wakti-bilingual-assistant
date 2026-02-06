
type FieldKind = 'text' | 'textarea' | 'date';

type FieldSchema = {
  id: string;
  path: string;
  kind: FieldKind;
  required?: boolean;
  labelEn: string;
  labelAr: string;
  placeholderEn?: string;
  placeholderAr?: string;
  notesEn?: string;
  notesAr?: string;
};

type ActionSchema = {
  id: string;
  labelEn: string;
  labelAr: string;
  kind: 'openDialog' | 'save' | 'cancel' | 'delete';
};

export const CALENDAR_ADD_ENTRY_SCHEMA = {
  id: 'calendar.manual_note.v1',
  version: 1,

  entity: {
    type: 'manual_note',
    storage: 'local',
    dateStorageFormat: 'yyyy-MM-dd',
  },

  fields: [
    {
      id: 'title',
      path: 'entry.title',
      kind: 'text',
      required: true,
      labelEn: 'Title',
      labelAr: 'العنوان',
      placeholderEn: 'Enter title...',
      placeholderAr: 'أدخل العنوان...',
    },
    {
      id: 'date',
      path: 'entry.date',
      kind: 'date',
      required: true,
      labelEn: 'Date',
      labelAr: 'التاريخ',
      notesEn: "Must be stored as local day string 'yyyy-MM-dd' (prevents timezone shifting).",
      notesAr: "يجب حفظه كتاريخ محلي بصيغة 'yyyy-MM-dd' لتجنب تغيير اليوم بسبب المنطقة الزمنية.",
    },
    {
      id: 'description',
      path: 'entry.description',
      kind: 'textarea',
      required: false,
      labelEn: 'Description',
      labelAr: 'الوصف',
      placeholderEn: 'Enter description...',
      placeholderAr: 'أدخل الوصف...',
    },
  ] as FieldSchema[],

  actions: [
    { id: 'open', labelEn: 'Create Note', labelAr: 'إنشاء ملاحظة', kind: 'openDialog' },
    { id: 'save', labelEn: 'Save', labelAr: 'حفظ', kind: 'save' },
    { id: 'cancel', labelEn: 'Cancel', labelAr: 'إلغاء', kind: 'cancel' },
    { id: 'delete', labelEn: 'Delete', labelAr: 'حذف', kind: 'delete' },
  ] as ActionSchema[],
} as const;
