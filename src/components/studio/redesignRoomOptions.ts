export type RedesignOption = {
  value: string;
  en: string;
  ar: string;
  prompt: string;
  /**
   * Palettes only. The exact finishes that palette resolves to.
   *
   * ⛔ THIS IS WHAT MAKES THE TWO VIEWS LOOK LIKE ONE ROOM. A palette prompt on its own is far
   * too loose to land in the same place twice: "warm beige and sand tones" was read by one render
   * as cool cream walls with a sage accent and a grey sofa, and by the other as warm cream walls
   * with a dark teal arch and a cream sofa. Both obeyed the words; the room stopped matching.
   * Naming the actual finishes makes the brief deterministic, so consistency no longer depends on
   * the model successfully copying a reference image.
   */
  materials?: string;
};

/**
 * Two eye-level views, one per half of the room.
 *
 * A third 'top' (dollhouse/aerial) view was removed deliberately. This model treats reference
 * images as "edit these pixels" and keeps the reference camera, so a written camera instruction
 * cannot override it — the aerial was handed two eye-level renders and returned eye-level every
 * time, despite three separate blunt instructions not to. There is no reference available with
 * the right camera, so the view was dropped rather than shipped permanently wrong.
 * `DesignerSavedProjects.tsx` still maps the old 'top' key so previously saved sets still label.
 */
export type RedesignViewKey = 'halfA' | 'halfB';

export type RedesignChoices = {
  roomType: string;
  roomTypeCustom: string;
  style: string;
  styleCustom: string;
  palette: string;
  paletteCustom: string;
  lighting: string;
  lightingCustom: string;
  flooring: string;
  flooringCustom: string;
  finish: string;
  furniture: string;
  furnitureCustom: string;
  structure: string;
  structureCustom: string;
};

export const REDESIGN_ROOM_TYPES: RedesignOption[] = [
  { value: 'living', en: 'Living Room', ar: 'غرفة المعيشة', prompt: 'living room' },
  { value: 'majlis', en: 'Majlis', ar: 'مجلس', prompt: 'traditional Gulf majlis sitting room' },
  { value: 'bedroom', en: 'Bedroom', ar: 'غرفة النوم', prompt: 'bedroom' },
  { value: 'master-bedroom', en: 'Master Bedroom', ar: 'غرفة النوم الرئيسية', prompt: 'master bedroom suite' },
  { value: 'kids-room', en: 'Kids Room', ar: 'غرفة الأطفال', prompt: 'children bedroom' },
  { value: 'guest-room', en: 'Guest Room', ar: 'غرفة الضيوف', prompt: 'guest bedroom' },
  { value: 'kitchen', en: 'Kitchen', ar: 'المطبخ', prompt: 'kitchen' },
  { value: 'dining', en: 'Dining Room', ar: 'غرفة الطعام', prompt: 'dining room' },
  { value: 'bathroom', en: 'Bathroom', ar: 'الحمّام', prompt: 'bathroom' },
  { value: 'office', en: 'Home Office', ar: 'المكتب المنزلي', prompt: 'home office' },
  { value: 'entry', en: 'Entry / Hallway', ar: 'المدخل / الممر', prompt: 'entry foyer and hallway' },
  { value: 'gym', en: 'Home Gym', ar: 'صالة رياضية منزلية', prompt: 'home gym' },
  { value: 'cinema', en: 'Home Cinema', ar: 'سينما منزلية', prompt: 'home cinema room' },
  { value: 'playroom', en: 'Playroom', ar: 'غرفة لعب', prompt: 'kids playroom' },
  { value: 'closet', en: 'Walk-in Closet', ar: 'غرفة ملابس', prompt: 'walk-in closet dressing room' },
  { value: 'laundry', en: 'Laundry Room', ar: 'غرفة الغسيل', prompt: 'laundry utility room' },
  { value: 'balcony', en: 'Balcony / Terrace', ar: 'شرفة / تراس', prompt: 'balcony terrace lounge' },
  { value: 'custom', en: 'Custom…', ar: 'مخصص…', prompt: 'room' },
];

export const REDESIGN_STYLES: RedesignOption[] = [
  { value: 'modern', en: 'Modern', ar: 'عصري', prompt: 'modern' },
  { value: 'scandinavian', en: 'Scandinavian', ar: 'اسكندنافي', prompt: 'Scandinavian' },
  { value: 'minimal', en: 'Minimal', ar: 'بسيط', prompt: 'minimalist' },
  { value: 'classic', en: 'Classic', ar: 'كلاسيكي', prompt: 'classic' },
  { value: 'warm', en: 'Warm', ar: 'دافئ', prompt: 'warm cosy' },
  { value: 'luxury', en: 'Luxury', ar: 'فاخر', prompt: 'high-end luxury' },
  { value: 'contemporary', en: 'Contemporary', ar: 'معاصر', prompt: 'contemporary' },
  { value: 'industrial', en: 'Industrial', ar: 'صناعي', prompt: 'industrial loft' },
  { value: 'japandi', en: 'Japandi', ar: 'جباندي', prompt: 'Japandi' },
  { value: 'mid-century', en: 'Mid-Century', ar: 'منتصف القرن', prompt: 'mid-century modern' },
  { value: 'bohemian', en: 'Bohemian', ar: 'بوهيمي', prompt: 'bohemian' },
  { value: 'art-deco', en: 'Art Deco', ar: 'آرت ديكو', prompt: 'art deco' },
  { value: 'rustic', en: 'Rustic', ar: 'ريفي', prompt: 'rustic' },
  { value: 'coastal', en: 'Coastal', ar: 'ساحلي', prompt: 'coastal' },
  { value: 'arabic', en: 'Arabic', ar: 'عربي', prompt: 'modern Arabic Islamic' },
  { value: 'neoclassic', en: 'Neoclassic', ar: 'نيوكلاسيك', prompt: 'neoclassical' },
  { value: 'moroccan', en: 'Moroccan', ar: 'مغربي', prompt: 'Moroccan' },
  { value: 'custom', en: 'Custom…', ar: 'مخصص…', prompt: 'bespoke' },
];

export const REDESIGN_PALETTES: RedesignOption[] = [
  {
    value: 'neutral',
    en: 'Neutral',
    ar: 'محايد',
    prompt: 'soft neutral tones',
    materials: 'walls in soft chalk white; upholstery in light greige linen; curtains in off-white; all woods in pale natural oak; all metals in matt brushed nickel; rugs in soft ivory wool',
  },
  {
    value: 'warm-beige',
    en: 'Warm Beige',
    ar: 'بيج دافئ',
    prompt: 'warm beige and sand tones',
    materials: 'walls in warm off-white; at most ONE accent wall, in soft camel beige; upholstery in oatmeal linen; curtains in ivory; all woods in honey-toned natural oak; all metals in brushed brass; rugs in pale sand wool',
  },
  {
    value: 'cool-grey',
    en: 'Cool Grey',
    ar: 'رمادي بارد',
    prompt: 'cool grey tones',
    materials: 'walls in pale cool grey; upholstery in mid dove-grey fabric; curtains in light silver-grey; all woods in grey-washed oak; all metals in polished chrome; rugs in charcoal-flecked grey wool',
  },
  {
    value: 'white-wood',
    en: 'White & Wood',
    ar: 'أبيض وخشبي',
    prompt: 'white with natural wood tones',
    materials: 'walls in clean bright white; upholstery in white and natural cotton; curtains in sheer white linen; all woods in pale blonde ash left visible throughout; all metals in matt black; rugs in undyed natural jute',
  },
  {
    value: 'earth',
    en: 'Earth Tones',
    ar: 'ألوان ترابية',
    prompt: 'earthy terracotta and clay tones',
    materials: 'walls in warm clay plaster; upholstery in terracotta and rust woven fabric; curtains in unbleached natural linen; all woods in mid-brown walnut; all metals in aged bronze; rugs in ochre and rust patterned wool',
  },
  {
    value: 'dark-moody',
    en: 'Dark & Moody',
    ar: 'داكن وهادئ',
    prompt: 'dark moody charcoal tones',
    materials: 'walls in deep charcoal; upholstery in graphite velvet; curtains in heavy dark charcoal; all woods in near-black stained oak; all metals in gunmetal; rugs in deep slate grey',
  },
  {
    value: 'navy-gold',
    en: 'Navy & Gold',
    ar: 'كحلي وذهبي',
    prompt: 'navy blue with brushed gold accents',
    materials: 'walls in soft warm white with at most ONE deep navy accent wall; upholstery in navy velvet; curtains in ivory; all woods in dark walnut; all metals in brushed gold; rugs in cream with a navy border',
  },
  {
    value: 'green-brass',
    en: 'Green & Brass',
    ar: 'أخضر ونحاسي',
    prompt: 'deep green with brass accents',
    materials: 'walls in soft warm white with at most ONE deep forest-green accent wall; upholstery in emerald velvet; curtains in warm ivory; all woods in mid-brown walnut; all metals in unlacquered brass; rugs in cream and green',
  },
  {
    value: 'cream-caramel',
    en: 'Cream & Caramel',
    ar: 'كريمي وكراميل',
    prompt: 'cream and caramel leather tones',
    materials: 'walls in soft cream; upholstery in caramel tan leather and cream bouclé; curtains in cream; all woods in warm mid-oak; all metals in antique brass; rugs in cream with caramel tones',
  },
  { value: 'custom', en: 'Custom…', ar: 'مخصص…', prompt: 'custom palette' },
];

/**
 * Used when the owner typed their own palette, so there is no schedule to read. It cannot name
 * colours, but it can still force ONE decision per surface instead of a fresh guess per render.
 */
const CUSTOM_MATERIAL_LOCK = 'commit to ONE exact colour for the walls, ONE for the upholstery, ONE for the curtains, ONE wood tone and ONE metal finish, and repeat those same choices on every surface in the image';

/**
 * ⛔ The single line that fixes the worst inconsistency the owner saw: the same ornate arch came
 * back cream in one render and dark teal in the other. Left unsaid, the model treats decorative
 * plasterwork as somewhere to invent an accent colour.
 */
const MATERIAL_TRIM_RULE = 'ALL decorative plasterwork is painted the SAME colour as the wall or ceiling it sits on — the arch and its scrolls, spirals and medallions, plus every cornice, ceiling trim, column and skirting. Never give any of it a contrasting, darker or accent colour, unless the survey states that element is a different material such as timber, stone or metal.';

const resolvePaletteMaterials = (value: string): string =>
  REDESIGN_PALETTES.find((item) => item.value === value)?.materials || CUSTOM_MATERIAL_LOCK;

export const REDESIGN_LIGHTING: RedesignOption[] = [
  { value: 'daylight', en: 'Bright daylight', ar: 'ضوء نهار ساطع', prompt: 'bright natural daylight streaming in' },
  { value: 'warm-evening', en: 'Warm evening', ar: 'مساء دافئ', prompt: 'warm evening lighting with lamps on' },
  { value: 'soft-ambient', en: 'Soft ambient', ar: 'إضاءة هادئة', prompt: 'soft diffused ambient lighting' },
  { value: 'dramatic', en: 'Dramatic accent', ar: 'إضاءة مركزة', prompt: 'dramatic accent and cove lighting' },
  { value: 'custom', en: 'Custom…', ar: 'مخصص…', prompt: 'custom lighting' },
];

export const REDESIGN_FLOORING: RedesignOption[] = [
  { value: 'light-wood', en: 'Light Wood', ar: 'خشب فاتح', prompt: 'light oak wood flooring' },
  { value: 'dark-wood', en: 'Dark Wood', ar: 'خشب غامق', prompt: 'dark walnut wood flooring' },
  { value: 'marble', en: 'Marble', ar: 'رخام', prompt: 'polished marble flooring' },
  { value: 'porcelain', en: 'Porcelain Tile', ar: 'بورسلان', prompt: 'large-format porcelain tile flooring' },
  { value: 'concrete', en: 'Polished Concrete', ar: 'خرسانة مصقولة', prompt: 'polished concrete flooring' },
  { value: 'carpet', en: 'Carpet', ar: 'سجاد', prompt: 'full carpet flooring' },
  { value: 'terrazzo', en: 'Terrazzo', ar: 'تيرازو', prompt: 'terrazzo flooring' },
  { value: 'keep', en: 'Keep existing', ar: 'إبقاء الحالي', prompt: 'keep the existing flooring exactly as shown in the photos' },
  { value: 'custom', en: 'Custom…', ar: 'مخصص…', prompt: 'custom flooring' },
];

export const REDESIGN_FINISH_LEVELS: RedesignOption[] = [
  { value: 'essential', en: 'Essential', ar: 'أساسي', prompt: 'budget-friendly essential finishes' },
  { value: 'balanced', en: 'Balanced', ar: 'متوازن', prompt: 'mid-range balanced finishes' },
  { value: 'premium', en: 'Premium', ar: 'ممتاز', prompt: 'premium finishes and materials' },
  { value: 'ultra', en: 'Ultra Luxury', ar: 'فخامة عالية', prompt: 'ultra-luxury bespoke finishes' },
];

// How much freedom the model has with the furniture. Every option except the last two keeps
// the piece count honest, because the whole point of this feature is the user's real room.
export const REDESIGN_FURNITURE: RedesignOption[] = [
  {
    value: 'keep-all',
    en: 'Keep everything',
    ar: 'احتفظ بكل شيء',
    prompt: 'FURNITURE IS LOCKED: keep every existing piece of furniture exactly as it is — the same pieces, in the same positions, at the same orientation, with the same footprint and the same walking paths between them. Do not move anything, do not add anything, do not remove anything, and do not change how many desks, chairs, sofas or tables there are. Only re-finish what is already there: refresh the materials, upholstery, colours and decor.',
  },
  {
    value: 'upgrade-in-place',
    en: 'Same spots, nicer pieces',
    ar: 'نفس المواقع، قطع أجمل',
    prompt: 'FURNITURE POSITIONS ARE LOCKED: every piece stays exactly where the attached photograph shows it — the same position, the same orientation, the same footprint, the same walking paths, and the same number of desks, chairs, sofas and tables. You are allowed to replace each piece with a more beautiful version of the same kind of piece in the chosen style, and to change materials, colours, upholstery and decor.',
  },
  {
    value: 'declutter',
    en: 'Clear the clutter',
    ar: 'أزل الفوضى',
    prompt: 'Keep the main furniture where the attached photograph shows it, but strip out all clutter, excess small items, loose paperwork, visible cables and stray objects, for a calm, uncluttered, showroom-ready result.',
  },
  {
    value: 'rearrange',
    en: 'Rearrange for better flow',
    ar: 'أعد التوزيع',
    prompt: 'You may rearrange the furniture into a better, more comfortable layout with clearer circulation, keeping roughly the same amount of furniture and the same purpose for the space, and keeping the walls, windows and doors exactly as they are.',
  },
  {
    value: 'new-furniture',
    en: 'All new furniture',
    ar: 'أثاث جديد تماماً',
    prompt: 'Replace the furniture entirely with new pieces of your own choosing, arranged in whatever layout suits the space best, while keeping the room clearly fit for its stated purpose and keeping the walls, windows and doors exactly as they are.',
  },
  { value: 'custom', en: 'Custom…', ar: 'مخصص…', prompt: 'custom furniture treatment' },
];

// How much freedom the model has with the shell itself. Exterior openings are never
// negotiable, because moving a window is what makes a render stop being the user's room.
export const REDESIGN_STRUCTURE: RedesignOption[] = [
  {
    value: 'keep-exact',
    en: 'Keep structure',
    ar: 'احتفظ بالهيكل',
    prompt: 'ARCHITECTURE IS LOCKED: keep the walls, the ceiling construction, and every window and every door exactly as they appear, at the same size, the same shape and the same position.',
  },
  {
    value: 'ceiling',
    en: 'Upgrade the ceiling',
    ar: 'طور السقف',
    prompt: 'Keep every wall, window and door exactly as it is, but you may redesign the ceiling itself into something more refined, such as timber slats, coffers, a floating tray or concealed cove lighting.',
  },
  {
    value: 'built-ins',
    en: 'Add built-in joinery',
    ar: 'أضف أعمال خشبية مدمجة',
    prompt: 'Keep every wall, window and door exactly as it is, but you may add built-in joinery against the existing walls, such as a feature wall, wall panelling, integrated shelving or a built-in media unit.',
  },
  {
    value: 'open-up',
    en: 'Open it up',
    ar: 'افتح المساحة',
    prompt: 'Keep the exterior walls and every window and every door exactly as they are, but you may remove or lower non-structural internal partitions so the space feels more open and connected.',
  },
  { value: 'custom', en: 'Custom…', ar: 'مخصص…', prompt: 'custom structural treatment' },
];

export const REDESIGN_VIEWS: Array<{
  key: RedesignViewKey;
  titleEn: string;
  titleAr: string;
  hintEn: string;
  hintAr: string;
  /**
   * ⛔ 'auto' on purpose — do not put a fixed ratio back here.
   *
   * These renders are edits of the owner's own photograph, and phone photos are portrait. Asking
   * for 16:9 forced the model to invent the left and right edges of the room to fill a landscape
   * frame, so "keep the camera exactly as it is" became impossible and the result stopped looking
   * like the owner's room. 'auto' makes the output match the reference's shape.
   * `normalizeAspectRatio` in the edge function accepts 'auto' and defaults to it.
   */
  aspectRatio: string;
  /** Placeholder box shape only, used before a render exists. Finished renders size naturally. */
  aspectClass: string;
  instruction: string;
}> = [
  {
    key: 'halfA',
    titleEn: 'Room half 1',
    titleAr: 'نصف الغرفة الأول',
    hintEn: 'Wide eye-level view of the first half',
    hintAr: 'منظر واسع للنصف الأول',
    aspectRatio: 'auto',
    aspectClass: 'aspect-[16/9]',
    // Framing only. WHICH reference defines the camera is decided by the render mode in
    // buildRedesignPrompt. Never restate camera roles here as well, or the two contradict.
    // "Wide-angle" describes the LENS, not the frame shape, so it still holds for a tall frame.
    instruction: 'Deliver a wide-angle eye-level interior photograph that keeps the full height of the room, from the floor to the ceiling, inside the frame.',
  },
  {
    key: 'halfB',
    titleEn: 'Room half 2',
    titleAr: 'نصف الغرفة الثاني',
    hintEn: 'Wide eye-level view of the opposite half',
    hintAr: 'منظر واسع للنصف الآخر',
    aspectRatio: 'auto',
    aspectClass: 'aspect-[16/9]',
    instruction: 'Deliver a wide-angle eye-level interior photograph that keeps the full height of the room, from the floor to the ceiling, inside the frame.',
  },
];

export const resolveChoiceLabel = (
  options: RedesignOption[],
  value: string,
  customValue: string,
  language: 'en' | 'ar',
): string => {
  if (value === 'custom' && customValue.trim()) return customValue.trim();
  const option = options.find((item) => item.value === value);
  if (!option) return value;
  return language === 'ar' ? option.ar : option.en;
};

const resolvePromptPart = (
  options: RedesignOption[],
  value: string,
  customValue: string,
): string => {
  if (value === 'custom' && customValue.trim()) return customValue.trim();
  return options.find((item) => item.value === value)?.prompt || '';
};

/**
 * Which link of the chain a render is. This decides what the attached references MEAN, which is
 * the single most important thing the model has to be told.
 *
 *   establish → 1 reference:  the owner's photo of this half. This render invents the design.
 *   match     → 2 references: [the owner's photo of the OTHER half, the approved render].
 *               Camera and architecture come from reference 1; design comes from reference 2.
 *
 * ⛔ THE ORDER IS THE WHOLE FIX. This model anchors composition to the FIRST reference, so the
 * approved render used to sit in slot 1 and half 2 inherited half 1's camera — both renders came
 * back showing the same end of the room. The camera photo must always occupy slot 1.
 */
export type RedesignRenderMode = 'establish' | 'match' | 'edit';

export type RedesignPromptContext = {
  /** Written survey of the room, produced from every uploaded photo. */
  roomAnalysis?: string;
  /**
   * Retry variant. Grok's content filter intermittently refuses interiors described with
   * words like "master bedroom suite" (Kie error 431, "content safety restrictions").
   * Safe mode drops the room-type wording and frames the request as unoccupied
   * real-estate photography, which clears the filter without changing the design.
   */
  safeMode?: boolean;
  /**
   * ⛔ The whole reason the three images finally look like one room.
   *
   * Consistency used to be carried by PROSE read back off render 1, and prose cannot pin down
   * which sofa, which oak or which rug — so every view quietly invented its own and the owner got
   * three different rooms. Pixels can pin it down, so each render now receives the previous
   * render itself. And because references beat words in image-to-image, each render gets exactly
   * ONE camera reference: piling four photos onto every view made all three collapse onto the
   * same dominant wall.
   */
  renderMode: RedesignRenderMode;
  /**
   * The ONE change the client asked for, used only by the 'edit' mode. It leads that prompt,
   * because an instruction buried at word 700 is an instruction the model ignores — the exact
   * lesson the owner's-brief block below was reordered for.
   */
  editInstruction?: string;
};

// Used by both chained modes. Naming the categories one by one matters: "match the style" gets
// read as "same vibe", which is exactly how a bench at the foot of the bed became a sofa.
const DESIGN_LOCK = 'the same wall colour and wall finish, the same ceiling treatment, the same flooring, the same curtains, the same light fittings and the same colour temperature, the same furniture pieces, the same upholstery fabrics and colours, the same metals, the same woods, the same rugs, and the same art and accessories';

export const buildRedesignPrompt = (
  choices: RedesignChoices,
  viewKey: RedesignViewKey,
  language: 'en' | 'ar',
  context: RedesignPromptContext,
): string => {
  // ⛔ THE EDIT PROMPT IS ITS OWN PROMPT, built before anything else and deliberately WITHOUT the
  // design brief. The render being edited already embodies every choice the owner made, so
  // restating the brief would only invite the model to re-style a picture it was told to copy.
  // Its single reference is the finished render itself.
  if (context.renderMode === 'edit') {
    const instruction = (context.editInstruction || '').trim().replace(/\s+/g, ' ').slice(0, 300);
    return [
      'THIS IS A TARGETED EDIT OF AN IMAGE THAT ALREADY EXISTS.',
      'The attached image is a finished interior render the client is looking at right now, and it is almost entirely correct. Reproduce it as closely as you possibly can — the same camera position, viewing direction and framing, the same room shape, the same windows and doors, the same furniture in the same places, the same materials, the same colours, the same lighting — and change ONLY what the instruction below names.',
      'Everything the client has not mentioned must come out looking exactly as it does in the attached image. Treat every pixel you were not asked about as already approved. Do not restyle a wall, do not rearrange furniture, do not swap a material and do not adjust the lighting anywhere the instruction does not name. If the instruction names one object, that one object is the only thing that changes.',
      `THE CHANGE THE CLIENT IS ASKING FOR, and nothing else: ${instruction}`,
      'Apply that change properly and unmistakably — a client who has to squint to find it will ask again. If it names a colour, use that exact colour. If it names a position, use that exact position.',
      'Output exactly one single image. Photorealistic architectural interior visualisation. No people, no pets, no text, no watermark, no collage, no split screen, no picture-in-picture.',
    ].join('\n');
  }

  const view = REDESIGN_VIEWS.find((item) => item.key === viewKey)!;
  const roomType = resolvePromptPart(REDESIGN_ROOM_TYPES, choices.roomType, choices.roomTypeCustom);
  const style = resolvePromptPart(REDESIGN_STYLES, choices.style, choices.styleCustom);
  const palette = resolvePromptPart(REDESIGN_PALETTES, choices.palette, choices.paletteCustom);
  // Identical for both views by construction, which is the entire point — see `materials`.
  const paletteMaterials = resolvePaletteMaterials(choices.palette);
  const lighting = resolvePromptPart(REDESIGN_LIGHTING, choices.lighting, choices.lightingCustom);
  const flooring = resolvePromptPart(REDESIGN_FLOORING, choices.flooring, choices.flooringCustom);
  const finish = resolvePromptPart(REDESIGN_FINISH_LEVELS, choices.finish, '');
  const furniture = resolvePromptPart(REDESIGN_FURNITURE, choices.furniture, choices.furnitureCustom);
  const structure = resolvePromptPart(REDESIGN_STRUCTURE, choices.structure, choices.structureCustom);
  const analysis = (context.roomAnalysis || '').trim();
  const mode = context.renderMode;
  // In safe mode the room-type wording is dropped entirely, because that is the token
  // Grok's filter reacts to. The survey and the reference image still carry the meaning.
  const subject = context.safeMode ? 'interior space' : roomType;

  // What the attached references ARE. Everything else in the prompt depends on the model getting
  // this right, so it is stated first and in the bluntest possible terms.
  const referenceBlock: string[] = mode === 'establish'
    ? [
      `Restyle the real ${subject} in the attached photograph into a photorealistic ${style} interior.`,
      'CRITICAL — THIS IS A RESTYLE OF THE ATTACHED PHOTOGRAPH, NOT A NEW ROOM. The attached image is a real photograph of the actual room, and it is the ground truth for everything structural. Keep its camera position, viewing direction and framing. Keep the exact room shape and proportions, the exact ceiling height and the exact ceiling construction. Keep every window and every door precisely where it is, at the same size and the same shape. Never invent a different room, never move a wall, never add or remove an opening, never change the room outline. Only finishes, materials, colours, furniture design and decor may change.',
    ]
    : [
      'TWO IMAGES ARE ATTACHED AND THEY HAVE DIFFERENT JOBS. Never blend them and never output a collage.',
      `IMAGE 1 IS THE ROOM YOU ARE RESTYLING, AND IT SETS THE CAMERA. It is a real photograph of the actual ${subject}, taken looking towards the OPPOSITE end from image 2. Keep its camera position, its viewing direction, its camera height and its framing EXACTLY as they are. Keep its architecture exactly: the walls where they are, the ceiling height and construction, and every window, every door and every fixed fitting at its true size and position. Its old finishes, colours and furniture are all replaced by the new design.`,
      `IMAGE 2 IS THE APPROVED DESIGN FOR THIS SAME ROOM. It shows the other end of this one room, already redesigned and accepted by the owner. Match it exactly for ${DESIGN_LOCK}.`,
      `⛔ DO NOT COPY IMAGE 2's CAMERA, VIEWING DIRECTION OR FRAMING. Image 2 faces the opposite way. Your image must look where IMAGE 1 looks and show what IMAGE 1 shows. If your result ends up framed like image 2, it is wrong.`,
      'Where the instructions below say "the attached photograph", they mean IMAGE 1.',
    ];

  // ⛔ THE OWNER'S PICKS LEAD THE PROMPT. They used to sit at roughly word 700, behind the
  // reference block, the fixed-items block and a 400-word survey, as five bare unemphasised lines —
  // and on the matched render they were then explicitly demoted with "listed for reference only".
  // The owner rightly complained his choices were being ignored. These models weight early
  // instructions far more heavily, so the brief now comes first and states that it is mandatory.
  const brief: string[] = [
    "THE OWNER'S DESIGN BRIEF — THIS IS WHAT THEY PAID FOR AND IT IS NOT OPTIONAL:",
    `• Interior style: ${style}.`,
    `• Colour palette: ${palette}.`,
    `• Lighting: ${lighting}.`,
    `• Flooring: ${flooring}.`,
    `• Finish quality: ${finish}.`,
    'All five must be clearly visible in the result. A render that quietly ignores the style or the palette has failed, however attractive it looks.',
    // ⛔ The schedule and the trim rule are sent with BOTH views, word for word. That is what makes
    // the two renders match: they are aiming at the same named finishes instead of each
    // re-interpreting a loose phrase like "warm beige and sand tones".
    `LOCKED MATERIAL SCHEDULE — use these exact finishes and no others: ${paletteMaterials}.`,
    MATERIAL_TRIM_RULE,
    'This schedule is fixed for every view of this room, so never substitute a colour, a wood or a metal of your own. Two photographs of one room must show the same walls, the same upholstery and the same woodwork.',
  ];

  // ⛔ A FURNISH INSTRUCTION IS ALWAYS SENT. NEVER make this conditional.
  //
  // The matched render once had it removed, to stop the owner's "replace the furniture with pieces
  // of your own choosing" pick from contradicting "reuse image 2's exact pieces". The result was a
  // completely EMPTY room: image 1's old furniture was correctly deleted, nothing in image 2
  // "belonged" to image 1's foreground, and no line was left telling the model to furnish anything.
  // The owner got bare floorboards. Consistency wording must ADD to the furnish instruction, never
  // replace it.
  const furnitureBlock: string[] = mode === 'establish'
    ? [furniture]
    : [
      'FURNISH THE WHOLE ROOM. Every part of the floor that IMAGE 1 shows must be properly furnished and styled. An empty room, a bare floor or a half-dressed room is a failed render.',
      `Take the furniture DESIGN from IMAGE 2: the same pieces, the same upholstery, the same woods, metals and colours. Any piece visible in image 2 that also falls inside IMAGE 1's view must be drawn as that same piece. For the parts of the room that image 2 does not cover, add everything this end of the room needs — bed, seating, tables, storage, rugs, lighting, art — designed to match image 2's pieces exactly, as though one designer furnished the whole room in one go.`,
    ];

  const lines = [
    // ⛔ Never say "empty property" here. This line leads the whole prompt on a retry, and the word
    // empty invites a bare unfurnished room — the opposite of what safe mode is for. Safe mode only
    // needs to drop the room-type wording and rule out human figures.
    ...(context.safeMode
      ? ['Professional real-estate architectural interior photography of an unoccupied home. There are no people and no human figures anywhere in this image.']
      : []),
    ...referenceBlock,
    ...brief,
    // ⛔ Named individually and blunt on purpose. "Keep the structure" was not enough: the owner
    // watched the air-conditioning unit and the window slide around the room between renders,
    // because the model treats a wall-mounted box as furniture unless it is told otherwise.
    'THESE ITEMS DO NOT MOVE AND DO NOT DISAPPEAR: every window, every door, every air-conditioning unit or split unit, every radiator, every ceiling fan or light fitting position, every socket and switch, every column, beam, niche, arch, step and built-in wardrobe. Each one stays on the same wall, at the same height, at the same size, in the same position, and the same number of them appear in your image as in the photographs. You may change what they look like to match the chosen style, but you may not relocate one, resize one, delete one or add one. The room keeps its exact width, depth, proportions and ceiling height: a narrow room stays exactly that narrow.',
    ...(analysis
      ? [
        `SURVEY OF THIS EXACT ROOM (measured from every photograph the owner supplied — obey this over any guess):\n${analysis}`,
        // ⛔ "Must survive" was not enough. The owner's room is defined by a huge arch covered in
        // scrollwork and circular medallions, and the render reduced it to a thin plain band with
        // two dots — technically still an arch, but the room stopped being his room. Simplifying
        // ornament has to be forbidden by name.
        'PROTECT THE CHARACTER: every item listed under SIGNATURE FEATURES above must appear in your image, drawn in FULL DETAIL. Where the room has an ornate arch, decorative mouldings, scrollwork, carved medallions, corbels, a curved or tray ceiling, a niche or a feature chandelier, reproduce that ornament with the same outline, the same depth and the same richness of detail as the photograph. NEVER simplify it into a plain flat band, a thin painted strip, a bare opening or a smooth surface, and never straighten a curve. These details are what make this room recognisable as the owner\'s, and a render that flattens them is worthless even if it is beautiful. You may re-finish them in the chosen style and palette, but never remove or reduce them.',
      ]
      : []),
    structure,
    ...furnitureBlock,
    `CAMERA AND FRAMING: ${view.instruction}`,
    'Output exactly one single image. Photorealistic architectural interior visualisation, correct perspective and scale, clean and realistic materials. No people, no pets, no text, no labels, no watermark, no collage, no split screen, no picture-in-picture.',
  ];

  if (language === 'ar') {
    lines.push('Any signage or written detail inside the render must be avoided entirely.');
  }

  return lines.join('\n');
};
