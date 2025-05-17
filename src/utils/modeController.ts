
import { AIMode } from "@/components/ai-assistant/types";

export interface ModeChangeCallbacks {
  onBeforeChange?: (oldMode: AIMode, newMode: AIMode) => void;
  onAfterChange?: (oldMode: AIMode, newMode: AIMode) => void;
}

// Create a class to manage mode switching and callbacks
class ModeController {
  private activeMode: AIMode = "general";
  private callbacks: Set<ModeChangeCallbacks> = new Set();
  private switchInProgress = false;

  // Get the current active mode
  getActiveMode(): AIMode {
    return this.activeMode;
  }

  // Set the active mode with proper callbacks
  async setActiveMode(newMode: AIMode): Promise<boolean> {
    if (newMode === this.activeMode) {
      return true; // Already in this mode
    }

    if (this.switchInProgress) {
      // Wait for existing switch to complete
      return new Promise((resolve) => {
        setTimeout(() => {
          this.setActiveMode(newMode).then(resolve);
        }, 300);
      });
    }

    try {
      this.switchInProgress = true;
      const oldMode = this.activeMode;
      
      // Run pre-change callbacks
      for (const callback of this.callbacks) {
        callback.onBeforeChange?.(oldMode, newMode);
      }

      // Update the active mode
      this.activeMode = newMode;
      
      // Small delay to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Run post-change callbacks
      for (const callback of this.callbacks) {
        callback.onAfterChange?.(oldMode, newMode);
      }

      return true;
    } finally {
      this.switchInProgress = false;
    }
  }

  // Register callbacks for mode changes
  registerCallbacks(callbacks: ModeChangeCallbacks): () => void {
    this.callbacks.add(callbacks);
    
    // Return an unregister function
    return () => {
      this.callbacks.delete(callbacks);
    };
  }

  // Check if a mode switch is required based on message content
  shouldSwitchMode(message: string, currentMode: AIMode): AIMode | null {
    const lowerText = message.toLowerCase();
    
    // Image generation - creative mode
    if (this.isImageGenerationRequest(lowerText)) {
      return currentMode !== 'creative' ? 'creative' : null;
    }
    
    // Task creation - assistant mode
    if (
      lowerText.includes("create task") ||
      lowerText.includes("add task") ||
      lowerText.includes("make task") ||
      lowerText.includes("create reminder") ||
      lowerText.includes("add reminder") ||
      lowerText.includes("remind me") ||
      lowerText.includes("schedule") ||
      lowerText.includes("create event") ||
      lowerText.includes("add event") ||
      lowerText.includes("calendar") ||
      lowerText.includes("add to my calendar") ||
      lowerText.includes("plan") ||
      lowerText.includes("meeting") ||
      lowerText.includes("appointment")
    ) {
      return currentMode !== 'assistant' ? 'assistant' : null;
    }
    
    // Writing assistance - writer mode
    if (
      lowerText.includes("write") ||
      lowerText.includes("draft") ||
      lowerText.includes("compose") ||
      lowerText.includes("email") ||
      lowerText.includes("letter") ||
      lowerText.includes("essay") ||
      lowerText.includes("poem") ||
      lowerText.includes("story") ||
      lowerText.includes("message") ||
      lowerText.includes("edit") ||
      lowerText.includes("text") ||
      lowerText.includes("summarize") ||
      lowerText.includes("rewrite")
    ) {
      return currentMode !== 'writer' ? 'writer' : null;
    }
    
    // Default - no mode switch needed
    return null;
  }

  // Helper to detect image generation requests
  isImageGenerationRequest(text: string): boolean {
    const lowerText = text.toLowerCase();
    return (
      lowerText.startsWith("/image") ||
      lowerText.includes("generate image") ||
      lowerText.includes("create image") ||
      lowerText.includes("draw") ||
      lowerText.includes("create a picture") ||
      lowerText.includes("make an image") ||
      lowerText.includes("generate a picture") ||
      lowerText.includes("show me a picture") ||
      lowerText.includes("visualize") ||
      lowerText.includes("picture of")
    );
  }
  
  // Extract prompt for image generation
  extractImagePrompt(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.startsWith("/image")) {
      return text.substring(6).trim();
    }
    
    // Handle other image generation phrases
    const patterns = [
      "generate image of ", 
      "create image of ",
      "draw ",
      "create a picture of ",
      "make an image of ",
      "generate a picture of ",
      "show me a picture of ",
      "picture of ",
      "visualize "
    ];
    
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        const startIndex = lowerText.indexOf(pattern) + pattern.length;
        return text.substring(startIndex).trim();
      }
    }
    
    // Fallback - use the entire text as prompt
    return text;
  }
}

// Export singleton instance for global use
export const modeController = new ModeController();
