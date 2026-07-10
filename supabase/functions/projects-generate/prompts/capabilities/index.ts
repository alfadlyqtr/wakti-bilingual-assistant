// 🧠 THREE-LAYER PROMPT ARCHITECTURE — Capability Registry
//
// Layer 1 (CORE): Always in BASE_SYSTEM_PROMPT — identity, output format, defensive coding.
// Layer 2 (MANIFEST): Always sent — a short menu of available capabilities.
// Layer 3 (DOCS): Injected only when detected (CREATE mode) or fetched on demand (AGENT mode).
//
// This pattern is how Cascade/Cursor manage prompt size without losing reliability.

import { PHASER_CAPABILITY } from "./phaser.ts";
import { STOCK_IMAGES_CAPABILITY } from "./stockImages.ts";
import { FORMS_CAPABILITY } from "./forms.ts";
import { BOOKING_CAPABILITY } from "./booking.ts";
import { ECOMMERCE_CAPABILITY } from "./ecommerce.ts";
import { BLOG_CAPABILITY } from "./blog.ts";
import { SPORTS_CAPABILITY } from "./sports.ts";
import { MULTI_FILE_FEATURES_CAPABILITY } from "./multiFileFeatures.ts";
import { COMMENTS_CAPABILITY } from "./comments.ts";
import { CHAT_CAPABILITY } from "./chat.ts";
import { ROLES_CAPABILITY } from "./roles.ts";

export type CapabilityName =
  | "phaser_game"
  | "stock_images"
  | "forms"
  | "booking"
  | "ecommerce"
  | "blog"
  | "sports"
  | "multi_file_features"
  | "comments"
  | "chat"
  | "roles";

// The short menu — always sent to the AI so it knows what's available.
export const CAPABILITY_MANIFEST = `
## 🛠️ AVAILABLE CAPABILITIES

Your project is pre-wired to a Supabase backend. The following capability docs can be loaded
on demand using the \`get_capability_doc\` tool in Agent/Execute mode. In CREATE mode, they are
auto-injected when the user's request matches.

| Capability      | When to use                                                           |
|-----------------|-----------------------------------------------------------------------|
| stock_images    | ANY image (hero, section, gallery). Uses Nano Banana generated assets. |
| forms           | Contact, quote, newsletter, feedback, waitlist forms.                 |
| booking         | Appointments, scheduling, services (barber, salon, spa, clinic).      |
| ecommerce       | Shop, store, products, cart.                                          |
| blog            | Blog, CMS, articles, posts, news, magazine content.                   |
| sports          | Sports fan sites, rosters, standings, fixtures, team news.            |
| phaser_game     | 2D games (racing, shooter, puzzle, platformer, arcade).               |
| multi_file_features | Language toggle, dark mode, cart, auth, animations, modals, toasts, new pages, search. |
| comments        | Comments, reviews, ratings, discussions on posts/products.           |
| chat            | Live chat, messaging, direct messages, support inbox.                |
| roles           | User roles, permissions, team/admin access, staff accounts.          |

Rules:
- Never hardcode data the backend provides (products, services, categories, filters).
- Never import @supabase/supabase-js in generated projects — use project-backend-api.
- For Arabic / RTL / multi-language, follow the runtime i18n instructions added separately.
`;

// Full docs, keyed by name.
const DOCS: Record<CapabilityName, string> = {
  phaser_game: PHASER_CAPABILITY,
  stock_images: STOCK_IMAGES_CAPABILITY,
  forms: FORMS_CAPABILITY,
  booking: BOOKING_CAPABILITY,
  ecommerce: ECOMMERCE_CAPABILITY,
  blog: BLOG_CAPABILITY,
  sports: SPORTS_CAPABILITY,
  multi_file_features: MULTI_FILE_FEATURES_CAPABILITY,
  comments: COMMENTS_CAPABILITY,
  chat: CHAT_CAPABILITY,
  roles: ROLES_CAPABILITY,
};

export function getCapabilityDoc(name: string): string | null {
  const key = name as CapabilityName;
  return DOCS[key] ?? null;
}

export function listCapabilityNames(): CapabilityName[] {
  return Object.keys(DOCS) as CapabilityName[];
}

// -------------------------------------------------------------------------
// SMART CLASSIFIER — Detects which capabilities apply to a user prompt.
// Used in CREATE mode (one-shot generation) to pre-inject the right docs.
// In AGENT mode, the AI fetches docs on demand via get_capability_doc.
// -------------------------------------------------------------------------

interface DetectionRule {
  capability: CapabilityName;
  keywords: RegExp[];
}

const RULES: DetectionRule[] = [
  {
    capability: "phaser_game",
    keywords: [
      /\b(game|gaming|play|player|score|level|levels|leaderboard|shoot(er)?|rac(e|ing)|puzzle|platformer|arcade|rpg|strategy|adventure|simulation|chess|trivia|battle|fighter|runner|clicker|tower\s*defense|enemies|boss|power[- ]?up|lives|health\s*bar|jump|gravity|collision|canvas|sprite|phaser)\b/i,
    ],
  },
  {
    capability: "ecommerce",
    keywords: [
      // NOTE: bare "product(s)" is deliberately excluded — it's a generic word that
      // shows up in unrelated prompts (e.g. "images for products/services" on a
      // booking site) and was causing false ecommerce capability injection.
      // "product catalog" as a phrase is still a strong, specific signal.
      /\b(shop|store|e-?commerce|ecommerce|product\s*catalog|cart|checkout|marketplace|buy|sell|inventory|sku|catalog)\b/i,
      // Arabic: \b is ASCII-only in JS regex and never matches around Arabic script,
      // so these run as plain substring checks (Arabic's root-letter structure makes
      // that safe — e.g. "بيع" only ever appears inside sell/sale/seller-related words).
      // Deliberately excludes bare "منتج/منتجات" (product/products) for the same
      // false-positive reason as the English list above.
      /متجر|تسوق|سلة(?:\s*(?:التسوق|الشراء|المشتريات))?|تجارة\s*إلكترونية|كتالوج|إتمام\s*الشراء|الدفع\s*الإلكتروني|بيع|شراء|مخزون|سوق\s*إلكتروني/,
    ],
  },
  {
    capability: "blog",
    keywords: [
      /\b(blog|cms|content\s*management|article|articles|post|posts|news|newsletter\s*site|magazine|editorial|journal|stories)\b/i,
      /مدونة|مقالات?|أخبار|مجلة\s*إلكترونية/,
    ],
  },
  {
    capability: "sports",
    keywords: [
      /\b(sport|sports|football|soccer|fifa|afc|uefa|club|team|national\s+team|squad|roster|lineup|standings|table|fixtures?|matches?|results?|fans?|supporters?)\b/i,
      /qatar|qatari|القطري|قطر|العنابي/i,
      /رياض[ةي]|كرة\s*القدم|نادي|فريق|الدوري|مباريات?|بطولة|لاعبين/,
    ],
  },
  {
    capability: "booking",
    keywords: [
      /\b(book(ing)?|appointment|schedule|reservation|barber|salon|spa|clinic|consultation|haircut|massage|therapist|dentist|doctor)\b/i,
      /حجوزات|حجز|موعد|مواعيد|صالون|حلاق(?:ة)?|سبا|عيادة|استشارة|تدليك|قص\s*شعر/,
    ],
  },
  {
    capability: "forms",
    keywords: [
      /\b(contact\s*(us|form)?|quote\s*request|newsletter|waitlist|feedback|sign[- ]?up|subscribe|get\s*in\s*touch)\b/i,
      /تواصل\s*معنا|اتصل\s*بنا|نموذج\s*(تواصل|اتصال)|النشرة\s*البريدية|استفسار|طلب\s*عرض\s*سعر|قائمة\s*الانتظار/,
      // Default-on for business/professional site types that almost always ship a
      // contact section even when the prompt never says "contact form" explicitly
      // (portfolios, agencies, restaurants, personal brands, etc.) — mirrors the
      // stock_images default-on philosophy so the real backend contract is never
      // left to guesswork just because the trigger word wasn't literally "contact".
      /\b(portfolio|resume|cv|freelance(r)?|consultant|agency|studio|restaurant|cafe|hotel|clinic|dentist|law\s*firm|real\s*estate|realtor|photographer|personal\s*brand)\b/i,
      /بورتفوليو|السيرة\s*الذاتية|مستقل|استشاري|وكالة|استوديو|مطعم|مقهى|فندق|عيادة|عقارات|مصور|موقع\s*شخصي/,
    ],
  },
  {
    capability: "stock_images",
    keywords: [
      // Default-on for most site types; keep broad so nearly every project gets image guidance.
      /\b(landing|website|portfolio|hero|gallery|images?|photos?|showcase|restaurant|cafe|hotel|fitness|gym|about|team|agency|studio|business|brand)\b/i,
    ],
  },
  {
    capability: "multi_file_features",
    keywords: [
      /\b(language|arabic|english|rtl|ltr|bilingual|i18n|translation|toggle|switch\s*lang)\b/i,
      /\b(dark\s*mode|light\s*mode|theme\s*toggle|night\s*mode|color\s*scheme)\b/i,
      /\b(cart|shopping|add\s*to\s*cart|checkout|basket)\b/i,
      /\b(login|signup|sign\s*up|sign\s*in|auth|authentication|logout|register|user\s*account|member\s*(area|portal|login)|client\s*portal|dashboard|saas|user\s*profile|account\s*settings)\b/i,
      /\b(animation|animate|fade|slide|scroll\s*effect|aos|framer|motion|transition)\b/i,
      /\b(modal|popup|pop-up|dialog|overlay|lightbox)\b/i,
      /\b(toast|notification|alert\s*message|snackbar)\b/i,
      /\b(new\s*page|add\s*page|create\s*page|new\s*route|add\s*route|routing)\b/i,
      /\b(search|filter|sort|searchable)\b/i,
    ],
  },
  {
    capability: "comments",
    keywords: [
      /\b(comment(s)?|review(s)?|rating(s)?|discussion(s)?|reply|replies)\b/i,
      /تعليق(ات)?|مراجعات|تقييم(ات)?/,
    ],
  },
  {
    capability: "chat",
    keywords: [
      /\b(live\s*chat|chat\s*room|chat\s*widget|messaging|direct\s*message|dm(s)?|support\s*inbox)\b/i,
      /دردشة|محادثة|رسائل\s*مباشرة/,
    ],
  },
  {
    capability: "roles",
    keywords: [
      /\b(user\s*roles?|admin\s*role|permissions?|access\s*control|team\s*member(s)?|staff\s*account(s)?|role[- ]?based)\b/i,
      /صلاحيات|أدوار\s*المستخدمين/,
    ],
  },
];

export function detectCapabilities(prompt: string): CapabilityName[] {
  const detected = new Set<CapabilityName>();
  const text = (prompt || "").slice(0, 4000); // cap to avoid pathological regex cost
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      if (kw.test(text)) {
        detected.add(rule.capability);
        break;
      }
    }
  }
  // If the user is building a game, they don't also need e-commerce/booking docs.
  if (detected.has("phaser_game")) {
    detected.delete("ecommerce");
    detected.delete("booking");
    detected.delete("forms");
    detected.delete("comments");
    detected.delete("chat");
    detected.delete("roles");
  }
  return Array.from(detected);
}

/**
 * Assemble docs for CREATE mode — returns the concatenated capability docs
 * that match the prompt, or an empty string if none match.
 */
export function assembleCapabilityDocs(prompt: string): { names: CapabilityName[]; text: string } {
  const names = detectCapabilities(prompt);
  if (names.length === 0) return { names: [], text: "" };
  const sections = names.map((n) => DOCS[n]).filter(Boolean);
  return {
    names,
    text:
      "\n\n# 📚 LOADED CAPABILITIES (auto-selected for this request)\n" +
      sections.join("\n\n---\n"),
  };
}
