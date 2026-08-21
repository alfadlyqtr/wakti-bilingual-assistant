import { supabase } from '@/integrations/supabase/client';

export interface BrandKit {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  tone: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandKitDraft {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  tone: string | null;
}

export async function fetchBrandKits(userId: string): Promise<BrandKit[]> {
  const { data, error } = await (supabase as any)
    .from('brand_kits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as BrandKit[];
}

export async function createBrandKit(userId: string, draft: BrandKitDraft): Promise<BrandKit> {
  const { data, error } = await (supabase as any)
    .from('brand_kits')
    .insert({
      user_id: userId,
      name: draft.name,
      logo_url: draft.logo_url,
      primary_color: draft.primary_color,
      accent_color: draft.accent_color,
      tone: draft.tone,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as BrandKit;
}

export async function deleteBrandKit(userId: string, kitId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('brand_kits')
    .delete()
    .eq('id', kitId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function uploadBrandKitLogo(userId: string, imageSource: string): Promise<string> {
  try {
    const res = await fetch(imageSource);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const blob = await res.blob();
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `${userId}/brand-kits/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from('generated-images')
      .upload(fileName, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('generated-images').getPublicUrl(fileName);
    if (!data?.publicUrl) throw new Error('Failed to get logo URL');
    return data.publicUrl;
  } catch {
    // Remote logos (e.g. scanned from a website) may be blocked by CORS —
    // keep the original URL so saving the kit never fails because of the logo.
    if (imageSource.startsWith('http')) return imageSource;
    throw new Error('Could not upload the logo');
  }
}

const toHex = (value: number) => value.toString(16).padStart(2, '0');
const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

/**
 * Extract the two most dominant *saturated* colors from an image (e.g. a logo).
 * Near-white, near-black, and transparent pixels are ignored so the result
 * reflects the actual brand colors, not the canvas background.
 */
export async function extractBrandColors(imageSource: string): Promise<{ primary: string; accent: string } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = new Map<string, { count: number; score: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          if (max > 240 && min > 220) continue; // near-white background
          if (max < 24) continue; // near-black
          const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`;
          const entry = buckets.get(key) || { count: 0, score: 0, r: 0, g: 0, b: 0 };
          entry.count += 1;
          entry.score += 0.35 + saturation;
          entry.r += r;
          entry.g += g;
          entry.b += b;
          buckets.set(key, entry);
        }

        const ranked = [...buckets.values()]
          .filter((entry) => entry.count >= 4)
          .sort((a, b) => b.score - a.score);
        if (!ranked.length) return resolve(null);

        const avg = (entry: { count: number; r: number; g: number; b: number }) =>
          rgbToHex(Math.round(entry.r / entry.count), Math.round(entry.g / entry.count), Math.round(entry.b / entry.count));

        const primary = avg(ranked[0]);
        const accentEntry = ranked.slice(1).find((entry) => avg(entry) !== primary) || ranked[0];
        resolve({ primary, accent: avg(accentEntry) });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageSource;
  });
}
