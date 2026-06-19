const rawSandpackBundlerUrl = (import.meta.env.VITE_SANDPACK_BUNDLER_URL ?? '').trim();

function normalizeBundlerUrl(value: string): string | undefined {
  if (!value) return undefined;

  if (value.startsWith('/')) {
    if (typeof window !== 'undefined') {
      // Resolve same-origin relative URLs to the origin root to avoid Sandpack's subdirectory bugs
      return window.location.origin;
    }
    return '/';
  }

  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

// Only set when VITE_SANDPACK_BUNDLER_URL is explicitly provided (e.g. a
// self-hosted bundler). When unset, this stays `undefined` so Sandpack uses
// its built-in, version-matched bundler — the most reliable option.
export const SANDPACK_BUNDLER_URL = normalizeBundlerUrl(rawSandpackBundlerUrl);

export const SANDPACK_EFFECTIVE_BUNDLER_URL = SANDPACK_BUNDLER_URL;

// If VITE_SANDPACK_BUNDLER_URL is a same-origin relative path (like /sandbox.html),
// we use it as the startRoute to ensure the iframe loads the correct file.
export const SANDPACK_START_ROUTE = rawSandpackBundlerUrl.startsWith('/') ? rawSandpackBundlerUrl : undefined;
