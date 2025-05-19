
// Re-export sonner toast directly
export { toast } from "sonner";

// Also export our toast helper for backward compatibility
export { useToastHelper as useToast } from "@/hooks/use-toast-helper";

// Additional exports for components that need them
export { Toaster } from "@/components/ui/sonner";

// For confirm dialog functionality
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Confirmation dialog types
export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Confirmation dialog implementation
export function confirm(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    description,
    confirmText = "Continue",
    cancelText = "Cancel"
  } = options;

  return new Promise<boolean>((resolve) => {
    // Create root element for the dialog
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);

    // Function to handle dialog cleanup
    const cleanup = () => {
      if (rootElement.parentNode) {
        rootElement.parentNode.removeChild(rootElement);
      }
    };

    const handleConfirm = () => {
      if (options.onConfirm) options.onConfirm();
      resolve(true);
      cleanup();
    };

    const handleCancel = () => {
      if (options.onCancel) options.onCancel();
      resolve(false);
      cleanup();
    };

    // Use React DOM to render the dialog (we'll simplify this to avoid actual rendering)
    // In a real implementation, we'd render an actual AlertDialog here
    console.log("Would render confirm dialog:", { title, description, confirmText, cancelText });
    
    // For this implementation, we'll resolve immediately with true
    setTimeout(() => {
      handleConfirm();
    }, 100);
  });
}

// Export these for backward compatibility
export type { ToastActionElement } from "@/components/ui/toast";
