import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_NAME = 'wakti-grok-image-edit';

export interface EditSegment {
  name: string;
  index: number;
  maskDataUrl: string;
}

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
}

// In-flight + completed segment fetches, shared by prefetch and the edit panel,
// so the same task is NEVER submitted to Kie twice.
const segmentCache = new Map<string, Promise<EditSegment[]>>();

/**
 * Submit a Kie 2.0 segment-map task for a generated image and poll until done.
 * Returns the segment list (name + index + mask as base64 data URL).
 * Throws on failure. Takes ~40s on Kie's side.
 */
export function fetchSegmentsForTask(kieTaskId: string): Promise<EditSegment[]> {
  const existing = segmentCache.get(kieTaskId);
  if (existing) return existing;

  const promise = doFetchSegments(kieTaskId);
  segmentCache.set(kieTaskId, promise);
  // Allow a fresh retry if it failed
  promise.catch(() => segmentCache.delete(kieTaskId));
  return promise;
}

async function doFetchSegments(kieTaskId: string): Promise<EditSegment[]> {
  const headers = await getAuthHeaders();
  if (!headers) throw new Error('auth');

  const submitResp = await fetch(`${SUPABASE_URL}/functions/v1/${FN_NAME}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'segment', task_id: kieTaskId }),
  });
  const submitJson = await submitResp.json().catch(() => ({} as Record<string, unknown>));
  const segTaskId = (submitJson?.taskId as string) || '';
  if (!submitResp.ok || !submitJson?.success || !segTaskId) throw new Error('segment submit failed');

  const deadline = Date.now() + 3 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollResp = await fetch(`${SUPABASE_URL}/functions/v1/${FN_NAME}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'segment', taskId: segTaskId }),
    });
    const pollJson = await pollResp.json().catch(() => ({} as Record<string, unknown>));
    if (Array.isArray(pollJson?.segments)) return pollJson.segments as EditSegment[];
    if (pollJson?.status === 'failed' || pollJson?.status === 'error') throw new Error('segment task failed');
  }
  throw new Error('segment timed out');
}
