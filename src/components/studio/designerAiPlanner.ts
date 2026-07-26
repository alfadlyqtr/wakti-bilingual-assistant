export type PlannerLanguage = 'en' | 'ar';

export type PlannerWallBreak = {
  id: string;
  positionRatio: number;
  width: number;
};

export type PlannerWall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'structural' | 'partition' | 'beam';
  breaks?: PlannerWallBreak[];
};

export type PlannerAperture = {
  id: string;
  wallId: string;
  type: 'door' | 'window';
  positionRatio: number;
  width: number;
  hinge?: 'start' | 'end';
  swing?: 'left' | 'right';
};

export type DesignerRoomType = 'lobby' | 'living' | 'majlis' | 'dining' | 'hallway' | 'bathroom' | 'spa' | 'gym' | 'kitchen' | 'bedroom' | 'office' | 'other';
export type DesignerRoomSize = 'small' | 'medium' | 'large';
export type DesignerRoomPrivacy = 'public' | 'semi-private' | 'private';
export type DesignerZone = 'entry' | 'public' | 'family' | 'service' | 'private';
export type DesignerConnectionKind = 'door' | 'open' | 'hallway';

export type DesignerChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type DesignerRoomSpec = {
  id: string;
  name: string;
  type: DesignerRoomType;
  size: DesignerRoomSize;
  privacy: DesignerRoomPrivacy;
  zone: DesignerZone;
  nearEntrance?: boolean;
  between?: [string, string];
  widthUnits?: number;
  heightUnits?: number;
};

export type DesignerConnectionSpec = {
  id: string;
  from: string;
  to: string;
  kind: DesignerConnectionKind;
};

export type DesignerEntranceSide = 'north' | 'south' | 'east' | 'west';

export type DesignerBrief = {
  summary: string;
  assumptions: string[];
  questions: string[];
  rooms: DesignerRoomSpec[];
  connections: DesignerConnectionSpec[];
  entranceSide?: DesignerEntranceSide;
};

export type DesignerPlacement = {
  roomId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DesignerSpatialDraft = DesignerBrief & {
  placements: DesignerPlacement[];
};

const ROOM_ALIASES: Array<{ type: DesignerRoomType; aliases: string[] }> = [
  { type: 'lobby', aliases: ['small lobby', 'lobby', 'foyer', 'entry lobby', 'entrance lobby', 'entrance hall', 'مدخل', 'لوبي', 'بهو'] },
  { type: 'living', aliases: ['living room', 'family room', 'sitting room', 'majlis living', 'غرفة معيشة', 'صالة', 'مجلس معيشة'] },
  { type: 'majlis', aliases: ['majlis', 'مجلس'] },
  { type: 'dining', aliases: ['dining room', 'dining', 'meal room', 'غرفة طعام', 'سفرة'] },
  { type: 'hallway', aliases: ['hallway', 'corridor', 'hall', 'passage', 'ممر', 'هول'] },
  { type: 'bathroom', aliases: ['downstairs bath', 'guest bath', 'guest bathroom', 'bathroom', 'bath', 'wc', 'restroom', 'حمام', 'دورة مياه'] },
  { type: 'spa', aliases: ['spa area', 'spa', 'سبا'] },
  { type: 'gym', aliases: ['gym', 'workout room', 'fitness room', 'جيم', 'نادي'] },
  { type: 'kitchen', aliases: ['kitchen', 'مطبخ'] },
  { type: 'bedroom', aliases: ['bedroom', 'غرفة نوم'] },
  { type: 'office', aliases: ['office', 'study', 'home office', 'مكتب'] },
];

const ROOM_TITLES: Record<PlannerLanguage, Record<DesignerRoomType, string>> = {
  en: {
    lobby: 'Lobby',
    living: 'Living Room',
    majlis: 'Majlis',
    dining: 'Dining Room',
    hallway: 'Hallway',
    bathroom: 'Bathroom',
    spa: 'Spa',
    gym: 'Gym',
    kitchen: 'Kitchen',
    bedroom: 'Bedroom',
    office: 'Office',
    other: 'Room',
  },
  ar: {
    lobby: 'اللوبي',
    living: 'غرفة المعيشة',
    majlis: 'المجلس',
    dining: 'غرفة الطعام',
    hallway: 'الممر',
    bathroom: 'الحمام',
    spa: 'السبا',
    gym: 'الجيم',
    kitchen: 'المطبخ',
    bedroom: 'غرفة النوم',
    office: 'المكتب',
    other: 'غرفة',
  },
};

const SIZE_PATTERNS: Array<{ size: DesignerRoomSize; words: string[] }> = [
  { size: 'large', words: ['big', 'large', 'grand', 'spacious', 'wide', 'كبير', 'واسع'] },
  { size: 'small', words: ['small', 'compact', 'tiny', 'little', 'صغير'] },
];

const slugify = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48);

const uniqueBy = <T,>(items: T[], getKey: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const titleForType = (type: DesignerRoomType, language: PlannerLanguage, index = 1) => {
  const base = ROOM_TITLES[language][type] || ROOM_TITLES[language].other;
  if (index <= 1) return base;
  return language === 'ar' ? `${base} ${index}` : `${base} ${index}`;
};

const defaultPrivacyForType = (type: DesignerRoomType): DesignerRoomPrivacy => {
  if (type === 'lobby' || type === 'hallway') return 'public';
  if (type === 'living' || type === 'majlis' || type === 'dining' || type === 'kitchen') return 'semi-private';
  return 'private';
};

const defaultZoneForType = (type: DesignerRoomType): DesignerZone => {
  if (type === 'lobby') return 'entry';
  if (type === 'majlis' || type === 'dining') return 'public';
  if (type === 'living') return 'family';
  if (type === 'hallway' || type === 'spa' || type === 'gym' || type === 'bathroom' || type === 'kitchen') return 'service';
  if (type === 'bedroom' || type === 'office') return 'private';
  return 'family';
};

const detectSizeNearAlias = (text: string, alias: string): DesignerRoomSize => {
  const aliasIndex = text.indexOf(alias);
  if (aliasIndex === -1) return 'medium';
  const start = Math.max(0, aliasIndex - 18);
  const windowText = text.slice(start, aliasIndex + alias.length + 18);
  const found = SIZE_PATTERNS.find((pattern) => pattern.words.some((word) => windowText.includes(word)));
  return found?.size || 'medium';
};

const makeRoomId = (type: DesignerRoomType, index: number, hint?: string) => {
  const suffix = index > 1 ? `-${index}` : '';
  const safeHint = hint ? `-${slugify(hint)}` : '';
  return `${type}${safeHint}${suffix}`;
};

const roomTypeFromId = (roomId: string, rooms: DesignerRoomSpec[]) => rooms.find((room) => room.id === roomId)?.type || 'other';

const sizeLabel = (size: DesignerRoomSize, language: PlannerLanguage) => {
  if (language === 'ar') {
    if (size === 'large') return 'كبير';
    if (size === 'small') return 'صغير';
    return 'متوسط';
  }
  if (size === 'large') return 'large';
  if (size === 'small') return 'small';
  return 'medium';
};

const getDimensionUnits = (room: DesignerRoomSpec): { width: number; height: number } => {
  if (room.type === 'lobby') return room.size === 'small' ? { width: 8, height: 4 } : room.size === 'large' ? { width: 12, height: 5 } : { width: 10, height: 4 };
  if (room.type === 'living') return room.size === 'large' ? { width: 12, height: 10 } : room.size === 'small' ? { width: 8, height: 6 } : { width: 10, height: 8 };
  if (room.type === 'majlis') return room.size === 'large' ? { width: 11, height: 8 } : room.size === 'small' ? { width: 8, height: 6 } : { width: 10, height: 7 };
  if (room.type === 'dining') return room.size === 'large' ? { width: 10, height: 7 } : room.size === 'small' ? { width: 7, height: 5 } : { width: 8, height: 6 };
  if (room.type === 'hallway') return { width: 4, height: 16 };
  if (room.type === 'bathroom') return room.between ? { width: 4, height: 7 } : room.size === 'large' ? { width: 5, height: 5 } : { width: 4, height: 4 };
  if (room.type === 'spa') return room.size === 'large' ? { width: 8, height: 7 } : { width: 7, height: 6 };
  if (room.type === 'gym') return room.size === 'large' ? { width: 9, height: 7 } : { width: 8, height: 6 };
  if (room.type === 'kitchen') return room.size === 'large' ? { width: 9, height: 7 } : { width: 8, height: 6 };
  if (room.type === 'bedroom') return room.size === 'large' ? { width: 10, height: 8 } : { width: 8, height: 6 };
  if (room.type === 'office') return room.size === 'large' ? { width: 8, height: 6 } : { width: 7, height: 5 };
  return { width: 8, height: 6 };
};

const addConnection = (connections: DesignerConnectionSpec[], from: string, to: string, kind: DesignerConnectionKind) => {
  if (!from || !to || from === to) return;
  const key = [from, to].sort().join('|');
  if (connections.some((connection) => [connection.from, connection.to].sort().join('|') === key)) return;
  connections.push({ id: `connection-${key}`, from, to, kind });
};

const pickPrimaryRoom = (rooms: DesignerRoomSpec[], type: DesignerRoomType) => rooms.find((room) => room.type === type) || null;

const extractRoomsFromRequest = (text: string, language: PlannerLanguage): DesignerRoomSpec[] => {
  const lowered = text.toLowerCase();
  const rooms: DesignerRoomSpec[] = [];
  const counters = new Map<DesignerRoomType, number>();
  const createRoom = (type: DesignerRoomType, size: DesignerRoomSize, hint?: string, overrides: Partial<DesignerRoomSpec> = {}) => {
    const nextIndex = (counters.get(type) || 0) + 1;
    counters.set(type, nextIndex);
    const name = overrides.name || titleForType(type, language, nextIndex);
    rooms.push({
      id: overrides.id || makeRoomId(type, nextIndex, hint),
      name,
      type,
      size,
      privacy: overrides.privacy || defaultPrivacyForType(type),
      zone: overrides.zone || defaultZoneForType(type),
      nearEntrance: overrides.nearEntrance,
      between: overrides.between,
    });
  };

  ROOM_ALIASES.forEach(({ type, aliases }) => {
    aliases.forEach((alias) => {
      let searchIndex = lowered.indexOf(alias);
      while (searchIndex !== -1) {
        if (type === 'living' && lowered.includes('another living room') && alias === 'living room' && rooms.some((room) => room.type === 'living')) {
          createRoom('living', 'medium', 'living-2');
          searchIndex = -1;
          continue;
        }
        if (type === 'living' && lowered.includes('second living room') && alias === 'living room' && rooms.some((room) => room.type === 'living')) {
          createRoom('living', 'medium', 'living-2');
          searchIndex = -1;
          continue;
        }
        const size = detectSizeNearAlias(lowered, alias);
        createRoom(type, size, alias);
        searchIndex = lowered.indexOf(alias, searchIndex + alias.length);
      }
    });
  });

  if (lowered.includes('another living room') && rooms.filter((room) => room.type === 'living').length < 2) {
    createRoom('living', 'medium', 'another-living');
  }
  if (lowered.includes('second living room') && rooms.filter((room) => room.type === 'living').length < 2) {
    createRoom('living', 'medium', 'second-living');
  }
  if (lowered.includes('downstairs bath') && !rooms.some((room) => room.id.includes('downstairs'))) {
    const bath = rooms.find((room) => room.type === 'bathroom');
    if (bath) {
      bath.id = 'bathroom-downstairs';
      bath.name = language === 'ar' ? 'حمام الدور الأرضي' : 'Downstairs Bath';
      bath.zone = 'service';
    } else {
      createRoom('bathroom', 'small', 'downstairs', { id: 'bathroom-downstairs', name: language === 'ar' ? 'حمام الدور الأرضي' : 'Downstairs Bath', zone: 'service' });
    }
  }

  const mentionsBetweenBathroom = /bathroom between|bath between|حمام بين/.test(lowered) && /majlis/.test(lowered) && /dining/.test(lowered);
  if (mentionsBetweenBathroom && !rooms.some((room) => room.id === 'bathroom-between-majlis-dining')) {
    createRoom('bathroom', 'small', 'between-majlis-dining', {
      id: 'bathroom-between-majlis-dining',
      name: language === 'ar' ? 'حمام بين المجلس والطعام' : 'Bathroom Between Majlis and Dining',
      zone: 'public',
      privacy: 'private',
      between: ['majlis', 'dining'],
    });
  }

  const lobby = pickPrimaryRoom(rooms, 'lobby');
  if (lobby) lobby.nearEntrance = true;
  const majlis = pickPrimaryRoom(rooms, 'majlis');
  if (majlis && lobby) majlis.nearEntrance = true;

  return uniqueBy(rooms, (room) => room.id);
};

const ensureCoreConnections = (rooms: DesignerRoomSpec[], connections: DesignerConnectionSpec[], language: PlannerLanguage) => {
  const lobby = pickPrimaryRoom(rooms, 'lobby');
  const majlis = pickPrimaryRoom(rooms, 'majlis');
  const dining = pickPrimaryRoom(rooms, 'dining');
  const hallway = pickPrimaryRoom(rooms, 'hallway');
  const livingRooms = rooms.filter((room) => room.type === 'living');
  const serviceRooms = rooms.filter((room) => room.type === 'spa' || room.type === 'gym' || (room.type === 'bathroom' && room.id !== 'bathroom-between-majlis-dining'));
  const betweenBath = rooms.find((room) => room.id === 'bathroom-between-majlis-dining');

  if (lobby && majlis && !connections.some((connection) => [connection.from, connection.to].includes(lobby.id) && [connection.from, connection.to].includes(majlis.id))) {
    addConnection(connections, lobby.id, majlis.id, 'door');
  }
  if (lobby && dining && !connections.some((connection) => [connection.from, connection.to].includes(lobby.id) && [connection.from, connection.to].includes(dining.id))) {
    addConnection(connections, lobby.id, dining.id, 'door');
  }
  if (!lobby && livingRooms.length > 1) {
    addConnection(connections, livingRooms[0].id, livingRooms[1].id, 'open');
  }
  if (livingRooms.length > 1) {
    addConnection(connections, livingRooms[0].id, livingRooms[1].id, 'open');
  }
  if (hallway && serviceRooms.length) {
    serviceRooms.forEach((room) => addConnection(connections, hallway.id, room.id, 'door'));
  }
  if (betweenBath && majlis && dining) {
    addConnection(connections, betweenBath.id, majlis.id, 'door');
    addConnection(connections, betweenBath.id, dining.id, 'door');
    addConnection(connections, majlis.id, dining.id, 'open');
  }
  if (lobby && livingRooms[0] && !majlis && !dining) {
    addConnection(connections, lobby.id, livingRooms[0].id, 'open');
  }
  if (hallway && livingRooms[0] && !connections.some((connection) => [connection.from, connection.to].includes(hallway.id) && [connection.from, connection.to].includes(livingRooms[0].id))) {
    addConnection(connections, hallway.id, livingRooms[0].id, 'open');
  }

  const fallbackSummary = language === 'ar'
    ? 'أنشأت مسودة أولى يمكن تعديلها بالسحب أو بالمحادثة.'
    : 'I created a first draft that you can refine by dragging or by chat.';
  return fallbackSummary;
};

const extractConnectionsFromRequest = (text: string, rooms: DesignerRoomSpec[]): DesignerConnectionSpec[] => {
  const lowered = text.toLowerCase();
  const connections: DesignerConnectionSpec[] = [];
  const lobby = pickPrimaryRoom(rooms, 'lobby');
  const majlis = pickPrimaryRoom(rooms, 'majlis');
  const dining = pickPrimaryRoom(rooms, 'dining');
  const hallway = pickPrimaryRoom(rooms, 'hallway');
  const serviceRooms = rooms.filter((room) => room.type === 'bathroom' || room.type === 'spa' || room.type === 'gym');

  if (/door leading to[^.\n]*majlis|door to[^.\n]*majlis|باب[^.\n]*مجلس/.test(lowered) && lobby && majlis) {
    addConnection(connections, lobby.id, majlis.id, 'door');
  }
  if (/door leading to[^.\n]*dining|door to[^.\n]*dining|باب[^.\n]*طعام|باب[^.\n]*سفرة/.test(lowered) && lobby && dining) {
    addConnection(connections, lobby.id, dining.id, 'door');
  }
  if (/hallway leading to|corridor leading to|ممر[^.\n]*يؤدي/.test(lowered) && hallway) {
    serviceRooms.forEach((room) => addConnection(connections, hallway.id, room.id, 'hallway'));
  }
  if ((/dining room and majlis should also be connected|majlis and dining room should also be connected|المجلس.*غرفة الطعام.*متصل|غرفة الطعام.*المجلس.*متصل/.test(lowered) || (lowered.includes('majlis') && lowered.includes('dining') && lowered.includes('connected'))) && majlis && dining) {
    addConnection(connections, majlis.id, dining.id, 'open');
  }

  return connections;
};

const buildQuestions = (rooms: DesignerRoomSpec[], connections: DesignerConnectionSpec[], language: PlannerLanguage) => {
  const questions: string[] = [];
  const livingRooms = rooms.filter((room) => room.type === 'living');
  const majlis = pickPrimaryRoom(rooms, 'majlis');
  const dining = pickPrimaryRoom(rooms, 'dining');
  const hallway = pickPrimaryRoom(rooms, 'hallway');
  const betweenBath = rooms.find((room) => room.id === 'bathroom-between-majlis-dining');

  if (majlis && !majlis.nearEntrance) {
    questions.push(language === 'ar' ? 'هل تريد المجلس قريبًا جدًا من المدخل للضيوف؟' : 'Do you want the majlis very close to the entrance for guests?');
  }
  if (livingRooms.length > 1) {
    questions.push(language === 'ar' ? 'هل تريد غرفتي المعيشة بجانب بعض أم مفصولتين أكثر؟' : 'Do you want the two living rooms side by side or more separated?');
  }
  if (hallway) {
    questions.push(language === 'ar' ? 'هل تريد الممر مستقيمًا أم متفرعًا نحو السبا والجيم والحمام؟' : 'Do you want the hallway straight or branching toward the spa, gym, and bath?');
  }
  if (betweenBath && majlis && dining) {
    questions.push(language === 'ar' ? 'هل حمام المجلس والطعام يكون بمدخلين منفصلين أم من الممر؟' : 'Should the bathroom between the majlis and dining have direct access from both rooms or from the hall?');
  }
  return uniqueBy(questions, (question) => question).slice(0, 4);
};

export const buildLocalDesignerBrief = (prompt: string, language: PlannerLanguage): DesignerBrief => {
  const rooms = extractRoomsFromRequest(prompt, language);
  const connections = extractConnectionsFromRequest(prompt, rooms);
  const summary = ensureCoreConnections(rooms, connections, language);
  const assumptions: string[] = [];
  const lobby = pickPrimaryRoom(rooms, 'lobby');
  const majlis = pickPrimaryRoom(rooms, 'majlis');
  const dining = pickPrimaryRoom(rooms, 'dining');
  const hallway = pickPrimaryRoom(rooms, 'hallway');
  const livingRooms = rooms.filter((room) => room.type === 'living');
  const betweenBath = rooms.find((room) => room.id === 'bathroom-between-majlis-dining');

  if (majlis && lobby) assumptions.push(language === 'ar' ? 'افترضت أن المجلس قريب من المدخل ليستقبل الضيوف.' : 'I assumed the majlis sits near the entrance for guests.');
  if (dining && majlis) assumptions.push(language === 'ar' ? 'افترضت أن غرفة الطعام ملاصقة للمجلس.' : 'I assumed the dining room sits beside the majlis.');
  if (hallway) assumptions.push(language === 'ar' ? 'افترضت أن الممر يخدم الحمام والسبا والجيم بشكل مباشر.' : 'I assumed the hallway serves the bath, spa, and gym directly.');
  if (livingRooms.length > 1) assumptions.push(language === 'ar' ? 'افترضت أن هناك صالة رئيسية وصالة ثانية أقرب للمنطقة العائلية.' : 'I assumed there is one main living room and a second living area in the family zone.');
  if (betweenBath) assumptions.push(language === 'ar' ? 'افترضت أن الحمام الأوسط موضوع بين المجلس والطعام كمساحة مشتركة.' : 'I assumed the shared bathroom sits between the majlis and dining room.');

  return {
    summary,
    assumptions: uniqueBy(assumptions, (item) => item),
    questions: buildQuestions(rooms, connections, language),
    rooms,
    connections,
  };
};

const cleanJsonFence = (response: string) => {
  const tagMatch = response.match(/<designer-json>([\s\S]*?)<\/designer-json>/i);
  if (tagMatch?.[1]) return tagMatch[1].trim();
  const codeMatch = response.match(/```json([\s\S]*?)```/i) || response.match(/```([\s\S]*?)```/i);
  if (codeMatch?.[1]) return codeMatch[1].trim();
  const braceStart = response.indexOf('{');
  const braceEnd = response.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) return response.slice(braceStart, braceEnd + 1);
  return '';
};

const normalizeRoomType = (value: unknown): DesignerRoomType => {
  const lowered = String(value || '').toLowerCase();
  if (lowered.includes('lobby') || lowered.includes('foyer') || lowered.includes('entry') || lowered.includes('مدخل') || lowered.includes('بهو')) return 'lobby';
  if (lowered.includes('majlis') || lowered.includes('مجلس')) return 'majlis';
  if (lowered.includes('dining') || lowered.includes('طعام') || lowered.includes('سفرة')) return 'dining';
  if (lowered.includes('hall') || lowered.includes('corridor') || lowered.includes('ممر')) return 'hallway';
  if (lowered.includes('bath') || lowered.includes('حمام') || lowered.includes('wc')) return 'bathroom';
  if (lowered.includes('spa') || lowered.includes('سبا')) return 'spa';
  if (lowered.includes('gym') || lowered.includes('جيم')) return 'gym';
  if (lowered.includes('kitchen') || lowered.includes('مطبخ')) return 'kitchen';
  if (lowered.includes('bedroom') || lowered.includes('غرفة نوم')) return 'bedroom';
  if (lowered.includes('office') || lowered.includes('study') || lowered.includes('مكتب')) return 'office';
  if (lowered.includes('living') || lowered.includes('family') || lowered.includes('صالة') || lowered.includes('معيشة')) return 'living';
  return 'other';
};

const normalizeRoomSize = (value: unknown): DesignerRoomSize => {
  const lowered = String(value || '').toLowerCase();
  if (lowered.includes('large') || lowered.includes('big') || lowered.includes('واسع') || lowered.includes('كبير')) return 'large';
  if (lowered.includes('small') || lowered.includes('compact') || lowered.includes('صغير')) return 'small';
  return 'medium';
};

const normalizeConnectionKind = (value: unknown): DesignerConnectionKind => {
  const lowered = String(value || '').toLowerCase();
  if (lowered.includes('open')) return 'open';
  if (lowered.includes('hall')) return 'hallway';
  return 'door';
};

export const parseDesignerBriefFromResponse = (response: string, language: PlannerLanguage): DesignerBrief | null => {
  try {
    const jsonText = cleanJsonFence(response);
    if (!jsonText) return null;
    const parsed = JSON.parse(jsonText);
    const rawRooms = Array.isArray(parsed?.rooms) ? parsed.rooms : [];
    const rooms = rawRooms.map((room: Record<string, unknown>, index: number): DesignerRoomSpec => {
      const type = normalizeRoomType(room.type || room.name || room.id || 'other');
      const size = normalizeRoomSize(room.size || room.scale || 'medium');
      const rawPrivacy = String(room.privacy || '');
      const rawZone = String(room.zone || '');
      return {
        id: String(room.id || makeRoomId(type, index + 1)),
        name: String(room.name || titleForType(type, language, index + 1)),
        type,
        size,
        privacy: rawPrivacy === 'public' || rawPrivacy === 'semi-private' || rawPrivacy === 'private' ? rawPrivacy : defaultPrivacyForType(type),
        zone: rawZone === 'entry' || rawZone === 'public' || rawZone === 'family' || rawZone === 'service' || rawZone === 'private' ? rawZone : defaultZoneForType(type),
        nearEntrance: Boolean(room.nearEntrance),
        between: Array.isArray(room.between) && room.between.length === 2 ? [String(room.between[0]), String(room.between[1])] : undefined,
        widthUnits: Number.isFinite(Number(room.widthUnits)) && Number(room.widthUnits) > 0 ? Number(room.widthUnits) : undefined,
        heightUnits: Number.isFinite(Number(room.heightUnits)) && Number(room.heightUnits) > 0 ? Number(room.heightUnits) : undefined,
      };
    });
    const connections = (Array.isArray(parsed?.connections) ? parsed.connections : []).map((connection: Record<string, unknown>, index: number): DesignerConnectionSpec => ({
      id: String(connection.id || `connection-${index + 1}`),
      from: String(connection.from || connection.fromRoomId || ''),
      to: String(connection.to || connection.toRoomId || ''),
      kind: normalizeConnectionKind(connection.kind || 'door'),
    })).filter((connection: DesignerConnectionSpec) => rooms.some((room) => room.id === connection.from) && rooms.some((room) => room.id === connection.to));

    if (!rooms.length) return null;
    ensureCoreConnections(rooms, connections, language);
    return {
      summary: typeof parsed?.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : (language === 'ar' ? 'أنشأت مسودة أولى بناءً على وصفك.' : 'I created a first draft from your description.'),
      assumptions: uniqueBy(Array.isArray(parsed?.assumptions) ? parsed.assumptions.map((item: unknown) => String(item)) : [], (item) => item),
      questions: uniqueBy(Array.isArray(parsed?.questions) ? parsed.questions.map((item: unknown) => String(item)) : [], (item) => item).slice(0, 4),
      rooms,
      connections,
    };
  } catch {
    return null;
  }
};

export const buildDesignerAiPrompt = ({
  language,
  request,
  conversation,
  currentLayoutSummary,
}: {
  language: PlannerLanguage;
  request: string;
  conversation: DesignerChatTurn[];
  currentLayoutSummary: string;
}) => {
  const priorConversation = conversation.slice(-6).map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`).join('\n');
  const schema = `{
  "summary": "string",
  "assumptions": ["string"],
  "questions": ["string"],
  "rooms": [
    {
      "id": "string",
      "name": "string",
      "type": "lobby|living|majlis|dining|hallway|bathroom|spa|gym|kitchen|bedroom|office|other",
      "size": "small|medium|large",
      "privacy": "public|semi-private|private",
      "zone": "entry|public|family|service|private",
      "nearEntrance": true,
      "between": ["room-id-a", "room-id-b"]
    }
  ],
  "connections": [
    {
      "id": "string",
      "from": "room-id",
      "to": "room-id",
      "kind": "door|open|hallway"
    }
  ]
}`;
  return `${language === 'ar' ? 'أنت مصمم مخططات داخلي لوكتي. اقرأ طلب المستخدم وحوله إلى JSON نظيف فقط.' : 'You are Wakti AI Designer. Read the user request and convert it into clean JSON only.'}

${language === 'ar' ? 'القواعد:' : 'Rules:'}
1. ${language === 'ar' ? 'أعد فقط JSON بين وسمي <designer-json> و </designer-json>.' : 'Return only JSON inside <designer-json> and </designer-json>.'}
2. ${language === 'ar' ? 'لا تكتب شرحًا خارج JSON.' : 'Do not write explanation outside the JSON.'}
3. ${language === 'ar' ? 'استخرج الغرف والعلاقات والافتراضات والأسئلة المهمة فقط.' : 'Extract rooms, relationships, assumptions, and only important follow-up questions.'}
4. ${language === 'ar' ? 'إذا كان الطلب تعديلًا، حافظ على النية السابقة ما لم يغيّرها المستخدم.' : 'If the request is a revision, preserve earlier intent unless the user changed it.'}
5. ${language === 'ar' ? 'لا تضف غرفًا كثيرة غير مطلوبة.' : 'Do not invent many extra rooms.'}

${language === 'ar' ? 'مخطط JSON المطلوب:' : 'Required JSON schema:'}
${schema}

${language === 'ar' ? 'ملخص المخطط الحالي:' : 'Current layout summary:'}
${currentLayoutSummary || (language === 'ar' ? 'لا يوجد مخطط بعد.' : 'No layout yet.')}

${language === 'ar' ? 'المحادثة الأخيرة:' : 'Recent designer conversation:'}
${priorConversation || (language === 'ar' ? 'لا يوجد.' : 'None.')}

${language === 'ar' ? 'طلب المستخدم الجديد:' : 'New user request:'}
${request}`;
};

const placeRoom = (placements: DesignerPlacement[], roomId: string, x: number, y: number, width: number, height: number) => {
  placements.push({ roomId, x, y, width, height });
};

export const buildSpatialDraftFromBrief = (brief: DesignerBrief): DesignerSpatialDraft => {
  const rooms = brief.rooms;
  const placements: DesignerPlacement[] = [];
  const placed = new Set<string>();
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const publicRowRooms = rooms.filter((room) => room.type === 'majlis' || room.type === 'dining' || room.id === 'bathroom-between-majlis-dining');
  const lobby = rooms.find((room) => room.type === 'lobby');
  const livingRooms = rooms.filter((room) => room.type === 'living');
  const hallway = rooms.find((room) => room.type === 'hallway');
  const serviceRooms = rooms.filter((room) => room.type === 'spa' || room.type === 'gym' || (room.type === 'bathroom' && room.id !== 'bathroom-between-majlis-dining') || room.type === 'kitchen');
  const privateRooms = rooms.filter((room) => room.type === 'bedroom' || room.type === 'office' || room.type === 'other');

  const orderedPublicRooms = (() => {
    const majlis = publicRowRooms.find((room) => room.type === 'majlis');
    const betweenBath = publicRowRooms.find((room) => room.id === 'bathroom-between-majlis-dining');
    const dining = publicRowRooms.find((room) => room.type === 'dining');
    const ordered: DesignerRoomSpec[] = [];
    if (majlis) ordered.push(majlis);
    if (betweenBath) ordered.push(betweenBath);
    if (dining) ordered.push(dining);
    publicRowRooms.forEach((room) => {
      if (!ordered.some((item) => item.id === room.id)) ordered.push(room);
    });
    return ordered;
  })();

  const publicStartX = 4;
  const publicY = lobby ? 8 : 4;
  let publicHeight = 0;
  let publicWidth = 0;

  orderedPublicRooms.forEach((room) => {
    const dimensions = getDimensionUnits(room);
    placeRoom(placements, room.id, publicStartX + publicWidth, publicY, dimensions.width, dimensions.height);
    placed.add(room.id);
    publicHeight = Math.max(publicHeight, dimensions.height);
    publicWidth += dimensions.width;
  });

  if (lobby) {
    const lobbyDimensions = getDimensionUnits(lobby);
    placeRoom(placements, lobby.id, publicStartX, 4, Math.max(lobbyDimensions.width, publicWidth || lobbyDimensions.width), lobbyDimensions.height);
    placed.add(lobby.id);
  }

  let livingX = 4;
  const livingY = publicY + (publicHeight || 0);
  let livingRowRight = livingX;
  livingRooms.forEach((room, index) => {
    const dimensions = getDimensionUnits(room);
    const width = index === 0 && room.size !== 'small' ? Math.max(dimensions.width, Math.max(publicWidth, 12) - (livingRooms.length > 1 ? 10 : 0)) : dimensions.width;
    placeRoom(placements, room.id, livingX, livingY, width, dimensions.height);
    placed.add(room.id);
    livingX += width;
    livingRowRight = Math.max(livingRowRight, livingX);
  });

  if (hallway) {
    const hallwayDimensions = getDimensionUnits(hallway);
    const serviceHeight = serviceRooms.reduce((total, room) => total + getDimensionUnits(room).height, 0);
    const hallX = Math.max(publicStartX + Math.max(publicWidth, livingRowRight - 4), 28);
    const hallY = publicY;
    placeRoom(placements, hallway.id, hallX, hallY, hallwayDimensions.width, Math.max(hallwayDimensions.height, serviceHeight || hallwayDimensions.height));
    placed.add(hallway.id);

    let serviceY = hallY;
    serviceRooms.forEach((room) => {
      const dimensions = getDimensionUnits(room);
      placeRoom(placements, room.id, hallX + hallwayDimensions.width, serviceY, dimensions.width, dimensions.height);
      placed.add(room.id);
      serviceY += dimensions.height;
    });
  } else {
    const serviceX = Math.max(publicStartX + Math.max(publicWidth, livingRowRight - 4), 30);
    let serviceY = publicY;
    serviceRooms.forEach((room) => {
      const dimensions = getDimensionUnits(room);
      placeRoom(placements, room.id, serviceX, serviceY, dimensions.width, dimensions.height);
      placed.add(room.id);
      serviceY += dimensions.height;
    });
  }

  let privateX = 4;
  const privateY = Math.max(livingY + (livingRooms[0] ? getDimensionUnits(livingRooms[0]).height : 0), publicY + publicHeight + 8);
  privateRooms.forEach((room) => {
    const dimensions = getDimensionUnits(room);
    placeRoom(placements, room.id, privateX, privateY, dimensions.width, dimensions.height);
    placed.add(room.id);
    privateX += dimensions.width;
  });

  rooms.forEach((room) => {
    if (placed.has(room.id)) return;
    const dimensions = getDimensionUnits(room);
    placeRoom(placements, room.id, 4 + placements.length * 2, 4 + placements.length * 2, dimensions.width, dimensions.height);
  });

  return { ...brief, placements };
};

type BoundaryUnit = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pairKey: string;
  roomA: string;
  roomB: string | null;
  orientation: 'horizontal' | 'vertical';
};

type BoundarySegment = BoundaryUnit & {
  wallId: string;
};

const segmentKey = (x1: number, y1: number, x2: number, y2: number, pairKey: string) => `${x1},${y1},${x2},${y2}|${pairKey}`;

const getCellMap = (placements: DesignerPlacement[]) => {
  const cellMap = new Map<string, string>();
  placements.forEach((placement) => {
    for (let x = placement.x; x < placement.x + placement.width; x += 1) {
      for (let y = placement.y; y < placement.y + placement.height; y += 1) {
        cellMap.set(`${x},${y}`, placement.roomId);
      }
    }
  });
  return cellMap;
};

const buildBoundarySegments = (draft: DesignerSpatialDraft): BoundarySegment[] => {
  const cellMap = getCellMap(draft.placements);
  const units = new Map<string, BoundaryUnit>();
  draft.placements.forEach((placement) => {
    for (let x = placement.x; x < placement.x + placement.width; x += 1) {
      for (let y = placement.y; y < placement.y + placement.height; y += 1) {
        const checks = [
          { neighborX: x, neighborY: y - 1, x1: x, y1: y, x2: x + 1, y2: y, orientation: 'horizontal' as const },
          { neighborX: x + 1, neighborY: y, x1: x + 1, y1: y, x2: x + 1, y2: y + 1, orientation: 'vertical' as const },
          { neighborX: x, neighborY: y + 1, x1: x, y1: y + 1, x2: x + 1, y2: y + 1, orientation: 'horizontal' as const },
          { neighborX: x - 1, neighborY: y, x1: x, y1: y, x2: x, y2: y + 1, orientation: 'vertical' as const },
        ];
        checks.forEach((check) => {
          const neighborRoom = cellMap.get(`${check.neighborX},${check.neighborY}`) || null;
          if (neighborRoom === placement.roomId) return;
          const pair = [placement.roomId, neighborRoom || 'outside'].sort();
          const pairKey = pair.join('|');
          const key = segmentKey(check.x1, check.y1, check.x2, check.y2, pairKey);
          if (!units.has(key)) {
            units.set(key, {
              x1: check.x1,
              y1: check.y1,
              x2: check.x2,
              y2: check.y2,
              pairKey,
              roomA: pair[0],
              roomB: pair[1] === 'outside' ? null : pair[1],
              orientation: check.orientation,
            });
          }
        });
      }
    }
  });

  const horizontal = Array.from(units.values()).filter((unit) => unit.orientation === 'horizontal').sort((a, b) => a.pairKey.localeCompare(b.pairKey) || a.y1 - b.y1 || a.x1 - b.x1);
  const vertical = Array.from(units.values()).filter((unit) => unit.orientation === 'vertical').sort((a, b) => a.pairKey.localeCompare(b.pairKey) || a.x1 - b.x1 || a.y1 - b.y1);
  const merged: BoundarySegment[] = [];

  const mergeUnits = (items: BoundaryUnit[], isHorizontal: boolean) => {
    let current: BoundaryUnit | null = null;
    items.forEach((item) => {
      if (!current) {
        current = { ...item };
        return;
      }
      const touches = isHorizontal
        ? current.pairKey === item.pairKey && current.y1 === item.y1 && current.x2 === item.x1
        : current.pairKey === item.pairKey && current.x1 === item.x1 && current.y2 === item.y1;
      if (touches) {
        current = isHorizontal
          ? { ...current, x2: item.x2 }
          : { ...current, y2: item.y2 };
        return;
      }
      merged.push({ ...current, wallId: `wall-${merged.length + 1}` });
      current = { ...item };
    });
    if (current) merged.push({ ...current, wallId: `wall-${merged.length + 1}` });
  };

  mergeUnits(horizontal, true);
  mergeUnits(vertical, false);
  return merged;
};

const getDoorWidthUnits = (firstType: DesignerRoomType, secondType: DesignerRoomType | 'outside') => {
  if (firstType === 'bathroom' || secondType === 'bathroom') return 0.9;
  if (firstType === 'majlis' || firstType === 'dining' || secondType === 'majlis' || secondType === 'dining') return 1.2;
  return 1;
};

const getOpeningWidthUnits = (firstType: DesignerRoomType, secondType: DesignerRoomType | 'outside') => {
  if (firstType === 'living' || secondType === 'living') return 2.2;
  if (firstType === 'hallway' || secondType === 'hallway') return 1.6;
  return 1.5;
};

export const compileDesignerDraftToLayout = (draft: DesignerSpatialDraft, pixelsPerUnit: number): { walls: PlannerWall[]; apertures: PlannerAperture[] } => {
  const boundaries = buildBoundarySegments(draft);
  const walls: PlannerWall[] = boundaries.map((segment) => ({
    id: segment.wallId,
    x1: segment.x1 * pixelsPerUnit,
    y1: segment.y1 * pixelsPerUnit,
    x2: segment.x2 * pixelsPerUnit,
    y2: segment.y2 * pixelsPerUnit,
    type: segment.roomB ? 'partition' : 'structural',
  }));
  const wallMap = new Map(walls.map((wall, index) => [wall.id, { wall, segment: boundaries[index] }]));
  const apertures: PlannerAperture[] = [];
  const usedWallOpenings = new Map<string, number>();

  draft.connections.forEach((connection) => {
    const pair = [connection.from, connection.to].sort().join('|');
    const candidates = boundaries.filter((segment) => segment.roomB && segment.pairKey === pair);
    if (!candidates.length) return;
    const candidate = candidates.sort((a, b) => {
      const lengthA = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
      const lengthB = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
      return lengthB - lengthA;
    })[0];
    const wallEntry = wallMap.get(candidate.wallId);
    if (!wallEntry) return;
    const firstType = roomTypeFromId(connection.from, draft.rooms);
    const secondType = roomTypeFromId(connection.to, draft.rooms);
    const usedCount = usedWallOpenings.get(candidate.wallId) || 0;
    usedWallOpenings.set(candidate.wallId, usedCount + 1);
    const ratioOptions = [0.35, 0.5, 0.65];
    const positionRatio = ratioOptions[Math.min(usedCount, ratioOptions.length - 1)];

    if (connection.kind === 'open' || (connection.kind === 'hallway' && (firstType === 'living' || secondType === 'living' || firstType === 'lobby' || secondType === 'lobby'))) {
      const width = getOpeningWidthUnits(firstType, secondType) * pixelsPerUnit;
      const wall = wallEntry.wall;
      wall.breaks = [...(wall.breaks || []), {
        id: `break-${candidate.wallId}-${usedCount + 1}`,
        positionRatio,
        width,
      }];
      return;
    }

    apertures.push({
      id: `aperture-${candidate.wallId}-${usedCount + 1}`,
      wallId: candidate.wallId,
      type: 'door',
      positionRatio,
      width: getDoorWidthUnits(firstType, secondType) * pixelsPerUnit,
      hinge: usedCount % 2 === 0 ? 'start' : 'end',
      swing: usedCount % 2 === 0 ? 'right' : 'left',
    });
  });

  return { walls, apertures };
};

export const summarizeCurrentLayout = ({
  walls,
  apertures,
  pixelsPerUnit,
  language,
}: {
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  apertures: Array<{ type: 'door' | 'window'; width: number }>;
  pixelsPerUnit: number;
  language: PlannerLanguage;
}) => {
  if (!walls.length) return language === 'ar' ? 'لا يوجد مخطط حالي.' : 'No current layout.';
  const totalWallLength = walls.reduce((sum, wall) => sum + Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1), 0) / pixelsPerUnit;
  const doorCount = apertures.filter((aperture) => aperture.type === 'door').length;
  const windowCount = apertures.filter((aperture) => aperture.type === 'window').length;
  return language === 'ar'
    ? `يوجد حاليًا ${walls.length} جدارًا بطول إجمالي ${totalWallLength.toFixed(1)} متر، مع ${doorCount} باب و${windowCount} نافذة.`
    : `The current plan has ${walls.length} walls with ${totalWallLength.toFixed(1)} metres of total wall length, plus ${doorCount} doors and ${windowCount} windows.`;
};

export const buildAssistantReply = (draft: DesignerSpatialDraft, language: PlannerLanguage) => {
  const createdRooms = draft.rooms.map((room) => `${room.name} (${sizeLabel(room.size, language)})`);
  const intro = language === 'ar'
    ? 'أنشأت مسودة أولى على اللوحة ويمكنك تعديلها الآن بالسحب أو برسالة جديدة.'
    : 'I created a first draft on the canvas, and you can refine it now by dragging or by sending another message.';
  return `${intro}\n\n${language === 'ar' ? 'أضفت:' : 'I added:'}\n- ${createdRooms.join('\n- ')}`;
};
