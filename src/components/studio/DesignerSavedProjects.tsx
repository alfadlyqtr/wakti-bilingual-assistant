import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FolderOpen, Images, Loader2, PencilRuler, RefreshCw, Save, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DesignerImageLightbox, { type LightboxImage } from './DesignerImageLightbox';
import {
  canReopen,
  readSavedProject,
  type DesignerProjectTarget,
  type SavedProject,
} from './designerProjects';

type DbResult<T> = { data: T | null; error: { message: string } | null };

/**
 * The generated Supabase types file predates `user_designer_projects`, so the typed client
 * rejects the table name. This describes only the narrow surface we actually call. Row-level
 * security still restricts every one of these calls to the signed-in user's own rows.
 */
const designerProjects = () => (supabase as unknown as {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => Promise<DbResult<Record<string, unknown>[]>>;
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<DbResult<null>>;
    };
  };
}).from('user_designer_projects');

const VIEW_LABELS: Record<string, { en: string; ar: string }> = {
  halfA: { en: 'Room half 1', ar: 'نصف الغرفة الأول' },
  halfB: { en: 'Room half 2', ar: 'نصف الغرفة الثاني' },
  top: { en: 'Aerial view', ar: 'منظر علوي' },
  blueprint: { en: 'Original drawing', ar: 'الرسم الأصلي' },
  floorplan: { en: 'Whole home', ar: 'المنزل كامل' },
};

export default function DesignerSavedProjects({
  language,
  onStartDesign,
  onOpenProject,
}: {
  language: 'en' | 'ar';
  onStartDesign: () => void;
  onOpenProject: (target: DesignerProjectTarget, project: SavedProject) => void;
}) {
  const isArabic = language === 'ar';
  const { user } = useAuth();
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  const labelFor = useCallback((key: string, position: number): string => {
    const label = VIEW_LABELS[key];
    if (label) return isArabic ? label.ar : label.en;
    // Floor plan projects store one image per room, so the key is the room's own name after
    // slugging. Reading it back beats showing a meaningless "Image 2".
    const fromKey = key.replace(/[-_]+/g, ' ').trim();
    if (fromKey) return fromKey.replace(/\b\w/g, (character) => character.toUpperCase());
    return isArabic ? `صورة ${position}` : `Image ${position}`;
  }, [isArabic]);

  const loadProjects = useCallback(async () => {
    if (!user?.id) {
      setProjects([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // `choices` is what a project is reopened FROM — the drawn geometry for a layout, the picks
      // and room pins for a floor plan. Without it the panel can only ever be a gallery.
      const { data, error } = await designerProjects()
        .select('id, title, mode, summary, choices, images, created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      setProjects((data || []).map(readSavedProject));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(isArabic ? 'تعذّر تحميل التصاميم المحفوظة' : 'Could not load your saved designs');
      console.error('[designer-saved] load failed:', message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isArabic]);

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  const deleteProject = async (project: SavedProject) => {
    if (deletingId) return;
    setDeletingId(project.id);
    try {
      // Remove the stored files first, so deleting a project never leaves orphans behind.
      const paths = project.images.map((image) => image.storage_path).filter((path): path is string => Boolean(path));
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from('generated-images').remove(paths);
        if (storageError) console.warn('[designer-saved] storage cleanup failed:', storageError.message);
      }

      const { error } = await designerProjects().delete().eq('id', project.id);
      if (error) throw new Error(error.message);

      setProjects((current) => current.filter((item) => item.id !== project.id));
      toast.success(isArabic ? 'تم حذف المشروع' : 'Project deleted');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(isArabic ? 'تعذّر الحذف' : 'Could not delete that project');
      console.error('[designer-saved] delete failed:', message);
    } finally {
      setDeletingId(null);
    }
  };

  const openLightbox = (project: SavedProject, index: number) => {
    setLightbox({
      images: project.images.map((image, position) => ({
        url: image.url,
        label: labelFor(image.key, position + 1),
      })),
      index,
    });
  };

  const cardClass = 'rounded-2xl border border-[#c9dff5] bg-white/90 shadow-[0_10px_24px_rgba(6,5,65,0.08)] dark:border-sky-300/20 dark:bg-black/30 dark:shadow-none';
  const openButtonClass = 'inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-300/45 bg-sky-400/15 px-2.5 text-[11px] font-extrabold text-sky-800 transition-all hover:bg-sky-400/25 active:scale-95 dark:text-sky-100';

  if (isLoading) {
    return (
      <div className={`${cardClass} flex min-h-[360px] flex-col items-center justify-center px-5 py-10 text-center`}>
        <Loader2 className="h-7 w-7 animate-spin text-sky-600 dark:text-sky-300" />
        <p className="mt-3 text-sm font-semibold text-muted-foreground">
          {isArabic ? 'جاري تحميل تصاميمك...' : 'Loading your designs...'}
        </p>
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className={`${cardClass} flex min-h-[360px] flex-col items-center justify-center px-5 py-10 text-center`}>
        <div className="relative mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-700 shadow-[0_0_22px_hsla(210,100%,65%,0.25)] dark:text-sky-200">
          <Save className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-extrabold text-foreground">
          {isArabic ? 'لا توجد تصاميم محفوظة بعد' : 'No saved designs yet'}
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {isArabic
            ? 'أنشئ تصميمًا ثم اضغط "احفظ الصور كمشروع" لتظهر هنا.'
            : 'Create a design, then tap "Save images as a project" and it will appear here.'}
        </p>
        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/35 bg-amber-50/70 px-3 py-2 text-start dark:border-amber-300/20 dark:bg-amber-400/[0.07]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-200" />
            <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-100">{errorMessage}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onStartDesign}
          className="mt-5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_hsla(210,100%,65%,0.45)] transition-all hover:brightness-110 active:scale-95"
        >
          {isArabic ? 'ابدأ تصميمًا' : 'Start a Design'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`${cardClass} flex items-center justify-between gap-2 px-3 py-2.5`}>
        <div className="flex min-w-0 items-center gap-2">
          <Images className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-200" />
          <span className="truncate text-sm font-extrabold text-foreground">
            {isArabic ? `${projects.length} مشروع محفوظ` : `${projects.length} saved ${projects.length === 1 ? 'project' : 'projects'}`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void loadProjects()}
          aria-label={isArabic ? 'تحديث' : 'Refresh'}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sky-700 transition hover:bg-sky-100 dark:text-sky-200 dark:hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((project) => (
          <section key={project.id} className={`${cardClass} overflow-hidden`}>
            <div className="flex items-start justify-between gap-2 border-b border-[#e4eef8] bg-[#f7fbff] px-3 py-2.5 dark:border-sky-300/10 dark:bg-black/25">
              <div className="min-w-0">
                <h3 className="truncate text-xs font-extrabold text-foreground">{project.title}</h3>
                <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                  {new Date(project.created_at).toLocaleDateString(isArabic ? 'ar' : 'en', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {isArabic ? `${project.images.length} صور` : `${project.images.length} images`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void deleteProject(project)}
                disabled={deletingId === project.id}
                aria-label={isArabic ? 'حذف' : 'Delete'}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-400/10"
              >
                {deletingId === project.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 p-2">
              {project.images.map((image, index) => (
                <button
                  key={image.url}
                  type="button"
                  onClick={() => openLightbox(project, index)}
                  className="aspect-[4/3] overflow-hidden rounded-lg border border-[#d9e7f5] transition active:scale-95 dark:border-sky-300/15"
                  aria-label={labelFor(image.key, index + 1)}
                >
                  <img src={image.url} alt={labelFor(image.key, index + 1)} loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>

            {project.summary && (
              <p className="px-3 pb-3 text-[10px] leading-relaxed text-muted-foreground">{project.summary}</p>
            )}

            {/* ⛔ Routed strictly on the project's own mode — nothing here guesses. A drawn layout is
                the only kind with two doors, because a drawing is genuinely useful in both places:
                back on the canvas to change the walls, or over in Furnish to dress it. A redesign
                project offers nothing, so a room photo set can never be loaded as a floor plan. */}
            {canReopen(project) && (
              <div className="flex gap-2 border-t border-[#e4eef8] p-2 dark:border-sky-300/10">
                {project.mode === 'draw' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenProject('draw', project)}
                      className={openButtonClass}
                    >
                      <PencilRuler className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{isArabic ? 'تعديل الرسم' : 'Edit drawing'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenProject('trace', project)}
                      className={openButtonClass}
                    >
                      <Wand2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{isArabic ? 'افرشها' : 'Furnish it'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenProject('trace', project)}
                    className={openButtonClass}
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{isArabic ? 'افتح وواصل التعديل' : 'Open & keep editing'}</span>
                  </button>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      <DesignerImageLightbox
        images={lightbox?.images || []}
        startIndex={lightbox ? lightbox.index : null}
        onClose={() => setLightbox(null)}
        language={language}
      />
    </div>
  );
}
