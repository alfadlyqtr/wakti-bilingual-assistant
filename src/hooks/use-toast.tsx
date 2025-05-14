
import * as React from "react";
import { toast as toastSonner } from "sonner";

export function useToast() {
  return {
    toast: (props: { 
      title?: string; 
      description?: string; 
      variant?: "default" | "destructive";
      duration?: number;
      icon?: React.ReactNode;
    }) => {
      toastSonner(props.title, {
        description: props.description,
        duration: props.duration,
        icon: props.icon,
      });
    },
    dismiss: (toastId?: string) => {
      toastSonner.dismiss(toastId);
    },
    // Adding confirm to the useToast hook
    confirm: (options: { title?: string; description?: string; onConfirm?: () => void }): Promise<boolean> => {
      return new Promise((resolve) => {
        const confirmed = window.confirm(options.description || "");
        if (confirmed && options.onConfirm) {
          options.onConfirm();
        }
        resolve(confirmed);
      });
    }
  };
}

// Make toast function directly callable with title/description
export const toast = Object.assign(
  // Main callable function
  (props: { 
    title?: string; 
    description?: string; 
    variant?: "default" | "destructive";
    duration?: number;
    icon?: React.ReactNode;
  }) => {
    return toastSonner(props.title, {
      description: props.description,
      duration: props.duration,
      icon: props.icon
    });
  },
  // Additional methods
  {
    error: (message: string) => toastSonner.error(message),
    success: (message: string) => toastSonner.success(message),
    info: (message: string) => toastSonner.info(message),
    warning: (message: string) => toastSonner.warning(message),
    dismiss: (toastId?: string) => toastSonner.dismiss(toastId)
  }
);

// Standalone confirm function
export const confirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const confirmed = window.confirm(message);
    resolve(confirmed);
  });
};
