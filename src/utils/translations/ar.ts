import { commonAr } from "./modules/ar/common";
import { authAr } from "./modules/ar/auth";
import { navigationAr } from "./modules/ar/navigation";
import { tasksAr } from "./modules/ar/tasks";
import { remindersAr } from "./modules/ar/reminders";
import { dashboardAr } from "./modules/ar/dashboard";
import { timeAr } from "./modules/ar/time";
import { statusAr } from "./modules/ar/status";
import { formsAr } from "./modules/ar/forms";
import { settingsAr } from "./modules/ar/settings";
import { contactsAr } from "./modules/ar/contacts";

// Arabic translations for WAKTI app
export const ar = {
  ...commonAr,
  ...authAr,
  ...navigationAr,
  ...tasksAr,
  ...remindersAr,
  ...dashboardAr,
  ...timeAr,
  ...statusAr,
  ...formsAr,
  ...settingsAr,
  ...contactsAr,
  
  // Additional specific translations
  blocked: "محظور",
  unblock: "إلغاء الحظر",
  contact: "جهة اتصال",
  username: "اسم المستخدم",
  updatePassword: "تحديث كلمة المرور",
  
  // Event specific
  eventTitle: "عنوان الحدث",
  eventDescription: "وصف الحدث",
  eventDate: "تاريخ الحدث",
  eventTime: "وقت الحدث",
  eventLocation: "موقع الحدث",
  addEvent: "إضافة حدث",
  editEvent: "تعديل الحدث",
  deleteEvent: "حذف الحدث",
  noEvents: "لا توجد أحداث",
  noEventsYet: "لا توجد أحداث بعد",
  createEvent: "إنشاء حدث",
  
  // Account specific
  dateOfBirth: "تاريخ الميلاد",
  updateDateOfBirth: "تحديث تاريخ الميلاد",
  updateEmail: "تحديث البريد الإلكتروني",
  
  // Additional missing keys for complete coverage
  all: "الكل",
  none: "لا شيء",
  some: "بعض",
  many: "كثير",
  few: "قليل",
  most: "معظم",
  least: "الأقل",
  first: "الأول",
  last: "الأخير",
  latest: "الأحدث",
  oldest: "الأقدم",
  newest: "الأجدد",
  recent: "حديث",
  old: "قديم",
  new: "جديد",
  updated: "محدث",
  created: "منشأ",
  modified: "معدل",
  deleted: "محذوف",
  added: "مضاف",
  removed: "مزال",
  changed: "متغير",
  unchanged: "غير متغير",
  saved: "محفوظ",
  unsaved: "غير محفوظ",
  synced: "متزامن",
  unsynced: "غير متزامن",
  connected: "متصل",
  disconnected: "منقطع",
  secure: "آمن",
  insecure: "غير آمن",
  verified: "موثق",
  unverified: "غير موثق",
  valid: "صالح",
  invalid: "غير صالح",
  required: "مطلوب",
  optional: "اختياري",
  recommended: "موصى به",
  
  // Numbers
  zero: "صفر",
  one: "واحد",
  two: "اثنان",
  three: "ثلاثة",
  four: "أربعة",
  five: "خمسة",
  six: "ستة",
  seven: "سبعة",
  eight: "ثمانية",
  nine: "تسعة",
  ten: "عشرة",
  
  // Frequency
  never: "أبداً",
  always: "دائماً",
  sometimes: "أحياناً",
  often: "غالباً",
  rarely: "نادراً"
};
