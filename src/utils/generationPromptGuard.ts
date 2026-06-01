const BLOCKED_WORDS = [
  'fuck',
  'fucking',
  'sex',
  'porn',
  'porno',
  'xxx',
  'nude',
  'naked',
  'nsfw',
  'blowjob',
  'bj',
  'handjob',
  'dick',
  'cock',
  'penis',
  'vagina',
  'pussy',
  'boobs',
  'tits',
  'cum',
  'cumming',
  'horny',
  'slut',
  'whore',
  'escort',
  'fetish',
  'bdsm',
  'masturbate',
  'masturbation',
  'anal',
  'rape',
  'raped',
] as const;

const BLOCKED_PHRASES = [
  'teen sex',
  'child nude',
  'kid naked',
  'forced sex',
] as const;

const CHAR_VARIANTS: Record<string, string> = {
  a: 'a4@',
  b: 'b8',
  c: 'c(',
  e: 'e3',
  g: 'g69',
  i: 'i1!|l',
  o: 'o0',
  s: 's5$',
  t: 't7+',
  u: 'u*',
  x: 'x%',
};

const BLOCKED_MESSAGE = {
  ar: 'يحتوي هذا الوصف على ألفاظ صريحة أو مسيئة ولا يمكن استخدامه لإنشاء الصور أو الفيديو. الرجاء إزالة هذه الكلمات ثم المحاولة مرة أخرى.',
  en: 'This prompt contains explicit or abusive wording and cannot be used for image or video generation. Please remove it and try again.',
};

export interface GenerationPromptGuardResult {
  allowed: boolean;
  normalizedPrompt: string;
  blockedTerm: string | null;
  message: string;
}

function escapeCharClass(value: string): string {
  return value.replace(/[\\\]\-\^]/g, '\\$&');
}

function buildCharPattern(char: string): string {
  const variants = CHAR_VARIANTS[char] || char;
  return `[${escapeCharClass(variants)}]`;
}

function buildWordRegex(term: string): RegExp {
  const body = Array.from(term.toLowerCase())
    .map((char, index, arr) => `${buildCharPattern(char)}+${index < arr.length - 1 ? '[^a-z0-9]*' : ''}`)
    .join('');

  return new RegExp(`(^|[^a-z0-9])${body}($|[^a-z0-9])`, 'i');
}

function buildPhraseRegex(phrase: string): RegExp {
  const words = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  const body = words
    .map((word, index) => {
      const wordBody = Array.from(word)
        .map((char, charIndex, arr) => `${buildCharPattern(char)}+${charIndex < arr.length - 1 ? '[^a-z0-9]*' : ''}`)
        .join('');
      return `${wordBody}${index < words.length - 1 ? '[^a-z0-9]+' : ''}`;
    })
    .join('');

  return new RegExp(`(^|[^a-z0-9])${body}($|[^a-z0-9])`, 'i');
}

const blockedWordPatterns = BLOCKED_WORDS.map((term) => ({
  term,
  regex: buildWordRegex(term),
}));

const blockedPhrasePatterns = BLOCKED_PHRASES.map((term) => ({
  term,
  regex: buildPhraseRegex(term),
}));

function sanitizePrompt(raw: unknown): string {
  if (raw == null) return '';
  return String(raw)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 8000);
}

export function inspectGenerationPrompt(raw: unknown, language: string = 'en'): GenerationPromptGuardResult {
  const normalizedPrompt = sanitizePrompt(raw);

  if (!normalizedPrompt) {
    return {
      allowed: true,
      normalizedPrompt,
      blockedTerm: null,
      message: '',
    };
  }

  const lowerPrompt = normalizedPrompt.toLowerCase();

  for (const entry of blockedPhrasePatterns) {
    if (entry.regex.test(lowerPrompt)) {
      return {
        allowed: false,
        normalizedPrompt,
        blockedTerm: entry.term,
        message: language === 'ar' ? BLOCKED_MESSAGE.ar : BLOCKED_MESSAGE.en,
      };
    }
  }

  for (const entry of blockedWordPatterns) {
    if (entry.regex.test(lowerPrompt)) {
      return {
        allowed: false,
        normalizedPrompt,
        blockedTerm: entry.term,
        message: language === 'ar' ? BLOCKED_MESSAGE.ar : BLOCKED_MESSAGE.en,
      };
    }
  }

  return {
    allowed: true,
    normalizedPrompt,
    blockedTerm: null,
    message: '',
  };
}
