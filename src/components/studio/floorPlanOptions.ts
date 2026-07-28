// Tab 2 — Floor Plan Studio.
// Turns a flat 2D blueprint into a furnished, photorealistic top-down render.
// This is a different job from Tab 1: there the reference is a photograph of a real room and the
// camera must be preserved. Here the reference is a *drawing*, and the whole point is to change
// medium — drawing to photograph — while holding the geometry absolutely still.
//
// ⛔ THERE IS NO TRACER, AND THERE MUST NOT BE ONE AGAIN.
// An earlier version digitised the blueprint into editable vector geometry and rendered THAT.
// It was a lossy filter on a perfect source: the uploaded drawing already holds exact wall
// positions, thicknesses, door swings, fixtures and printed room names, and the trace threw all
// of that away and replaced it with ~40 approximate line segments — so the render was driven by
// the worse copy. Vision models are excellent at reading a drawing semantically and genuinely bad
// at emitting precise coordinates, so this feature is built on the strength: we take the ROOM LIST
// off the drawing, and the drawing itself goes to the renderer untouched.

export type FloorPlanFurnitureMode = 'keep' | 'fresh';

/**
 * What the client actually uploaded. This is NOT styling — it tells the model how to READ the
 * labels it finds on the drawing, and it is the whole difference between a master suite and a house.
 *
 * ⛔ Added because a master-suite plan (M. BATHROOM, M. DRESSING, MASTER LIVING, MASTER BEDROOM,
 * OFFICE) was read as a house of six independent rooms: the 6m x 6m dressing room came back as a
 * lounge with a round dining table, and MASTER LIVING as a family living room with a big sectional.
 * Nothing on a floor plan states whether it is a whole house or one suite inside one, and the model
 * cannot infer it reliably, so the client is asked once at upload and the answer is stated as fact.
 */
export type FloorPlanUploadKind = 'home' | 'suite' | 'room';

/** The six direction rows, in display order. */
export type FloorPlanRowKey = 'style' | 'palette' | 'flooring' | 'lighting' | 'ceiling' | 'finish';

/** Trades resolution and model effort against waiting time. See FLOOR_PLAN_SPEEDS. */
export type FloorPlanSpeed = 'quick' | 'best';

/**
 * Which way the user wants to work. 'home' shows the six direction rows only; 'rooms' shows the
 * room list and tucks those same six rows away as the base for everything left untouched. It is
 * a UI mode, not a prompt input — the brief is assembled identically either way.
 */
export type FloorPlanScope = 'home' | 'rooms';

export type FloorPlanChoices = {
  furnitureMode: FloorPlanFurnitureMode;
  /** null until the client picks. Required before the plan step will advance. */
  uploadKind: FloorPlanUploadKind | null;
  scope: FloorPlanScope;
  /** Selected option id per row. '' means "designer's choice" and contributes nothing. */
  rows: Record<FloorPlanRowKey, string>;
  /** Free text for a row switched to Custom. Only read when that row's id is CUSTOM_ID. */
  custom: Partial<Record<FloorPlanRowKey, string>>;
  speed: FloorPlanSpeed;
  customNote: string;
};

/**
 * One room's own direction. Everything is optional: an unset row means that room simply inherits
 * the whole-home choice, which is what keeps the per-room prompt block short even on a plan with
 * fifteen rooms.
 */
export type RoomStyleOverride = {
  /**
   * Repurposes the room: an id from ROOM_PURPOSES, or CUSTOM_ID with the words in `purposeNote`.
   * This is deliberately separate from the styling rows. Typing "dining room" into the Style row's
   * Custom box used to do nothing, because the core brief orders the model not to change the
   * function of a room that is already labelled — three words of styling could never beat that.
   * A purpose is written as its own overriding sentence instead of fighting it.
   */
  purpose?: string;
  purposeNote?: string;
  rows?: Partial<Record<FloorPlanRowKey, string>>;
  custom?: Partial<Record<FloorPlanRowKey, string>>;
  note?: string;
};

/** Per-room direction, keyed by the room label's id so a rename never orphans it. */
export type RoomOverrides = Record<string, RoomStyleOverride>;

/**
 * Two or more rooms the user wants treated as one space — a dining area open to a majlis, say.
 * This needs no geometry at all: the group's direction is written as a single line naming both
 * rooms, which is also the strongest possible instruction against the model inventing a divider
 * between them. The group's own styling lives in `RoomOverrides` under the group's id, so the
 * same sheet, the same badge and the same prompt code serve rooms and groups alike.
 */
export type RoomGroup = {
  id: string;
  labelIds: string[];
};

/**
 * One line of per-room direction. `names` holds a single room, or every room in a group.
 */
export type RoomDirection = {
  names: string[];
  override: RoomStyleOverride;
};

export type FloorPlanOption = {
  id: string;
  en: string;
  ar: string;
  prompt: string;
};

export const FLOOR_PLAN_FURNITURE_MODES: Array<FloorPlanOption & {
  id: FloorPlanFurnitureMode;
  hintEn: string;
  hintAr: string;
}> = [
  {
    id: 'keep',
    en: 'Keep what is drawn',
    ar: 'أبقِ ما هو مرسوم',
    hintEn: 'Follow the furniture already on the plan',
    hintAr: 'اتبع الأثاث الموجود في المخطط',
    prompt: 'FURNITURE SOURCE — THIS SECTION DECIDES THE LOOSE FURNITURE AND IT OVERRIDES EVERY OTHER MENTION OF WHERE FURNITURE GOES.\nThe plan already has furniture drawn on it as symbols, and the client wants that layout kept. Read every symbol and rebuild it as real, solid furniture standing in the SAME position, at the SAME size, facing the SAME direction as the symbol. A rectangle against a wall with three cushions drawn on it is a three-seat sofa against that wall. A circle with chairs around it is a round dining table with that many chairs. Do not relocate furniture, do not add extra pieces to a room that has furniture drawn, and do not leave out a piece that is drawn. Where a room has no furniture drawn at all, furnish it sensibly for its stated purpose.',
  },
  {
    id: 'fresh',
    en: 'Furnish it fresh',
    ar: 'افرشها من جديد',
    hintEn: 'Ignore drawn furniture, design it properly',
    hintAr: 'تجاهل الأثاث المرسوم وصممها بشكل جديد',
    // ⛔ This choice used to lose every time, and not because the model disobeyed. It was one
    // sentence, and the core brief ahead of it said "the bed in the position drawn", "seating
    // grouped the way the plan draws it", "the desk and chair in the position drawn", "keep the
    // equipment shown on the plan" and "preserve 100% of the uploaded floor plan" — then the
    // architect's reading arrived with a full furniture inventory under "follow it". Seven votes
    // to one. Those phrases are now scoped to built-ins only, and this block is marked as the
    // authority. The "failed render" line is the Tab 1 empty-room lesson: the moment you tell a
    // model to ignore the furniture it can see, you must tell it to put furniture back.
    prompt: 'FURNITURE SOURCE — THIS SECTION DECIDES THE LOOSE FURNITURE AND IT OVERRIDES EVERY OTHER MENTION OF WHERE FURNITURE GOES.\nThe client has asked for this home to be furnished FRESH, and that decision is final. The furniture symbols drawn on the plan show the OLD layout, which the client has rejected. Do not copy their positions, do not copy their sizes and do not copy their orientations. If any text later in this brief lists the furniture drawn on the plan, that list is a record of what is being REPLACED, not an instruction to reproduce it.\nFurnish every room from scratch as a professional interior designer would, choosing pieces that suit each room\'s stated purpose and size, with generous circulation space, correct clearances around every door, and a single coherent scheme running through the whole home. Every room must still end up completely furnished and styled — a bare, empty or half-dressed room is a failed render.\nBuilt-in fittings are NOT loose furniture and are NOT yours to move: kitchen counters and islands, wardrobe and dressing-room joinery, vanities, WCs, basins, showers, baths, built-in seating and staircases all stay exactly where the plan draws them.',
  },
];

/**
 * ⛔ Every one of these blocks is pushed AFTER CORE_INSTRUCTION, never before it. The per-room
 * furnishing list inside CORE_INSTRUCTION describes a MASTER LIVING as a living room and an OFFICE
 * as a home office, so a suite instruction placed ahead of that list loses to it on position — the
 * same way the client's furniture choice used to lose seven votes to one.
 */
export const FLOOR_PLAN_UPLOAD_KINDS: Array<FloorPlanOption & {
  id: FloorPlanUploadKind;
  hintEn: string;
  hintAr: string;
}> = [
  {
    id: 'home',
    en: 'A whole home',
    ar: 'منزل كامل',
    hintEn: 'A full house, villa, or one whole floor with several bedrooms',
    hintAr: 'منزل أو فيلا أو طابق كامل فيه عدة غرف نوم',
    prompt: 'WHAT THIS DRAWING IS\nThis drawing is a complete home, or one full floor of a home. The named spaces on it are independent rooms of a house, so furnish each one for its own label as a room in its own right.',
  },
  {
    id: 'suite',
    en: 'One suite',
    ar: 'جناح واحد',
    hintEn: 'One bedroom with its own bathroom, dressing room and sitting area',
    hintAr: 'غرفة نوم واحدة مع حمّامها وغرفة ملابسها وجلستها',
    prompt: 'WHAT THIS DRAWING IS — THIS DECIDES HOW EVERY LABEL ON THE PLAN IS READ, AND IT OVERRIDES THE ROOM-BY-ROOM FURNISHING LIST ABOVE WHEREVER THE TWO DISAGREE.\nThis drawing is ONE bedroom suite inside a larger home — a master suite or a guest suite. It is not a house and it is not a floor of separate rooms. Every space drawn here belongs to that one suite and exists to serve it.\nThere is exactly ONE bedroom on this plan and it is the heart of the suite. Every other space supports that bedroom: a dressing room is the bedroom\'s own private walk-in wardrobe, a bathroom is its private en-suite, a sitting or living area is the suite\'s private lounge and NOT a family living room, an office or study is a private desk area inside the suite, and a lobby or hall is the suite\'s private entrance.\nFurnish it as one continuous private suite, with one consistent scheme running through every space so it reads as a single set of rooms belonging to one person. Never furnish these spaces as though they were separate rooms belonging to different parts of a house.',
  },
  {
    id: 'room',
    en: 'A single room',
    ar: 'غرفة واحدة',
    hintEn: 'Just one room on its own',
    hintAr: 'غرفة واحدة فقط',
    prompt: 'WHAT THIS DRAWING IS\nThis drawing is ONE single room, not a home and not a suite. Furnish it as one room for the purpose its label states, and treat any smaller space opening off it as part of that same room.',
  },
];

export const FLOOR_PLAN_STYLES: FloorPlanOption[] = [
  {
    id: 'warm-luxury',
    en: 'Warm luxury',
    ar: 'فخامة دافئة',
    prompt: 'Style: warm contemporary luxury. Deep-pile patterned rugs, cream upholstery, dark walnut joinery, brushed brass detailing, marble surfaces, layered warm lighting, mature indoor plants.',
  },
  {
    id: 'modern-minimal',
    en: 'Modern minimal',
    ar: 'حداثة بسيطة',
    prompt: 'Style: modern minimalism. Uncluttered rooms, low-profile furniture, flat matt surfaces, a tight neutral palette, concealed lighting, almost no ornament, generous empty floor.',
  },
  {
    id: 'majlis-arabic',
    en: 'Arabic majlis',
    ar: 'مجلس عربي',
    prompt: 'Style: contemporary Gulf Arabic. Continuous floor-level majlis seating along the walls, richly patterned carpets, carved or fluted timber screens, arched niches, ornate brass and glass lighting, generous formal symmetry.',
  },
  {
    id: 'scandi',
    en: 'Scandinavian',
    ar: 'إسكندنافي',
    prompt: 'Style: Scandinavian. Pale oak floors, white and soft grey walls, light natural textiles, simple honest furniture, abundant daylight, restrained and calm.',
  },
  {
    id: 'industrial',
    en: 'Industrial loft',
    ar: 'صناعي',
    prompt: 'Style: industrial loft. Polished or micro-cement concrete floors, exposed brick, blackened steel frames, tan leather, visible ductwork and cable-suspended pendant lighting.',
  },
  {
    id: 'classic',
    en: 'Classic elegance',
    ar: 'أناقة كلاسيكية',
    prompt: 'Style: classical elegance. Panelled and moulded walls, herringbone parquet, tufted and buttoned upholstery, crystal chandeliers, symmetrical formal arrangements, gilded accents.',
  },
  {
    id: 'japandi',
    en: 'Japandi',
    ar: 'جاباندي',
    prompt: 'Style: Japandi. Low solid-timber furniture, paper and linen shades, tatami-like textures, handmade ceramics, warm off-white walls, deliberate empty space, quiet and grounded.',
  },
  {
    id: 'mid-century',
    en: 'Mid-century',
    ar: 'منتصف القرن',
    prompt: 'Style: mid-century modern. Tapered walnut legs, low-slung lounge seating, bold geometric rugs, sculptural globe and sputnik lighting, mustard and teal accents, walnut sideboards.',
  },
  {
    id: 'coastal',
    en: 'Coastal',
    ar: 'ساحلي',
    prompt: 'Style: contemporary coastal. Whitewashed timber, pale washed oak, linen slipcovered seating, rattan and jute, soft blue and sea-glass accents, sheer curtains, bright and airy.',
  },
  {
    id: 'art-deco',
    en: 'Art deco',
    ar: 'آرت ديكو',
    prompt: 'Style: art deco glamour. Fluted and channelled panelling, bold geometric inlay, velvet upholstery, polished brass and blackened metal, marble with dramatic veining, mirrored and lacquered surfaces.',
  },
  {
    id: 'bohemian',
    en: 'Boho',
    ar: 'بوهيمي',
    prompt: 'Style: modern bohemian. Layered patterned rugs, abundant plants, rattan and cane, macrame and woven wall hangings, mixed warm textiles, low relaxed seating, collected rather than matched.',
  },
  {
    id: 'farmhouse',
    en: 'Modern farmhouse',
    ar: 'ريفي عصري',
    prompt: 'Style: modern farmhouse. Shaker joinery, wide-plank timber floors, matt black hardware, apron sinks, natural linen, simple honest forms, warm white walls with timber beams where appropriate.',
  },
];

export const FLOOR_PLAN_PALETTES: FloorPlanOption[] = [
  { id: 'warm-neutral', en: 'Warm neutral', ar: 'محايد دافئ', prompt: 'Palette: warm neutrals — cream, sand, taupe, soft camel, with walnut timber.' },
  { id: 'cool-grey', en: 'Cool grey', ar: 'رمادي بارد', prompt: 'Palette: cool greys — pale grey, charcoal, off-white, with pale ash timber.' },
  { id: 'earth-green', en: 'Earth & green', ar: 'ترابي وأخضر', prompt: 'Palette: earth tones with olive and sage green, terracotta, and oak.' },
  { id: 'mono-black', en: 'Monochrome', ar: 'أحادي', prompt: 'Palette: monochrome — white, mid grey, matt black, with a single timber tone.' },
  { id: 'blue-brass', en: 'Blue & brass', ar: 'أزرق ونحاسي', prompt: 'Palette: deep navy and petrol blue with brushed brass and pale stone.' },
  { id: 'desert-sand', en: 'Desert sand', ar: 'رملي صحراوي', prompt: 'Palette: desert sand, bone, dusty rose and burnt clay, with pale travertine.' },
  { id: 'cream-gold', en: 'Cream & gold', ar: 'كريمي وذهبي', prompt: 'Palette: cream and ivory with champagne gold, soft beige and pale marble.' },
  { id: 'emerald', en: 'Emerald', ar: 'زمردي', prompt: 'Palette: deep emerald and forest green with warm brass, cream and dark timber.' },
  { id: 'terracotta', en: 'Terracotta', ar: 'طيني', prompt: 'Palette: terracotta and burnt orange with cream plaster, clay tones and pale oak.' },
  { id: 'blush-mauve', en: 'Blush & mauve', ar: 'وردي باهت', prompt: 'Palette: soft blush, dusty mauve and warm grey, with rose gold and pale ash.' },
  { id: 'charcoal-oak', en: 'Charcoal & oak', ar: 'فحمي وبلوطي', prompt: 'Palette: charcoal and graphite with warm natural oak, bone white and black metal.' },
  { id: 'bright-white', en: 'Bright white', ar: 'أبيض ناصع', prompt: 'Palette: crisp bright white throughout, with pale blond timber and the lightest grey.' },
];

// The four rows below are optional direction. The first entry of each is deliberately empty, so
// leaving a row alone adds nothing to the prompt and the model designs it as it sees fit.

export const FLOOR_PLAN_LIGHTING: FloorPlanOption[] = [
  { id: '', en: "Designer's choice", ar: 'اختيار المصمم', prompt: '' },
  { id: 'warm-evening', en: 'Warm evening', ar: 'مسائي دافئ', prompt: 'Lighting: warm evening. Lamps and pendants lit, pools of warm light, soft long shadows, cosy and intimate.' },
  { id: 'bright-daylight', en: 'Bright daylight', ar: 'ضوء النهار', prompt: 'Lighting: bright natural daylight flooding in through the windows, crisp clean shadows, fresh and open.' },
  { id: 'soft-diffused', en: 'Soft & diffused', ar: 'ناعم ومنتشر', prompt: 'Lighting: soft and evenly diffused, gentle shadows, calm overcast quality, nothing harsh.' },
  { id: 'dramatic', en: 'Dramatic', ar: 'درامية', prompt: 'Lighting: dramatic and directional. Strong accent lighting, deep contrast, highlighted feature walls and objects, gallery-like.' },
  { id: 'cove-hidden', en: 'Hidden cove', ar: 'إضاءة مخفية', prompt: 'Lighting: concealed architectural lighting. Hidden cove and perimeter strips washing the walls, no visible fittings, even glow.' },
  { id: 'golden-hour', en: 'Golden hour', ar: 'الساعة الذهبية', prompt: 'Lighting: late golden hour. Low warm sunlight raking across the floors, rich amber tone, long soft shadows.' },
];

export const FLOOR_PLAN_FLOORING: FloorPlanOption[] = [
  { id: '', en: "Designer's choice", ar: 'اختيار المصمم', prompt: '' },
  { id: 'light-oak', en: 'Light oak', ar: 'بلوط فاتح', prompt: 'Flooring: wide-plank light oak with visible natural grain, laid in a consistent direction.' },
  { id: 'dark-walnut', en: 'Dark walnut', ar: 'جوز داكن', prompt: 'Flooring: rich dark walnut planks with a satin finish and deep grain.' },
  { id: 'marble', en: 'Marble', ar: 'رخام', prompt: 'Flooring: large-format polished marble slabs with soft grey veining and near-invisible joints.' },
  { id: 'travertine', en: 'Travertine', ar: 'ترافرتين', prompt: 'Flooring: honed travertine in large warm cream tiles with a soft matt surface.' },
  { id: 'microcement', en: 'Microcement', ar: 'مايكروسمنت', prompt: 'Flooring: seamless microcement in a warm grey tone, completely jointless, subtly mottled.' },
  { id: 'patterned-tile', en: 'Patterned tile', ar: 'بلاط منقوش', prompt: 'Flooring: decorative patterned tile with a repeating geometric motif, correctly scaled to each room.' },
  { id: 'warm-carpet', en: 'Warm carpet', ar: 'سجاد دافئ', prompt: 'Flooring: full soft carpet in a warm neutral tone with a visible dense pile.' },
];

export const FLOOR_PLAN_CEILINGS: FloorPlanOption[] = [
  { id: '', en: "Designer's choice", ar: 'اختيار المصمم', prompt: '' },
  { id: 'flat-clean', en: 'Flat & clean', ar: 'مسطح ونظيف', prompt: 'Ceilings: plain flat plaster, crisp shadow gaps, recessed downlights only.' },
  { id: 'cove-lit', en: 'Cove lit', ar: 'كورنيش مضيء', prompt: 'Ceilings: dropped perimeter bulkheads with concealed cove lighting washing the edges.' },
  { id: 'coffered', en: 'Coffered', ar: 'مقسّم', prompt: 'Ceilings: coffered, with a regular grid of recessed panels and moulded edges.' },
  { id: 'timber-slat', en: 'Timber slats', ar: 'شرائح خشبية', prompt: 'Ceilings: warm timber slats or battens running in one direction, with lighting between them.' },
  { id: 'exposed', en: 'Exposed', ar: 'مكشوف', prompt: 'Ceilings: exposed structure — concrete soffit or timber beams — with surface-mounted services and track lighting.' },
];

export const FLOOR_PLAN_FINISH_LEVELS: FloorPlanOption[] = [
  { id: '', en: "Designer's choice", ar: 'اختيار المصمم', prompt: '' },
  { id: 'understated', en: 'Understated', ar: 'بسيط راقٍ', prompt: 'Finish level: understated and restrained. Good honest materials, very little ornament, nothing showy, calm and liveable.' },
  { id: 'premium', en: 'Premium', ar: 'ممتاز', prompt: 'Finish level: premium. Considered detailing, quality natural materials, designer furniture, styled but still comfortable.' },
  { id: 'ultra-luxury', en: 'Ultra luxury', ar: 'فخامة قصوى', prompt: 'Finish level: ultra luxury. Book-matched stone, bespoke joinery throughout, statement lighting, sculptural furniture, flawless detailing, five-star hotel standard.' },
];

export const CUSTOM_ID = '__custom__';
const CUSTOM_OPTION: FloorPlanOption = { id: CUSTOM_ID, en: 'Custom…', ar: 'مخصص…', prompt: '' };
/** In a room's sheet the empty id means "inherit the whole-home choice", not "auto". */
const SAME_AS_HOME: FloorPlanOption = { id: '', en: 'Same as home', ar: 'مثل المنزل', prompt: '' };

/**
 * Every direction row in one table, with the Custom chip already appended. Driving the UI from
 * this instead of six near-identical blocks is what keeps the studio component readable.
 */
export const FLOOR_PLAN_ROWS: Array<{
  key: FloorPlanRowKey;
  en: string;
  ar: string;
  options: FloorPlanOption[];
  /** Rooms may override the first four. Ceilings and finish level stay whole-home only. */
  perRoom: boolean;
}> = [
  { key: 'style', en: 'Style', ar: 'الطراز', options: [...FLOOR_PLAN_STYLES, CUSTOM_OPTION], perRoom: true },
  { key: 'palette', en: 'Palette', ar: 'الألوان', options: [...FLOOR_PLAN_PALETTES, CUSTOM_OPTION], perRoom: true },
  { key: 'flooring', en: 'Flooring', ar: 'الأرضية', options: [...FLOOR_PLAN_FLOORING, CUSTOM_OPTION], perRoom: true },
  { key: 'lighting', en: 'Lighting', ar: 'الإضاءة', options: [...FLOOR_PLAN_LIGHTING, CUSTOM_OPTION], perRoom: true },
  { key: 'ceiling', en: 'Ceilings', ar: 'الأسقف', options: [...FLOOR_PLAN_CEILINGS, CUSTOM_OPTION], perRoom: false },
  { key: 'finish', en: 'Finish level', ar: 'مستوى التشطيب', options: [...FLOOR_PLAN_FINISH_LEVELS, CUSTOM_OPTION], perRoom: false },
];

const ROW_OPTIONS = Object.fromEntries(
  FLOOR_PLAN_ROWS.map((row) => [row.key, row.options]),
) as Record<FloorPlanRowKey, FloorPlanOption[]>;

/** The same rows as shown inside a single room's sheet, each led by a "Same as home" chip. */
export const PER_ROOM_ROWS = FLOOR_PLAN_ROWS
  .filter((row) => row.perRoom)
  .map((row) => ({
    ...row,
    // Style and palette have no empty entry of their own, so the inherit chip is prepended.
    // Flooring and lighting already start with one, so it is swapped rather than duplicated.
    options: row.options[0].id === ''
      ? [SAME_AS_HOME, ...row.options.slice(1)]
      : [SAME_AS_HOME, ...row.options],
  }));

/**
 * What a room can be turned into. The prompt text is a noun phrase so it drops into the sentence
 * "Furnish it completely and only as ___".
 */
export const ROOM_PURPOSES: FloorPlanOption[] = [
  { id: '', en: 'As drawn', ar: 'كما هو مرسوم', prompt: '' },
  { id: 'majlis', en: 'Majlis', ar: 'مجلس', prompt: 'a formal Arabic majlis' },
  { id: 'dining', en: 'Dining room', ar: 'غرفة طعام', prompt: 'a formal dining room' },
  { id: 'living', en: 'Living room', ar: 'غرفة جلوس', prompt: 'a family living room' },
  { id: 'salon', en: 'Salon', ar: 'صالون', prompt: 'an elegant reception salon' },
  { id: 'prayer', en: 'Prayer room', ar: 'غرفة صلاة', prompt: 'a prayer room' },
  { id: 'bedroom', en: 'Bedroom', ar: 'غرفة نوم', prompt: 'a bedroom' },
  { id: 'office', en: 'Office', ar: 'مكتب', prompt: 'a home office and study' },
  { id: 'gym', en: 'Gym', ar: 'صالة رياضة', prompt: 'a home gym' },
  { id: 'kitchen', en: 'Kitchen', ar: 'مطبخ', prompt: 'a kitchen' },
  { id: 'playroom', en: 'Playroom', ar: 'غرفة أطفال', prompt: "a children's playroom" },
  { id: 'storage', en: 'Storage', ar: 'مخزن', prompt: 'a storage room' },
  CUSTOM_OPTION,
];

/** The first question of the style step: one look everywhere, or room by room. */
export const FLOOR_PLAN_SCOPES: Array<{
  id: FloorPlanScope;
  en: string;
  ar: string;
  hintEn: string;
  hintAr: string;
}> = [
  { id: 'home', en: 'Whole house', ar: 'المنزل كله', hintEn: 'One look everywhere', hintAr: 'طراز واحد للكل' },
  { id: 'rooms', en: 'Room by room', ar: 'غرفة بغرفة', hintEn: 'Style each room', hintAr: 'خصّص كل غرفة' },
];

/**
 * ⛔ TWO INDEPENDENT LEVERS. Do not confuse them again.
 *
 *  - `quality` is what costs the TIME. It maps to `providerSettings.openai.quality`, which is how
 *    much compute GPT Image 2 spends. 'high' put a dense plan at 2–4 minutes.
 *  - `maxEdge` is what costs the DETAIL. A whole villa rendered at 1024px leaves a staircase about
 *    sixty pixels wide, which is not enough to draw treads and a handrail at all.
 *
 * The old 'quick' mode dropped BOTH at once, so it was fast and it silently lost staircases — which
 * is why it was never wired to the UI. The live mode now takes the speed win only: medium quality
 * at the FULL 1536px. Never drop `maxEdge` to buy speed; drop `quality` instead.
 */
export const FLOOR_PLAN_SPEEDS: Array<{
  id: FloorPlanSpeed;
  en: string;
  ar: string;
  hintEn: string;
  hintAr: string;
  quality: 'medium' | 'high';
  maxEdge: number;
  /** Typical wait, used only to pace the progress bar. The bar never claims to be finished. */
  expectSeconds: number;
}> = [
  // ⚠️ NOT USED and must not be used for a whole-home render — 1024px loses staircases. Kept only
  // because `FloorPlanSpeed` is a two-value type; there is no picker in the UI.
  { id: 'quick', en: 'Quick look', ar: 'نظرة سريعة', hintEn: 'About a minute', hintAr: 'حوالي دقيقة', quality: 'medium', maxEdge: 1024, expectSeconds: 70 },
  // The live mode. Medium quality for speed, full 1536px so fine structure survives.
  { id: 'best', en: 'Best quality', ar: 'أفضل جودة', hintEn: 'About 90 seconds', hintAr: 'حوالي ٩٠ ثانية', quality: 'medium', maxEdge: 1536, expectSeconds: 100 },
];

export const speedSettings = (speed: FloorPlanSpeed) =>
  FLOOR_PLAN_SPEEDS.find((item) => item.id === speed) || FLOOR_PLAN_SPEEDS[0];

/**
 * The instruction that does the heavy lifting.
 *
 * This is the owner's own proven brief, kept close to his wording on purpose — it is what
 * produced the reference result he approved. Two things about it are deliberate and must not
 * be "improved":
 *  - It is written as headed sections with short declarative lines. GPT Image 2 is an LLM-based
 *    model that reads the whole prompt like a chat model, so a structured brief genuinely lands
 *    where a single flowing paragraph would not.
 *  - The camera is ORTHOGRAPHIC TRUE TOP-DOWN, not a dollhouse cutaway. An earlier cutaway
 *    version produced a tilted architectural model instead of a finished plan that overlays the
 *    original drawing. Overlay accuracy is the entire point of this feature.
 *
 * ⛔ The room names are READ but never DRAWN. The model must understand that a space is a MAJLIS
 * so it furnishes it as one, but printing the word across the finished image makes it read as a
 * floor plan rather than a photograph of a finished home. Tapping a room is handled by the pin
 * overlay in `FloorPlanCanvas`, so nothing depends on baked-in text.
 */
const CORE_INSTRUCTION = [
  'ARCHITECTURAL FLOOR PLAN VISUALIZATION (STRICT MODE)',
  // ⛔ "DO NOT redesign it" was too broad — read plainly it also forbids the client's own
  // "furnish it fresh" choice. Scoped to the building, which is the only thing that is untouchable.
  'The uploaded image is an architectural floor plan, NOT a style reference. Treat it as the master blueprint. The blueprint is the source of truth for the BUILDING — its walls, its doors, its windows, its structure, its built-in fittings and its room labels. DO NOT redesign the building. Which loose furniture goes where is decided by the FURNITURE SOURCE section below.',
  // ⛔ Keep this example list in step with the FURNISH EACH ROOM list below. It was originally
  // Gulf-villa only (salon, majlis, salah), so a master-suite plan — bathroom, dressing, master
  // living, bedroom, office — matched almost nothing and fell through to the catch-all. The
  // 6m x 6m dressing room came back furnished as a lounge with a round rug and bookshelves.
  'HIGHEST PRIORITY\nRead every room label on the plan and understand its purpose — for example SALON, SALAH, GYM, MAJLIS, DINING, KITCHEN, LOBBY, TOILET, WC, HW, ENTRANCE, MASTER BEDROOM, BEDROOM, M. DRESSING, DRESSING, WALK-IN CLOSET, MASTER LIVING, LIVING, OFFICE, STUDY, M. BATHROOM, BATHROOM, EN-SUITE, LAUNDRY, STORE, or any other labelled space. Each room must be furnished according to its own label. Do NOT guess a different function for a room that is already named — the only exception is a room the per-room section below explicitly gives a new purpose, where that new purpose wins outright. Read the labels to understand the home, then do NOT draw them — the finished image contains no text.',
  'NEVER CHANGE\nNever move walls. Never change wall thickness. Never add a wall. Never add a partition, screen or divider of any kind. Never remove a wall that is drawn. Never change room sizes. Never change room proportions. Never split a room. Never move windows. Never move doors. Never remove a door. Never remove a window. Never add a door. Never add a window. The number of doors in your image is exactly the number drawn on the blueprint, and the same is true of the windows. Never rotate the floor plan. Never mirror it. Never crop it. Never create a different house.\nWhere two labelled rooms have NO wall drawn between them they are ONE open space and must stay open. Do not invent a divider, a screen, a step or a change of level between them just because they carry two different names. Two room names can share a single open space, and that is normal in this kind of home.\nThe output must overlay perfectly on the uploaded blueprint: if the generated image were laid over the blueprint, every wall and every opening would align.',
  // ⛔ Doors and windows needed their own block. NEVER CHANGE above told the model not to MOVE
  // them, and it obeyed that literally — it deleted them and invented new ones instead, because
  // nothing forbade either. A swing arc also reads as notation, and the notation section orders
  // notation to be dropped, so the door went with it. State plainly that the opening is real.
  'DOORS AND WINDOWS — EVERY ONE IS PHYSICAL AND EVERY ONE SURVIVES\nOn the blueprint a door is a gap in a wall with a thin leaf line, usually with a quarter-circle swing arc showing which way it opens. A window is a thin break in the wall thickness drawn as two or three parallel lines. Count every one of them before you begin. Where the architect\'s reading further down states a TOTALS line, those counts were made by an architect studying this drawing and they are correct — match them exactly rather than relying on your own glance. Your image must contain exactly that many doors and exactly that many windows, each in the same wall, at the same width, in the same position.\nThe swing arc is notation, so do not draw the arc itself — but the doorway it belongs to is a real physical opening and must appear as one, with a real door in it. Never fill a doorway in with solid wall. Never fill a window in with solid wall. Never delete an opening because the room would look neater closed, because the wall looks cluttered, or because you cannot tell what it is. Never invent a door or a window in a wall that has none drawn. Where a gap in a wall has no leaf drawn it is a cased opening or archway: leave it open and do not fit a door into it.',
  'FURNISH EACH ROOM ACCORDING TO ITS LABEL\nSALON — elegant reception seating, sofas, coffee and side tables, rug, TV feature wall where appropriate, decorative lighting, window treatments, artwork, plants.\nSALAH — prayer room: premium prayer carpet, minimal furniture, Quran shelf, soft indirect lighting, calm neutral palette, subtle Islamic geometric detail.\nMAJLIS — formal continuous perimeter seating, rich patterned carpet, low tables, ornate lighting, generous symmetry.\nGYM — gym equipment, rubber flooring, a mirrored wall, a wall-mounted TV, storage, bright lighting.\nKITCHEN — cabinetry, worktops, island if one is drawn, sink, appliances, task lighting, realistic finishes.\nDINING — dining table and chairs, buffet or sideboard, feature pendant lighting, rug, decorative pieces.\nTOILET and WC — vanity, WC, shower or bath if drawn, mirror, lighting, realistic tiling.\nLOBBY and ENTRANCE — console table, artwork, decorative lighting, plants, runner.\nMASTER BEDROOM and BEDROOM — a bed, an upholstered or panelled headboard wall, bedside tables with lamps on both sides, a bench or stool at the foot where there is room, the wardrobe run wherever one is drawn, a rug under the bed, curtains, artwork and soft layered lighting.\nDRESSING, M. DRESSING, WARDROBE and WALK-IN CLOSET — this is a walk-in dressing room. It is NOT a lounge, NOT a library and NOT a study. Line every wall the plan draws cabinetry against with full-height wardrobe joinery: hanging rails, open shelving, drawer banks, glass-fronted display cabinets and integrated strip lighting. Add a central island of drawers, or an ottoman, only where the plan leaves clear floor for one. Add a full-length mirror. NEVER furnish a dressing room with sofas, armchairs, bookshelves, a bed, a desk or a dining table.\nMASTER LIVING, LIVING, FAMILY and SITTING — comfortable seating, coffee and side tables, a rug, a media or feature wall, floor and table lamps, curtains and plants.\nOFFICE and STUDY — a desk and chair, shelving or storage, a task lamp, a rug and artwork.\nBATHROOM, M. BATHROOM, EN-SUITE and SHOWER ROOM — build every fitting the plan draws and only those: bath, shower enclosure, WC, bidet, and the single or twin vanity with its mirrors. Full realistic wall and floor tiling, towels, and lighting at the mirrors.\nLAUNDRY, STORE, PANTRY and MAID — the fittings the plan draws, practical shelving and worktops, simple durable finishes.\nA label that begins with "M." or "MASTER" belongs to the master suite: furnish it to a more generous and more luxurious standard than the ordinary equivalent room, but keep its function exactly what the label says.\nAny other labelled space — furnish it correctly for the function its label states.\nEach line above says WHAT belongs in that kind of room. WHERE the loose furniture stands is decided by the FURNITURE SOURCE section, which wins on that one point. Built-in fittings — kitchen counters and islands, wardrobe and dressing-room joinery, vanities, WCs, basins, showers, baths, built-in seating and staircases — always stay exactly where the blueprint draws them, whichever furniture mode is in force.',
  'STAIRCASES AND LEVEL CHANGES — DO NOT LOSE THEM\nA staircase is drawn as a run of closely spaced parallel lines (the treads), usually crossed by a long direction arrow or a diagonal break line. That run of lines is a REAL PHYSICAL STRUCTURE and one of the most important objects in the home. Build every staircase the plan shows, in exactly the position, width and direction it is drawn: real three-dimensional steps seen from directly above, the correct number of treads, a proper handrail or balustrade, and realistic shadow in the gaps between treads. The arrow across it is notation — do not draw the arrow, but never delete the stair it belongs to. A staircase must NEVER be replaced by a planter, a garden bed, a rug, a table, a bench, a corridor or empty floor. If you are unsure whether a run of parallel lines is a staircase, build the staircase.',
  'MATERIALS\nUse premium materials throughout unless the style and palette below direct otherwise: natural oak, travertine, Italian marble, microcement, textured paint, brushed brass, natural stone, high-end fabrics, architectural lighting, luxury finishes.',
  'CAMERA\nOrthographic. True top-down. Ninety degrees overhead. No perspective. No isometric. No dollhouse cutaway. No angled camera. Keep the plan at exactly the rotation it has in the uploaded image.',
  'IGNORE THE DRAFTING NOTATION\nThe dimension lines and their numbers, the grid and centre lines, level markers such as "+0.45 FL", equipment tags, the title block and the page border are all drawing notation. They are not physical objects. Render none of them.\nHATCHING: hatching drawn inside the THICKNESS of a wall marks that wall as solid built construction. Hatching that fills an entire ROOM from wall to wall is a completely different thing — it is only a drawing convention shading an area, it is a floor and not a wall, and it is not a solid block. Furnish a hatched room as a normal room. Never build a wall along the edge of a hatched area, and never build a wall through the middle of one.\nAnnotations such as "OUT OF SCOPE" are contractual wording — those rooms are real and must be furnished in full like every other room.\nNever convert something you cannot identify into planting or landscaping. Indoor plants belong only where the plan draws a plant symbol, or as ordinary styling within a furnished room.',
  'STYLE\nUltra photorealistic. Architectural visualisation. Interior designer presentation. Luxury villa. 8K. Realistic shadows. Realistic textures. Magazine quality.',
  'BACKGROUND\nEverything outside the building outline is plain flat pure white and completely empty. No ground, no landscaping, no shadow spill, no page, no border, no drawing remnants.',
  'NO TEXT ANYWHERE\nThe finished image contains no writing of any kind. No room names. No labels. No dimensions. No numbers. No annotations. No title block. No logos. No watermarks. Not a single letter. The rooms are identified by their furniture alone, exactly as they would be in a photograph of the finished home.',
  'IMPORTANT\nYou are not designing a new house. You are finishing the architect\'s work. It should look as though the architect has already built this house and hired an elite interior designer to decorate it. The finished image must preserve 100% of the uploaded floor plan\'s GEOMETRY — every wall, every door, every window, every staircase and every built-in fitting — replacing the symbolic floor-plan graphics with realistic materials, furniture, flooring, paint, lighting and décor.',
].join('\n\n');

/**
 * ⛔ Pushed AFTER the design direction, never inside CORE_INSTRUCTION. In a true top-down view the
 * only part of a wall you can see is its top edge, and nothing in this file used to describe that
 * surface at all — so the model filled it with whichever material the brief pushed hardest. A client
 * who picked Warm luxury ("dark walnut joinery"), Warm neutral ("with walnut timber") and Dark
 * walnut flooring got every wall top rendered in dark walnut, and the whole plan came back looking
 * like a model kit built out of wood instead of a home. It has to sit after the style, palette and
 * flooring lines to beat them on position.
 */
const SURFACE_RULE = 'SURFACES — WALL TOPS ARE WHITE, ALWAYS\nBecause the camera looks straight down, the only part of any wall you can see is its TOP surface, cut flat. Render every wall top as one flat matt band of plain warm white plaster, the same white on every wall in the building, with clean sharp edges and a soft shadow falling from it into the rooms on either side. Wall tops are NEVER timber, NEVER walnut, NEVER stone, NEVER marble, NEVER tiled, NEVER patterned and NEVER dark, whatever the style, palette, flooring and finish sections ask for — those sections describe floors, furniture, joinery and décor only, and they do not apply to wall tops. White wall tops are what make this image read as a real home seen from above rather than a model built out of wood.';

/** Trims a free-text note down to something safe to append to a prompt. */
const cleanNote = (note: string): string => note.trim().replace(/\s+/g, ' ').slice(0, 400);

/**
 * One row's contribution. An unset id contributes nothing; a Custom id contributes whatever the
 * user typed, so their own words go into the brief verbatim rather than being mapped to a preset.
 */
const rowPrompt = (
  key: FloorPlanRowKey,
  id: string | undefined,
  custom?: Partial<Record<FloorPlanRowKey, string>>,
): string => {
  if (!id) return '';
  if (id === CUSTOM_ID) return cleanNote(custom?.[key] || '');
  return ROW_OPTIONS[key].find((option) => option.id === id)?.prompt || '';
};

/** The room's new purpose in words, or '' when it keeps the one printed on the drawing. */
export const purposePhrase = (override: RoomStyleOverride): string => {
  if (!override.purpose) return '';
  if (override.purpose === CUSTOM_ID) return cleanNote(override.purposeNote || '');
  return ROOM_PURPOSES.find((option) => option.id === override.purpose)?.prompt || '';
};

/**
 * A repurposed room needs a sentence strong enough to beat the core brief, which orders the model
 * never to change the function of a labelled room and then lists what each kind of room contains.
 * So this says outright which instructions to drop, while keeping the building itself untouchable.
 */
const purposeDirective = (override: RoomStyleOverride): string => {
  const phrase = purposePhrase(override).replace(/[.\s]+$/, '');
  if (!phrase) return '';
  return `THIS ROOM'S PURPOSE HAS CHANGED: it is now ${phrase}. The client has decided this, so for this room ignore the function printed on the drawing and ignore every earlier instruction about what a room of that name contains. Furnish it completely and only as ${phrase}, and leave out the fittings and furniture that belonged to its old purpose. Its walls, doors and windows do not change.`;
};

/** True when a room has been given any direction of its own. Also drives the UI badge. */
export const hasRoomOverride = (override?: RoomStyleOverride): boolean => Boolean(
  override && (
    purposePhrase(override)
    || Object.values(override.rows || {}).some(Boolean)
    || (override.note || '').trim()
  ),
);

/** One room's own direction, assembled from only the rows it actually overrides. */
const roomDirective = (override: RoomStyleOverride): string => [
  purposeDirective(override),
  ...PER_ROOM_ROWS.map((row) => rowPrompt(row.key, override.rows?.[row.key], override.custom)),
  cleanNote(override.note || ''),
].filter(Boolean).join(' ');

/**
 * The per-room block. This is what makes "style the whole floor, or go room by room, in one go"
 * work without any geometry: GPT Image 2 reads the room names printed on the drawing, so naming a
 * room in the prompt is enough to target it. Rooms with no override are left out entirely, which
 * keeps the block short and stops an unstyled room being described twice in conflicting terms.
 */
const buildRoomBlock = (rooms: RoomDirection[]): string => {
  const lines = rooms
    .map((room) => ({
      names: room.names.map((name) => name.trim().toUpperCase()).filter(Boolean),
      directive: roomDirective(room.override),
    }))
    // A group is worth a line even with no styling of its own: "treat these as one space" is
    // itself the instruction. A lone room with nothing set is left out to keep the block short.
    .filter((room) => room.names.length && (room.directive || room.names.length > 1))
    .map((room) => (room.names.length > 1
      ? `${room.names.join(' + ')} — treat these as ONE single continuous space with one shared scheme flowing across the whole area. Do not invent any divider between them. Where the blueprint draws no wall between them they stay completely open to each other; where it does draw a wall, keep that wall exactly as it is and simply run the same scheme through both.${room.directive ? ` ${room.directive}` : ''}`
      : `${room.names[0]} — ${room.directive}`));
  if (!lines.length) return '';
  return [
    'PER-ROOM DESIGN DIRECTION — HIGHEST PRIORITY FOR THE ROOMS NAMED HERE',
    'Each line below names a room, or a set of rooms, and gives it its own direction. Inside those rooms these instructions REPLACE the whole-home direction above, and where a line changes a room\'s purpose it also overrides the room labelling and furnishing rules stated earlier. Apply each line only within the rooms named on it and never let it spill into a neighbouring room. Every room NOT named below follows the whole-home direction exactly. The building itself never changes — these lines affect finishes, furniture, fittings and lighting only, never a wall, a door or a window.',
    ...lines,
  ].join('\n');
};

/**
 * Builds the prompt for the main whole-home render.
 * `planBrief` is the written reading of the drawing from the analyzer — it is how detail that
 * the image model would otherwise gloss over (room names and purposes, stair direction, which
 * wall each window sits in) actually reaches it.
 */
export const buildFloorPlanPrompt = (
  choices: FloorPlanChoices,
  options: {
    planBrief?: string;
    safeMode?: boolean;
    editHistory?: string[];
    rooms?: RoomDirection[];
    /**
     * True when the FIRST reference image is the render currently on screen, with the blueprint
     * second. Edits are sent that way so the model can copy the picture the client is looking at
     * instead of building the whole home again from the drawing and calling it an edit.
     */
    editFromCurrentRender?: boolean;
  } = {},
): string => {
  const parts = [CORE_INSTRUCTION];

  // ⛔ Pushed AFTER CORE_INSTRUCTION on purpose — see FLOOR_PLAN_UPLOAD_KINDS. Falls back to a whole
  // home so a saved project, a targeted edit or an undo can never render with this block missing.
  const uploadKind = FLOOR_PLAN_UPLOAD_KINDS.find((kind) => kind.id === choices.uploadKind)
    || FLOOR_PLAN_UPLOAD_KINDS[0];
  parts.push(uploadKind.prompt);

  const furniture = FLOOR_PLAN_FURNITURE_MODES.find((mode) => mode.id === choices.furnitureMode)
    || FLOOR_PLAN_FURNITURE_MODES[0];
  parts.push(furniture.prompt);

  const line = (key: FloorPlanRowKey) => rowPrompt(key, choices.rows[key], choices.custom);
  parts.push([
    'WHOLE-HOME DESIGN DIRECTION — applies to every room unless a room is named in the per-room section below.',
    // Style and palette must always say something, or the model invents a scheme of its own.
    // They can fall empty if the user picks Custom and then types nothing.
    line('style') || FLOOR_PLAN_STYLES[0].prompt,
    line('palette') || FLOOR_PLAN_PALETTES[0].prompt,
    line('flooring'),
    line('lighting'),
    line('ceiling'),
    line('finish'),
  ].filter(Boolean).join('\n'));

  parts.push(SURFACE_RULE);

  const roomBlock = buildRoomBlock(options.rooms || []);
  if (roomBlock) parts.push(roomBlock);

  const brief = (options.planBrief || '').trim();
  if (brief) {
    parts.push([
      'ARCHITECT\'S READING OF THIS EXACT DRAWING — treat every line of this as fact about the attached plan. Where it names a room, that room must be furnished for that purpose. Where it states a total, match that total exactly. Where it describes a wall, an opening, a staircase, a structure or a built-in fitting, build exactly what it describes.',
      // ⛔ The reading carries a room-by-room inventory of the furniture SYMBOLS on the drawing,
      // and the analyzer is deliberately told to make it thorough. Sitting unlabelled under
      // "follow it", that inventory silently out-voted the client's own furniture choice and the
      // rejected layout came straight back. It must be labelled for the mode in force.
      choices.furnitureMode === 'fresh'
        ? 'ONE EXCEPTION: its FURNITURE SYMBOLS section describes the OLD loose-furniture layout that the client has asked you to REPLACE. Read it only so you know what is being removed, and do not reproduce any of it. The FURNITURE SOURCE section above decides the loose furniture. Every other section of the reading still applies in full.'
        : 'Its FURNITURE SYMBOLS section is the drawn layout you are rebuilding, so follow it closely.',
      brief,
    ].join('\n'));
  }

  // Edits are appended in the order the user asked for them, so later corrections win.
  const edits = (options.editHistory || []).map(cleanNote).filter(Boolean);
  if (edits.length) {
    parts.push([
      // ⛔ "Keep everything else as it is" is only obeyable if the model can SEE what it already
      // made. When an edit was rendered from the blueprint alone, the whole home was generated
      // afresh every time and every room came back different — which is exactly what the client
      // means by "it changed the whole image, not just what I asked for".
      options.editFromCurrentRender
        ? 'THIS IS A TARGETED EDIT OF AN IMAGE THAT ALREADY EXISTS.\nREFERENCE IMAGE 1 is the finished render the client is looking at right now. It is the starting point and it is almost entirely correct. REFERENCE IMAGE 2 is the original blueprint, and it remains the authority for the walls, doors and windows.\nReproduce REFERENCE IMAGE 1 as closely as you possibly can — the same layout, the same furniture in the same places, the same materials, the same colours, the same flooring, the same lighting — and change ONLY the specific things listed below. Everything the client has not mentioned must come out looking the same as it does in REFERENCE IMAGE 1. Do not restyle a room, do not re-arrange furniture, do not swap a material and do not adjust the lighting anywhere the list does not name. Treat every pixel you were not asked about as already approved.\nThese requests are the only permission you have to alter the building, and that permission covers nothing but what each line names. Every other wall, partition, door, window and opening stays exactly as it is: do not add one, move one, remove one, straighten one or tidy one up, for any reason. If a change names one wall, that one wall is the only wall that changes. If some other part of the plan looks like it would be better altered, leave it alone — that is not what was asked.\nTHE CHANGES, and nothing else:'
        : 'REQUESTED CHANGES — the client has asked for these specific changes, and ONLY these. Apply each one exactly as written, then stop.\nThese requests are the only permission you have to alter the building, and that permission covers nothing but what each line names. Every other wall, partition, door, window and opening stays exactly as the blueprint draws it: do not add one, move one, remove one, straighten one or tidy one up, for any reason. If a change names one wall, that one wall is the only wall that changes. If some other part of the plan looks like it would be better altered, leave it alone — that is not what was asked. Every room not named below keeps the finishes, furniture and layout it already has:',
      edits.map((edit, index) => `${index + 1}. ${edit}`).join('\n'),
    ].join('\n'));
  }

  const note = cleanNote(choices.customNote);
  if (note) parts.push(`ALSO REQUESTED BY THE CLIENT: ${note}`);

  if (options.safeMode) {
    parts.push('Keep the image a neutral, unfurnished-of-people architectural visualisation. No people, no figures, no artwork on walls, no brand names, no logos.');
  }

  return parts.join('\n\n');
};

/**
 * Builds the prompt for a single-room close-up, used when the user taps a room and asks for it
 * in detail. Anchored on the whole-home render so the room's finishes stay consistent with it.
 */
export const buildRoomZoomPrompt = (
  roomName: string,
  choices: FloorPlanChoices,
  options: { planBrief?: string; safeMode?: boolean; override?: RoomStyleOverride } = {},
): string => {
  const override = options.override || {};
  const purpose = purposePhrase(override);
  const parts = [
    'ARCHITECTURAL ROOM PLAN VISUALIZATION (STRICT MODE)',
    `The uploaded image is a finished top-down plan of a whole home. Find the room labelled ${roomName} in it and produce a close-up of ONLY that room, filling the frame. Everything else is cropped away.`,
    'CAMERA\nOrthographic. True top-down. Ninety degrees overhead. No perspective. No isometric. No dollhouse cutaway. No angled camera. Keep the room at exactly the rotation it has in the uploaded image.',
    `GEOMETRY IS LOCKED\nThe ${roomName} keeps the exact shape, proportions, wall positions and wall thicknesses it has in the uploaded image. Every doorway and window stays in the same wall at the same position. Every piece of furniture stays in the same place, at the same size, facing the same way. This is the same room shown closer, NOT a redesign of it.`,
    'DETAIL\nThis is a close-up, so raise the level of finish: visible material texture and grain, fabric weave, correct tile and plank scale, realistic soft shadows under every object, warm practical lighting from the room\'s own fittings, styled accessories. Ultra photorealistic architectural visualisation, 8K, magazine quality.',
    'BACKGROUND\nEverything outside this room\'s walls is plain flat pure white and completely empty.',
    'NO TEXT\nRender no words, no room names, no dimensions, no labels, no logos and no watermarks anywhere in the image.',
  ];

  // The close-up must repeat this room's own direction, or it silently reverts to the whole-home
  // scheme and stops matching the room the user is looking at.
  // The room's own row wins; where it inherits, the whole-home row is used instead.
  const line = (key: FloorPlanRowKey) => rowPrompt(key, override.rows?.[key], override.custom)
    || rowPrompt(key, choices.rows[key], choices.custom);
  parts.push([
    purpose
      ? `This room has been repurposed and in the uploaded image it is already furnished as ${purpose.replace(/[.\s]+$/, '')}. Keep it that way — do not put back anything belonging to the function its name suggests.`
      : '',
    line('style') || FLOOR_PLAN_STYLES[0].prompt,
    line('palette') || FLOOR_PLAN_PALETTES[0].prompt,
    line('flooring'),
    line('lighting'),
    rowPrompt('ceiling', choices.rows.ceiling, choices.custom),
    rowPrompt('finish', choices.rows.finish, choices.custom),
    cleanNote(override.note || ''),
  ].filter(Boolean).join('\n'));

  parts.push(SURFACE_RULE);

  const brief = (options.planBrief || '').trim();
  if (brief) {
    parts.push([
      // ⛔ The close-up must match the render on screen, which is already furnished. The reading
      // describes the ORIGINAL DRAWING, so its furniture inventory is the wrong authority here in
      // either furniture mode — it would drag the close-up back towards the blueprint's symbols.
      `ARCHITECT'S READING OF THE ORIGINAL DRAWING — use only the parts that describe the ${roomName}, and only for its walls, openings, structure and built-in fittings. Ignore its FURNITURE SYMBOLS section completely: the uploaded image is already furnished, and its furniture is what you must keep.`,
      brief,
    ].join('\n'));
  }

  const note = cleanNote(choices.customNote);
  if (note) parts.push(`ALSO REQUESTED BY THE CLIENT: ${note}`);

  if (options.safeMode) {
    parts.push('Keep it a neutral architectural visualisation. No people, no figures, no artwork on walls, no brand names, no logos.');
  }

  return parts.join('\n\n');
};

export const DEFAULT_FLOOR_PLAN_CHOICES: FloorPlanChoices = {
  furnitureMode: 'keep',
  // ⛔ Deliberately unset: the client must pick before the plan step will advance. Guessing this is
  // what turned a master suite's 6m x 6m dressing room into a lounge with a dining table in it.
  uploadKind: null,
  // Whole home first: it is the one-tap path, and it is the base every room falls back to.
  scope: 'home',
  rows: {
    style: FLOOR_PLAN_STYLES[0].id,
    palette: FLOOR_PLAN_PALETTES[0].id,
    // Empty means "designer's choice", so an untouched row adds nothing to the prompt.
    flooring: '',
    lighting: '',
    ceiling: '',
    finish: '',
  },
  custom: {},
  // ⛔ Always best. There is no picker and no upgrade step — the first thing the user sees must be
  // the good version, not a cheap preview that loses staircases and fine detail.
  speed: 'best',
  customNote: '',
};
