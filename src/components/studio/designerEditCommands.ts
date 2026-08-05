import type { PlannerLanguage } from './designerAiPlanner';
import { FURNITURE_SYMBOLS, type FurnitureSymbol } from './floorPlanFurniture';
import type { PlacedItem } from './LayoutFurniture';

export type DesignerMoveTarget =
  | { type: 'window' }
  | { type: 'door' }
  | { type: 'wall' }
  | { type: 'item'; itemHint: string }
  | { type: 'room'; roomHint: string };

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
  | { kind: 'move-item'; itemHint: string; target: DesignerMoveTarget }
  | { kind: 'add-item'; itemHint: string }
  | { kind: 'remove-item'; itemHint: string }
  | { kind: 'space-items'; firstHint: string; secondHint: string }
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

// The room-type vocabulary used to tell "move the sofa to the MAJLIS" (a room) apart from
// "move the sofa next to the BED" (another piece of furniture). Window, door and wall are
// checked first because they are unambiguous.
const ROOM_TYPE_TERMS = [
  'room', 'bedroom', 'kitchen', 'bathroom', 'majlis', 'salon', 'living', 'office', 'study', 'dining', 'hall', 'lobby', 'entrance',
  'غرفة', 'مجلس', 'صالة', 'مطبخ', 'حمام', 'مكتب', 'سفرة', 'مدخل', 'صاله',
];

// Everyday names mapped onto the palette's symbol ids, so "cabinet" finds the wardrobe and
// "كنبة" finds the sofa. Matching prefers the longest alias, so "single bed" beats "bed".
const ITEM_ALIASES: Array<{ alias: string; symbolId: string }> = [
  { alias: 'single bed', symbolId: 'bed-single' },
  { alias: 'king bed', symbolId: 'bed-king' },
  { alias: 'bed', symbolId: 'bed-king' },
  { alias: 'سرير مفرد', symbolId: 'bed-single' },
  { alias: 'سرير', symbolId: 'bed-king' },
  { alias: 'sofa', symbolId: 'sofa-3' },
  { alias: 'couch', symbolId: 'sofa-3' },
  { alias: 'كنبة', symbolId: 'sofa-3' },
  { alias: 'كنبه', symbolId: 'sofa-3' },
  { alias: 'armchair', symbolId: 'armchair' },
  { alias: 'majlis bench', symbolId: 'majlis-bench' },
  { alias: 'coffee table', symbolId: 'coffee-table' },
  { alias: 'طاولة قهوة', symbolId: 'coffee-table' },
  { alias: 'side table', symbolId: 'side-table' },
  { alias: 'طاولة جانبية', symbolId: 'side-table' },
  { alias: 'tv', symbolId: 'tv-unit' },
  { alias: 'تلفزيون', symbolId: 'tv-unit' },
  { alias: 'تلفاز', symbolId: 'tv-unit' },
  { alias: 'bookshelf', symbolId: 'bookshelf' },
  { alias: 'مكتبة', symbolId: 'bookshelf' },
  { alias: 'console', symbolId: 'console' },
  { alias: 'كونسول', symbolId: 'console' },
  { alias: 'rug', symbolId: 'rug' },
  { alias: 'carpet', symbolId: 'rug' },
  { alias: 'سجادة', symbolId: 'rug' },
  { alias: 'dining table', symbolId: 'dining-6' },
  { alias: 'طاولة طعام', symbolId: 'dining-6' },
  { alias: 'سفرة', symbolId: 'dining-6' },
  { alias: 'chair', symbolId: 'chair' },
  { alias: 'كرسي', symbolId: 'chair' },
  { alias: 'sideboard', symbolId: 'sideboard' },
  { alias: 'بوفيه', symbolId: 'sideboard' },
  { alias: 'nightstand', symbolId: 'nightstand' },
  { alias: 'كومودينو', symbolId: 'nightstand' },
  { alias: 'wardrobe', symbolId: 'wardrobe' },
  { alias: 'closet', symbolId: 'wardrobe' },
  { alias: 'cabinet', symbolId: 'wardrobe' },
  { alias: 'خزانة', symbolId: 'wardrobe' },
  { alias: 'دولاب', symbolId: 'wardrobe' },
  { alias: 'dresser', symbolId: 'dresser' },
  { alias: 'تسريحة', symbolId: 'dresser' },
  { alias: 'counter', symbolId: 'counter' },
  { alias: 'كاونتر', symbolId: 'counter' },
  { alias: 'island', symbolId: 'island' },
  { alias: 'جزيرة', symbolId: 'island' },
  { alias: 'sink', symbolId: 'sink' },
  { alias: 'حوض', symbolId: 'sink' },
  { alias: 'cooker', symbolId: 'cooker' },
  { alias: 'stove', symbolId: 'cooker' },
  { alias: 'oven', symbolId: 'cooker' },
  { alias: 'فرن', symbolId: 'cooker' },
  { alias: 'fridge', symbolId: 'fridge' },
  { alias: 'ثلاجة', symbolId: 'fridge' },
  { alias: 'toilet', symbolId: 'wc' },
  { alias: 'wc', symbolId: 'wc' },
  { alias: 'مرحاض', symbolId: 'wc' },
  { alias: 'basin', symbolId: 'basin' },
  { alias: 'مغسلة', symbolId: 'basin' },
  { alias: 'vanity', symbolId: 'vanity' },
  { alias: 'shower', symbolId: 'shower' },
  { alias: 'دش', symbolId: 'shower' },
  { alias: 'bathtub', symbolId: 'bathtub' },
  { alias: 'bath', symbolId: 'bathtub' },
  { alias: 'بانيو', symbolId: 'bathtub' },
  { alias: 'desk', symbolId: 'desk' },
  { alias: 'مكتب', symbolId: 'desk' },
  { alias: 'office chair', symbolId: 'office-chair' },
  { alias: 'treadmill', symbolId: 'treadmill' },
  { alias: 'car', symbolId: 'car' },
  { alias: 'سيارة', symbolId: 'car' },
  { alias: 'plant', symbolId: 'plant' },
  { alias: 'نبتة', symbolId: 'plant' },
  { alias: 'mirror', symbolId: 'mirror' },
  { alias: 'مرآة', symbolId: 'mirror' },
  { alias: 'fireplace', symbolId: 'fireplace' },
  { alias: 'مدفأة', symbolId: 'fireplace' },
  { alias: 'prayer carpet', symbolId: 'prayer-carpet' },
  { alias: 'سجادة صلاة', symbolId: 'prayer-carpet' },
  { alias: 'split unit', symbolId: 'split-unit' },
  { alias: 'مكيف', symbolId: 'split-unit' },
  { alias: 'table', symbolId: 'coffee-table' },
  { alias: 'طاولة', symbolId: 'coffee-table' },
];

/** Strips English articles and the Arabic definite article, and collapses whitespace. */
export const normalizeItemHint = (raw: string): string => raw
  .toLowerCase()
  .trim()
  .replace(/^(?:the|a|an)\s+/, '')
  .replace(/(^|\s)ال(?=\S)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

const aliasForHint = (hint: string): { alias: string; symbolId: string } | undefined => (
  [...ITEM_ALIASES]
    .sort((first, second) => second.alias.length - first.alias.length)
    .find((entry) => hint === entry.alias || hint.includes(entry.alias))
);

const symbolMatchesHint = (symbol: FurnitureSymbol, hint: string): boolean => {
  const h = normalizeItemHint(hint);
  if (!h) return false;
  if (symbol.id === h || symbol.id.startsWith(h)) return true;
  const en = symbol.en.toLowerCase();
  if (en === h || (h.length > 2 && en.includes(h))) return true;
  const ar = symbol.ar.replace(/(^|\s)ال(?=\S)/g, '$1');
  if (h.length > 1 && ar.includes(h)) return true;
  const alias = ITEM_ALIASES.find((entry) => entry.alias === h);
  if (alias) return symbol.id === alias.symbolId;
  return false;
};

/** Resolves a spoken furniture name to a palette symbol, or null when the palette lacks it. */
export const findFurnitureSymbol = (hint: string): FurnitureSymbol | null => {
  const h = normalizeItemHint(hint);
  if (!h) return null;
  const alias = aliasForHint(h);
  if (alias) {
    const exact = FURNITURE_SYMBOLS.find((symbol) => symbol.id === alias.symbolId);
    if (exact) return exact;
  }
  return FURNITURE_SYMBOLS.find((symbol) => symbolMatchesHint(symbol, h)) || null;
};

/**
 * Finds a piece already sitting on the plan by its spoken name. The currently selected piece
 * wins when it matches, because "move it next to the window" almost always means that one.
 */
export const findPlacedItemByHint = (
  items: PlacedItem[],
  hint: string,
  selectedId?: string | null,
  excludeId?: string,
): PlacedItem | null => {
  const matches = items.filter((item) => {
    if (item.id === excludeId) return false;
    const symbol = FURNITURE_SYMBOLS.find((entry) => entry.id === item.symbolId);
    return symbol ? symbolMatchesHint(symbol, hint) : false;
  });
  return matches.find((item) => item.id === selectedId) || matches[0] || null;
};

const stripLeadingVerb = (raw: string, verbs: RegExp): string => raw.replace(verbs, '').trim();

/** "put space between the bed and the cabinet" / "حط مسافة بين السرير والخزانة". */
const extractSpaceBetween = (raw: string): { firstHint: string; secondHint: string } | null => {
  const english = raw.match(/(?:put|leave|add|make|give|create)(?:\s+some|\s+a\s+little)?\s+(?:more\s+)?space\s+between\s+(?:the\s+)?(.+?)\s+and\s+(?:the\s+)?(.+?)\.?\s*$/i);
  if (english?.[1] && english?.[2]) return { firstHint: english[1].trim(), secondHint: english[2].trim() };
  const arabic = raw.match(/(?:حط|ضع|خلّ|خلي|سوّ|سو|اعمل)?\s*(?:مسافة|فراغ)\s+بين\s+(.+?)\s+و\s*(.+?)\.?\s*$/);
  if (arabic?.[1] && arabic?.[2]) return { firstHint: arabic[1].trim(), secondHint: arabic[2].trim() };
  return null;
};

/** "move the bed next to the window" / "حرك السرير جنب الشباك". */
const extractMove = (raw: string): { itemHint: string; targetText: string } | null => {
  const english = raw.match(/(?:move|shift|relocate|reposition|put|place)\s+(?:the\s+)?([a-z0-9\s-]+?)\s+(?:next\s+to|beside|against|near|closer\s+to|into|to)\s+(?:the\s+)?(.+?)\.?\s*$/i);
  if (english?.[1] && english?.[2]) return { itemHint: english[1].trim(), targetText: english[2].trim() };
  const arabic = raw.match(/(?:حرّك|حرك|انقل|حط|ضع|بدّل مكان|بدل مكان)\s+(.+?)\s+(?:جنب|جانب|بجانب|عند|قرب|الى|إلى)\s+(.+?)\.?\s*$/);
  if (arabic?.[1] && arabic?.[2]) return { itemHint: arabic[1].trim(), targetText: arabic[2].trim() };
  return null;
};

const classifyMoveTarget = (targetText: string): DesignerMoveTarget => {
  const text = targetText.toLowerCase();
  if (has(text, WINDOW_TERMS)) return { type: 'window' };
  if (has(text, DOOR_TERMS)) return { type: 'door' };
  if (has(text, WALL_TERMS)) return { type: 'wall' };
  if (has(text, ROOM_TYPE_TERMS)) return { type: 'room', roomHint: normalizeItemHint(targetText) };
  return { type: 'item', itemHint: normalizeItemHint(targetText) };
};

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

  const spaceBetween = extractSpaceBetween(raw);
  if (spaceBetween) return { kind: 'space-items', ...spaceBetween };

  const move = extractMove(raw);
  if (move) return { kind: 'move-item', itemHint: normalizeItemHint(move.itemHint), target: classifyMoveTarget(move.targetText) };

  const wantsRemove = has(text, REMOVE_TERMS);
  const wantsAdd = has(text, ADD_TERMS);

  if (wantsRemove) {
    if (has(text, WINDOW_TERMS) || has(text, DOOR_TERMS) || has(text, OPENING_TERMS)) return { kind: 'remove-opening' };
    if (has(text, WALL_TERMS) || has(text, BEAM_TERMS) || has(text, COLUMN_TERMS)) return { kind: 'remove-wall' };
    const hint = normalizeItemHint(stripLeadingVerb(raw, /^(?:please\s+)?(?:remove|delete|erase|take\s+out|get\s+rid\s+of|احذف|امسح|ازل|أزل|شيل)\s*/i));
    if (hint && findFurnitureSymbol(hint)) return { kind: 'remove-item', itemHint: hint };
  }

  if (wantsAdd) {
    if (has(text, COLUMN_TERMS)) return { kind: 'add-column' };
    if (has(text, BEAM_TERMS)) return { kind: 'add-beam' };
    if (has(text, WINDOW_TERMS)) return { kind: 'add-window' };
    if (has(text, DOOR_TERMS)) return { kind: 'add-door' };
    if (has(text, OPENING_TERMS)) return { kind: 'add-opening' };
    if (has(text, ROOM_TERMS) && !has(text, WALL_TERMS)) return { kind: 'add-room' };
    if (has(text, WALL_TERMS)) return { kind: 'add-wall' };
    const hint = normalizeItemHint(stripLeadingVerb(raw, /^(?:please\s+)?(?:add|place|put|insert|create|draw|اضف|أضف|ضع|ارسم|انشئ|أنشئ)\s*/i));
    if (hint && findFurnitureSymbol(hint)) return { kind: 'add-item', itemHint: hint };
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
    case 'move-item':
      return context.didApply
        ? (isArabic ? 'حرّكت القطعة إلى المكان المطلوب.' : 'I moved the piece where you asked.')
        : (isArabic ? 'ما لقيت القطعة أو المكان المطلوب على المخطط. أضفها أولًا أو حددها.' : 'I could not find that piece or that spot on the plan. Add it first, or select it.');
    case 'add-item':
      return context.didApply
        ? (isArabic ? 'أضفتها في منتصف العرض الحالي، اسحبها إلى مكانها.' : 'I added it in the middle of your current view, drag it into place.')
        : (isArabic ? 'ما عندي هذه القطعة في قائمة الأثاث.' : 'I do not have that piece in the furniture palette.');
    case 'remove-item':
      return context.didApply
        ? (isArabic ? 'حذفتها من المخطط.' : 'I removed it from the plan.')
        : (isArabic ? 'ما لقيت هذه القطعة على المخطط.' : 'I could not find that piece on the plan.');
    case 'space-items':
      return context.didApply
        ? (isArabic ? 'باعدت بينهم.' : 'I spaced them apart.')
        : (isArabic ? 'أحتاج القطعتين على المخطط حتى أباعد بينهم.' : 'I need both pieces on the plan to space them apart.');
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
