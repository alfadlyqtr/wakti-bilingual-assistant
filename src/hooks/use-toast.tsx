
import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast";
import {
  ToastActionProps,
  toast as sonnerToast,
  Toaster as SonnerToaster,
} from "sonner";

export type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000000;

export type ToastOptions = Omit<ToasterToast, "id">;

let memoryToasts: ToasterToast[] = [];

const useToast = () => {
  return {
    toast,
    dismiss: (toastId?: string) => {
      sonnerToast.dismiss(toastId);
    },
    toasts: memoryToasts,
  };
};

// Simple confirm function that returns a promise
export function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const confirmed = window.confirm(message);
    resolve(confirmed);
  });
}

// Toast function that uses sonner's toast
export function toast(props: ToastOptions) {
  const { title, description, variant, ...rest } = props;
  
  // Map variant to sonner's equivalent
  let sonnerVariant: "default" | "success" | "error" | "warning" | "info" = "default";
  if (variant === "destructive") {
    sonnerVariant = "error";
  } else if (variant === "success") {
    sonnerVariant = "success";
  }
  
  // Use sonner toast
  sonnerToast(title as string, {
    description,
    ...rest,
    type: sonnerVariant,
  });
  
  // Store toast in memory for any component that needs access to all toasts
  const id = Math.random().toString(36).substring(2, 9);
  const newToast: ToasterToast = {
    id,
    title,
    description,
    variant,
    ...rest,
  };
  
  memoryToasts = [newToast, ...memoryToasts].slice(0, TOAST_LIMIT);
  
  // Return the toast ID in case it needs to be dismissed
  return id;
}

export { useToast };
