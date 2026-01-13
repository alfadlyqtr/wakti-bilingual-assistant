/**
 * Direct Style Editor - Applies style changes directly to JSX code
 * WITHOUT using AI prompts. This saves credits for users!
 * 
 * Supports:
 * - Text content changes
 * - Inline style changes (color, backgroundColor, fontSize)
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
}

/**
 * Find an element in JSX code by matching its tag, text content, or class
 */
function findElementInCode(
  code: string,
  element: ElementInfo
): { fullMatch: string; openingTag: string; startIndex: number; endIndex: number } | null {
  const { tagName, innerText, className } = element;
  
  // Strategy 1: Find by tag + exact text content (for simple elements)
  if (innerText && innerText.length > 0 && innerText.length < 200) {
    const escapedText = innerText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Match self-closing or regular elements with this text
    // Pattern: <tagName ...>text</tagName>
    const textPatterns = [
      // Simple case: <tag>text</tag>
      new RegExp(`(<${tagName}[^>]*>)\\s*${escapedText}\\s*</${tagName}>`, 'g'),
      // With nested tags: <tag><span>text</span></tag> - less reliable
    ];
    
    for (const pattern of textPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        return {
          fullMatch: match[0],
          openingTag: match[1],
          startIndex: match.index,
          endIndex: match.index + match[0].length
        };
      }
    }
  }
  
  // Strategy 2: Find by tag + className (more reliable for styled elements)
  if (className) {
    const firstClass = className.split(' ').filter(c => c && !c.includes('hover:'))[0];
    if (firstClass) {
      const escapedClass = firstClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match className="..." or className={'...'} containing our class
      const classPattern = new RegExp(
        `<${tagName}[^>]*className=["'{][^"'}]*${escapedClass}[^"'}]*["'}][^>]*>`,
        'g'
      );
      
      const match = classPattern.exec(code);
      if (match) {
        // Find the closing tag
        const afterOpening = code.slice(match.index + match[0].length);
        const closingPattern = new RegExp(`</${tagName}>`);
        const closingMatch = closingPattern.exec(afterOpening);
        
        if (closingMatch) {
          const fullMatch = code.slice(match.index, match.index + match[0].length + closingMatch.index + closingMatch[0].length);
          return {
            fullMatch,
            openingTag: match[0],
            startIndex: match.index,
            endIndex: match.index + fullMatch.length
          };
        }
      }
    }
  }
  
  return null;
}

/**
 * Add or update inline style on an element's opening tag
 */
function updateOpeningTagStyles(
  openingTag: string,
  styles: { color?: string; backgroundColor?: string; fontSize?: string; fontFamily?: string }
): string {
  // Check if element already has a style prop
  const styleMatch = openingTag.match(/style=\{\{([^}]*)\}\}/);
  
  if (styleMatch) {
    // Element has existing style - merge our changes
    let existingStyles = styleMatch[1];
    
    if (styles.color) {
      if (existingStyles.includes('color:')) {
        existingStyles = existingStyles.replace(/color:\s*['"][^'"]*['"]/g, `color: '${styles.color}'`);
      } else {
        existingStyles = `color: '${styles.color}', ${existingStyles}`;
      }
    }
    
    if (styles.backgroundColor) {
      if (existingStyles.includes('backgroundColor:')) {
        existingStyles = existingStyles.replace(/backgroundColor:\s*['"][^'"]*['"]/g, `backgroundColor: '${styles.backgroundColor}'`);
      } else {
        existingStyles = `${existingStyles}, backgroundColor: '${styles.backgroundColor}'`;
      }
    }
    
    if (styles.fontSize) {
      if (existingStyles.includes('fontSize:')) {
        existingStyles = existingStyles.replace(/fontSize:\s*['"][^'"]*['"]/g, `fontSize: '${styles.fontSize}'`);
      } else {
        existingStyles = `${existingStyles}, fontSize: '${styles.fontSize}'`;
      }
    }
    
    if (styles.fontFamily) {
      if (existingStyles.includes('fontFamily:')) {
        existingStyles = existingStyles.replace(/fontFamily:\s*['"][^'"]*['"]/g, `fontFamily: '${styles.fontFamily}'`);
      } else {
        existingStyles = `${existingStyles}, fontFamily: '${styles.fontFamily}'`;
      }
    }
    
    return openingTag.replace(/style=\{\{[^}]*\}\}/, `style={{${existingStyles}}}`);
  } else {
    // Element has no style prop - add one before the closing >
    const styleObj: string[] = [];
    if (styles.color) styleObj.push(`color: '${styles.color}'`);
    if (styles.backgroundColor) styleObj.push(`backgroundColor: '${styles.backgroundColor}'`);
    if (styles.fontSize) styleObj.push(`fontSize: '${styles.fontSize}'`);
    if (styles.fontFamily) styleObj.push(`fontFamily: '${styles.fontFamily}'`);
    
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
  
  // Handle style changes
  const hasStyleChanges = changes.color || changes.bgColor || changes.fontSize || changes.fontFamily;
  
  if (hasStyleChanges) {
    const found = findElementInCode(modifiedCode, element);
    
    if (found) {
      const newOpeningTag = updateOpeningTagStyles(found.openingTag, {
        color: changes.color,
        backgroundColor: changes.bgColor !== 'transparent' ? changes.bgColor : undefined,
        fontSize: changes.fontSize,
        fontFamily: changes.fontFamily
      });
      
      // Replace old opening tag with new one
      const newFullMatch = found.fullMatch.replace(found.openingTag, newOpeningTag);
      modifiedCode = modifiedCode.slice(0, found.startIndex) + newFullMatch + modifiedCode.slice(found.endIndex);
      
      if (changes.color) appliedChanges.push('color');
      if (changes.bgColor && changes.bgColor !== 'transparent') appliedChanges.push('background');
      if (changes.fontSize) appliedChanges.push('font size');
      if (changes.fontFamily) appliedChanges.push('font');
    } else {
      // Fallback: If we can't find the element precisely, try a simpler approach
      // Look for the opening tag pattern and add/modify style there
      console.warn('[directStyleEditor] Could not find element precisely, trying fallback');
      
      // If text was provided, try to find element by its text content
      if (element.innerText) {
        const escapedText = element.innerText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const simplePattern = new RegExp(`(<${element.tagName}[^>]*)>\\s*${escapedText}`, 'g');
        const match = simplePattern.exec(modifiedCode);
        
        if (match) {
          const openingTagPart = match[1];
          const newOpeningTag = updateOpeningTagStyles(openingTagPart + '>', {
            color: changes.color,
            backgroundColor: changes.bgColor !== 'transparent' ? changes.bgColor : undefined,
            fontSize: changes.fontSize,
            fontFamily: changes.fontFamily
          });
          
          modifiedCode = modifiedCode.replace(match[0], newOpeningTag.slice(0, -1) + `>${element.innerText}`);
          if (changes.color) appliedChanges.push('color');
          if (changes.bgColor && changes.bgColor !== 'transparent') appliedChanges.push('background');
          if (changes.fontSize) appliedChanges.push('font size');
          if (changes.fontFamily) appliedChanges.push('font');
        }
      }
    }
  }
  
  if (appliedChanges.length > 0) {
    return {
      success: true,
      code: modifiedCode,
      message: `Applied: ${appliedChanges.join(', ')}`
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
