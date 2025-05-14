
import {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"
import {
  useToast as useToastOriginal,
} from "@/components/ui/toast"

export { useToast } from "@/components/ui/toaster"

import { toast as toastOriginal } from "@/components/ui/use-toast";

export function toast(props: ToastProps) {
  return toastOriginal(props);
}

type ConfirmOptions = {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
}

export const confirm = (options: ConfirmOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    const { toast } = useToastOriginal();
    
    const onConfirm = () => {
      resolve(true);
    };

    const onCancel = () => {
      resolve(false);
    };

    toast({
      title: options.title,
      description: options.description,
      action: (
        <ToastActionElement altText="Confirm action">
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="rounded bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {options.cancelText || "Cancel"}
            </button>
            <button
              onClick={onConfirm}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              {options.confirmText || "Confirm"}
            </button>
          </div>
        </ToastActionElement>
      ),
      duration: 10000,
    });
  });
};
