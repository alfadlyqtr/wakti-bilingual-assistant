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
import { weather } from "./modules/weather";

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
  ...weather,
  
  // Additional TR specific translations
  manageTasksAndResponsibilities: "Manage your tasks and responsibilities",
  searchTasks: "Search tasks...",
  sharedTasks: "Shared Tasks",
  myTasks: "My Tasks",
  noTasksFound: "No tasks found",
  noTasksYet: "No tasks yet",
  createFirstTask: "Create your first task",
  
  // NEW MISSING MAW3D KEYS
  createAndManageEvents: "Create and manage your events",
  searchEvents: "Search events...",
  
  // MISSING CONVERSATION SIDEBAR KEYS
  conversations: "Conversations",
  new_conversation: "New Conversation",
  no_conversations: "No conversations",
};
