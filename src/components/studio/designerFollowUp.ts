import type {
  DesignerBrief,
  DesignerConnectionSpec,
  DesignerEntranceSide,
  DesignerRoomSpec,
  DesignerRoomType,
  PlannerLanguage,
} from './designerAiPlanner';

export type DesignerFormFieldKind = 'number' | 'select' | 'toggle';

export type DesignerFormField = {
  id: string;
  kind: DesignerFormFieldKind;
  label: string;
  group: string;
  hint?: string;
  unit?: string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
  defaultValue: string;
};

export type DesignerFormAnswers = Record<string, string>;

const MEASURABLE_PRIORITY: DesignerRoomType[] = [
  'majlis',
  'living',
  'dining',
  'bedroom',
  'kitchen',
  'lobby',
  'office',
  'gym',
  'spa',
  'hallway',
  'bathroom',
  'other',
];

const DEFAULT_SIDE_UNITS: Record<DesignerRoomType, { width: number; depth: number }> = {
  lobby: { width: 9, depth: 5 },
  living: { width: 11, depth: 8 },
  majlis: { width: 10, depth: 8 },
  dining: { width: 9, depth: 7 },
  hallway: { width: 12, depth: 3 },
  bathroom: { width: 4, depth: 4 },
  spa: { width: 7, depth: 6 },
  gym: { width: 8, depth: 6 },
  kitchen: { width: 8, depth: 6 },
  bedroom: { width: 9, depth: 7 },
  office: { width: 7, depth: 6 },
  other: { width: 8, depth: 6 },
};

const text = (language: PlannerLanguage, en: string, ar: string) => (language === 'ar' ? ar : en);

const roomTitle = (room: DesignerRoomSpec) => room.name || room.id;

const sortRoomsForMeasurement = (rooms: DesignerRoomSpec[]) => rooms
  .slice()
  .sort((a, b) => MEASURABLE_PRIORITY.indexOf(a.type) - MEASURABLE_PRIORITY.indexOf(b.type));

export const buildFollowUpForm = ({
  brief,
  language,
  unitLabel,
}: {
  brief: DesignerBrief;
  language: PlannerLanguage;
  unitLabel: string;
}): DesignerFormField[] => {
  const fields: DesignerFormField[] = [];
  const rooms = brief.rooms;
  if (!rooms.length) return fields;

  const measurementGroup = text(language, 'Room measurements', 'مقاسات الغرف');
  const layoutGroup = text(language, 'Layout preferences', 'تفضيلات التوزيع');
  const countGroup = text(language, 'Room counts', 'عدد الغرف');

  sortRoomsForMeasurement(rooms).slice(0, 8).forEach((room) => {
    const defaults = DEFAULT_SIDE_UNITS[room.type] || DEFAULT_SIDE_UNITS.other;
    fields.push({
      id: `size:${room.id}:width`,
      kind: 'number',
      group: measurementGroup,
      label: text(language, `${roomTitle(room)} width`, `عرض ${roomTitle(room)}`),
      unit: unitLabel,
      min: 2,
      max: 40,
      defaultValue: String(room.widthUnits && room.widthUnits > 0 ? Math.round(room.widthUnits) : defaults.width),
    });
    fields.push({
      id: `size:${room.id}:depth`,
      kind: 'number',
      group: measurementGroup,
      label: text(language, `${roomTitle(room)} depth`, `عمق ${roomTitle(room)}`),
      unit: unitLabel,
      min: 2,
      max: 40,
      defaultValue: String(room.heightUnits && room.heightUnits > 0 ? Math.round(room.heightUnits) : defaults.depth),
    });
  });

  const bedrooms = rooms.filter((room) => room.type === 'bedroom');
  if (bedrooms.length) {
    fields.push({
      id: 'count:bedroom',
      kind: 'number',
      group: countGroup,
      label: text(language, 'How many bedrooms', 'كم غرفة نوم'),
      min: 1,
      max: 8,
      defaultValue: String(bedrooms.length),
    });
  }

  const bathrooms = rooms.filter((room) => room.type === 'bathroom' && !room.between);
  if (bathrooms.length) {
    fields.push({
      id: 'count:bathroom',
      kind: 'number',
      group: countGroup,
      label: text(language, 'How many bathrooms', 'كم حمام'),
      min: 1,
      max: 6,
      defaultValue: String(bathrooms.length),
    });
  }

  fields.push({
    id: 'entranceSide',
    kind: 'select',
    group: layoutGroup,
    label: text(language, 'Main entrance side', 'جهة المدخل الرئيسي'),
    defaultValue: brief.entranceSide || 'north',
    options: [
      { value: 'north', label: text(language, 'Top (north)', 'أعلى (شمال)') },
      { value: 'south', label: text(language, 'Bottom (south)', 'أسفل (جنوب)') },
      { value: 'east', label: text(language, 'Right (east)', 'يمين (شرق)') },
      { value: 'west', label: text(language, 'Left (west)', 'يسار (غرب)') },
    ],
  });

  const majlis = rooms.find((room) => room.type === 'majlis');
  if (majlis) {
    fields.push({
      id: 'majlisNearEntrance',
      kind: 'toggle',
      group: layoutGroup,
      label: text(language, 'Keep the majlis next to the entrance', 'اجعل المجلس بجانب المدخل'),
      defaultValue: majlis.nearEntrance ? 'yes' : 'no',
    });
  }

  const livingRooms = rooms.filter((room) => room.type === 'living');
  if (livingRooms.length > 1) {
    fields.push({
      id: 'livingArrangement',
      kind: 'select',
      group: layoutGroup,
      label: text(language, 'Two living areas should be', 'الصالتان يجب أن تكونا'),
      defaultValue: 'open',
      options: [
        { value: 'open', label: text(language, 'Connected by a wide opening', 'متصلتين بفتحة واسعة') },
        { value: 'door', label: text(language, 'Separated with a door', 'مفصولتين بباب') },
      ],
    });
  }

  const hallway = rooms.find((room) => room.type === 'hallway');
  const serviceRooms = rooms.filter((room) => room.type === 'spa' || room.type === 'gym' || (room.type === 'bathroom' && !room.between));
  if (hallway && serviceRooms.length) {
    fields.push({
      id: 'hallwayAccess',
      kind: 'select',
      group: layoutGroup,
      label: text(language, 'Hallway should open into', 'الممر يفتح على'),
      defaultValue: 'all',
      options: [
        { value: 'all', label: text(language, 'All service rooms', 'كل غرف الخدمات') },
        { value: 'wet', label: text(language, 'Only bath and spa', 'الحمام والسبا فقط') },
      ],
    });
  }

  const sharedBath = rooms.find((room) => room.type === 'bathroom' && room.between);
  if (sharedBath) {
    fields.push({
      id: 'sharedBathAccess',
      kind: 'select',
      group: layoutGroup,
      label: text(language, 'Shared bathroom access', 'مدخل الحمام المشترك'),
      defaultValue: 'both',
      options: [
        { value: 'both', label: text(language, 'From both rooms', 'من الغرفتين') },
        { value: 'single', label: text(language, 'From one room only', 'من غرفة واحدة فقط') },
      ],
    });
  }

  return fields;
};

export const buildDefaultAnswers = (fields: DesignerFormField[]): DesignerFormAnswers => {
  const answers: DesignerFormAnswers = {};
  fields.forEach((field) => {
    answers[field.id] = field.defaultValue;
  });
  return answers;
};

const cloneRoomForCount = (
  source: DesignerRoomSpec,
  index: number,
  language: PlannerLanguage,
): DesignerRoomSpec => ({
  ...source,
  id: `${source.type}-extra-${index}`,
  name: language === 'ar'
    ? `${source.type === 'bedroom' ? 'غرفة نوم' : 'حمام'} ${index}`
    : `${source.type === 'bedroom' ? 'Bedroom' : 'Bathroom'} ${index}`,
  between: undefined,
});

const upsertConnection = (
  connections: DesignerConnectionSpec[],
  from: string,
  to: string,
  kind: DesignerConnectionSpec['kind'],
) => {
  if (!from || !to || from === to) return;
  const key = [from, to].sort().join('|');
  const existing = connections.find((connection) => [connection.from, connection.to].sort().join('|') === key);
  if (existing) {
    existing.kind = kind;
    return;
  }
  connections.push({ id: `connection-${key}`, from, to, kind });
};

export const applyFollowUpAnswers = ({
  brief,
  answers,
  language,
}: {
  brief: DesignerBrief;
  answers: DesignerFormAnswers;
  language: PlannerLanguage;
}): { brief: DesignerBrief; notes: string[] } => {
  const rooms = brief.rooms.map((room) => ({ ...room }));
  const connections = brief.connections.map((connection) => ({ ...connection }));
  const notes: string[] = [];

  Object.entries(answers).forEach(([key, rawValue]) => {
    if (!key.startsWith('size:')) return;
    const [, roomId, dimension] = key.split(':');
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) return;
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;
    if (dimension === 'width') room.widthUnits = value;
    if (dimension === 'depth') room.heightUnits = value;
  });

  const applyCount = (type: DesignerRoomType, answerKey: string) => {
    const desired = Number(answers[answerKey]);
    if (!Number.isFinite(desired) || desired <= 0) return;
    const existing = rooms.filter((room) => room.type === type && !room.between);
    if (!existing.length) return;
    if (desired > existing.length) {
      const template = existing[0];
      for (let index = existing.length + 1; index <= desired; index += 1) {
        const created = cloneRoomForCount(template, index, language);
        if (rooms.some((room) => room.id === created.id)) continue;
        rooms.push(created);
        const hallway = rooms.find((room) => room.type === 'hallway');
        if (hallway) upsertConnection(connections, hallway.id, created.id, 'door');
      }
      notes.push(language === 'ar'
        ? `عدّلت العدد إلى ${desired} من ${type === 'bedroom' ? 'غرف النوم' : 'الحمامات'}.`
        : `I set the count to ${desired} ${type === 'bedroom' ? 'bedrooms' : 'bathrooms'}.`);
      return;
    }
    if (desired < existing.length) {
      const removable = existing.slice(desired).map((room) => room.id);
      removable.forEach((roomId) => {
        const roomIndex = rooms.findIndex((room) => room.id === roomId);
        if (roomIndex !== -1) rooms.splice(roomIndex, 1);
      });
      for (let index = connections.length - 1; index >= 0; index -= 1) {
        if (removable.includes(connections[index].from) || removable.includes(connections[index].to)) {
          connections.splice(index, 1);
        }
      }
      notes.push(language === 'ar'
        ? `قلّلت العدد إلى ${desired} من ${type === 'bedroom' ? 'غرف النوم' : 'الحمامات'}.`
        : `I reduced the count to ${desired} ${type === 'bedroom' ? 'bedrooms' : 'bathrooms'}.`);
    }
  };

  applyCount('bedroom', 'count:bedroom');
  applyCount('bathroom', 'count:bathroom');

  const entranceSide = answers.entranceSide as DesignerEntranceSide | undefined;

  if (answers.majlisNearEntrance) {
    const majlis = rooms.find((room) => room.type === 'majlis');
    if (majlis) {
      majlis.nearEntrance = answers.majlisNearEntrance === 'yes';
      notes.push(majlis.nearEntrance
        ? text(language, 'The majlis stays next to the entrance.', 'المجلس يبقى بجانب المدخل.')
        : text(language, 'The majlis is no longer forced next to the entrance.', 'لم يعد المجلس مثبتًا بجانب المدخل.'));
    }
  }

  if (answers.livingArrangement) {
    const livingRooms = rooms.filter((room) => room.type === 'living');
    if (livingRooms.length > 1) {
      upsertConnection(
        connections,
        livingRooms[0].id,
        livingRooms[1].id,
        answers.livingArrangement === 'door' ? 'door' : 'open',
      );
      notes.push(answers.livingArrangement === 'door'
        ? text(language, 'The two living areas are separated by a door.', 'الصالتان مفصولتان بباب.')
        : text(language, 'The two living areas share a wide opening.', 'الصالتان متصلتان بفتحة واسعة.'));
    }
  }

  if (answers.hallwayAccess) {
    const hallway = rooms.find((room) => room.type === 'hallway');
    if (hallway) {
      const wetOnly = answers.hallwayAccess === 'wet';
      const targets = rooms.filter((room) => (
        wetOnly
          ? room.type === 'bathroom' || room.type === 'spa'
          : room.type === 'bathroom' || room.type === 'spa' || room.type === 'gym'
      ) && !room.between);
      targets.forEach((room) => upsertConnection(connections, hallway.id, room.id, 'door'));
      if (wetOnly) {
        const gym = rooms.find((room) => room.type === 'gym');
        if (gym) {
          for (let index = connections.length - 1; index >= 0; index -= 1) {
            const connection = connections[index];
            const involvesBoth = [connection.from, connection.to].includes(hallway.id)
              && [connection.from, connection.to].includes(gym.id);
            if (involvesBoth) connections.splice(index, 1);
          }
        }
      }
    }
  }

  if (answers.sharedBathAccess) {
    const sharedBath = rooms.find((room) => room.type === 'bathroom' && room.between);
    if (sharedBath?.between) {
      const [firstId, secondId] = sharedBath.between;
      const first = rooms.find((room) => room.id === firstId || room.type === firstId);
      const second = rooms.find((room) => room.id === secondId || room.type === secondId);
      if (answers.sharedBathAccess === 'single') {
        if (second) {
          for (let index = connections.length - 1; index >= 0; index -= 1) {
            const connection = connections[index];
            const involvesBoth = [connection.from, connection.to].includes(sharedBath.id)
              && [connection.from, connection.to].includes(second.id);
            if (involvesBoth) connections.splice(index, 1);
          }
        }
        notes.push(text(language, 'The shared bathroom opens from one room only.', 'الحمام المشترك يفتح من غرفة واحدة فقط.'));
      } else {
        if (first) upsertConnection(connections, sharedBath.id, first.id, 'door');
        if (second) upsertConnection(connections, sharedBath.id, second.id, 'door');
        notes.push(text(language, 'The shared bathroom opens from both rooms.', 'الحمام المشترك يفتح من الغرفتين.'));
      }
    }
  }

  return {
    brief: {
      ...brief,
      rooms,
      connections,
      entranceSide: entranceSide || brief.entranceSide,
    },
    notes,
  };
};
