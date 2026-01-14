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
  const { tagName, innerText, className, openingTag: elementOpeningTag } = element;

  const tagCandidates = [tagName, `motion.${tagName}`];
  const escapeTagForRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Self-closing tags that don't have closing tags
  const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
  const isSelfClosing = selfClosingTags.includes(tagName.toLowerCase());

  // Strategy 0: For images, try to match by src attribute (most reliable for imgs)
  if (tagName.toLowerCase() === 'img' && elementOpeningTag) {
    // Extract src from the opening tag we have
    const srcMatch = elementOpeningTag.match(/src=["']([^"']+)["']/);
    if (srcMatch) {
      const srcValue = srcMatch[1];
      // Only use if src is specific enough (not a placeholder/variable)
      if (srcValue.length > 10 && !srcValue.startsWith('{')) {
        const escapedSrc = srcValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        for (const cand of tagCandidates) {
          const t = escapeTagForRegex(cand);
          // Match img with this specific src (handles both <img ... /> and <img ... >)
          const srcPattern = new RegExp(`<${t}[^>]*src=["']${escapedSrc}["'][^>]*(?:\\/>|>)`, 'g');
          
          const match = srcPattern.exec(code);
          if (match) {
            return {
              fullMatch: match[0],
              openingTag: match[0],
              startIndex: match.index,
              endIndex: match.index + match[0].length,
            };
          }
        }
      }
    }
  }

  // Strategy 1: Find by tag + exact text content (for non-self-closing tags)
  if (!isSelfClosing && innerText && innerText.length > 0 && innerText.length < 200) {
    const escapedText = innerText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (const cand of tagCandidates) {
      const t = escapeTagForRegex(cand);
      const pattern = new RegExp(`(<${t}[^>]*>)\\s*${escapedText}\\s*</${t}>`, 'g');

      let match;
      while ((match = pattern.exec(code)) !== null) {
        return {
          fullMatch: match[0],
          openingTag: match[1],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        };
      }
    }
  }

  // Strategy 2: Find by tag + className (prefer unique/specific classes)
  if (className) {
    // Filter out generic Tailwind utility classes for better matching
    const genericClasses = ['w-full', 'h-full', 'flex', 'block', 'hidden', 'relative', 'absolute', 'p-', 'm-', 'text-', 'bg-'];
    const classes = className.split(' ').filter((c) => c && !c.includes('hover:') && !c.includes(':'));
    
    // Try to find a more specific class first
    const specificClass = classes.find(c => {
      const isGeneric = genericClasses.some(g => c === g || (g.endsWith('-') && c.startsWith(g)));
      return !isGeneric && c.length > 4;
    });
    
    const classToMatch = specificClass || classes[0];
    
    if (classToMatch) {
      const escapedClass = classToMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      for (const cand of tagCandidates) {
        const t = escapeTagForRegex(cand);
        
        if (isSelfClosing) {
          // For self-closing tags, match the whole tag including />
          const selfClosingPattern = new RegExp(
            `<${t}[^>]*className=["'{][^"'}]*${escapedClass}[^"'}]*["'}][^>]*(?:\\/>|>)`,
            'g'
          );
          
          const match = selfClosingPattern.exec(code);
          if (match) {
            return {
              fullMatch: match[0],
              openingTag: match[0],
              startIndex: match.index,
              endIndex: match.index + match[0].length,
            };
          }
        } else {
          // For regular tags, find opening and closing
          const classPattern = new RegExp(
            `<${t}[^>]*className=["'{][^"'}]*${escapedClass}[^"'}]*["'}][^>]*>`,
            'g'
          );

          const match = classPattern.exec(code);
          if (match) {
            const afterOpening = code.slice(match.index + match[0].length);
            const closingPattern = new RegExp(`</${t}>`);
            const closingMatch = closingPattern.exec(afterOpening);

            if (closingMatch) {
              const fullMatch = code.slice(
                match.index,
                match.index + match[0].length + closingMatch.index + closingMatch[0].length
              );

              return {
                fullMatch,
                openingTag: match[0],
                startIndex: match.index,
                endIndex: match.index + fullMatch.length,
              };
            }
          }
        }
      }
    }
  }

  // Strategy 3: For self-closing tags, try matching by tag alone if there's only one
  if (isSelfClosing) {
    for (const cand of tagCandidates) {
      const t = escapeTagForRegex(cand);
      const allMatches: RegExpExecArray[] = [];
      const tagPattern = new RegExp(`<${t}[^>]*(?:\\/>|>)`, 'g');
      
      let m;
      while ((m = tagPattern.exec(code)) !== null) {
        allMatches.push(m);
      }
      
      // If only one match, use it
      if (allMatches.length === 1) {
        const match = allMatches[0];
        return {
          fullMatch: match[0],
          openingTag: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
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
  const styleMatch = openingTag.match(/style=\{\{([^}]*)\}\}/);
  
  if (styleMatch) {
    // Element has existing style - merge our changes
    let existingStyles = styleMatch[1];
    
    for (const [prop, value] of validStyles) {
      if (!value) continue;
      
      const propRegex = new RegExp(`${prop}:\\s*['"][^'"]*['"]`, 'g');
      if (existingStyles.match(propRegex)) {
        existingStyles = existingStyles.replace(propRegex, `${prop}: '${value}'`);
      } else {
        existingStyles = `${prop}: '${value}', ${existingStyles}`;
      }
    }
    
    return openingTag.replace(/style=\{\{[^}]*\}\}/, `style={{${existingStyles}}}`);
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
function updateTextContent(code: string, oldText: string, newText: string): string {
  // Simple but effective - just replace the text
  // Be careful with very short or common strings
  if (oldText.length < 3) {
    console.warn('[directStyleEditor] Text too short for reliable replacement');
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
    modifiedCode = updateTextContent(modifiedCode, element.innerText, changes.text);
    if (modifiedCode !== code) {
      appliedChanges.push('text');
    }
  }
  
  // Build style changes object with proper CSS property names
  const styleUpdates: Record<string, string | undefined> = {};
  
  if (changes.color) styleUpdates.color = changes.color;
  if (changes.bgColor && changes.bgColor !== 'transparent' && changes.bgColor !== 'inherit') {
    styleUpdates.backgroundColor = changes.bgColor;
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
  if (changes.borderRadius && changes.borderRadius !== '0') styleUpdates.borderRadius = changes.borderRadius;
  if (changes.boxShadow && changes.boxShadow !== 'none') styleUpdates.boxShadow = changes.boxShadow;
  if (changes.opacity && changes.opacity !== '1') styleUpdates.opacity = changes.opacity;
  if (changes.width) styleUpdates.width = changes.width;
  if (changes.height) styleUpdates.height = changes.height;
  if (changes.display) styleUpdates.display = changes.display;
  if (changes.textAlign) styleUpdates.textAlign = changes.textAlign;
  if (changes.fontWeight) styleUpdates.fontWeight = changes.fontWeight;
  if (changes.letterSpacing) styleUpdates.letterSpacing = changes.letterSpacing;
  if (changes.lineHeight) styleUpdates.lineHeight = changes.lineHeight;
  if (changes.textTransform) styleUpdates.textTransform = changes.textTransform;
  if (changes.textDecoration) styleUpdates.textDecoration = changes.textDecoration;
  
  const hasStyleChanges = Object.keys(styleUpdates).length > 0;
  
  if (hasStyleChanges) {
    const found = findElementInCode(modifiedCode, element);
    
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
      
      const tagCandidates = [element.tagName, `motion.${element.tagName}`];
      const selfClosingTags = ['img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
      const isSelfClosing = selfClosingTags.includes(element.tagName.toLowerCase());
      
      // For self-closing tags, try matching by the opening tag we have
      if (isSelfClosing && element.openingTag) {
        // Extract a unique identifier from the opening tag (like src for images)
        const srcMatch = element.openingTag.match(/src=["']([^"']+)["']/);
        if (srcMatch) {
          const escapedSrc = srcMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          
          for (const cand of tagCandidates) {
            const t = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`(<${t}[^>]*src=["']${escapedSrc}["'][^>]*)(\\/?>)`, 'g');
            const match = pattern.exec(modifiedCode);
            
            if (match) {
              const openingTagPart = match[1];
              const closing = match[2];
              const newOpeningTag = updateOpeningTagStyles(openingTagPart + closing, styleUpdates);
              
              modifiedCode = modifiedCode.replace(match[0], newOpeningTag);
              
              // Track applied changes
              Object.keys(styleUpdates).forEach(key => {
                if (!appliedChanges.includes(key)) appliedChanges.push(key);
              });
              break;
            }
          }
        }
      }
      // For non-self-closing tags, try to find element by its text content
      else if (element.innerText) {
        const escapedText = element.innerText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        for (const cand of tagCandidates) {
          const t = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const simplePattern = new RegExp(`(<${t}[^>]*)>\\s*${escapedText}`, 'g');
          const match = simplePattern.exec(modifiedCode);

          if (match) {
            const openingTagPart = match[1];
            const newOpeningTag = updateOpeningTagStyles(openingTagPart + '>', styleUpdates);

            modifiedCode = modifiedCode.replace(match[0], newOpeningTag.slice(0, -1) + `>${element.innerText}`);
            
            // Track applied changes
            Object.keys(styleUpdates).forEach(key => {
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
