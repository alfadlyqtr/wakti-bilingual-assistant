/**
 * Direct Style Editor - Applies style changes directly to JSX code
 * WITHOUT using AI prompts. This saves credits for users!
 * 
 * Supports:
 * - Text content changes
 * - Inline style changes (color, backgroundColor, fontSize, fontFamily, and many more)
 * - Works with both existing style props and adding new ones
 */

interface ElementInfo {
  tagName: string;
  className: string;
  id: string;
  innerText: string;
  openingTag: string;
}

interface StyleChanges {
  text?: string;
  color?: string;
  bgColor?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
  // Additional CSS properties
  margin?: string;
  padding?: string;
  gap?: string;
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  border?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderColor?: string;
  borderRadius?: string;
  boxShadow?: string;
  opacity?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  display?: string;
  textAlign?: string;
  fontWeight?: string;
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: string;
  textDecoration?: string;
}

const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
const genericClasses = [
  'w-full', 'h-full', 'flex', 'block', 'hidden', 'relative', 'absolute', 'p-', 'm-', 'text-', 'bg-',
  'font-', 'min-', 'max-', 'justify-', 'items-', 'gap-', 'border-', 'shadow-', 'rounded-', 'transition-'
];

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTagCandidates(tagName: string): string[] {
  const candidates = [tagName, `motion.${tagName}`];

  if (tagName.toLowerCase() === 'a') {
    candidates.push('Link', 'NavLink', 'MotionLink', 'motion.Link');
  } else if (tagName.toLowerCase() === 'button') {
    candidates.push('Button', 'MotionButton', 'motion.button');
  }

  return Array.from(new Set(candidates));
}

function getFlexibleTextPattern(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeForRegex)
    .join('\\s+');
}

function extractStaticAttributeValue(openingTag: string, attributeName: string): string | null {
  if (!openingTag) return null;

  const match = openingTag.match(new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1]?.trim() || null;
}

function buildAttributePattern(attributeName: string, attributeValue: string): string {
  const escapedValue = escapeForRegex(attributeValue);
  return `${attributeName}\\s*=\\s*(?:"[^"]*${escapedValue}[^"]*"|'[^']*${escapedValue}[^']*'|\\{[^}]*${escapedValue}[^}]*\\})`;
}

function getClassTokens(className: string): string[] {
  return Array.from(
    new Set(
      className
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token && !token.includes('hover:') && !token.includes(':'))
        .filter((token) => !genericClasses.some((genericClass) => token === genericClass || (genericClass.endsWith('-') && token.startsWith(genericClass))))
        .sort((a, b) => b.length - a.length)
    )
  );
}

function findClosingTagIndex(code: string, tagName: string, fromIndex: number): number {
  const closingPattern = new RegExp(`</${escapeForRegex(tagName)}>`,'g');
  closingPattern.lastIndex = fromIndex;
  const closingMatch = closingPattern.exec(code);
  return closingMatch ? closingMatch.index + closingMatch[0].length : -1;
}

function findElementByUniqueTextAnchor(
  code: string,
  element: ElementInfo,
  tagCandidates: string[]
): { fullMatch: string; openingTag: string; startIndex: number; endIndex: number } | null {
  const text = (element.innerText || '').trim();
  if (!text || text.length < 3) return null;

  const normalizedNeedle = text.replace(/\s+/g, ' ').trim().toLowerCase();
  const escapedText = escapeForRegex(text).replace(/\s+/g, '\\s+');
  const textPattern = new RegExp(escapedText, 'gi');
  const textMatches: Array<{ index: number; text: string }> = [];
  let textMatch;

  while ((textMatch = textPattern.exec(code)) !== null) {
    const matchedText = textMatch[0].replace(/\s+/g, ' ').trim().toLowerCase();
    if (matchedText === normalizedNeedle) {
      textMatches.push({ index: textMatch.index, text: textMatch[0] });
    }
  }

  if (textMatches.length !== 1) return null;

  const textIndex = textMatches[0].index;

  for (const cand of tagCandidates) {
    const openingPattern = new RegExp(`(<${escapeForRegex(cand)}[^>]*>)`, 'g');
    const openings: Array<{ openingTag: string; startIndex: number; endIndex: number }> = [];
    let openingMatch;

    while ((openingMatch = openingPattern.exec(code)) !== null) {
      if (openingMatch.index < textIndex) {
        openings.push({
          openingTag: openingMatch[1],
          startIndex: openingMatch.index,
          endIndex: openingMatch.index + openingMatch[1].length,
        });
      }
    }

    for (let i = openings.length - 1; i >= 0; i -= 1) {
      const opening = openings[i];
      const closingEnd = findClosingTagIndex(code, cand, opening.endIndex);
      if (closingEnd === -1) continue;
      if (textIndex < closingEnd) {
        return {
          fullMatch: code.slice(opening.startIndex, closingEnd),
          openingTag: opening.openingTag,
          startIndex: opening.startIndex,
          endIndex: closingEnd,
        };
      }
    }
  }

  return null;
}

/**
 * Find an element in JSX code by matching its tag, text content, class, or src.
 * NOTE: DOM tagName may come from components like framer-motion (e.g. <motion.h1> renders <h1>),
 * so we try multiple JSX tag candidates.
 * 
 * Enhanced to support:
 * - Self-closing tags (<img>, <input>, <br>, etc.)
 * - Matching by src attribute for images
 * - More specific className matching
 */
function findElementInCode(
  code: string,
  element: ElementInfo
): { fullMatch: string; openingTag: string; startIndex: number; endIndex: number } | null {
  const { tagName, innerText, className, id, openingTag: elementOpeningTag } = element;

  const tagCandidates = getTagCandidates(tagName);
  const isSelfClosing = selfClosingTags.includes(tagName.toLowerCase());
  const attributeNames = ['src', 'href', 'alt', 'title', 'aria-label', 'name', 'placeholder', 'type', 'role'];

  const matchByOpeningTag = (openingTagPattern: string) => {
    for (const cand of tagCandidates) {
      const t = escapeForRegex(cand);

      if (isSelfClosing) {
        const pattern = new RegExp(`<${t}[^>]*${openingTagPattern}[^>]*(?:\\/>|>)`, 'g');
        const match = pattern.exec(code);

        if (match) {
          return {
            fullMatch: match[0],
            openingTag: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
          };
        }
      } else {
        const pattern = new RegExp(`(<${t}[^>]*${openingTagPattern}[^>]*>)`, 'g');
        const match = pattern.exec(code);

        if (match) {
          const afterOpening = code.slice(match.index + match[1].length);
          const closingPattern = new RegExp(`</${t}>`);
          const closingMatch = closingPattern.exec(afterOpening);

          if (closingMatch) {
            const fullMatch = code.slice(
              match.index,
              match.index + match[1].length + closingMatch.index + closingMatch[0].length
            );

            return {
              fullMatch,
              openingTag: match[1],
              startIndex: match.index,
              endIndex: match.index + fullMatch.length,
            };
          }
        }
      }
    }

    return null;
  };

  const idValue = id || extractStaticAttributeValue(elementOpeningTag, 'id');
  if (idValue) {
    const idMatch = matchByOpeningTag(buildAttributePattern('id', idValue));
    if (idMatch) {
      return idMatch;
    }
  }

  for (const attributeName of attributeNames) {
    const attributeValue = extractStaticAttributeValue(elementOpeningTag, attributeName);
    if (!attributeValue || attributeValue.length < 2) continue;

    const attributeMatch = matchByOpeningTag(buildAttributePattern(attributeName, attributeValue));
    if (attributeMatch) {
      return attributeMatch;
    }
  }

  const classTokens = getClassTokens(className);
  const classToMatch = classTokens[0];
  const classPattern = classToMatch
    ? `(?:className|class)\\s*=\\s*(?:"[^"]*${escapeForRegex(classToMatch)}[^"]*"|'[^']*${escapeForRegex(classToMatch)}[^']*'|\\{[^>]*${escapeForRegex(classToMatch)}[^>]*\\})`
    : null;

  if (!isSelfClosing && innerText && innerText.length > 0 && innerText.length < 200) {
    const flexibleText = getFlexibleTextPattern(innerText);

    for (const cand of tagCandidates) {
      const t = escapeForRegex(cand);
      const exactPattern = new RegExp(`(<${t}[^>]*>)\\s*${flexibleText}\\s*</${t}>`, 'g');
      let exactMatch;

      while ((exactMatch = exactPattern.exec(code)) !== null) {
        return {
          fullMatch: exactMatch[0],
          openingTag: exactMatch[1],
          startIndex: exactMatch.index,
          endIndex: exactMatch.index + exactMatch[0].length,
        };
      }

      const nestedTextMatches: Array<{ fullMatch: string; openingTag: string; startIndex: number; endIndex: number }> = [];
      const nestedTextPattern = new RegExp(`(<${t}[^>]*>)[\\s\\S]{0,1200}?${flexibleText}[\\s\\S]{0,1200}?</${t}>`, 'g');
      let textOnlyNestedMatch;

      while ((textOnlyNestedMatch = nestedTextPattern.exec(code)) !== null) {
        nestedTextMatches.push({
          fullMatch: textOnlyNestedMatch[0],
          openingTag: textOnlyNestedMatch[1],
          startIndex: textOnlyNestedMatch.index,
          endIndex: textOnlyNestedMatch.index + textOnlyNestedMatch[0].length,
        });
      }

      if (nestedTextMatches.length === 1) {
        return nestedTextMatches[0];
      }

      if (classPattern) {
        const nestedPattern = new RegExp(`(<${t}[^>]*${classPattern}[^>]*>)[\\s\\S]{0,1200}?${flexibleText}[\\s\\S]{0,1200}?</${t}>`, 'g');
        let nestedMatch;

        while ((nestedMatch = nestedPattern.exec(code)) !== null) {
          return {
            fullMatch: nestedMatch[0],
            openingTag: nestedMatch[1],
            startIndex: nestedMatch.index,
            endIndex: nestedMatch.index + nestedMatch[0].length,
          };
        }
      }
    }
  }

  if (classPattern) {
    const classMatch = matchByOpeningTag(classPattern);
    if (classMatch) {
      return classMatch;
    }
  }

  const anchoredTextMatch = findElementByUniqueTextAnchor(code, element, tagCandidates);
  if (anchoredTextMatch) {
    return anchoredTextMatch;
  }

  if (isSelfClosing) {
    for (const cand of tagCandidates) {
      const t = escapeForRegex(cand);
      const allMatches: RegExpExecArray[] = [];
      const tagPattern = new RegExp(`<${t}[^>]*(?:\\/>|>)`, 'g');

      let match;
      while ((match = tagPattern.exec(code)) !== null) {
        allMatches.push(match);
      }

      if (allMatches.length === 1) {
        const singleMatch = allMatches[0];
        return {
          fullMatch: singleMatch[0],
          openingTag: singleMatch[0],
          startIndex: singleMatch.index,
          endIndex: singleMatch.index + singleMatch[0].length,
        };
      }
    }
  }

  return null;
}

/**
 * Add or update inline style on an element's opening tag
 * Now supports all CSS properties passed in
 */
function updateOpeningTagStyles(
  openingTag: string,
  styles: Record<string, string | undefined>
): string {
  // Filter out undefined/null/empty values
  const validStyles = Object.entries(styles).filter(([_, v]) => v && v !== 'inherit' && v !== 'none' && v !== 'transparent');
  
  if (validStyles.length === 0) {
    return openingTag;
  }

  // Check if element already has a style prop
  const styleMatch = openingTag.match(/style=\{\{([\s\S]*?)\}\}/);
  
  if (styleMatch) {
    // Element has existing style - merge our changes
    let existingStyles = styleMatch[1];
    
    for (const [prop, value] of validStyles) {
      if (!value) continue;
      
      const propRegex = new RegExp(`${prop}:\\s*[^,}]+`, 'g');
      if (existingStyles.match(propRegex)) {
        existingStyles = existingStyles.replace(propRegex, `${prop}: '${value}'`);
      } else {
        existingStyles = `${prop}: '${value}', ${existingStyles}`;
      }
    }
    
    return openingTag.replace(/style=\{\{[\s\S]*?\}\}/, `style={{${existingStyles}}}`);
  } else {
    // Element has no style prop - add one before the closing >
    const styleObj = validStyles.map(([prop, value]) => `${prop}: '${value}'`);
    const styleString = `style={{ ${styleObj.join(', ')} }}`;
    
    // Insert before the closing >
    if (openingTag.endsWith('/>')) {
      return openingTag.slice(0, -2) + ` ${styleString} />`;
    } else {
      return openingTag.slice(0, -1) + ` ${styleString}>`;
    }
  }
}

/**
 * Update text content within an element
 */
function updateTextContent(code: string, element: ElementInfo, newText: string): string {
  // Simple but effective - just replace the text
  // Be careful with very short or common strings
  const oldText = element.innerText;

  if (oldText.length < 3) {
    console.warn('[directStyleEditor] Text too short for reliable replacement');
    return code;
  }

  const found = findElementInCode(code, element);
  if (found && found.fullMatch.includes(oldText)) {
    const updatedMatch = found.fullMatch.replace(oldText, newText);

    if (updatedMatch !== found.fullMatch) {
      return code.slice(0, found.startIndex) + updatedMatch + code.slice(found.endIndex);
    }
  }

  const exactMatchCount = code.split(oldText).length - 1;
  if (exactMatchCount !== 1) {
    console.warn('[directStyleEditor] Text match is not unique enough for replacement');
    return code;
  }
  
  return code.replace(oldText, newText);
}

/**
 * Main function: Apply style changes directly to code
 * Returns the modified code or null if changes couldn't be applied
 */
export function applyDirectEdits(
  code: string,
  element: ElementInfo,
  changes: StyleChanges
): { success: boolean; code: string; message: string } {
  let modifiedCode = code;
  const appliedChanges: string[] = [];
  
  // Handle text changes first (simplest)
  if (changes.text && element.innerText && changes.text !== element.innerText) {
    modifiedCode = updateTextContent(modifiedCode, element, changes.text);
    if (modifiedCode !== code) {
      appliedChanges.push('text');
    }
  }
  
  // Build style changes object with proper CSS property names
  const styleUpdates: Record<string, string | undefined> = {};
  
  if (changes.color) styleUpdates.color = changes.color;
  const backgroundColor = changes.backgroundColor || changes.bgColor;
  if (backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== 'inherit') {
    styleUpdates.backgroundColor = backgroundColor;
  }
  if (changes.fontSize) styleUpdates.fontSize = changes.fontSize;
  if (changes.fontFamily && changes.fontFamily !== 'inherit') styleUpdates.fontFamily = changes.fontFamily;
  if (changes.margin) styleUpdates.margin = changes.margin;
  if (changes.padding) styleUpdates.padding = changes.padding;
  if (changes.gap) styleUpdates.gap = changes.gap;
  if (changes.flexDirection) styleUpdates.flexDirection = changes.flexDirection;
  if (changes.alignItems) styleUpdates.alignItems = changes.alignItems;
  if (changes.justifyContent) styleUpdates.justifyContent = changes.justifyContent;
  if (changes.border) styleUpdates.border = changes.border;
  if (changes.borderWidth) styleUpdates.borderWidth = changes.borderWidth;
  if (changes.borderStyle && changes.borderStyle !== 'none') styleUpdates.borderStyle = changes.borderStyle;
  if (changes.borderColor && changes.borderColor !== 'inherit') styleUpdates.borderColor = changes.borderColor;
  if (changes.borderRadius && changes.borderRadius !== '0') styleUpdates.borderRadius = changes.borderRadius;
  if (changes.boxShadow && changes.boxShadow !== 'none') styleUpdates.boxShadow = changes.boxShadow;
  if (changes.opacity && changes.opacity !== '1') styleUpdates.opacity = changes.opacity;
  if (changes.width) styleUpdates.width = changes.width;
  if (changes.height) styleUpdates.height = changes.height;
  if (changes.minWidth) styleUpdates.minWidth = changes.minWidth;
  if (changes.minHeight) styleUpdates.minHeight = changes.minHeight;
  if (changes.maxWidth) styleUpdates.maxWidth = changes.maxWidth;
  if (changes.maxHeight) styleUpdates.maxHeight = changes.maxHeight;
  if (changes.display) styleUpdates.display = changes.display;
  if (changes.textAlign) styleUpdates.textAlign = changes.textAlign;
  if (changes.fontWeight) styleUpdates.fontWeight = changes.fontWeight;
  if (changes.letterSpacing) styleUpdates.letterSpacing = changes.letterSpacing;
  if (changes.lineHeight) styleUpdates.lineHeight = changes.lineHeight;
  if (changes.textTransform) styleUpdates.textTransform = changes.textTransform;
  if (changes.textDecoration) styleUpdates.textDecoration = changes.textDecoration;
  
  const hasStyleChanges = Object.keys(styleUpdates).length > 0;
  const styleTargetElement = changes.text ? { ...element, innerText: changes.text } : element;
  
  if (hasStyleChanges) {
    const found = findElementInCode(modifiedCode, styleTargetElement);
    
    if (found) {
      const newOpeningTag = updateOpeningTagStyles(found.openingTag, styleUpdates);
      
      // Replace old opening tag with new one
      const newFullMatch = found.fullMatch.replace(found.openingTag, newOpeningTag);
      modifiedCode = modifiedCode.slice(0, found.startIndex) + newFullMatch + modifiedCode.slice(found.endIndex);
      
      // Track what was applied
      if (styleUpdates.color) appliedChanges.push('color');
      if (styleUpdates.backgroundColor) appliedChanges.push('background');
      if (styleUpdates.fontSize) appliedChanges.push('font size');
      if (styleUpdates.fontFamily) appliedChanges.push('font');
      if (styleUpdates.margin) appliedChanges.push('margin');
      if (styleUpdates.padding) appliedChanges.push('padding');
      if (styleUpdates.gap) appliedChanges.push('gap');
      if (styleUpdates.flexDirection) appliedChanges.push('direction');
      if (styleUpdates.alignItems) appliedChanges.push('alignment');
      if (styleUpdates.border) appliedChanges.push('border');
      if (styleUpdates.borderRadius) appliedChanges.push('radius');
      if (styleUpdates.boxShadow) appliedChanges.push('shadow');
      if (styleUpdates.opacity) appliedChanges.push('opacity');
    } else {
      // Fallback: If we can't find the element precisely, try a simpler approach
      console.warn('[directStyleEditor] Could not find element precisely, trying fallback');
      
      const tagCandidates = getTagCandidates(element.tagName);
      const isSelfClosing = selfClosingTags.includes(element.tagName.toLowerCase());
      
      // For self-closing tags, try matching by the opening tag we have
      if (isSelfClosing && element.openingTag) {
        // Extract a unique identifier from the opening tag (like src for images)
        const srcMatch = element.openingTag.match(/src=["']([^"']+)["']/);
        if (srcMatch) {
          const escapedSrc = escapeForRegex(srcMatch[1]);
          
          for (const cand of tagCandidates) {
            const t = escapeForRegex(cand);
            const pattern = new RegExp(`(<${t}[^>]*src=["']${escapedSrc}["'][^>]*)(\\/?>)`, 'g');
            const match = pattern.exec(modifiedCode);
            
            if (match) {
              const openingTagPart = match[1];
              const closing = match[2];
              const newOpeningTag = updateOpeningTagStyles(openingTagPart + closing, styleUpdates);
              
              modifiedCode = modifiedCode.replace(match[0], newOpeningTag);
              
              // Track applied changes
              Object.keys(styleUpdates).forEach((key) => {
                if (!appliedChanges.includes(key)) appliedChanges.push(key);
              });
              break;
            }
          }
        }
      }
      // For non-self-closing tags, try to find element by its text content
      else if (styleTargetElement.innerText) {
        const escapedText = getFlexibleTextPattern(styleTargetElement.innerText);

        for (const cand of tagCandidates) {
          const t = escapeForRegex(cand);
          const simplePattern = new RegExp(`(<${t}[^>]*)>\\s*${escapedText}`, 'g');
          const match = simplePattern.exec(modifiedCode);

          if (match) {
            const openingTagPart = match[1];
            const newOpeningTag = updateOpeningTagStyles(openingTagPart + '>', styleUpdates);

            modifiedCode = modifiedCode.replace(match[0], newOpeningTag.slice(0, -1) + `>${styleTargetElement.innerText}`);
            
            // Track applied changes
            Object.keys(styleUpdates).forEach((key) => {
              if (!appliedChanges.includes(key)) appliedChanges.push(key);
            });
            break;
          }
        }
      }
    }
  }
  
  if (appliedChanges.length > 0) {
    return {
      success: true,
      code: modifiedCode,
      message: appliedChanges.join(', ')
    };
  }
  
  return {
    success: false,
    code: code,
    message: 'No changes could be applied'
  };
}

/**
 * Validate that the code is still valid JSX after our edits
 * Basic check - ensures we haven't broken the structure
 */
export function validateJSX(code: string): boolean {
  // Simple validation: check for balanced tags and quotes
  const openTags = (code.match(/<[a-zA-Z][^>]*(?<!\/)\s*>/g) || []).length;
  const closeTags = (code.match(/<\/[a-zA-Z]+>/g) || []).length;
  const selfClosing = (code.match(/<[a-zA-Z][^>]*\/>/g) || []).length;
  
  // Very rough check - open + self-closing should roughly equal or exceed close tags
  // This isn't perfect but catches major issues
  if (openTags + selfClosing < closeTags) {
    console.warn('[directStyleEditor] JSX validation warning: tag imbalance');
    return false;
  }
  
  return true;
}

