// Shared shape of a row in `user_designer_projects`, plus the safe readers that turn its jsonb
// back into something a studio can trust.
//
// ⛔ `choices` is jsonb written by whichever tab saved the project, so coming back IN it is
// genuinely unknown: a row saved months ago predates fields that exist today, and a row saved by
// another tab has an entirely different shape. Every reader below is total — it never throws and
// always returns something usable — because one malformed saved project must never be able to
// break the Saved tab for everything else in it.

export type SavedProjectImage = {
  key: string;
  url: string;
  storage_path?: string;
};

export type SavedProject = {
  id: string;
  title: string;
  /** Which studio created it: 'redesign' (tab 1), 'floorplan' (tab 2) or 'draw' (tab 3). */
  mode: string;
  summary: string | null;
  choices: Record<string, unknown>;
  images: SavedProjectImage[];
  created_at: string;
};

/**
 * Which studio a saved project is being opened into. These match `DesignerStartMode`, not the
 * saved `mode`: a drawn layout is saved as 'draw' but can be opened into 'trace' to be furnished.
 */
export type DesignerProjectTarget = 'redesign' | 'trace' | 'draw';

export type OpenProjectRequest = {
  target: DesignerProjectTarget;
  project: SavedProject;
};

/**
 * A saved project on its way into the Furnish Floor Plan studio.
 *
 * The blueprint URL is resolved before handing it over so the studio never has to know how images
 * are keyed. Everything else is read off `project.choices` inside the studio, next to the state it
 * fills, because only the studio knows the shape of its own picks.
 */
export type FloorPlanHandoff = {
  project: SavedProject;
  blueprintUrl: string;
};

/**
 * The source drawing, stored alongside the finished renders. This one image is what makes a
 * project reopenable at all — without it there is a gallery of pictures and nothing to edit.
 */
export const BLUEPRINT_KEY = 'blueprint';

/** The whole-home render. Room close-ups are keyed by the room's own slugged name. */
export const FLOOR_PLAN_KEY = 'floorplan';

export const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const asText = (value: unknown, fallback = ''): string => (
  typeof value === 'string' ? value : fallback
);

export const asNumber = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

/** Finds one stored image by its key. Returns '' rather than undefined so callers can just test it. */
export const projectImageUrl = (project: SavedProject, key: string): string => (
  project.images.find((image) => image.key === key)?.url || ''
);

/** Parses one row straight off the table into the shape the app works with. */
export const readSavedProject = (row: Record<string, unknown>): SavedProject => ({
  id: String(row.id ?? ''),
  title: asText(row.title, 'Room design'),
  mode: asText(row.mode, 'redesign'),
  summary: row.summary ? String(row.summary) : null,
  choices: asRecord(row.choices),
  created_at: String(row.created_at ?? ''),
  images: asArray(row.images)
    .map((item) => asRecord(item))
    .filter((item) => asText(item.url))
    .map((item) => ({
      key: asText(item.key),
      url: asText(item.url),
      storage_path: asText(item.storage_path) || undefined,
    })),
});

/**
 * True when a saved project carries enough to be reopened and worked on, rather than only viewed.
 *
 * Projects saved before the blueprint was stored are still perfectly good galleries, so they are
 * never hidden or migrated — they simply do not offer an Open button.
 */
export const canReopen = (project: SavedProject): boolean => {
  if (project.mode === 'draw') return asArray(project.choices.walls).length > 0;
  if (project.mode === 'floorplan') return Boolean(projectImageUrl(project, BLUEPRINT_KEY));
  return false;
};
