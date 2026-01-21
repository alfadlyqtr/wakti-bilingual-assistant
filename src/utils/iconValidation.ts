/**
 * Utility to validate Lucide React icons and prevent crashes from
 * non-existent icons being imported
 */

/**
 * Safe list of Lucide React icons that are guaranteed to exist
 * This prevents the "Element type is invalid: expected a string" error
 * when importing a non-existent icon like "Beard"
 */
export const VALID_LUCIDE_ICONS = new Set([
  // Most commonly used UI icons
  "AlertTriangle", "ArrowLeft", "ArrowRight", "Check", "ChevronDown", "ChevronLeft", 
  "ChevronRight", "ChevronUp", "Copy", "Download", "Edit", "Eye", "EyeOff",
  "FileText", "Filter", "Home", "Info", "Loader2", "Menu", "MoreHorizontal", 
  "Plus", "Save", "Search", "Settings", "Trash2", "Upload", "User", "X",
  
  // App functionality icons
  "Bell", "Calendar", "Camera", "CreditCard", "FileText", "Image",
  "LayoutDashboard", "Lock", "Mail", "MessageCircle", "MessageSquare",
  "Mic", "Phone", "Send", "Share2", "Shield", "ShoppingCart", "Star",
  "Terminal", "Trash", "Users",
  
  // Media and content icons
  "Audio", "Book", "Bookmark", "File", "Folder", "Globe", "Headphones",
  "Link", "List", "Map", "Monitor", "Music", "Play", "Printer", "Video", 
  
  // Weather and nature icons
  "Cloud", "CloudRain", "Droplet", "Moon", "Snowflake", "Sun", "Wind",
  
  // Device and hardware icons
  "Battery", "Bluetooth", "Cast", "Database", "HardDrive", "Laptop", 
  "Smartphone", "Speaker", "Tablet", "Wifi", 
  
  // Design and editor icons
  "Layers", "Maximize", "Minimize", "Move", "Pen", "Pencil", "Scissors", 
  "ScissorsLineDashed", "Sliders", "Type", 
  
  // UI state icons
  "CheckCircle", "Clock", "Loader", "LucideProps", "RefreshCw", "RotateCw",
  "ToggleLeft", "ToggleRight", "XCircle",
  
  // Misc icons
  "Activity", "Award", "Briefcase", "Coffee", "Command", "Heart", "Key", 
  "Map", "MapPin", "Package", "Percent", "Power", "Radio", "Target", 
  "ThumbsDown", "ThumbsUp", "Zap",

  // Brand icons
  "Facebook", "Github", "Instagram", "Linkedin", "Twitter", "Youtube",
  
  // Specific icons for Wakti
  "Bot", "Brain", "Code2", "FileCode", "FileJson", "FileType", "Sparkles",
  "ExternalLink", "MousePointer2", "PanelLeft", "PanelLeftClose", "Share2",
  
  // Visual editing icons
  "AlignCenter", "AlignJustify", "AlignLeft", "AlignRight", "Bold", 
  "Italic", "Underline", "List", "ListOrdered", "Quote",

  // E-commerce icons
  "CreditCard", "DollarSign", "Package", "ShoppingBag", "ShoppingCart", "Tag",
  
  // Misc additional icons
  "AlertCircle", "Archive", "ArrowDownCircle", "ArrowUpCircle", "BarChart",
  "Box", "Circle", "ClipboardCheck", "Compass", "FilePlus", "Flag",
  "Gift", "HelpCircle", "Home", "Layout", "Maximize2", "Minimize2",
  "Square", "Triangle", "WifiOff"
]);

/**
 * Validates if an icon name exists in the lucide-react library
 * @param iconName The name of the icon to check
 * @returns Whether the icon is valid
 */
export function isValidLucideIcon(iconName: string): boolean {
  return VALID_LUCIDE_ICONS.has(iconName);
}

/**
 * Provides a safe fallback icon if the requested icon doesn't exist
 * @param iconName The name of the icon to check
 * @param fallback Optional fallback icon name (defaults to "Square")
 * @returns A valid icon name, either the original or the fallback
 */
export function getSafeLucideIcon(iconName: string, fallback: string = "Square"): string {
  if (isValidLucideIcon(iconName)) {
    return iconName;
  }
  
  // If fallback is also invalid, use Square as ultimate fallback
  if (!isValidLucideIcon(fallback)) {
    return "Square";
  }
  
  return fallback;
}

/**
 * Maps icon names in a React component import array to safe versions
 * @param imports Array of icon name strings from lucide-react
 * @returns Array with invalid icons replaced by their fallbacks
 * 
 * @example
 * // Replace:
 * import { Check, Beard, X } from 'lucide-react';
 * // With:
 * import { Check, User, X } from 'lucide-react';
 * // By using:
 * const safeIconImports = getSafeLucideIconImports(['Check', 'Beard', 'X']);
 * // safeIconImports = ['Check', 'User', 'X']
 */
export function getSafeLucideIconImports(imports: string[]): string[] {
  return imports.map(iconName => {
    // Find appropriate fallbacks based on icon name
    let fallback = "Square";
    
    // Smart fallbacks based on name context
    if (iconName.toLowerCase().includes("user") || 
        iconName.toLowerCase().includes("person") || 
        iconName.toLowerCase().includes("profile")) {
      fallback = "User";
    } 
    else if (iconName.toLowerCase().includes("edit") || 
             iconName.toLowerCase().includes("pencil") || 
             iconName.toLowerCase().includes("pen")) {
      fallback = "Pencil";
    }
    else if (iconName.toLowerCase().includes("save") || 
             iconName.toLowerCase().includes("disk")) {
      fallback = "Save";
    }
    else if (iconName.toLowerCase().includes("trash") || 
             iconName.toLowerCase().includes("delete") || 
             iconName.toLowerCase().includes("remove")) {
      fallback = "Trash";
    }
    else if (iconName.toLowerCase().includes("settings") || 
             iconName.toLowerCase().includes("gear") || 
             iconName.toLowerCase().includes("cog")) {
      fallback = "Settings";
    }
    else if (iconName.toLowerCase().includes("hair") || 
             iconName.toLowerCase().includes("cut") || 
             iconName.toLowerCase().includes("beard") || 
             iconName.toLowerCase().includes("salon") || 
             iconName.toLowerCase().includes("barber")) {
      fallback = "Scissors";  // Perfect for barber context!
    }
    
    return getSafeLucideIcon(iconName, fallback);
  });
}

/**
 * Helper function to patch dynamic imports from lucide-react
 * Scans React component code for lucide-react imports and ensures all icons exist
 * @param code React component code as a string
 * @returns Updated code with safe icon imports (no duplicates)
 */
export function validateLucideImports(code: string): string {
  // Find lucide-react import statements
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/g;
  
  return code.replace(importRegex, (match, importList) => {
    // Extract individual icon names
    const icons = importList.split(',')
      .map(s => s.trim())
      .filter(Boolean);
    
    // Track used icon names to avoid duplicates
    const usedIcons = new Set<string>();
    const safeIcons: string[] = [];
    
    // Counter for generating unique fallback names
    let fallbackCounter = 0;
    const fallbackOptions = ["Square", "Circle", "Triangle", "Star", "Heart", "Box", "Zap", "Sun", "Moon", "Check"];
      
    // Get safe versions of all icons
    for (const icon of icons) {
      // Handle aliased imports like "Menu as MenuIcon"
      const parts = icon.split(' as ');
      const iconName = parts[0].trim();
      const alias = parts.length > 1 ? parts[1].trim() : null;
      
      let fallback = "Square";
      
      // Custom fallbacks for specific icon categories
      if (iconName.toLowerCase().includes("beard") || 
          iconName.toLowerCase().includes("cut") || 
          iconName.toLowerCase().includes("salon") || 
          iconName.toLowerCase().includes("barber")) {
        fallback = "Scissors";
      } else if (iconName.toLowerCase().includes("user") || 
                iconName.toLowerCase().includes("person") || 
                iconName.toLowerCase().includes("profile")) {
        fallback = "User";
      }
      
      let safeIcon = getSafeLucideIcon(iconName, fallback);
      
      // If this icon name is already used (would cause duplicate), pick a different one
      while (usedIcons.has(safeIcon)) {
        safeIcon = fallbackOptions[fallbackCounter % fallbackOptions.length];
        fallbackCounter++;
        // Safety check to prevent infinite loop
        if (fallbackCounter > 20) break;
      }
      
      usedIcons.add(safeIcon);
      
      // Return with alias if original had one
      safeIcons.push(alias ? `${safeIcon} as ${alias}` : safeIcon);
    }
    
    // Rebuild import statement
    return `import { ${safeIcons.join(', ')} } from 'lucide-react'`;
  });
}
