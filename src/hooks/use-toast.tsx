
import * as React from "react";
import { toast as sonnerToast } from "sonner";

type ToastProps = React.ComponentPropsWithoutRef<typeof sonnerToast>;

const useToast = () => {
  return {
    toast: sonnerToast,
  };
};

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
};

const toast = sonnerToast;

const confirm = (options: ConfirmOptions = {}): Promise<boolean> => {
  return new Promise((resolve) => {
    const {
      title = "Confirm",
      description = "Are you sure you want to continue?",
      confirmText = "Confirm",
      cancelText = "Cancel",
    } = options;

    sonnerToast(
      title,
      {
        description,
        action: {
          label: confirmText,
          onClick: () => resolve(true),
        },
        cancel: {
          label: cancelText,
          onClick: () => resolve(false),
        },
        onAutoClose: () => resolve(false),
      }
    );
  });
};

export { useToast, toast, confirm };
