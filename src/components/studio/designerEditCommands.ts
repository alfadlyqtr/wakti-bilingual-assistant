import type { PlannerLanguage } from './designerAiPlanner';

export type DesignerEditCommand =
  | { kind: 'remove-wall' }
  | { kind: 'remove-opening' }
  | { kind: 'add-wall' }
  | { kind: 'add-room' }
  | { kind: 'add-beam' }
  | { kind: 'add-column' }
  | { kind: 'add-window' }
  | { kind: 'add-door' }
  | { kind: 'add-opening' }
  | { kind: 'rename-room'; nextName: string; roomHint?: string }
  | { kind: 'clear-plan' }
  | { kind: 'undo' };

const has = (text: string, terms: string[]) => terms.some((term) => text.includes(term));

const REMOVE_TERMS = ['remove', 'delete', 'erase', 'take out', 'get rid of', 'احذف', 'امسح', 'ازل', 'أزل', 'شيل'];
const ADD_TERMS = ['add', 'place', 'put', 'insert', 'create', 'draw', 'اضف', 'أضف', 'ضع', 'ارسم', 'انشئ', 'أنشئ'];

const WALL_TERMS = ['wall', 'partition', 'جدار', 'حائط', 'قاطع'];
const BEAM_TERMS = ['beam', 'كمرة', 'جسر'];
const COLUMN_TERMS = ['column', 'pole', 'pillar', 'post', 'عمود', 'سترة'];
const WINDOW_TERMS = ['window', 'نافذة', 'شباك'];
const DOOR_TERMS = ['door', 'باب'];
const OPENING_TERMS = ['opening', 'open gap', 'gap', 'archway', 'arch', 'فتحة', 'مدخل مفتوح'];
const ROOM_TERMS = ['room', 'space', 'غرفة', 'مساحة'];

const RENAME_TERMS = ['rename', 'call it', 'name it', 'label it', 'change the name', 'سمّ', 'سم ', 'اسم', 'غير الاسم', 'غيّر الاسم'];
const CLEAR_TERMS = ['clear the plan', 'clear plan', 'start over', 'reset the plan', 'delete everything', 'امسح كل شيء', 'ابدأ من جديد', 'مسح المخطط'];
const UNDO_TERMS = ['undo', 'revert', 'go back one step', 'تراجع', 'ارجع خطوة'];

const extractRenameTarget = (raw: string): { nextName: string; roomHint?: string } | null => {
  const quoted = raw.match(/["'“”«]([^"'“”»]{1,40})["'“”»]/);
  if (quoted?.[1]) {
    const before = raw.slice(0, quoted.index || 0).toLowerCase();
    const hintMatch = before.match(/(?:rename|label|name)\s+(?:the\s+)?([a-z\u0600-\u06ff\s]{2,24}?)\s+(?:to|as)\s*$/);
    return { nextName: quoted[1].trim(), roomHint: hintMatch?.[1]?.trim() };
  }
  const pattern = raw.match(/(?:rename|label|name|call)\s+(?:the\s+)?([a-z\u0600-\u06ff\s]{2,24}?)\s+(?:to|as)\s+([^.,\n]{1,40})/i);
  if (pattern?.[2]) {
    return { nextName: pattern[2].trim(), roomHint: pattern[1].trim() };
  }
  const arabic = raw.match(/(?:سم|سمّ|غير اسم|غيّر اسم)\s+([\u0600-\u06ff\s]{2,24}?)\s+(?:الى|إلى)\s+([^.,\n]{1,40})/);
  if (arabic?.[2]) {
    return { nextName: arabic[2].trim(), roomHint: arabic[1].trim() };
  }
  return null;
};

export const parseDesignerEditCommand = (
  rawText: string,
  _language: PlannerLanguage,
): DesignerEditCommand | null => {
  const raw = rawText.trim();
  if (!raw) return null;
  const text = raw.toLowerCase();

  if (has(text, CLEAR_TERMS)) return { kind: 'clear-plan' };
  if (has(text, UNDO_TERMS)) return { kind: 'undo' };

  if (has(text, RENAME_TERMS)) {
    const rename = extractRenameTarget(raw);
    if (rename) return { kind: 'rename-room', nextName: rename.nextName, roomHint: rename.roomHint };
  }

  const wantsRemove = has(text, REMOVE_TERMS);
  const wantsAdd = has(text, ADD_TERMS);

  if (wantsRemove) {
    if (has(text, WINDOW_TERMS) || has(text, DOOR_TERMS) || has(text, OPENING_TERMS)) return { kind: 'remove-opening' };
    if (has(text, WALL_TERMS) || has(text, BEAM_TERMS) || has(text, COLUMN_TERMS)) return { kind: 'remove-wall' };
  }

  if (wantsAdd) {
    if (has(text, COLUMN_TERMS)) return { kind: 'add-column' };
    if (has(text, BEAM_TERMS)) return { kind: 'add-beam' };
    if (has(text, WINDOW_TERMS)) return { kind: 'add-window' };
    if (has(text, DOOR_TERMS)) return { kind: 'add-door' };
    if (has(text, OPENING_TERMS)) return { kind: 'add-opening' };
    if (has(text, ROOM_TERMS) && !has(text, WALL_TERMS)) return { kind: 'add-room' };
    if (has(text, WALL_TERMS)) return { kind: 'add-wall' };
  }

  return null;
};

export const describeEditCommand = (
  command: DesignerEditCommand,
  language: PlannerLanguage,
  context: { didApply: boolean; detail?: string },
): string => {
  const isArabic = language === 'ar';
  if (context.detail) return context.detail;

  switch (command.kind) {
    case 'remove-wall':
      return context.didApply
        ? (isArabic ? 'حذفت الجدار المحدد.' : 'I removed the selected wall.')
        : (isArabic ? 'اختر الجدار على اللوحة أولًا، ثم اطلب حذفه.' : 'Select the wall on the canvas first, then ask me to remove it.');
    case 'remove-opening':
      return context.didApply
        ? (isArabic ? 'حذفت الفتحة المحددة.' : 'I removed the selected opening.')
        : (isArabic ? 'اختر الباب أو النافذة أولًا، ثم اطلب حذفه.' : 'Select the door or window first, then ask me to remove it.');
    case 'add-column':
      return isArabic ? 'أضفت عمودًا كعنصر كمرة قصير، ويمكنك سحبه لمكانه.' : 'I added a column as a short beam marker, and you can drag it into place.';
    case 'add-beam':
      return isArabic ? 'فعّلت أداة الكمرة، ارسمها على اللوحة.' : 'I switched on the beam tool, draw it on the canvas.';
    case 'add-window':
      return context.didApply
        ? (isArabic ? 'أضفت نافذة على الجدار المحدد.' : 'I added a window on the selected wall.')
        : (isArabic ? 'فعّلت أداة النافذة، اضغط على الجدار المطلوب.' : 'I switched on the window tool, click the wall you want.');
    case 'add-door':
      return context.didApply
        ? (isArabic ? 'أضفت بابًا على الجدار المحدد.' : 'I added a door on the selected wall.')
        : (isArabic ? 'فعّلت أداة الباب، اضغط على الجدار المطلوب.' : 'I switched on the door tool, click the wall you want.');
    case 'add-opening':
      return context.didApply
        ? (isArabic ? 'أضفت فتحة على الجدار المحدد.' : 'I added an opening on the selected wall.')
        : (isArabic ? 'فعّلت أداة الفتحة، اضغط على الجدار المطلوب.' : 'I switched on the opening tool, click the wall you want.');
    case 'add-wall':
      return isArabic ? 'فعّلت أداة الجدار، ارسمه على اللوحة.' : 'I switched on the wall tool, draw it on the canvas.';
    case 'add-room':
      return isArabic ? 'فعّلت أداة الغرفة، اسحب مستطيلًا على اللوحة.' : 'I switched on the room tool, drag a rectangle on the canvas.';
    case 'rename-room':
      return context.didApply
        ? (isArabic ? `غيّرت الاسم إلى ${command.nextName}.` : `I renamed it to ${command.nextName}.`)
        : (isArabic ? 'لم أجد الغرفة المطلوبة، اختر اسمها من اللوحة وحاول مرة أخرى.' : 'I could not find that room, select its label on the canvas and try again.');
    case 'clear-plan':
      return isArabic ? 'مسحت المخطط بالكامل.' : 'I cleared the whole plan.';
    case 'undo':
      return context.didApply
        ? (isArabic ? 'رجعت خطوة واحدة.' : 'I stepped back one change.')
        : (isArabic ? 'لا يوجد شيء للتراجع عنه.' : 'There is nothing to undo.');
    default:
      return isArabic ? 'نفذت طلبك.' : 'Done.';
  }
};
