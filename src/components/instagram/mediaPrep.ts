import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

export type InstagramTarget = 'feed' | 'story' | 'reel';
export type InstagramMediaKind = 'image' | 'video' | 'reel';
export type ImageShape = 'square' | 'portrait' | 'story-ready' | 'landscape';

export interface ImageAnalysis {
  width: number;
  height: number;
  ratio: number;
  shape: ImageShape;
  recommendedTarget: InstagramTarget;
  sourceUrl: string;
}

const STORY_RATIO = 9 / 16;
const FEED_MIN_RATIO = 4 / 5;
const FEED_MAX_RATIO = 1.91;

function inferImageShape(ratio: number): ImageShape {
  if (Math.abs(ratio - 1) < 0.08) return 'square';
  if (Math.abs(ratio - STORY_RATIO) < 0.08 || ratio < 0.7) return 'story-ready';
  if (ratio < 1) return 'portrait';
  return 'landscape';
}

export function recommendInstagramTargetForRatio(ratio: number): InstagramTarget {
  if (ratio < 0.72) return 'story';
  return 'feed';
}

function mimeToExtension(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('mp4')) return 'mp4';
  return 'jpg';
}

async function getSessionOrThrow() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || !session.user?.id) {
    throw new Error('Authentication required');
  }
  return session;
}

async function importExternalImageToStorage(imageUrl: string, accessToken: string): Promise<string> {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/save-generated-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      imageUrl,
      submode: 'instagram-publish',
      filenameHint: 'instagram-publish-source',
    }),
  });
  const json = await resp.json().catch(() => ({} as any));
  if (!resp.ok || !json?.success || !json?.url) {
    throw new Error(json?.error || 'Failed to import image for Instagram publishing');
  }
  return String(json.url);
}

async function ensureProcessableImageUrl(imageUrl: string): Promise<string> {
  if (!imageUrl) throw new Error('Missing image URL');
  if (
    imageUrl.startsWith('data:') ||
    imageUrl.startsWith('blob:') ||
    imageUrl.includes('supabase.co') ||
    imageUrl.startsWith(window.location.origin)
  ) {
    return imageUrl;
  }

  const session = await getSessionOrThrow();
  return importExternalImageToStorage(imageUrl, session.access_token);
}

async function fetchImageBitmap(imageUrl: string): Promise<{ bitmap: ImageBitmap; sourceUrl: string; mimeType: string }> {
  const sourceUrl = await ensureProcessableImageUrl(imageUrl);
  const resp = await fetch(sourceUrl);
  if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  return { bitmap, sourceUrl, mimeType: blob.type || 'image/jpeg' };
}

function renderCover(ctx: CanvasRenderingContext2D, bitmap: ImageBitmap, width: number, height: number) {
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(bitmap, x, y, drawWidth, drawHeight);
}

function renderContain(ctx: CanvasRenderingContext2D, bitmap: ImageBitmap, width: number, height: number, inset = 64) {
  const availableWidth = width - inset * 2;
  const availableHeight = height - inset * 2;
  const scale = Math.min(availableWidth / bitmap.width, availableHeight / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(bitmap, x, y, drawWidth, drawHeight);
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas export failed'));
    }, mimeType, 0.92);
  });
}

async function uploadPreparedBlob(blob: Blob, userId: string, folder: string): Promise<string> {
  const ext = mimeToExtension(blob.type || 'image/jpeg');
  const path = `${userId}/instagram-publish/${folder}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from('generated-images')
    .upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });
  if (uploadErr) throw uploadErr;

  const { data: publicUrlData } = supabase.storage.from('generated-images').getPublicUrl(path);
  if (!publicUrlData?.publicUrl) throw new Error('Failed to create prepared media URL');
  return publicUrlData.publicUrl;
}

export async function analyzeInstagramImage(imageUrl: string): Promise<ImageAnalysis> {
  const { bitmap, sourceUrl } = await fetchImageBitmap(imageUrl);
  try {
    const ratio = bitmap.width / bitmap.height;
    const shape = inferImageShape(ratio);
    return {
      width: bitmap.width,
      height: bitmap.height,
      ratio,
      shape,
      recommendedTarget: recommendInstagramTargetForRatio(ratio),
      sourceUrl,
    };
  } finally {
    bitmap.close();
  }
}

export async function prepareImageForInstagramTarget(imageUrl: string, target: InstagramTarget): Promise<{ url: string; analysis: ImageAnalysis }> {
  const session = await getSessionOrThrow();
  const { bitmap, sourceUrl, mimeType } = await fetchImageBitmap(imageUrl);

  try {
    const ratio = bitmap.width / bitmap.height;
    const analysis: ImageAnalysis = {
      width: bitmap.width,
      height: bitmap.height,
      ratio,
      shape: inferImageShape(ratio),
      recommendedTarget: recommendInstagramTargetForRatio(ratio),
      sourceUrl,
    };

    const needsFeedPrep = target === 'feed' && (ratio < FEED_MIN_RATIO || ratio > FEED_MAX_RATIO);
    const needsStoryPrep = target === 'story' || target === 'reel';

    if (!needsFeedPrep && !needsStoryPrep) {
      return { url: sourceUrl, analysis };
    }

    const canvas = document.createElement('canvas');
    const isStoryLike = target === 'story' || target === 'reel';
    canvas.width = isStoryLike ? 1080 : 1080;
    canvas.height = isStoryLike ? 1920 : 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.fillStyle = '#0c0f14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.filter = 'blur(36px) brightness(0.45)';
    renderCover(ctx, bitmap, canvas.width, canvas.height);
    ctx.restore();

    ctx.fillStyle = 'rgba(12,15,20,0.24)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 40;
    renderContain(ctx, bitmap, canvas.width, canvas.height, isStoryLike ? 72 : 56);
    ctx.restore();

    const outputMime = mimeType.includes('png') ? 'image/png' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, outputMime);
    const uploadedUrl = await uploadPreparedBlob(blob, session.user.id, target === 'feed' ? 'feed' : 'story');
    return { url: uploadedUrl, analysis };
  } finally {
    bitmap.close();
  }
}

export async function renderImageToInstagramVideo(imageUrl: string, accessToken: string, onStatus?: (msg: string) => void): Promise<string> {
  onStatus?.('Preparing video...');
  const renderResp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-producer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      imageUrls: [imageUrl],
      scripts: [''],
      format: '9:16',
      clipDuration: 6,
    }),
  });

  const renderJson = await renderResp.json().catch(() => ({} as any));
  if (!renderResp.ok || !renderJson?.renderId) {
    throw new Error(renderJson?.error || 'Failed to prepare Reel video');
  }

  const renderId = String(renderJson.renderId);
  for (let attempt = 0; attempt < 36; attempt += 1) {
    onStatus?.(`Preparing video${attempt > 0 ? '...' : ''}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const pollResp = await fetch(`${SUPABASE_URL}/functions/v1/cinema-producer?renderId=${encodeURIComponent(renderId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });
    const pollJson = await pollResp.json().catch(() => ({} as any));
    if (!pollResp.ok) {
      throw new Error(pollJson?.error || 'Failed to check Reel render status');
    }
    if (pollJson?.status === 'done' && pollJson?.url) {
      return String(pollJson.url);
    }
    if (pollJson?.status === 'failed') {
      throw new Error(pollJson?.error || 'Failed to prepare Reel video');
    }
  }

  throw new Error('Timed out while preparing Reel video');
}
