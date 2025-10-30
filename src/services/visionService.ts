export type VisionImage = { base64: string; mimeType: string };

function getApiBase(): string {
  try {
    const base = (import.meta as any)?.env?.VITE_API_URL;
    return typeof base === 'string' && base ? base.replace(/\/$/, '') : '';
  } catch {
    return '';
  }
}

export async function* streamVisionDirect(
  images: VisionImage[],
  prompt: string,
  language: string,
  personalTouch?: { nickname?: string; tone?: string; style?: string }
): AsyncGenerator<{ json?: any; token?: string; type?: 'done'; error?: string }, void, unknown> {
  const api = getApiBase();
  const resp = await fetch(`${api}/api/vision-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, prompt, language, personalTouch })
  });
  if (!resp.ok) throw new Error(`Vision failed: ${resp.status}`);

  const reader = resp.body?.getReader();
  if (!reader) throw new Error('No stream');

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') { yield { type: 'done' }; return; }
      try {
        const parsed = JSON.parse(data);
        if (parsed.json) yield { json: parsed.json };
        if (parsed.token) yield { token: parsed.token };
        if (parsed.error) yield { error: String(parsed.error) };
      } catch {}
    }
  }
}

export async function analyzeVision(
  images: VisionImage[],
  prompt: string,
  language: string,
  personalTouch: any,
  callbacks: {
    onJson?: (json: any) => void;
    onToken?: (token: string) => void;
    onComplete?: () => void;
    onError?: (error: string) => void;
  }
) {
  try {
    for await (const event of streamVisionDirect(images, prompt, language, personalTouch)) {
      if (event.json) callbacks.onJson?.(event.json);
      if (event.token) callbacks.onToken?.(event.token);
      if (event.type === 'done') callbacks.onComplete?.();
      if (event.error) callbacks.onError?.(event.error);
    }
  } catch (err: any) {
    callbacks.onError?.(String(err?.message || err));
  }
}
