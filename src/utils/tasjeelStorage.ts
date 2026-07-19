import { supabase } from '@/integrations/supabase/client';

const PUBLIC_PATH_MARKER = '/storage/v1/object/public/tasjeel_recordings/';
const SIGNED_PATH_MARKER = '/storage/v1/object/sign/tasjeel_recordings/';

export function normalizeTasjeelStoragePath(value: string | null | undefined): string | null {
  const rawValue = (value || '').trim();
  if (!rawValue || rawValue === 'placeholder_for_quick_summary') return null;

  if (rawValue.includes(PUBLIC_PATH_MARKER)) {
    return rawValue.split(PUBLIC_PATH_MARKER)[1]?.split('?')[0] || null;
  }

  if (rawValue.includes(SIGNED_PATH_MARKER)) {
    return rawValue.split(SIGNED_PATH_MARKER)[1]?.split('?')[0] || null;
  }

  if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) return null;
  return rawValue;
}

export async function createTasjeelSignedUrl(value: string | null | undefined, expiresIn = 900): Promise<string | null> {
  const path = normalizeTasjeelStoragePath(value);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from('tasjeel_recordings')
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data?.signedUrl || null;
}
