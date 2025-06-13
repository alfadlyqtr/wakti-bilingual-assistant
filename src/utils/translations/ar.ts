
import { commonAr } from "./modules/ar/common";
import { authAr } from "./modules/ar/auth";
import { navigationAr } from "./modules/ar/navigation";
import { tasksAr } from "./modules/ar/tasks";
import { remindersAr } from "./modules/ar/reminders";
import { eventsAr } from "./modules/ar/events";
import { rsvpAr } from "./modules/ar/rsvp";
import { contactsAr } from "./modules/ar/contacts";
import { settingsAr } from "./modules/ar/settings";
import { accountAr } from "./modules/ar/account";
import { dashboardAr } from "./modules/ar/dashboard";
import { timeAr } from "./modules/ar/time";
import { statusAr } from "./modules/ar/status";
import { formsAr } from "./modules/ar/forms";
import { feedbackAr } from "./modules/ar/feedback";
import { legalAr } from "./modules/ar/legal";
import { miscAr } from "./modules/ar/misc";

// Arabic translations for WAKTI app
export const ar = {
  ...commonAr,
  ...authAr,
  ...navigationAr,
  ...tasksAr,
  ...remindersAr,
  ...eventsAr,
  ...rsvpAr,
  ...contactsAr,
  ...settingsAr,
  ...accountAr,
  ...dashboardAr,
  ...timeAr,
  ...statusAr,
  ...formsAr,
  ...feedbackAr,
  ...legalAr,
  ...miscAr,
  
  // Additional specific translations that might still be needed
  blocked: "محظور",
  unblock: "إلغاء الحظر",
  contact: "جهة اتصال",
  username: "اسم المستخدم",
  updatePassword: "تحديث كلمة المرور",
  
  // Missing keys from build errors
  loadingTasks: "جاري تحميل المهام...",
  loadingReminders: "جاري تحميل التذكيرات...",
  errorLoadingReminders: "خطأ في تحميل التذكيرات",
  errorSnoozing: "فشل في تأجيل التذكير",
  errorDeleting: "فشل في حذف التذكير",
  confirmDeleteReminder: "هل أنت متأكد من أنك تريد حذف هذا التذكير؟",
  snoozeReminder: "تأجيل التذكير ليوم واحد",
  errorUpdatingTask: "خطأ في تحديث المهمة",
  taskSnoozedUntilTomorrow: "تم تأجيل المهمة حتى الغد",
  errorSnoozingTask: "خطأ في تأجيل المهمة",
  confirmDeleteTask: "هل أنت متأكد من أنك تريد حذف هذه المهمة؟",
  errorDeletingTask: "خطأ في حذف المهمة",
  errorCopyingLink: "خطأ في نسخ الرابط",
  dueOn: "مستحق في",
  hideSubtasks: "إخفاء المهام الفرعية",
  showSubtasks: "إظهار المهام الفرعية"
};
