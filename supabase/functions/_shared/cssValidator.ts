/**
 * CSS Inheritance Validator
 * Detects common CSS issues that cause visual bugs like invisible icons
 */

export interface CSSWarning {
  file: string;
  line?: number;
  issue: string;
  severity: 'error' | 'warning';
  suggestion: string;
}

/**
 * Common CSS inheritance issues to detect
 */
const CSS_INHERITANCE_PATTERNS = [
  {
    // text-transparent on parent with currentColor icons inside
    pattern: /className=["'][^"']*\btext-transparent\b[^"']*["'][^>]*>[\s\S]*?(?:<(?:Heart|Star|Check|X|Mail|Phone|Icon|.*Icon)\s[^>]*(?:fill=["']currentColor["']|stroke=["']currentColor["'])[^>]*>|lucide-react)/,
    issue: 'text-transparent class on parent element makes icons using currentColor invisible',
    severity: 'error' as const,
    suggestion: 'Move text-transparent to a separate span wrapping only the text, or give icons an explicit color class like text-pink-400'
  },
  {
    // opacity-0 or invisible on parent containing visible children
    pattern: /className=["'][^"']*\b(?:opacity-0|invisible)\b[^"']*["'][^>]*>[\s\S]*?<(?:button|a|input|img|svg|Icon)/i,
    issue: 'opacity-0 or invisible class on parent hides all child elements',
    severity: 'warning' as const,
    suggestion: 'Ensure parent visibility matches intended design, or use conditional rendering instead'
  },
  {
    // text-transparent without bg-clip-text (broken gradient text)
    pattern: /className=["'][^"']*\btext-transparent\b(?![^"']*\bbg-clip-text\b)[^"']*["']/,
    issue: 'text-transparent without bg-clip-text makes text invisible',
    severity: 'error' as const,
    suggestion: 'Add bg-clip-text and a gradient background (bg-gradient-to-r from-x to-y) for gradient text effect'
  },
  {
    // currentColor fill/stroke without explicit text color
    pattern: /<(?:svg|path|circle|rect)[^>]*(?:fill|stroke)=["']currentColor["'][^>]*>(?![\s\S]*className=["'][^"']*\btext-)/,
    issue: 'SVG using currentColor may inherit unexpected color from parent',
    severity: 'warning' as const,
    suggestion: 'Ensure parent has an explicit text color class or use a direct color value'
  },
  {
    // Hidden parent with interactive children
    pattern: /className=["'][^"']*\bhidden\b[^"']*["'][^>]*>[\s\S]*?<(?:button|a|input)[^>]*onClick/i,
    issue: 'Interactive elements inside hidden parent are inaccessible',
    severity: 'warning' as const,
    suggestion: 'Use conditional rendering or visibility toggles instead of hidden class'
  },
  {
    // Gradient background without proper contrast for icons
    pattern: /className=["'][^"']*bg-gradient[^"']*["'][^>]*>[\s\S]{0,200}?<(?:Heart|Star|Icon)[^>]*fill=["']currentColor["']/,
    issue: 'Icons with currentColor inside gradient backgrounds may have poor visibility',
    severity: 'warning' as const,
    suggestion: 'Give icons an explicit color class that contrasts with the gradient'
  }
];

/**
 * Specific icon + text-transparent detection (the exact bug we fixed)
 */
const LUCIDE_ICON_NAMES = [
  'Heart', 'Star', 'Check', 'X', 'Mail', 'Phone', 'User', 'Settings',
  'Home', 'Menu', 'Search', 'Bell', 'Calendar', 'Clock', 'Edit', 'Trash',
  'Plus', 'Minus', 'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ExternalLink', 'Download',
  'Upload', 'Image', 'Video', 'Music', 'File', 'Folder', 'Send', 'Share',
  'Copy', 'Clipboard', 'Save', 'Bookmark', 'Flag', 'AlertTriangle', 'Info',
  'HelpCircle', 'Eye', 'EyeOff', 'Lock', 'Unlock', 'Key', 'Shield', 'Zap'
];

/**
 * Validates a single file for CSS inheritance issues
 */
export function validateCSSInheritance(filePath: string, content: string): CSSWarning[] {
  const warnings: CSSWarning[] = [];
  
  if (!content || typeof content !== 'string') return warnings;
  
  // Skip non-React files
  if (!filePath.match(/\.(jsx?|tsx?)$/)) return warnings;
  
  // Check for text-transparent with lucide icons specifically
  const hasTextTransparent = content.includes('text-transparent');
  const hasLucideIcons = LUCIDE_ICON_NAMES.some(icon => content.includes(`<${icon}`));
  const hasCurrentColor = content.includes('currentColor');
  
  if (hasTextTransparent && hasLucideIcons && hasCurrentColor) {
    // More detailed check: find if icons are inside text-transparent elements
    const textTransparentBlocks = content.match(/className=["'][^"']*text-transparent[^"']*["'][^>]*>[\s\S]*?<\/(?:span|div|motion\.span|motion\.div)>/g) || [];
    
    for (const block of textTransparentBlocks) {
      for (const iconName of LUCIDE_ICON_NAMES) {
        if (block.includes(`<${iconName}`) && block.includes('currentColor')) {
          warnings.push({
            file: filePath,
            issue: `${iconName} icon with currentColor inside text-transparent element will be invisible`,
            severity: 'error',
            suggestion: `Move text-transparent to wrap only the text content, and give the ${iconName} icon an explicit color like text-pink-400`
          });
        }
      }
    }
  }
  
  // Run general pattern checks
  for (const check of CSS_INHERITANCE_PATTERNS) {
    if (check.pattern.test(content)) {
      // Avoid duplicate warnings for the same issue
      const alreadyWarned = warnings.some(w => w.issue === check.issue);
      if (!alreadyWarned) {
        warnings.push({
          file: filePath,
          issue: check.issue,
          severity: check.severity,
          suggestion: check.suggestion
        });
      }
    }
  }
  
  return warnings;
}

/**
 * Validates all files in a project for CSS inheritance issues
 */
export function validateProjectCSS(files: Record<string, string>): CSSWarning[] {
  const allWarnings: CSSWarning[] = [];
  
  for (const [filePath, content] of Object.entries(files)) {
    const fileWarnings = validateCSSInheritance(filePath, content);
    allWarnings.push(...fileWarnings);
  }
  
  return allWarnings;
}

/**
 * Formats warnings for console/log output
 */
export function formatCSSWarnings(warnings: CSSWarning[]): string {
  if (warnings.length === 0) return '';
  
  const lines = ['⚠️ CSS INHERITANCE WARNINGS DETECTED:'];
  
  const errors = warnings.filter(w => w.severity === 'error');
  const warningsList = warnings.filter(w => w.severity === 'warning');
  
  if (errors.length > 0) {
    lines.push(`\n🚨 ERRORS (${errors.length}):`);
    for (const err of errors) {
      lines.push(`  [${err.file}] ${err.issue}`);
      lines.push(`    → Fix: ${err.suggestion}`);
    }
  }
  
  if (warningsList.length > 0) {
    lines.push(`\n⚠️ WARNINGS (${warningsList.length}):`);
    for (const warn of warningsList) {
      lines.push(`  [${warn.file}] ${warn.issue}`);
      lines.push(`    → Fix: ${warn.suggestion}`);
    }
  }
  
  return lines.join('\n');
}

// ============================================================================
// THEME CONSISTENCY LINTER (Item 8)
// ----------------------------------------------------------------------------
// Detects hardcoded colors (hex / hsl / rgb literals) in component and CSS
// files OUTSIDE the `:root` declaration. Such colors break the "change the
// theme by editing :root variables" promise — when the user says "make it
// pink", hardcoded colors don't follow.
// ============================================================================

export interface ThemeWarning {
  file: string;
  line?: number;
  color: string;
  severity: 'warning' | 'error';
  context?: string;
  suggestion: string;
}

// Matches #rgb, #rrggbb, #rrggbbaa
const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3}){1,2}(?:[0-9a-fA-F]{2})?\b/g;
// Matches rgb()/rgba()/hsl()/hsla() with literal numbers (not var(--x))
const FUNCTIONAL_COLOR_RE = /\b(?:rgba?|hsla?)\s*\(\s*[\d.%,\s/]+\s*\)/g;

/** True if this string reference looks like a binary/hash token, not a color. */
function isLikelyNonColor(ctx: string): boolean {
  // Skip things like version hashes, asset URLs, or hex literals unrelated to color.
  if (/\.(png|jpe?g|webp|svg|gif|ico|mp3|mp4|wav|woff2?)/i.test(ctx)) return true;
  if (/sha\d+|md5|hash=|uuid|data:image\//i.test(ctx)) return true;
  return false;
}

/** Extract :root CSS variable names defined in any CSS file. */
function collectRootVariables(files: Record<string, string>): Set<string> {
  const vars = new Set<string>();
  for (const [path, content] of Object.entries(files)) {
    if (!path.endsWith('.css') || typeof content !== 'string') continue;
    const rootMatch = content.match(/:root\s*{([\s\S]*?)}/);
    if (!rootMatch) continue;
    const body = rootMatch[1];
    const varRe = /(--[a-zA-Z0-9-]+)\s*:/g;
    let m: RegExpExecArray | null;
    while ((m = varRe.exec(body)) !== null) vars.add(m[1]);
  }
  return vars;
}

/**
 * Scan a single file for hardcoded color values outside of a `:root` block.
 * For .css files, anything inside `:root { ... }` is skipped (that's where
 * theme vars belong). For .jsx/.tsx files, ALL hardcoded colors are flagged.
 */
export function validateThemeInFile(
  filePath: string,
  content: string,
  _rootVars: Set<string>,
): ThemeWarning[] {
  const warnings: ThemeWarning[] = [];
  if (!content || typeof content !== 'string') return warnings;

  const isCss = /\.css$/i.test(filePath);
  const isReact = /\.(jsx?|tsx?)$/i.test(filePath);
  if (!isCss && !isReact) return warnings;

  // For CSS: strip the :root block so we only scan the rest.
  let searchable = content;
  if (isCss) {
    searchable = content.replace(/:root\s*{[\s\S]*?}/g, '');
  }

  const lines = searchable.split('\n');
  const seen = new Set<string>(); // dedupe "same color on same line"

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = [
      ...Array.from(line.matchAll(HEX_COLOR_RE)).map((m) => m[0]),
      ...Array.from(line.matchAll(FUNCTIONAL_COLOR_RE)).map((m) => m[0]),
    ];
    if (matches.length === 0) continue;

    for (const color of matches) {
      if (isLikelyNonColor(line)) continue;
      const key = `${i}:${color}`;
      if (seen.has(key)) continue;
      seen.add(key);
      warnings.push({
        file: filePath,
        line: i + 1,
        color,
        severity: 'warning',
        context: line.trim().slice(0, 160),
        suggestion:
          isCss && _rootVars.size > 0
            ? `Replace with var(--primary|--secondary|--accent|--bg|--text|--bg-card|--text-muted) referencing :root.`
            : 'Replace with var(--*) referencing a value defined in :root { } of styles.css.',
      });
    }
  }

  return warnings;
}

/** Scan all project files for theme consistency violations. */
export function validateThemeConsistency(
  files: Record<string, string>,
): ThemeWarning[] {
  const rootVars = collectRootVariables(files);
  const out: ThemeWarning[] = [];
  for (const [path, content] of Object.entries(files)) {
    out.push(...validateThemeInFile(path, content, rootVars));
  }
  return out;
}

/** Human-readable summary suitable for console logging. */
export function formatThemeWarnings(warnings: ThemeWarning[]): string {
  if (warnings.length === 0) return '';
  const grouped: Record<string, ThemeWarning[]> = {};
  for (const w of warnings) (grouped[w.file] ||= []).push(w);

  const lines: string[] = [`🎨 THEME CONSISTENCY WARNINGS (${warnings.length}):`];
  for (const [file, ws] of Object.entries(grouped)) {
    lines.push(`  [${file}] ${ws.length} hardcoded color${ws.length === 1 ? '' : 's'}`);
    for (const w of ws.slice(0, 5)) {
      lines.push(`    L${w.line}: ${w.color}  — ${w.context}`);
    }
    if (ws.length > 5) lines.push(`    … (+${ws.length - 5} more)`);
  }
  return lines.join('\n');
}

/**
 * Returns a prompt addition for the AI to avoid these issues
 */
export function getCSSInheritanceGuidelines(): string {
  return `
### CSS INHERITANCE SAFETY RULES (CRITICAL)
1. **NEVER put icons inside text-transparent elements** - Icons using currentColor or fill="currentColor" will become invisible
   - ❌ BAD: <span className="text-transparent bg-clip-text ..."><Heart fill="currentColor" />Title</span>
   - ✅ GOOD: <span className="flex items-center gap-2"><Heart className="text-pink-400" fill="currentColor" /><span className="text-transparent bg-clip-text ...">Title</span></span>

2. **Always give icons explicit colors** when parent uses color manipulation (gradients, transparency, etc.)
   - Add a color class directly to the icon: <Heart className="text-pink-400" />

3. **Gradient text pattern**: Only the TEXT should be inside text-transparent bg-clip-text
   - Separate icons and other elements from gradient text spans

4. **Test visibility**: When using currentColor, ensure the inherited color is visible
`;
}
