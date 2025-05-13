
import { toast } from "sonner";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
};

const useToast = () => {
  const showToast = ({ title, description, variant, action }: ToastProps) => {
    if (variant === "destructive") {
      toast.error(title, {
        description,
        action,
      });
    } else {
      toast.success(title, {
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

export { useToast, toast };
