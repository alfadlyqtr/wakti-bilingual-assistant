
import * as React from "react";
import {
  Toast,
  ToastProps,
  ToastProvider as ToastUiProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "@/components/ui/toast";

import { createContext, useContext } from "react";

// Export the ToastActionElement type so it can be re-exported
export type ToastActionElement = React.ReactElement<typeof ToastAction>;

// Re-export the toast from sonner directly
export { toast } from "sonner";

// Confirmation dialog types
export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Expose the Toaster component from Sonner
export { Toaster } from "@/components/ui/sonner";

const ToastContext = createContext<{ confirm: (options: ConfirmOptions) => Promise<boolean> } | null>(null);

// Confirmation dialog implementation
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
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
      // Use ReactDOM.unmountComponentAtNode instead of direct React.unmountComponentAtNode
      const ReactDOM = require('react-dom');
      const unmountResult = ReactDOM.unmountComponentAtNode(rootElement);
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

    // Import necessary components using dynamic import
    import("@/components/ui/alert-dialog").then((AlertDialogModule) => {
      import("react-dom").then((ReactDOMModule) => {
        const ReactDOM = ReactDOMModule.default;
        const React = require('react');
        
        // Create AlertDialog component tree
        const alertDialog = React.createElement(
          AlertDialogModule.AlertDialog,
          { defaultOpen: true },
          React.createElement(
            AlertDialogModule.AlertDialogContent,
            null,
            React.createElement(
              AlertDialogModule.AlertDialogHeader,
              null,
              React.createElement(AlertDialogModule.AlertDialogTitle, null, title),
              React.createElement(AlertDialogModule.AlertDialogDescription, null, description)
            ),
            React.createElement(
              AlertDialogModule.AlertDialogFooter,
              null,
              React.createElement(AlertDialogModule.AlertDialogCancel, { onClick: handleCancel }, cancelText),
              React.createElement(AlertDialogModule.AlertDialogAction, { onClick: handleConfirm }, confirmText)
            )
          )
        );
        
        // Render the dialog
        ReactDOM.render(alertDialog, rootElement);
      });
    });
  });
}

// Export confirm function directly so it can be used outside of useToast
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return confirmDialog(options);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // Create a context value with the confirm function
  const contextValue = React.useMemo(() => ({
    confirm: confirmDialog,
  }), []);
  
  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Create a showToast utility for backwards compatibility
export const showToast = (props: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}): void => {
  const { variant, ...restProps } = props;
  
  if (variant === "destructive") {
    toast.error(props.title as string, restProps);
  } else if (variant === "success") {
    toast.success(props.title as string, restProps);
  } else {
    toast(props.title as string, restProps);
  }
};
