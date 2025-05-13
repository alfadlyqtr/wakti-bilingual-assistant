
// Import the sonner toast functionality
import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
};

const useToast = () => {
  const showToast = ({ title, description, variant, action }: ToastProps) => {
    if (variant === "destructive") {
      sonnerToast.error(title, {
        description,
        action,
      });
    } else {
      sonnerToast.success(title, {
        description,
        action,
      });
    }
  };

  return {
    toast: showToast,
    toasts: [] // This is to maintain compatibility with the shadcn/ui Toaster component
  };
};

// Direct toast function for easier access
const toast = (props: ToastProps) => {
  if (props.variant === "destructive") {
    sonnerToast.error(props.title, {
      description: props.description,
      action: props.action,
    });
  } else {
    sonnerToast.success(props.title, {
      description: props.description,
      action: props.action,
    });
  }
};

export { useToast, toast };
