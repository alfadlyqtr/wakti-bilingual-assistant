import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Frame,
  Gem,
  Home,
  ImagePlus,
  Layers,
  LayoutGrid,
  Loader2,
  Maximize2,
  FolderPlus,
  Paintbrush,
  Palette,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import RedesignRoomChoiceSection from './RedesignRoomChoiceSection';
import DesignerImageLightbox from './DesignerImageLightbox';
import { renderFileName, saveImagesToDevice } from './saveImageToDevice';
import {
  REDESIGN_FINISH_LEVELS,
  REDESIGN_FLOORING,
  REDESIGN_FURNITURE,
  REDESIGN_LIGHTING,
  REDESIGN_PALETTES,
  REDESIGN_ROOM_TYPES,
  REDESIGN_STRUCTURE,
  REDESIGN_STYLES,
  REDESIGN_VIEWS,
  buildRedesignPrompt,
  resolveChoiceLabel,
  type RedesignChoices,
  type RedesignRenderMode,
  type RedesignViewKey,
} from './redesignRoomOptions';

const SUPABASE_URL = ((import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL || 'https://hxauxozopvpzpdygoqwf.supabase.co').trim();

const MIN_PHOTOS = 4;
const MAX_PHOTOS = 6;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_EDGE_PIXELS = 1280;
/**
 * Gemini 3.1 Flash-Lite Image, via the shared KIE edge function.
 *
 * Chosen over grok-imagine/image-to-image for this tab because it actually obeys a written camera
 * instruction, honours aspect_ratio at all (grok-imagine has no such parameter, so every ratio ask
 * was silently ignored), and accepts up to ten references — all at the same 4 credits per image and
 * roughly a tenth of the latency. The edge function still defaults to Grok, so the general Image
 * tab is untouched.
 *
 * Both views now ask for 'auto' rather than a fixed ratio, so a render keeps the shape of the
 * owner's own photo instead of having its side edges invented to fill a landscape frame.
 */
const RENDER_MODEL = 'nano-banana-2-lite';
// ~4s per image on this model, so a 5s first poll was usually pure dead time.
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

type PhotoAsset = {
  id: string;
  name: string;
  dataUrl: string;
};

type RenderResult = {
  key: RedesignViewKey;
  url: string;
};

/** One render's references, plus what those references MEAN. Built by buildRenderPlan. */
type RenderPlan = { mode: RedesignRenderMode; references: string[] };

/**
 * Which uploaded photo (1-based) the survey picked as the best source for each half.
 * The survey also returns an AERIAL anchor; it is ignored, because that view was dropped.
 */
type PhotoAnchors = { half1: number; half2: number };

const DEFAULT_ANCHORS: PhotoAnchors = { half1: 1, half2: 2 };

/**
 * The two eye-level views MUST be driven by different photographs.
 *
 * When the survey names the same photo for both halves — or quietly falls back to it — both
 * renders shoot the same wall, and the owner gets "half 2 looks identical to half 1" with one
 * whole end of their room never drawn at all.
 */
const normalizeAnchors = (raw: PhotoAnchors, photoCount: number): PhotoAnchors => {
  const total = Math.max(photoCount, 1);
  const clamp = (value: number) => Math.min(Math.max(Math.round(value) || 1, 1), total);
  const half1 = clamp(raw.half1);
  let half2 = clamp(raw.half2);
  if (half2 === half1 && total > 1) half2 = (half1 % total) + 1;
  return { half1, half2 };
};

type WizardStep = 1 | 2 | 3;
type SectionKey = 'roomType' | 'style' | 'palette' | 'lighting' | 'flooring' | 'finish' | 'furniture' | 'structure';

const WIZARD_STEPS: Array<{ id: WizardStep; en: string; ar: string }> = [
  { id: 1, en: 'Photos', ar: 'الصور' },
  { id: 2, en: 'Choices', ar: 'الخيارات' },
  { id: 3, en: 'Result', ar: 'النتيجة' },
];

const preparePhoto = async (file: File): Promise<string> => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PIXELS / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read the photo'));
      reader.readAsDataURL(file);
    });
  }
};

export default function RedesignRoomStudio({ language }: { language: 'en' | 'ar' }) {
  const isArabic = language === 'ar';
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const [activeSlide, setActiveSlide] = useState(0);
  const [step, setStep] = useState<WizardStep>(1);
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [isReadingPhotos, setIsReadingPhotos] = useState(false);
  const [choices, setChoices] = useState<RedesignChoices>({
    roomType: 'living',
    roomTypeCustom: '',
    style: 'modern',
    styleCustom: '',
    palette: 'neutral',
    paletteCustom: '',
    lighting: 'daylight',
    lightingCustom: '',
    flooring: 'light-wood',
    flooringCustom: '',
    finish: 'balanced',
    furniture: 'upgrade-in-place',
    furnitureCustom: '',
    structure: 'keep-exact',
    structureCustom: '',
  });
  const [isRendering, setIsRendering] = useState(false);
  const [isSurveying, setIsSurveying] = useState(false);
  const [activeViewKey, setActiveViewKey] = useState<RedesignViewKey | null>(null);
  const [pendingKeys, setPendingKeys] = useState<RedesignViewKey[]>([]);
  const [failedKeys, setFailedKeys] = useState<RedesignViewKey[]>([]);
  const [roomAnalysis, setRoomAnalysis] = useState('');
  const [photoAnchors, setPhotoAnchors] = useState<PhotoAnchors>(DEFAULT_ANCHORS);
  const [results, setResults] = useState<RenderResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');
  /** One entry per applied edit, so undoing an edit restores the previous pair for free. */
  const [resultSnapshots, setResultSnapshots] = useState<RenderResult[][]>([]);

  const setChoice = <K extends keyof RedesignChoices>(key: K, value: RedesignChoices[K]) => {
    setChoices((current) => ({ ...current, [key]: value }));
  };

  const toggleSection = (key: SectionKey) => {
    setOpenSection((current) => (current === key ? null : key));
  };

  const scrollToSlide = useCallback((index: number) => {
    const track = carouselRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(REDESIGN_VIEWS.length - 1, index));
    const slide = track.children[clamped] as HTMLElement | undefined;
    if (!slide) return;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    setActiveSlide(clamped);
  }, []);

  const handleCarouselScroll = () => {
    const track = carouselRef.current;
    if (!track) return;
    const width = track.clientWidth || 1;
    setActiveSlide(Math.round(Math.abs(track.scrollLeft) / width));
  };

  // Follow whichever view is being worked on, so the user watches each slide fill in.
  useEffect(() => {
    if (step !== 3 || !activeViewKey) return;
    const index = REDESIGN_VIEWS.findIndex((item) => item.key === activeViewKey);
    if (index >= 0) scrollToSlide(index);
  }, [activeViewKey, step, scrollToSlide]);

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(isArabic ? `الحد الأقصى ${MAX_PHOTOS} صور` : `Maximum ${MAX_PHOTOS} photos`);
      return;
    }
    if (files.length > room) {
      toast.info(isArabic
        ? `الحد الأقصى ${MAX_PHOTOS} صور، لذلك أضفنا ${room} فقط.`
        : `Maximum is ${MAX_PHOTOS} photos, so only ${room} were added.`);
    }

    setIsReadingPhotos(true);
    try {
      const accepted: PhotoAsset[] = [];
      for (const file of files.slice(0, room)) {
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(isArabic ? `${file.name} أكبر من 10 ميجابايت` : `${file.name} is larger than 10 MB`);
          continue;
        }
        const dataUrl = await preparePhoto(file);
        if (!dataUrl) continue;
        accepted.push({ id: `${Date.now()}-${accepted.length}-${file.name}`, name: file.name, dataUrl });
      }
      if (accepted.length) setPhotos((current) => [...current, ...accepted].slice(0, MAX_PHOTOS));
    } catch {
      toast.error(isArabic ? 'تعذّر قراءة الصور' : 'Could not read the photos');
    } finally {
      setIsReadingPhotos(false);
    }
  };

  const removePhoto = (photoId: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
  };

  /**
   * Reads every uploaded photo once. Returns a written survey of the room, plus which photo best
   * suits each view.
   *
   * Each render is deliberately given only ONE of the owner's photos, so the survey is how the
   * remaining photos still reach the model — as measurements and counts it can read, rather than
   * as extra pictures competing to define the camera.
   */
  const surveyRoom = async (token: string): Promise<{ analysis: string; anchors: PhotoAnchors }> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/wakti-room-analyzer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'survey', image_base64s: photos.map((photo) => photo.dataUrl) }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success || typeof json?.analysis !== 'string') {
        return { analysis: '', anchors: DEFAULT_ANCHORS };
      }
      const raw = json?.anchors;
      const anchors = normalizeAnchors({
        half1: Number(raw?.half1) || DEFAULT_ANCHORS.half1,
        half2: Number(raw?.half2) || DEFAULT_ANCHORS.half2,
      }, photos.length);
      return { analysis: json.analysis.trim(), anchors };
    } catch {
      // The survey only improves accuracy, so never block the redesign on it.
      return { analysis: '', anchors: DEFAULT_ANCHORS };
    }
  };

  /**
   * Asks the vision judge whether an edited render actually shows the ONE change the client
   * asked for. Any failure of the check itself degrades to "compliant" — a broken judge must
   * never block a finished render from reaching the client.
   */
  const verifyEdit = async (token: string, imageUrl: string, instruction: string): Promise<{ compliant: boolean; reason: string }> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/wakti-room-analyzer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'verify', image_url: imageUrl, instruction }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success) return { compliant: true, reason: '' };
      return {
        compliant: json?.compliant !== false,
        reason: String(json?.reason || ''),
      };
    } catch {
      return { compliant: true, reason: '' };
    }
  };

  /**
   * The references for one render, and what each one MEANS.
   *
   * ⛔ Exactly ONE of the owner's photos per render, never several. In image-to-image the
   * reference pictures overrule the written instructions, so four photos of one room out-voted
   * the sentence naming which one set the camera, and every view collapsed onto the room's most
   * dominant wall.
   *
   * Consistency instead comes from the CHAIN — half 2 receives half 1's actual render, so the
   * design is pinned by pixels rather than by prose that can never say which sofa or which oak.
   *
   *   halfA → [owner's photo of half 1]                  invents the design
   *   halfB → [owner's photo of half 2, halfA render]     same design, opposite camera
   *
   * ⛔ THE ORDER IN halfB IS LOAD-BEARING. This model anchors composition to the FIRST reference.
   * With the approved render leading, half 2 inherited half 1's camera and both images showed the
   * same end of the room. The owner's photo must lead so it sets the camera; the render follows as
   * the design source only.
   *
   * Degrades safely: if half 1's render is missing, half 2 establishes from the owner's photo.
   */
  const buildRenderPlan = (
    viewKey: RedesignViewKey,
    anchors: PhotoAnchors,
    approved: RenderResult[],
  ): RenderPlan => {
    const photoAt = (oneBased: number) =>
      photos[Math.min(Math.max(oneBased - 1, 0), photos.length - 1)].dataUrl;

    if (viewKey === 'halfA') {
      return { mode: 'establish', references: [photoAt(anchors.half1)] };
    }

    const design = approved.find((item) => item.key === 'halfA')?.url;
    return design
      ? { mode: 'match', references: [photoAt(anchors.half2), design] }
      : { mode: 'establish', references: [photoAt(anchors.half2)] };
  };

  /** Submits one image-to-image task and polls the edge function until it finishes. */
  const renderSingleView = async (
    viewKey: RedesignViewKey,
    token: string,
    plan: RenderPlan,
    analysis: string,
    safeMode: boolean,
    editInstruction?: string,
  ): Promise<string> => {
    const view = REDESIGN_VIEWS.find((item) => item.key === viewKey)!;
    const requestBody = {
      model: RENDER_MODEL,
      user_prompt: buildRedesignPrompt(choices, viewKey, language, {
        roomAnalysis: analysis,
        safeMode,
        renderMode: plan.mode,
        editInstruction,
      }),
      image_base64s: plan.references,
      user_id: user?.id,
      aspect_ratio: view.aspectRatio,
      language,
    };

    const submitResponse = await fetch(`${SUPABASE_URL}/functions/v1/wakti-grok-image2image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(requestBody),
    });
    const submitJson = await submitResponse.json().catch(() => ({}));
    if (submitJson?.error === 'TRIAL_LIMIT_REACHED') {
      throw new Error(isArabic ? 'انتهت محاولاتك المجانية' : 'Your free trial limit is reached');
    }
    if (!submitResponse.ok || !submitJson?.success || !submitJson?.taskId) {
      throw new Error(String(submitJson?.error || (isArabic ? 'فشل إنشاء الصورة' : 'Image generation failed')));
    }

    const taskId = String(submitJson.taskId);
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const pollResponse = await fetch(`${SUPABASE_URL}/functions/v1/wakti-grok-image2image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taskId, user_id: user?.id }),
      });
      const pollJson = await pollResponse.json().catch(() => ({}));
      const urls: unknown = pollJson?.urls;
      if (Array.isArray(urls) && typeof urls[0] === 'string' && urls[0]) return urls[0];
      if (!pollResponse.ok || pollJson?.status === 'failed' || pollJson?.status === 'error') {
        throw new Error(String(pollJson?.error || (isArabic ? 'فشل إنشاء الصورة' : 'Image generation failed')));
      }
    }
    throw new Error(isArabic ? 'انتهت مدة الانتظار، حاول مرة أخرى' : 'Generation timed out, please try again');
  };

  /**
   * Renders one view, retrying once in safe mode. The content filter refuses interiors
   * intermittently (KIE error 431) and charges nothing for a refusal, so a free retry with
   * desensitised wording is the correct response rather than failing.
   */
  const renderWithRetry = async (
    viewKey: RedesignViewKey,
    token: string,
    plan: RenderPlan,
    analysis: string,
    editInstruction?: string,
  ): Promise<string> => {
    try {
      return await renderSingleView(viewKey, token, plan, analysis, false, editInstruction);
    } catch (firstError) {
      const message = firstError instanceof Error ? firstError.message : String(firstError);
      if (/trial|sign in|تسجيل الدخول|محاولاتك/i.test(message)) throw firstError;
      console.warn(`[redesign] ${viewKey} refused, retrying in safe mode:`, message);
      return renderSingleView(viewKey, token, plan, analysis, true, editInstruction);
    }
  };

  const handleGenerate = async () => {
    if (isRendering) return;
    if (photos.length < MIN_PHOTOS) {
      toast.error(isArabic ? `أضف ${MIN_PHOTOS} صور على الأقل` : `Add at least ${MIN_PHOTOS} photos`);
      return;
    }

    setStep(3);
    setOpenSection(null);
    setIsRendering(true);
    setErrorMessage(null);
    setResults([]);
    setFailedKeys([]);
    setSavedProjectId(null);
    setActiveSlide(0);
    setEditInput('');
    setResultSnapshots([]);
    setIsSurveying(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error(isArabic ? 'يجب تسجيل الدخول' : 'You need to sign in first');

      const { analysis, anchors } = await surveyRoom(token);
      setRoomAnalysis(analysis);
      setPhotoAnchors(anchors);
      setIsSurveying(false);

      // ⛔ STRICTLY SEQUENTIAL, and that is the whole point. halfB has to copy halfA's actual
      // pixels, so it cannot start until halfA exists. Running them in parallel is what let the
      // two drift into looking like different rooms.
      const failures: RedesignViewKey[] = [];
      const approved: RenderResult[] = [];

      for (const view of REDESIGN_VIEWS) {
        setActiveViewKey(view.key);
        setPendingKeys([view.key]);
        try {
          const plan = buildRenderPlan(view.key, anchors, approved);
          const url = await renderWithRetry(view.key, token, plan, analysis);
          approved.push({ key: view.key, url });
          setResults([...approved]);
        } catch (viewError) {
          const message = viewError instanceof Error ? viewError.message : String(viewError);
          if (/trial|sign in|تسجيل الدخول|محاولاتك/i.test(message)) throw viewError;
          console.error(`[redesign] ${view.key} failed:`, message);
          failures.push(view.key);
          setFailedKeys((current) => [...current, view.key]);
        } finally {
          setPendingKeys([]);
        }
      }

      if (failures.length === REDESIGN_VIEWS.length) {
        setErrorMessage(isArabic
          ? 'رفض مولّد الصور كل المحاولات. جرّب مرة أخرى أو غيّر نوع الغرفة.'
          : 'The image generator refused every attempt. Try again, or change the room type.');
      } else if (failures.length) {
        toast.warning(isArabic
          ? `جاهز ${REDESIGN_VIEWS.length - failures.length} من ${REDESIGN_VIEWS.length}. اضغط إعادة المحاولة على الصورة الناقصة.`
          : `${REDESIGN_VIEWS.length - failures.length} of ${REDESIGN_VIEWS.length} are ready. Tap Retry on the missing one.`);
      } else {
        toast.success(isArabic ? 'تم إنشاء التصميم الجديد' : 'Your new design is ready');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : (isArabic ? 'فشل إنشاء التصميم' : 'The redesign failed');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSurveying(false);
      setActiveViewKey(null);
      setPendingKeys([]);
      setIsRendering(false);
    }
  };

  /** Re-runs a single view that was refused, without redoing the ones that worked. */
  const retryView = async (viewKey: RedesignViewKey) => {
    if (isRendering) return;
    setIsRendering(true);
    setErrorMessage(null);
    setActiveViewKey(viewKey);
    setPendingKeys([viewKey]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error(isArabic ? 'يجب تسجيل الدخول' : 'You need to sign in first');

      // The view's own earlier attempt is excluded, so a retry never references the render it is
      // replacing — but the OTHER finished renders are still used as its design lock.
      const plan = buildRenderPlan(
        viewKey,
        photoAnchors,
        results.filter((item) => item.key !== viewKey),
      );
      const url = await renderWithRetry(viewKey, token, plan, roomAnalysis);
      setFailedKeys((current) => current.filter((key) => key !== viewKey));
      setResults((current) => [...current.filter((item) => item.key !== viewKey), { key: viewKey, url }]);
      toast.success(isArabic ? 'تمت إضافة الصورة' : 'That render is ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : (isArabic ? 'فشلت المحاولة' : 'The retry failed');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setActiveViewKey(null);
      setPendingKeys([]);
      setIsRendering(false);
    }
  };

  /**
   * Applies one written change to the finished renders.
   *
   * The slide the user is looking at is edited directly: its own render is the only reference,
   * so the model has the picture to copy and exactly one instruction to obey. The OTHER view is
   * then re-matched from its own photo with the freshly edited render as the design source —
   * the same chain that made the pair consistent in the first place — so the change appears in
   * both halves instead of silently splitting the room into two designs.
   */
  const applyEdit = async (rawInstruction: string) => {
    const instruction = rawInstruction.trim();
    if (!instruction || isRendering || !results.length) return;
    const slideView = REDESIGN_VIEWS[Math.min(activeSlide, REDESIGN_VIEWS.length - 1)];
    const targetView = results.some((item) => item.key === slideView.key)
      ? slideView
      : REDESIGN_VIEWS.find((view) => results.some((item) => item.key === view.key));
    const targetResult = targetView ? results.find((item) => item.key === targetView.key) : undefined;
    if (!targetView || !targetResult) return;

    const snapshot = results.map((item) => ({ ...item }));
    setIsRendering(true);
    setErrorMessage(null);
    setEditInput('');
    setActiveViewKey(targetView.key);
    setPendingKeys([targetView.key]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error(isArabic ? 'يجب تسجيل الدخول' : 'You need to sign in first');

      let editedUrl = await renderWithRetry(
        targetView.key,
        token,
        { mode: 'edit', references: [targetResult.url] },
        roomAnalysis,
        instruction,
      );

      // The judge checks the edit actually landed. A disobedient render is retried ONCE with
      // the failure spelled out, and the second result is kept whatever the judge says next.
      const verdict = await verifyEdit(token, editedUrl, instruction);
      if (!verdict.compliant) {
        console.warn('[redesign] edit judge rejected first attempt:', verdict.reason);
        editedUrl = await renderWithRetry(
          targetView.key,
          token,
          { mode: 'edit', references: [editedUrl] },
          roomAnalysis,
          `YOUR PREVIOUS ATTEMPT IGNORED THIS REQUEST (${verdict.reason || 'the change was not visible'}). It is the ONLY thing that matters now: ${instruction}`,
        );
      }

      const editedResults = [
        ...results.filter((item) => item.key !== targetView.key),
        { key: targetView.key, url: editedUrl } as RenderResult,
      ];
      setResults(editedResults);

      const otherView = REDESIGN_VIEWS.find((view) => view.key !== targetView.key);
      const otherCurrent = otherView ? results.find((item) => item.key === otherView.key) : undefined;
      if (otherView && otherCurrent) {
        const otherAnchor = otherView.key === 'halfA' ? photoAnchors.half1 : photoAnchors.half2;
        const otherPhoto = photos[Math.min(Math.max(otherAnchor - 1, 0), Math.max(photos.length - 1, 0))]?.dataUrl;
        if (otherPhoto) {
          setActiveViewKey(otherView.key);
          setPendingKeys([otherView.key]);
          try {
            const matchedUrl = await renderWithRetry(
              otherView.key,
              token,
              { mode: 'match', references: [otherPhoto, editedUrl] },
              roomAnalysis,
            );
            setResults([
              ...editedResults.filter((item) => item.key !== otherView.key),
              { key: otherView.key, url: matchedUrl },
            ]);
          } catch (matchError) {
            // The edit itself already landed — a failed re-match keeps the old other half.
            console.warn('[redesign] re-match after edit failed:', matchError instanceof Error ? matchError.message : matchError);
          }
        }
      }

      setResultSnapshots((current) => [...current, snapshot]);
      setSavedProjectId(null);
      toast.success(isArabic ? 'تم التعديل' : 'Change applied');
    } catch (error) {
      const message = error instanceof Error ? error.message : (isArabic ? 'فشل التعديل' : 'The edit failed');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setActiveViewKey(null);
      setPendingKeys([]);
      setIsRendering(false);
    }
  };

  /**
   * Undo restores the previous pair from memory — no render, no charge. The trade-off is that
   * the restored URLs are the provider's own, which eventually expire, but an undo chain never
   * outlives the session that made it.
   */
  const undoEdit = () => {
    setResultSnapshots((current) => {
      if (!current.length) return current;
      const previous = current[current.length - 1];
      setResults(previous.map((item) => ({ ...item })));
      setSavedProjectId(null);
      return current.slice(0, -1);
    });
  };

  /** Results in view order, so the lightbox arrows follow the same sequence as the carousel. */
  const orderedResults = REDESIGN_VIEWS
    .map((view) => {
      const result = results.find((item) => item.key === view.key);
      return result ? { url: result.url, label: isArabic ? view.titleAr : view.titleEn } : null;
    })
    .filter((item): item is { url: string; label: string } => item !== null);

  const openPreview = (viewKey: RedesignViewKey) => {
    const url = results.find((item) => item.key === viewKey)?.url;
    if (!url) return;
    const index = orderedResults.findIndex((item) => item.url === url);
    setPreviewIndex(index >= 0 ? index : 0);
  };

  const picksSummary = [
    resolveChoiceLabel(REDESIGN_ROOM_TYPES, choices.roomType, choices.roomTypeCustom, language),
    resolveChoiceLabel(REDESIGN_STYLES, choices.style, choices.styleCustom, language),
    resolveChoiceLabel(REDESIGN_PALETTES, choices.palette, choices.paletteCustom, language),
    resolveChoiceLabel(REDESIGN_FURNITURE, choices.furniture, choices.furnitureCustom, language),
    resolveChoiceLabel(REDESIGN_STRUCTURE, choices.structure, choices.structureCustom, language),
  ].join(' · ');

  /**
   * Saves every finished render as one project. The copying of the images into permanent
   * storage happens in the edge function, because the provider's URLs expire and cannot be
   * read from the browser.
   */
  const saveProject = async () => {
    if (isSaving || savedProjectId || !results.length) return;
    setIsSaving(true);
    try {
      console.log('[designer] saving project with', results.length, 'images');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error(isArabic ? 'يجب تسجيل الدخول' : 'You need to sign in first');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/wakti-designer-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'redesign',
          title: resolveChoiceLabel(REDESIGN_ROOM_TYPES, choices.roomType, choices.roomTypeCustom, language),
          summary: picksSummary,
          choices,
          images: REDESIGN_VIEWS
            .map((view) => {
              const result = results.find((item) => item.key === view.key);
              return result ? { key: view.key, url: result.url } : null;
            })
            .filter((item): item is { key: RedesignViewKey; url: string } => item !== null),
        }),
      });
      const json = await response.json().catch(() => ({}));
      console.log('[designer] save responded', response.status, json);
      if (!response.ok || !json?.success || !json?.project?.id) {
        throw new Error(String(json?.error || (isArabic ? 'تعذر الحفظ' : 'Could not save')));
      }

      setSavedProjectId(String(json.project.id));
      toast.success(isArabic
        ? `تم الحفظ في المحفوزات (${json.savedCount} صور)`
        : `Saved to your designs (${json.savedCount} images)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : (isArabic ? 'تعذر الحفظ' : 'Could not save');
      console.error('[designer] save failed:', message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const downloadResult = async (result: RenderResult) => {
    const view = REDESIGN_VIEWS.find((item) => item.key === result.key)!;
    await saveImagesToDevice([{
      url: result.url,
      fileName: renderFileName(isArabic ? view.titleAr : view.titleEn, 1),
    }]);
  };

  /** Hands every finished render to the device in one go. */
  const saveAllToPhone = async () => {
    const items = REDESIGN_VIEWS
      .map((view, position) => {
        const result = results.find((item) => item.key === view.key);
        return result
          ? { url: result.url, fileName: renderFileName(isArabic ? view.titleAr : view.titleEn, position + 1) }
          : null;
      })
      .filter((item): item is { url: string; fileName: string } => item !== null);
    if (!items.length) return;
    await saveImagesToDevice(items);
  };

  const cardClass = 'rounded-2xl border border-[#c9dff5] bg-white/90 shadow-[0_10px_24px_rgba(6,5,65,0.08)] dark:border-sky-300/20 dark:bg-black/30 dark:shadow-none';
  const fieldClass = 'w-full rounded-xl border border-[#d9e7f5] bg-white px-3 py-2.5 text-xs font-semibold text-[#31405a] outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 dark:border-sky-300/15 dark:bg-black/25 dark:text-foreground';
  const customInputClass = 'mt-2 w-full rounded-xl border border-sky-400/60 bg-white px-3 py-2 text-xs font-semibold text-[#31405a] outline-none placeholder:font-normal placeholder:text-muted-foreground focus:ring-2 focus:ring-sky-400/20 dark:border-sky-300/40 dark:bg-black/25 dark:text-foreground';

  const chipClass = (isActive: boolean) => `min-h-[38px] rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-all ${
    isActive
      ? 'border-sky-300/45 bg-sky-400/20 text-sky-800 shadow-[0_0_12px_hsla(210,100%,65%,0.2)] dark:text-sky-100'
      : 'border-[#d9e7f5] bg-[#f7fbff] text-[#40506a] hover:bg-sky-50 dark:border-sky-300/15 dark:bg-black/[0.1] dark:text-foreground/70 dark:hover:bg-white/[0.08]'
  }`;

  const readyToRender = photos.length >= MIN_PHOTOS && !isRendering && !isReadingPhotos;

  const stepCircleClass = (isActive: boolean) => `inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold ${
    isActive ? 'bg-white/25 text-white' : 'bg-sky-400/15 text-sky-700 dark:text-sky-200'
  }`;

  const primaryButtonClass = 'inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 text-sm font-extrabold text-white shadow-[0_4px_14px_hsla(210,100%,65%,0.45)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = 'inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#c9dff5] bg-white px-4 text-xs font-extrabold text-[#31405a] transition hover:bg-sky-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-300/20 dark:bg-black/25 dark:text-foreground dark:hover:bg-white/[0.06]';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[#c9dff5] bg-white/90 p-1.5 shadow-[0_10px_24px_rgba(6,5,65,0.08)] dark:border-sky-300/20 dark:bg-black/30 dark:shadow-none">
        {WIZARD_STEPS.map((wizardStep) => {
          const isActive = step === wizardStep.id;
          const isDone = wizardStep.id === 1
            ? photos.length >= MIN_PHOTOS
            : wizardStep.id === 3 && results.length === REDESIGN_VIEWS.length;
          const isBusy = wizardStep.id === 3 && isRendering;
          return (
            <button
              key={wizardStep.id}
              type="button"
              aria-current={isActive}
              onClick={() => setStep(wizardStep.id)}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-[0_4px_14px_hsla(210,100%,65%,0.4)]'
                  : 'text-[#40506a] hover:bg-sky-50 dark:text-foreground/70 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className={stepCircleClass(isActive)}>
                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isDone ? <Check className="h-3.5 w-3.5" /> : wizardStep.id}
              </span>
              <span className="text-[10px] font-bold leading-none">{isArabic ? wizardStep.ar : wizardStep.en}</span>
            </button>
          );
        })}
      </div>

      {step === 1 && (
      <section className={`${cardClass} p-3 md:p-4`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ImagePlus className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-200" />
            <span className="truncate text-sm font-bold text-foreground">
              {isArabic ? 'صور الغرفة' : 'Room Photos'}
            </span>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold tabular-nums ${
            photos.length >= MIN_PHOTOS
              ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200'
              : 'border-amber-300/35 bg-amber-400/10 text-amber-700 dark:text-amber-200'
          }`}>
            {photos.length} / {MAX_PHOTOS}
          </span>
        </div>

        {photos.length === 0 ? (
          <div className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#9ccff7] bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-5 text-center shadow-inner dark:border-sky-300/30 dark:from-[#081429] dark:via-[#0b1730] dark:to-[#0c1730]">
            <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-sky-400/15 blur-3xl" />
            <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-700 shadow-[0_0_28px_hsla(210,100%,65%,0.35)] dark:text-sky-200">
              <ImagePlus className="h-8 w-8" />
            </div>
            <h2 className="relative mt-4 text-lg font-bold text-foreground">
              {isArabic ? 'أضف صور غرفتك' : 'Add your room photos'}
            </h2>
            <p className="relative mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {isArabic
                ? `صوّر الغرفة من ${MIN_PHOTOS} إلى ${MAX_PHOTOS} زوايا مختلفة حتى يفهم وكتي الغرفة بالكامل.`
                : `Shoot the room from ${MIN_PHOTOS} to ${MAX_PHOTOS} different angles so Wakti understands the whole space.`}
            </p>
            <p className="relative mt-1 text-[11px] font-bold text-sky-700 dark:text-sky-200">
              {isArabic
                ? `${MIN_PHOTOS} صور على الأقل، و${MAX_PHOTOS} كحد أقصى`
                : `Minimum ${MIN_PHOTOS} photos, maximum ${MAX_PHOTOS}`}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isReadingPhotos}
              className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_hsla(210,100%,65%,0.45)] transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
            >
              {isReadingPhotos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isArabic ? 'اختيار الصور' : 'Choose Photos'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[#d9e7f5] bg-[#f7fbff] dark:border-sky-300/15 dark:bg-black/25">
                  <img src={photo.dataUrl} alt={photo.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    aria-label={isArabic ? 'إزالة الصورة' : 'Remove photo'}
                    className="absolute end-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-rose-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isReadingPhotos}
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#9ccff7] bg-[#f7fbff] text-[11px] font-bold text-sky-700 transition hover:bg-sky-50 disabled:opacity-60 dark:border-sky-300/30 dark:bg-black/20 dark:text-sky-200"
                >
                  {isReadingPhotos ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  {isArabic ? `إضافة (${MAX_PHOTOS - photos.length})` : `Add more (${MAX_PHOTOS - photos.length})`}
                </button>
              )}
            </div>
            {photos.length < MIN_PHOTOS ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-300/35 bg-amber-50/70 px-3 py-2 dark:border-amber-300/20 dark:bg-amber-400/[0.07]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-200" />
                <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-100">
                  {isArabic
                    ? `أضف ${MIN_PHOTOS - photos.length} صورة أخرى على الأقل لبدء إعادة التصميم. الحد الأقصى ${MAX_PHOTOS} صور.`
                    : `Add ${MIN_PHOTOS - photos.length} more photo(s) to start the redesign. Maximum ${MAX_PHOTOS} photos.`}
                </p>
              </div>
            ) : (
              <p className="text-[11px] font-semibold text-muted-foreground">
                {photos.length >= MAX_PHOTOS
                  ? (isArabic ? `وصلت للحد الأقصى ${MAX_PHOTOS} صور.` : `You have reached the maximum of ${MAX_PHOTOS} photos.`)
                  : (isArabic ? `يمكنك إضافة ${MAX_PHOTOS - photos.length} صورة أخرى (الحد الأقصى ${MAX_PHOTOS}).` : `You can add ${MAX_PHOTOS - photos.length} more (maximum ${MAX_PHOTOS}).`)}
              </p>
            )}
          </div>
        )}

        <input ref={fileInputRef} type="file" hidden multiple accept="image/*" onChange={handleFilesSelected} />

        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={photos.length < MIN_PHOTOS}
          className={`${primaryButtonClass} mt-3`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {isArabic ? 'التالي: الخيارات' : 'Next: choices'}
        </button>
      </section>
      )}

      {step === 3 && (
      <section className={`${cardClass} p-3 md:p-4`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-200" />
              <h3 className="truncate text-sm font-extrabold text-foreground">{isArabic ? 'التصميم الجديد' : 'Your new design'}</h3>
            </div>
            {isRendering && (
              <span className="shrink-0 rounded-full border border-sky-300/25 bg-sky-400/10 px-2 py-1 text-[10px] font-bold text-sky-800 dark:text-sky-200">
                {isSurveying
                  ? (isArabic ? 'قراءة الصور' : 'Reading photos')
                  : (isArabic
                    ? `${Math.min(results.length + 1, REDESIGN_VIEWS.length)} من ${REDESIGN_VIEWS.length}`
                    : `${Math.min(results.length + 1, REDESIGN_VIEWS.length)} of ${REDESIGN_VIEWS.length}`)}
              </span>
            )}
          </div>

          {isRendering && (
            <div className="flex items-start gap-2 rounded-xl border border-sky-300/30 bg-sky-50/70 px-3 py-2 dark:border-sky-300/15 dark:bg-sky-400/[0.07]">
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-sky-700 dark:text-sky-200" />
              <p className="text-[11px] leading-relaxed text-sky-900 dark:text-sky-100">
                {isSurveying
                  ? (isArabic
                    ? `نقرأ صورك الـ${photos.length} لفهم شكل الغرفة والنوافذ والأبواب...`
                    : `Reading all ${photos.length} of your photos to understand the room, and picking the best photo for each shot...`)
                  : activeViewKey === 'halfA'
                    ? (isArabic
                      ? 'نصمم النصف الأول من غرفتك. هذه الصورة هي التي ستتبعها الصورة الثانية.'
                      : 'Designing the first half of your room. This image becomes the master that the second one must copy.')
                    : (isArabic
                      ? 'ننقل نفس التصميم بالضبط إلى النصف الآخر من الغرفة، من الاتجاه المعاكس...'
                      : 'Carrying that exact design across to the other half of the room, looking the opposite way...')}
              </p>
            </div>
          )}

          {results.length === 0 && !isRendering && (
            <p className="rounded-xl border border-dashed border-[#c9dff5] bg-white/70 px-3 py-3 text-xs leading-relaxed text-[#53627a] dark:border-sky-300/15 dark:bg-black/15 dark:text-muted-foreground">
              {isArabic
                ? 'ستحصل على صورتين: نصف الغرفة الأول، ثم نصفها الثاني من الاتجاه المعاكس بنفس التصميم تماما. الصورة الثانية تُبنى على الأولى لتكونا غرفة واحدة.'
                : 'You will get 2 renders: one half of the room, then the opposite half in that exact same design. The second is built from the first, so both are the same room.'}
            </p>
          )}

          <div className="relative">
            <div
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {REDESIGN_VIEWS.map((view, index) => {
                const result = results.find((item) => item.key === view.key);
                const isActive = pendingKeys.includes(view.key);
                const hasFailed = !result && failedKeys.includes(view.key);
                return (
                  <div
                    key={view.key}
                    className={`w-full shrink-0 snap-center overflow-hidden rounded-xl border ${
                      result ? 'border-[#c9dff5] dark:border-sky-300/20' : 'border-dashed border-[#d9e7f5] dark:border-sky-300/15'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[#e4eef8] bg-[#f7fbff] px-3 py-2 dark:border-sky-300/10 dark:bg-black/25">
                      <span className="truncate text-[11px] font-extrabold text-foreground">
                        {index + 1}. {isArabic ? view.titleAr : view.titleEn}
                      </span>
                      {result ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => openPreview(view.key)} aria-label={isArabic ? 'تكبير' : 'Enlarge'} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sky-700 transition hover:bg-sky-100 dark:text-sky-200 dark:hover:bg-white/10">
                            <Maximize2 className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => downloadResult(result)} aria-label={isArabic ? 'تحميل' : 'Download'} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sky-700 transition hover:bg-sky-100 dark:text-sky-200 dark:hover:bg-white/10">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : isActive ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600 dark:text-sky-300" />
                      ) : null}
                    </div>
                    {/* ⛔ No fixed aspect box around a FINISHED render. Renders are requested with
                        aspect_ratio 'auto', so they come back shaped like the owner's own photo —
                        portrait, for phone photos. Forcing those into a 16:9 box with object-cover
                        sliced the ceiling and the floor straight off. The box shape is now only the
                        placeholder used while the render does not exist yet. */}
                    <div className={`flex items-center justify-center bg-[#eef7ff] dark:bg-black/40 ${result ? '' : view.aspectClass}`}>
                      {result ? (
                        <button type="button" onClick={() => openPreview(view.key)} className="w-full">
                          <img
                            src={result.url}
                            alt={isArabic ? view.titleAr : view.titleEn}
                            className="mx-auto max-h-[55vh] w-auto max-w-full"
                          />
                        </button>
                      ) : hasFailed ? (
                        <div className="flex flex-col items-center gap-2 px-4 text-center">
                          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                          <p className="text-[11px] font-semibold leading-relaxed text-amber-900 dark:text-amber-100">
                            {isArabic
                              ? 'رفض مولّد الصور هذه اللقطة. لم يتم خصم أي شيء منك.'
                              : "The image generator refused this shot. You were not charged for it."}
                          </p>
                          <button
                            type="button"
                            onClick={() => retryView(view.key)}
                            disabled={isRendering}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white transition active:scale-95 disabled:opacity-60"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            {isArabic ? 'إعادة المحاولة' : 'Retry'}
                          </button>
                        </div>
                      ) : (
                        <span className="px-3 text-center text-[10px] font-semibold text-muted-foreground">
                          {isActive
                            ? (isArabic ? 'جاري الرسم...' : 'Rendering...')
                            : (isArabic ? view.hintAr : view.hintEn)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollToSlide(activeSlide - 1)}
              disabled={activeSlide === 0}
              aria-label={isArabic ? 'السابق' : 'Previous'}
              className="absolute start-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => scrollToSlide(activeSlide + 1)}
              disabled={activeSlide >= REDESIGN_VIEWS.length - 1}
              aria-label={isArabic ? 'التالي' : 'Next'}
              className="absolute end-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2">
            {REDESIGN_VIEWS.map((view, index) => {
              const dotFailed = failedKeys.includes(view.key) && !results.some((item) => item.key === view.key);
              return (
                <button
                  key={view.key}
                  type="button"
                  onClick={() => scrollToSlide(index)}
                  aria-label={isArabic ? view.titleAr : view.titleEn}
                  className={`h-2 rounded-full transition-all ${
                    activeSlide === index ? 'w-6' : 'w-2'
                  } ${
                    dotFailed
                      ? 'bg-amber-500'
                      : activeSlide === index
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-600'
                        : 'bg-[#c9dff5] dark:bg-sky-300/25'
                  }`}
                />
              );
            })}
          </div>

          <p className="text-center text-[10px] font-semibold text-muted-foreground">
            {isArabic ? 'اسحب يميناً أو يساراً لرؤية باقي الصور' : 'Swipe left or right to see the other renders'}
          </p>

          {results.length > 0 && !isRendering && (
            <div className="rounded-xl border border-[#d9e7f5] bg-[#f7fbff] p-2.5 dark:border-sky-300/15 dark:bg-black/25">
              <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-foreground/65">
                  {isArabic ? 'عدّل النتيجة' : 'Edit the result'}
                </span>
                {resultSnapshots.length > 0 && (
                  <button
                    type="button"
                    onClick={undoEdit}
                    className="text-[10px] font-extrabold text-sky-700 transition hover:text-sky-900 dark:text-sky-200 dark:hover:text-sky-100"
                  >
                    {isArabic ? 'تراجع عن آخر تعديل' : 'Undo last edit'}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <textarea
                  value={editInput}
                  onChange={(event) => setEditInput(event.target.value.slice(0, 300))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      applyEdit(editInput);
                    }
                  }}
                  rows={2}
                  placeholder={isArabic ? 'مثال: بدّل لون الجدار خلف السرير إلى الأخضر الزيتوني' : 'e.g. Paint the wall behind the bed olive green'}
                  className="min-h-[58px] flex-1 resize-none rounded-xl border border-[#d9e7f5] bg-white px-3 py-2 text-xs font-semibold text-[#31405a] outline-none placeholder:font-normal placeholder:text-muted-foreground focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 dark:border-sky-300/15 dark:bg-black/25 dark:text-foreground"
                />
                <button
                  type="button"
                  onClick={() => applyEdit(editInput)}
                  disabled={isRendering || !editInput.trim()}
                  aria-label={isArabic ? 'تطبيق' : 'Apply'}
                  className="inline-flex h-[58px] w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[0_0_16px_hsla(210,100%,65%,0.35)] transition active:scale-95 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] leading-relaxed text-muted-foreground">
                {isArabic ? 'اكتب تغييرًا واحدًا في كل مرة، وسيظهر في الصورتين معًا.' : 'Ask for one change at a time — it will appear in both views.'}
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-300/50 bg-rose-50 px-3 py-2 dark:border-rose-300/25 dark:bg-rose-400/10">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-700 dark:text-rose-200" />
              <p className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-100">{errorMessage}</p>
            </div>
          )}

          {results.length > 0 && !isRendering && (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={saveProject}
                disabled={isSaving || Boolean(savedProjectId)}
                className={primaryButtonClass}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : savedProjectId ? <Check className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
                {isSaving
                  ? (isArabic ? 'جاري الحفظ...' : 'Saving...')
                  : savedProjectId
                    ? (isArabic ? 'محفوظ في المحفوظات' : 'Saved to Designer')
                    : (isArabic ? 'حفظ كمشروع' : 'Save as project')}
              </button>
              <button type="button" onClick={saveAllToPhone} className={secondaryButtonClass}>
                <Smartphone className="h-4 w-4" />
                {isArabic ? `حفظ ${results.length} صور في الهاتف` : `Save ${results.length} to phone`}
              </button>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setStep(2)} disabled={isRendering} className={secondaryButtonClass}>
              <SlidersHorizontal className="h-4 w-4" />
              {isArabic ? 'تغيير الخيارات' : 'Change choices'}
            </button>
            <button type="button" onClick={handleGenerate} disabled={!readyToRender} className={primaryButtonClass}>
              {isRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isRendering
                ? (isArabic ? 'جاري الرسم...' : 'Rendering...')
                : (isArabic ? 'أعد التصميم' : 'Redesign again')}
            </button>
          </div>
        </div>
      </section>
      )}

      {step === 2 && (
        <section className={`${cardClass} p-3 md:p-4`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sky-700 dark:text-sky-200" />
            <h2 className="text-sm font-extrabold text-foreground">{isArabic ? 'خيارات التصميم' : 'Design Choices'}</h2>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            {isArabic ? 'اضغط على أي بند لفتحه واختياره، لا حاجة لكتابة أي وصف.' : 'Tap any row to open it and pick, no writing needed.'}
          </p>

          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <RedesignRoomChoiceSection
              icon={Home}
              title={isArabic ? 'نوع الغرفة' : 'Room type'}
              summary={resolveChoiceLabel(REDESIGN_ROOM_TYPES, choices.roomType, choices.roomTypeCustom, language)}
              isOpen={openSection === 'roomType'}
              onToggle={() => toggleSection('roomType')}
            >
              <select value={choices.roomType} onChange={(event) => setChoice('roomType', event.target.value)} className={fieldClass}>
                {REDESIGN_ROOM_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{isArabic ? option.ar : option.en}</option>
                ))}
              </select>
              {choices.roomType === 'custom' && (
                <input
                  value={choices.roomTypeCustom}
                  onChange={(event) => setChoice('roomTypeCustom', event.currentTarget.value.slice(0, 48))}
                  placeholder={isArabic ? 'اكتب نوع الغرفة' : 'Name your room type'}
                  className={customInputClass}
                />
              )}
            </RedesignRoomChoiceSection>

            <RedesignRoomChoiceSection
              icon={Palette}
              title={isArabic ? 'أسلوب التصميم' : 'Design style'}
              summary={resolveChoiceLabel(REDESIGN_STYLES, choices.style, choices.styleCustom, language)}
              isOpen={openSection === 'style'}
              onToggle={() => toggleSection('style')}
            >
              <div className="grid grid-cols-3 gap-1.5">
                {REDESIGN_STYLES.map((option) => (
                  <button key={option.value} type="button" onClick={() => setChoice('style', option.value)} className={chipClass(choices.style === option.value)}>
                    {isArabic ? option.ar : option.en}
                  </button>
                ))}
              </div>
              {choices.style === 'custom' && (
                <input
                  value={choices.styleCustom}
                  onChange={(event) => setChoice('styleCustom', event.currentTarget.value.slice(0, 48))}
                  placeholder={isArabic ? 'اكتب الأسلوب' : 'Name your style'}
                  className={customInputClass}
                />
              )}
            </RedesignRoomChoiceSection>

            <RedesignRoomChoiceSection
              icon={Paintbrush}
              title={isArabic ? 'لوحة الألوان' : 'Colour palette'}
              summary={resolveChoiceLabel(REDESIGN_PALETTES, choices.palette, choices.paletteCustom, language)}
              isOpen={openSection === 'palette'}
              onToggle={() => toggleSection('palette')}
            >
              <div className="grid grid-cols-3 gap-1.5">
                {REDESIGN_PALETTES.map((option) => (
                  <button key={option.value} type="button" onClick={() => setChoice('palette', option.value)} className={chipClass(choices.palette === option.value)}>
                    {isArabic ? option.ar : option.en}
                  </button>
                ))}
              </div>
              {choices.palette === 'custom' && (
                <input
                  value={choices.paletteCustom}
                  onChange={(event) => setChoice('paletteCustom', event.currentTarget.value.slice(0, 48))}
                  placeholder={isArabic ? 'اكتب الألوان' : 'Name your colours'}
                  className={customInputClass}
                />
              )}
            </RedesignRoomChoiceSection>

            <RedesignRoomChoiceSection
              icon={Sun}
              title={isArabic ? 'الإضاءة' : 'Lighting'}
              summary={resolveChoiceLabel(REDESIGN_LIGHTING, choices.lighting, choices.lightingCustom, language)}
              isOpen={openSection === 'lighting'}
              onToggle={() => toggleSection('lighting')}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {REDESIGN_LIGHTING.map((option) => (
                  <button key={option.value} type="button" onClick={() => setChoice('lighting', option.value)} className={chipClass(choices.lighting === option.value)}>
                    {isArabic ? option.ar : option.en}
                  </button>
                ))}
              </div>
              {choices.lighting === 'custom' && (
                <input
                  value={choices.lightingCustom}
                  onChange={(event) => setChoice('lightingCustom', event.currentTarget.value.slice(0, 48))}
                  placeholder={isArabic ? 'اكتب نوع الإضاءة' : 'Name your lighting'}
                  className={customInputClass}
                />
              )}
            </RedesignRoomChoiceSection>

            <RedesignRoomChoiceSection
              icon={Layers}
              title={isArabic ? 'الأرضية' : 'Flooring'}
              summary={resolveChoiceLabel(REDESIGN_FLOORING, choices.flooring, choices.flooringCustom, language)}
              isOpen={openSection === 'flooring'}
              onToggle={() => toggleSection('flooring')}
            >
              <select value={choices.flooring} onChange={(event) => setChoice('flooring', event.target.value)} className={fieldClass}>
                {REDESIGN_FLOORING.map((option) => (
                  <option key={option.value} value={option.value}>{isArabic ? option.ar : option.en}</option>
                ))}
              </select>
              {choices.flooring === 'custom' && (
                <input
                  value={choices.flooringCustom}
                  onChange={(event) => setChoice('flooringCustom', event.currentTarget.value.slice(0, 48))}
                  placeholder={isArabic ? 'اكتب نوع الأرضية' : 'Name your flooring'}
                  className={customInputClass}
                />
              )}
            </RedesignRoomChoiceSection>

            <RedesignRoomChoiceSection
              icon={Gem}
              title={isArabic ? 'مستوى التشطيب' : 'Finish level'}
              summary={resolveChoiceLabel(REDESIGN_FINISH_LEVELS, choices.finish, '', language)}
              isOpen={openSection === 'finish'}
              onToggle={() => toggleSection('finish')}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {REDESIGN_FINISH_LEVELS.map((option) => (
                  <button key={option.value} type="button" onClick={() => setChoice('finish', option.value)} className={chipClass(choices.finish === option.value)}>
                    {isArabic ? option.ar : option.en}
                  </button>
                ))}
              </div>
            </RedesignRoomChoiceSection>

            <RedesignRoomChoiceSection
              icon={LayoutGrid}
              title={isArabic ? 'الأثاث' : 'Furniture'}
              summary={resolveChoiceLabel(REDESIGN_FURNITURE, choices.furniture, choices.furnitureCustom, language)}
              isOpen={openSection === 'furniture'}
              onToggle={() => toggleSection('furniture')}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {REDESIGN_FURNITURE.map((option) => (
                  <button key={option.value} type="button" onClick={() => setChoice('furniture', option.value)} className={chipClass(choices.furniture === option.value)}>
                    {isArabic ? option.ar : option.en}
                  </button>
                ))}
              </div>
              {choices.furniture === 'custom' && (
                <input
                  value={choices.furnitureCustom}
                  onChange={(event) => setChoice('furnitureCustom', event.currentTarget.value.slice(0, 80))}
                  placeholder={isArabic ? 'اكتب ما تريده للأثاث' : 'Describe what to do with the furniture'}
                  className={customInputClass}
                />
              )}
            </RedesignRoomChoiceSection>

            <RedesignRoomChoiceSection
              icon={Frame}
              title={isArabic ? 'هيكل الغرفة' : 'Room structure'}
              summary={resolveChoiceLabel(REDESIGN_STRUCTURE, choices.structure, choices.structureCustom, language)}
              isOpen={openSection === 'structure'}
              onToggle={() => toggleSection('structure')}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {REDESIGN_STRUCTURE.map((option) => (
                  <button key={option.value} type="button" onClick={() => setChoice('structure', option.value)} className={chipClass(choices.structure === option.value)}>
                    {isArabic ? option.ar : option.en}
                  </button>
                ))}
              </div>
              {choices.structure === 'custom' && (
                <input
                  value={choices.structureCustom}
                  onChange={(event) => setChoice('structureCustom', event.currentTarget.value.slice(0, 80))}
                  placeholder={isArabic ? 'اكتب ما تريده للهيكل' : 'Describe what may change structurally'}
                  className={customInputClass}
                />
              )}
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                {isArabic
                  ? 'النوافذ والأبواب الخارجية تبقى كما هي دائماً، حتى تبقى الغرفة غرفتك.'
                  : 'Your exterior windows and doors are always kept, so the room stays your room.'}
              </p>
            </RedesignRoomChoiceSection>
          </div>

          <div className="mt-4 rounded-xl border border-[#d9e7f5] bg-[#f7fbff] px-3 py-2.5 dark:border-sky-300/15 dark:bg-black/25">
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/70">{isArabic ? 'اختياراتك' : 'Your picks'}</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              {[
                resolveChoiceLabel(REDESIGN_ROOM_TYPES, choices.roomType, choices.roomTypeCustom, language),
                resolveChoiceLabel(REDESIGN_STYLES, choices.style, choices.styleCustom, language),
                resolveChoiceLabel(REDESIGN_PALETTES, choices.palette, choices.paletteCustom, language),
                resolveChoiceLabel(REDESIGN_LIGHTING, choices.lighting, choices.lightingCustom, language),
                resolveChoiceLabel(REDESIGN_FLOORING, choices.flooring, choices.flooringCustom, language),
                resolveChoiceLabel(REDESIGN_FINISH_LEVELS, choices.finish, '', language),
                resolveChoiceLabel(REDESIGN_FURNITURE, choices.furniture, choices.furnitureCustom, language),
                resolveChoiceLabel(REDESIGN_STRUCTURE, choices.structure, choices.structureCustom, language),
              ].join(' · ')}
            </p>
          </div>

          {photos.length < MIN_PHOTOS && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/35 bg-amber-50/70 px-3 py-2 dark:border-amber-300/20 dark:bg-amber-400/[0.07]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-200" />
              <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-100">
                {isArabic
                  ? `أضف ${MIN_PHOTOS} صور على الأقل في خطوة الصور قبل التوليد.`
                  : `Add at least ${MIN_PHOTOS} photos in the Photos step before generating.`}
              </p>
            </div>
          )}

          <div className="mt-3">
            <button type="button" onClick={handleGenerate} disabled={!readyToRender} className={primaryButtonClass}>
              {isRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isRendering
                ? (isArabic
                  ? `جاري الرسم ${Math.min(results.length + 1, REDESIGN_VIEWS.length)} من ${REDESIGN_VIEWS.length}`
                  : `Rendering ${Math.min(results.length + 1, REDESIGN_VIEWS.length)} of ${REDESIGN_VIEWS.length}`)
                : (isArabic ? 'أعد تصميم الغرفة' : 'Redesign my room')}
            </button>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/35 bg-amber-50/65 px-3 py-2 dark:border-amber-300/20 dark:bg-amber-400/[0.07]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-200" />
            <p className="text-[10px] leading-relaxed text-amber-900 dark:text-amber-100">
              {isArabic ? 'صور تصورية فقط، وليست مخططات تنفيذية.' : 'Concept visuals only, not construction drawings.'}
            </p>
          </div>
        </section>
      )}

      <DesignerImageLightbox
        images={orderedResults}
        startIndex={previewIndex}
        onClose={() => setPreviewIndex(null)}
        language={language}
        onSaveProject={saveProject}
        isSavingProject={isSaving}
        isSavedProject={Boolean(savedProjectId)}
      />
    </div>
  );
}
