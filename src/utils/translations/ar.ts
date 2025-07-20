import { authAr } from "./modules/ar/auth";
import { commonAr } from "./modules/ar/common";
import { navigationAr } from "./modules/ar/navigation";
import { formsAr } from "./modules/ar/forms";
import { dashboardAr } from "./modules/ar/dashboard";
import { tasksAr } from "./modules/ar/tasks";
import { remindersAr } from "./modules/ar/reminders";
import { eventsAr } from "./modules/ar/events";
import { contactsAr } from "./modules/ar/contacts";
import { settingsAr } from "./modules/ar/settings";
import { accountAr } from "./modules/ar/account";
import { statusAr } from "./modules/ar/status";
import { timeAr } from "./modules/ar/time";
import { feedbackAr } from "./modules/ar/feedback";
import { rsvpAr } from "./modules/ar/rsvp";
import { miscAr } from "./modules/ar/misc";
import { helpAr } from "./modules/ar/help";
import { legal as legalAr } from "./modules/ar/legal";
import { billingAr } from "./modules/ar/billing";
import { confirmationAr } from "./modules/ar/confirmation";
import { gamesAr } from "./modules/ar/games";
import { weatherAr } from "./modules/ar/weather";

export const ar = {
  ...commonAr,
  ...authAr,
  ...navigationAr,
  ...formsAr,
  ...dashboardAr,
  ...tasksAr,
  ...remindersAr,
  ...eventsAr,
  ...contactsAr,
  ...settingsAr,
  ...accountAr,
  ...statusAr,
  ...timeAr,
  ...feedbackAr,
  ...rsvpAr,
  ...miscAr,
  ...helpAr,
  ...legalAr,
  ...billingAr,
  ...confirmationAr,
  ...gamesAr,
  ...weatherAr,
  
  // Additional TR specific translations
  manageTasksAndResponsibilities: "إدارة مهامك ومسؤولياتك",
  searchTasks: "البحث في المهام...",
  sharedTasks: "المهام المشتركة",
  myTasks: "مهامي",
  noTasksFound: "لم يتم العثور على مهام",
  noTasksYet: "لا توجد مهام بعد",
  createFirstTask: "إنشاء أول مهمة لك",
  
  // NEW MISSING MAW3D KEYS
  createAndManageEvents: "إنشاء وإدارة فعالياتك",
  searchEvents: "البحث في الفعاليات...",
  
  // MISSING CONVERSATION SIDEBAR KEYS
  conversations: "المحادثات",
  new_conversation: "محادثة جديدة",
  no_conversations: "لا توجد محادثات",
};
