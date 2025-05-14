
import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast";
import {
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

// Define the confirm options type
export type ConfirmOptions = {
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

let memoryToasts: ToasterToast[] = [];

const useToast = () => {
  return {
    toast,
    confirm,
    dismiss: (toastId?: string) => {
      sonnerToast.dismiss(toastId);
    },
    toasts: memoryToasts,
  };
};

// Confirm function that shows a confirm dialog
export function confirm(options: ConfirmOptions | string) {
  // Handle string argument (backward compatibility)
  if (typeof options === 'string') {
    const confirmed = window.confirm(options);
    return Promise.resolve(confirmed);
  }
  
  // Handle object argument
  const { title, description, onConfirm, onCancel } = options;
  
  // Show confirm dialog using sonner
  sonnerToast(title, {
    description,
    action: {
      label: "Confirm",
      onClick: () => {
        onConfirm();
      },
    },
    cancel: {
      label: "Cancel",
      onClick: () => {
        if (onCancel) onCancel();
      },
    },
    duration: 10000,
  });
}

// Toast function that uses sonner's toast
export function toast(props: ToastOptions) {
  const { title, description, variant, ...rest } = props;
  
  // Map variant to sonner's equivalent - fix the type comparison issue
  let sonnerVariant: string = "default";
  if (variant === "destructive") {
    sonnerVariant = "error";
  } else if (variant === "success") {
    sonnerVariant = "success";
  }
  
  // Use sonner toast
  sonnerToast(title as string, {
    description,
    ...rest,
    // No need to specify a type property here as it's not compatible
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
