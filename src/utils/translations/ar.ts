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
import { legalAr } from "./modules/ar/legal";
import { billingAr } from "./modules/ar/billing";

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
};
