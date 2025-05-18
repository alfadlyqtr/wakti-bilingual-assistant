
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
  private lastError: Error | null = null;
  private consecutiveFailures = 0;

  // Get the current active mode
  getActiveMode(): AIMode {
    return this.activeMode;
  }

  // Reset the controller state if it gets stuck
  resetState(): void {
    console.log("Resetting mode controller state");
    this.switchInProgress = false;
    this.lastError = null;
    this.consecutiveFailures = 0;
  }

  // Get last error if any occurred during switching
  getLastError(): Error | null {
    return this.lastError;
  }

  // Set the active mode with proper callbacks
  async setActiveMode(newMode: AIMode): Promise<boolean> {
    if (newMode === this.activeMode) {
      return true; // Already in this mode
    }

    // Reset if switch has been in progress for too long (5 seconds)
    if (this.switchInProgress) {
      console.log("Mode switch already in progress, resetting state first");
      this.resetState();
    }

    try {
      this.switchInProgress = true;
      const oldMode = this.activeMode;
      
      console.log(`Mode switch initiated: ${oldMode} → ${newMode}`);
      
      // Run pre-change callbacks
      for (const callback of this.callbacks) {
        try {
          callback.onBeforeChange?.(oldMode, newMode);
        } catch (error) {
          console.error("Error in onBeforeChange callback:", error);
        }
      }

      // Update the active mode
      this.activeMode = newMode;
      
      // Small delay to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log(`Mode switch completed: ${oldMode} → ${newMode}`);
      
      // Run post-change callbacks
      for (const callback of this.callbacks) {
        try {
          callback.onAfterChange?.(oldMode, newMode);
        } catch (error) {
          console.error("Error in onAfterChange callback:", error);
        }
      }

      this.consecutiveFailures = 0;
      this.lastError = null;
      return true;
    } catch (error) {
      console.error(`Error switching mode from ${this.activeMode} to ${newMode}:`, error);
      this.lastError = error instanceof Error ? error : new Error(String(error));
      this.consecutiveFailures++;
      
      // Auto-reset after 3 consecutive failures
      if (this.consecutiveFailures >= 3) {
        console.warn("Multiple mode switch failures detected, auto-resetting controller");
        this.resetState();
      }
      
      return false;
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

  // Helper to detect image generation requests with expanded keywords
  isImageGenerationRequest(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // Expanded pattern matching with Arabic keywords
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
      lowerText.includes("picture of") ||
      lowerText.includes("sketch") ||
      lowerText.includes("illustrate") ||
      lowerText.includes("render") ||
      lowerText.includes("design") ||
      lowerText.includes("depict") ||
      lowerText.includes("show me") ||
      lowerText.includes("create art") ||
      lowerText.includes("generate art") ||
      lowerText.includes("ai art") ||
      // Arabic keywords for image generation
      lowerText.includes("صورة") ||  // image
      lowerText.includes("إنشاء صورة") || // create image
      lowerText.includes("توليد صورة") || // generate image
      lowerText.includes("رسم") || // draw
      lowerText.includes("رسمة") || // drawing
      lowerText.includes("صور") || // pictures
      lowerText.includes("تصور") || // visualize
      lowerText.includes("أظهر لي") || // show me
      lowerText.includes("فن ذكاء") // AI art
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
      "visualize ",
      "sketch ",
      "illustrate ",
      "render ",
      "design ",
      "depict ",
      "show me ",
      "create art of ",
      "generate art of ",
      // Arabic patterns
      "صورة ",
      "إنشاء صورة ",
      "توليد صورة ",
      "رسم ",
      "رسمة ",
      "صور ",
      "تصور ",
      "أظهر لي "
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
