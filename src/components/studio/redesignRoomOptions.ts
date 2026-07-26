export type RedesignOption = {
  value: string;
  en: string;
  ar: string;
  prompt: string;
};

export type RedesignViewKey = 'top' | 'halfA' | 'halfB';

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
  { value: 'neutral', en: 'Neutral', ar: 'محايد', prompt: 'soft neutral tones' },
  { value: 'warm-beige', en: 'Warm Beige', ar: 'بيج دافئ', prompt: 'warm beige and sand tones' },
  { value: 'cool-grey', en: 'Cool Grey', ar: 'رمادي بارد', prompt: 'cool grey tones' },
  { value: 'white-wood', en: 'White & Wood', ar: 'أبيض وخشبي', prompt: 'white with natural wood tones' },
  { value: 'earth', en: 'Earth Tones', ar: 'ألوان ترابية', prompt: 'earthy terracotta and clay tones' },
  { value: 'dark-moody', en: 'Dark & Moody', ar: 'داكن وهادئ', prompt: 'dark moody charcoal tones' },
  { value: 'navy-gold', en: 'Navy & Gold', ar: 'كحلي وذهبي', prompt: 'navy blue with brushed gold accents' },
  { value: 'green-brass', en: 'Green & Brass', ar: 'أخضر ونحاسي', prompt: 'deep green with brass accents' },
  { value: 'cream-caramel', en: 'Cream & Caramel', ar: 'كريمي وكراميل', prompt: 'cream and caramel leather tones' },
  { value: 'custom', en: 'Custom…', ar: 'مخصص…', prompt: 'custom palette' },
];

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
  aspectRatio: string;
  aspectClass: string;
  isAerial?: boolean;
  instruction: string;
}> = [
  {
    key: 'halfA',
    titleEn: 'Room half 1',
    titleAr: 'نصف الغرفة الأول',
    hintEn: 'Wide eye-level view of the first half',
    hintAr: 'منظر واسع للنصف الأول',
    aspectRatio: '16:9',
    aspectClass: 'aspect-[16/9]',
    instruction: 'The attached photograph already defines the camera. Keep the same camera position, the same viewing direction, the same height and the same framing as the attached photograph — you are restyling that exact photograph, not reshooting the room from somewhere else. Deliver it as a wide-angle eye-level interior photograph.',
  },
  {
    key: 'halfB',
    titleEn: 'Room half 2',
    titleAr: 'نصف الغرفة الثاني',
    hintEn: 'Wide eye-level view of the opposite half',
    hintAr: 'منظر واسع للنصف الآخر',
    aspectRatio: '16:9',
    aspectClass: 'aspect-[16/9]',
    instruction: 'The attached photograph is a second real photograph of the SAME room, looking towards its other half. Keep its camera position, viewing direction, height and framing exactly — you are restyling that exact photograph. Deliver it as a wide-angle eye-level interior photograph.',
  },
  {
    key: 'top',
    titleEn: 'Aerial view',
    titleAr: 'منظر علوي',
    hintEn: 'High view over the whole space',
    hintAr: 'منظر مرتفع للمساحة كاملة',
    aspectRatio: '3:2',
    aspectClass: 'aspect-[3/2]',
    isAerial: true,
    instruction: 'THIS VIEW DELIBERATELY MOVES THE CAMERA UPWARDS. The attached photograph is the highest-vantage real photograph of this room, and it is the ground truth for the room, the finishes and the furniture layout — but NOT for the camera height. Keep looking in the same direction as the photograph, then RAISE THE CAMERA far above head height, up near the ceiling or just above it, and tilt it down at roughly fifty to sixty degrees so you are looking down onto the floor. The floor and the furniture arrangement must dominate the frame and the whole layout must be readable at a glance, with the ceiling mostly out of shot. THIS MUST CLEARLY NOT BE AN EYE-LEVEL PHOTOGRAPH: if a viewer could mistake it for a normal standing shot, it is wrong. Deliver it as elegant, evenly lit, magazine-quality elevated architectural photography: real materials with true colour and texture, soft daylight, natural contact shadows under every piece of furniture, plants seen from above.',
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

export type RedesignPromptContext = {
  /** Written survey of the room, produced from every uploaded photo. */
  roomAnalysis?: string;
  /**
   * Materials and finishes read back off the first approved render. Injected into every
   * later render so all three images share one palette instead of each one independently
   * reinterpreting the style choices.
   */
  designSpec?: string;
  /**
   * Retry variant. Grok's content filter intermittently refuses interiors described with
   * words like "master bedroom suite" (Kie error 431, "content safety restrictions").
   * Safe mode drops the room-type wording and frames the request as unoccupied
   * real-estate photography, which clears the filter without changing the design.
   */
  safeMode?: boolean;
};

export const buildRedesignPrompt = (
  choices: RedesignChoices,
  viewKey: RedesignViewKey,
  language: 'en' | 'ar',
  context: RedesignPromptContext = {},
): string => {
  const view = REDESIGN_VIEWS.find((item) => item.key === viewKey)!;
  const roomType = resolvePromptPart(REDESIGN_ROOM_TYPES, choices.roomType, choices.roomTypeCustom);
  const style = resolvePromptPart(REDESIGN_STYLES, choices.style, choices.styleCustom);
  const palette = resolvePromptPart(REDESIGN_PALETTES, choices.palette, choices.paletteCustom);
  const lighting = resolvePromptPart(REDESIGN_LIGHTING, choices.lighting, choices.lightingCustom);
  const flooring = resolvePromptPart(REDESIGN_FLOORING, choices.flooring, choices.flooringCustom);
  const finish = resolvePromptPart(REDESIGN_FINISH_LEVELS, choices.finish, '');
  const furniture = resolvePromptPart(REDESIGN_FURNITURE, choices.furniture, choices.furnitureCustom);
  const structure = resolvePromptPart(REDESIGN_STRUCTURE, choices.structure, choices.structureCustom);
  const analysis = (context.roomAnalysis || '').trim();
  const designSpec = (context.designSpec || '').trim();
  // In safe mode the room-type wording is dropped entirely, because that is the token
  // Grok's filter reacts to. The survey and the reference image still carry the meaning.
  const subject = context.safeMode ? 'interior space' : roomType;

  const lines = [
    ...(context.safeMode
      ? ['Unoccupied empty property interior, professional real-estate architectural visualisation. There are no people and no human figures anywhere in this image.']
      : []),
    `Restyle the real ${subject} in the attached photograph into a photorealistic ${style} interior.`,
    // The aerial is the one view whose camera MUST move, so it never receives the
    // camera-lock sentence. Giving it both produced eye-level shots, because the two
    // instructions contradicted each other and the lock came first.
    view.isAerial
      ? 'CRITICAL — SAME ROOM, HIGHER CAMERA. The attached image is a real photograph of the actual room, and it is the ground truth for the architecture, the finishes and the furniture layout. Keep the exact room shape and proportions, the exact ceiling construction, and every window and every door precisely where it is. Keep the furniture where the photograph shows it. Never invent a different room. The one and only thing you must change about the camera is its height, exactly as described under CAMERA AND FRAMING below.'
      : 'CRITICAL — THIS IS A RESTYLE OF THE ATTACHED PHOTOGRAPH, NOT A NEW ROOM. The attached image is a real photograph of the actual room, and it is the ground truth for everything structural. Keep its camera position, viewing direction and framing. Keep the exact room shape and proportions, the exact ceiling height and the exact ceiling construction. Keep every window and every door precisely where it is, at the same size and the same shape. Never invent a different room, never move a wall, never add or remove an opening, never change the room outline. Only finishes, materials, colours, furniture design and decor may change.',
    ...(analysis
      ? [
        `SURVEY OF THIS EXACT ROOM (measured from every photograph the owner supplied — obey this over any guess):\n${analysis}`,
        'PROTECT THE CHARACTER: every item listed under SIGNATURE FEATURES above must survive in your image. Those details are what make this room recognisable, and a redesign that loses them is worthless. You may re-finish them in the chosen style and palette, but never remove them, never straighten a sloped or angled element, and never replace them with a plain flat surface.',
      ]
      : []),
    ...(designSpec
      ? [
        `LOCKED DESIGN SPECIFICATION — this exact specification was already approved for the first image of this same room, and this image is part of the same set. Match it precisely so the images look like one single project photographed on one day. Where it conflicts with the general style notes below, THE LOCKED SPECIFICATION WINS:\n${designSpec}`,
      ]
      : []),
    `Interior style: ${style}.`,
    `Colour palette: ${palette}.`,
    `Lighting: ${lighting}.`,
    `Flooring: ${flooring}.`,
    `Finish quality: ${finish}.`,
    structure,
    furniture,
    `CAMERA AND FRAMING: ${view.instruction}`,
    view.isAerial
      ? 'Output exactly one single image: one photorealistic HIGH ELEVATED view looking down over this one space, with the whole floor layout readable in one frame. It must not be an eye-level shot. No people, no pets, no text, no labels, no watermark, no collage, no split screen.'
      : 'Output exactly one single image. Photorealistic architectural interior visualisation, correct perspective and scale, clean and realistic materials. No people, no pets, no text, no labels, no watermark, no collage, no split screen, no picture-in-picture.',
  ];

  if (language === 'ar') {
    lines.push('Any signage or written detail inside the render must be avoided entirely.');
  }

  return lines.join('\n');
};
