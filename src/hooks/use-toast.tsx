
import * as React from "react";
import { toast as toastSonner } from "sonner";

export function useToast() {
  return {
    toast: (props: { title?: string; description?: string; variant?: "default" | "destructive" }) => {
      toastSonner(props.title, {
        description: props.description,
      });
    },
    dismiss: (toastId?: string) => {
      toastSonner.dismiss(toastId);
    }
  };
}

export const toast = {
  error: (message: string) => toastSonner.error(message),
  success: (message: string) => toastSonner.success(message),
  info: (message: string) => toastSonner.info(message),
  warning: (message: string) => toastSonner.warning(message),
  dismiss: (toastId?: string) => toastSonner.dismiss(toastId)
};

export const confirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const confirmed = window.confirm(message);
    resolve(confirmed);
  });
};
