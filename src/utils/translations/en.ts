import { auth } from "./modules/auth";
import { common } from "./modules/common";
import { navigation } from "./modules/navigation";
import { forms } from "./modules/forms";
import { dashboard } from "./modules/dashboard";
import { tasks } from "./modules/tasks";
import { reminders } from "./modules/reminders";
import { events } from "./modules/events";
import { contacts } from "./modules/contacts";
import { settings } from "./modules/settings";
import { account } from "./modules/account";
import { status } from "./modules/status";
import { time } from "./modules/time";
import { feedback } from "./modules/feedback";
import { rsvp } from "./modules/rsvp";
import { misc } from "./modules/misc";
import { help } from "./modules/help";
import { legal } from "./modules/legal";
import { billing } from "./modules/billing";
import { confirmation } from "./modules/confirmation";
import { games } from "./modules/games";

export const en = {
  ...common,
  ...auth,
  ...navigation,
  ...forms,
  ...dashboard,
  ...tasks,
  ...reminders,
  ...events,
  ...contacts,
  ...settings,
  ...account,
  ...status,
  ...time,
  ...feedback,
  ...rsvp,
  ...misc,
  ...help,
  ...legal,
  ...billing,
  ...confirmation,
  ...games,
};
