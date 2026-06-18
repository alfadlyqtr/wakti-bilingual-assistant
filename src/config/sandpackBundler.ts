const rawSandpackBundlerUrl = (import.meta.env.VITE_SANDPACK_BUNDLER_URL ?? '').trim();

function normalizeBundlerUrl(value: string): string | undefined {
  if (!value) return undefined;

  if (value.startsWith('/')) {
    return value;
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

// If no environment variable is provided, default to our highly-robust, same-domain,
// telemetry-free static copy at `/sandpack-bundler` which we host in the public folder.
export const SANDPACK_EFFECTIVE_BUNDLER_URL = SANDPACK_BUNDLER_URL || '/sandpack-bundler';
