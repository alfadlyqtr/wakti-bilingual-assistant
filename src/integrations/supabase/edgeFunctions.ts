import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './client';

interface TranscribeAudioPayload {
  audioUrl: string;
  [key: string]: unknown;
}

type EdgeFunctionPayload = Record<string, unknown>;

export const callEdgeFunctionWithRetry = async <T>(
  functionName: string,
  options: {
    body?: EdgeFunctionPayload;
    headers?: Record<string, string>;
    maxRetries?: number;
    retryDelay?: number;
    responseType?: 'json' | 'blob' | 'arrayBuffer' | 'text';
  } = {}
): Promise<T> => {
  const {
    body,
    headers = {},
    maxRetries = 3,
    retryDelay = 1000,
    responseType = 'json'
  } = options;

  let lastError: Error | null = null;

  if (false) console.log(`Calling edge function "${functionName}" with options:`, {
    hasBody: !!body,
    bodyType: body ? typeof body : null,
    bodyKeys: body ? Object.keys(body) : null,
    headers,
    maxRetries,
    retryDelay,
    responseType
  });

  if (functionName === 'transcribe-audio' && body) {
    const audioBody = body as TranscribeAudioPayload;
    if (false) console.log(`transcribe-audio request payload:`, {
      audioUrlStart: audioBody.audioUrl ? `${audioBody.audioUrl.substring(0, 30)}...` : 'undefined',
      audioUrlLength: audioBody.audioUrl ? audioBody.audioUrl.length : 0
    });
  } else if (functionName === 'summarize-text' && body) {
    const sBody = body as { transcript?: string; language?: string };
    if (false) console.log(`summarize-text request payload:`, {
      hasTranscript: !!sBody.transcript,
      transcriptLength: sBody.transcript ? sBody.transcript.length : 0,
      language: sBody.language
    });
  } else if (functionName === 'generate-speech' && body) {
    const gBody = body as { summary?: string; voice?: string };
    if (false) console.log(`generate-speech request payload:`, {
      summaryLength: gBody.summary ? gBody.summary.length : 0,
      voice: gBody.voice
    });
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const fullUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;

      let authToken = SUPABASE_ANON_KEY;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) authToken = session.access_token;
      } catch { /* fall back to anon key */ }

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${authToken}`,
          ...headers
        },
        body: JSON.stringify(body)
      };

      if (false) console.log('Fetch options:', {
        method: fetchOptions.method,
        hasBody: !!fetchOptions.body,
        headersKeys: Object.keys(fetchOptions.headers || {})
      });

      const startTime = Date.now();
      const response = await fetch(fullUrl, fetchOptions);
      const duration = Date.now() - startTime;

      if (false) console.log(`Direct fetch to "${functionName}" response:`, {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        contentType: response.headers.get('Content-Type'),
        time: `${duration}ms`
      });

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
          console.error(`Error response from "${functionName}":`, errorText);
        } catch (e) {
          errorText = response.statusText;
        }
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

      let data;
      const contentType = response.headers.get('Content-Type');

      if (responseType === 'blob' || contentType?.includes('audio/') || contentType?.includes('video/') || contentType?.includes('application/octet-stream')) {
        data = await response.blob();
      } else if (responseType === 'arrayBuffer') {
        data = await response.arrayBuffer();
      } else if (responseType === 'text' || contentType?.includes('text/')) {
        data = await response.text();
      } else {
        try {
          data = await response.json();
        } catch (e) {
          console.warn('Response was not valid JSON, returning raw text instead');
          data = await response.text();
        }
      }

      if (false) console.log(`Edge function "${functionName}" response received:`, {
        type: typeof data,
        isBlob: data instanceof Blob,
        isArrayBuffer: data instanceof ArrayBuffer,
        isString: typeof data === 'string'
      });

      return data as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`Error calling edge function "${functionName}" (attempt ${attempt + 1}/${maxRetries}):`, err);
      console.error(`Error details:`, {
        message: err.message,
        name: err.name,
        stack: err.stack?.split('\n').slice(0, 3).join('\n')
      });
      lastError = err;

      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }

  const errorMessage = `Failed to call edge function ${functionName} after ${maxRetries} attempts`;
  console.error(errorMessage, lastError);
  throw lastError || new Error(errorMessage);
};

export const withRetry = async <T>(
  operation: () => Promise<{ data: T | null; error: Error | null }>,
  maxRetries = 3,
  retryDelay = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await operation();

      if (error) {
        console.error(`Database operation error (attempt ${attempt + 1}/${maxRetries}):`, error);
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }

      if (data === null) {
        throw new Error('Operation returned null data');
      }

      return data as T;
    } catch (error) {
      console.error(`Error in database operation (attempt ${attempt + 1}/${maxRetries}):`, error);
      lastError = error as Error;

      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }

  throw lastError || new Error(`Failed to execute database operation after ${maxRetries} attempts`);
};
