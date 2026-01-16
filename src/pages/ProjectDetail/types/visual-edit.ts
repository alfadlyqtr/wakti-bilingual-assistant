// Visual Edit Mode type interfaces

export interface SelectedElementInfo {
  tagName: string;
  className: string;
  id: string;
  innerText: string;
  openingTag: string;
  computedStyle?: {
    color: string;
    backgroundColor: string;
    fontSize: string;
  };
  rect?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface DirectEditChanges {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  width?: string;
  height?: string;
  text?: string;
}

export interface ResizeDimensions {
  width: number;
  height: number;
}

// WAKTI color palette for color picker presets
export const WAKTI_COLOR_PALETTE = [
  // Primary colors
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  // Accent colors
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  // Neutrals
  '#ffffff',
  '#0c0f14',
  '#1e293b',
  '#64748b',
  // Gradients start colors
  '#4f46e5',
  '#7c3aed',
  '#db2777',
  '#ea580c',
];
