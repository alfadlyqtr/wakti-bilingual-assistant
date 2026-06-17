const rawSandpackBundlerUrl = (import.meta.env.VITE_SANDPACK_BUNDLER_URL ?? '').trim();
const DEFAULT_SANDPACK_BUNDLER_URL = 'https://preview.wakti.ai';

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

export const SANDPACK_BUNDLER_URL = normalizeBundlerUrl(rawSandpackBundlerUrl);

export const SANDPACK_EFFECTIVE_BUNDLER_URL = SANDPACK_BUNDLER_URL ?? DEFAULT_SANDPACK_BUNDLER_URL;
