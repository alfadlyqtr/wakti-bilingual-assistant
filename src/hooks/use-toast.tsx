
import * as React from "react";
import { toast as toastOriginal, ToastT } from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Re-export the useToast hook from shadcn
export { useToast } from "@/components/ui/toast";

// Create a toast function with success variant
export const toast: typeof toastOriginal & {
  success: (opts: ToastT) => void;
} = Object.assign(
  (opts: ToastT) => toastOriginal(opts),
  {
    success: (opts: ToastT) => toastOriginal({ ...opts, variant: "success" }),
  }
);

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
    cancelText = "Cancel",
    onConfirm,
    onCancel,
  } = options;

  return new Promise<boolean>((resolve) => {
    // Create root element for the dialog
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);

    // Function to handle dialog cleanup
    const cleanup = () => {
      const unmountResult = React.unmountComponentAtNode(rootElement);
      if (unmountResult && rootElement.parentNode) {
        rootElement.parentNode.removeChild(rootElement);
      }
    };

    // Render the confirmation dialog
    const handleConfirm = () => {
      if (onConfirm) onConfirm();
      resolve(true);
      cleanup();
    };

    const handleCancel = () => {
      if (onCancel) onCancel();
      resolve(false);
      cleanup();
    };

    // Render the confirmation dialog
    React.render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {cancelText}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
      rootElement
    );
  });
}
