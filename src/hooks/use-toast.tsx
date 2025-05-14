
import { toast as sonnerToast } from "sonner";
import React from "react";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
};

type ConfirmProps = {
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

// Define the toast parameter type to match sonner's type
interface ToastT {
  id: string | number;
  dismiss: () => void;
}

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

  const confirm = ({ title, description, onConfirm, onCancel }: ConfirmProps) => {
    sonnerToast.custom(
      ({ id, dismiss }: ToastT) => (
        <div className="flex flex-col gap-2 w-full p-2">
          <div className="font-semibold">{title}</div>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
          <div className="flex gap-2 justify-end mt-1">
            <button 
              onClick={() => {
                if (onCancel) onCancel();
                dismiss();
              }} 
              className="px-2 py-1 bg-muted hover:bg-muted/80 rounded-md text-sm transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                onConfirm();
                dismiss();
              }} 
              className="px-2 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      ),
      {
        duration: 5000,
      }
    );
  };

  return {
    toast: showToast,
    confirm,
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

// Export a confirm function for direct use like the toast function
const confirm = (props: ConfirmProps) => {
  sonnerToast.custom(
    ({ id, dismiss }: ToastT) => (
      <div className="flex flex-col gap-2 w-full p-2">
        <div className="font-semibold">{props.title}</div>
        {props.description && <div className="text-sm text-muted-foreground">{props.description}</div>}
        <div className="flex gap-2 justify-end mt-1">
          <button 
            onClick={() => {
              if (props.onCancel) props.onCancel();
              dismiss();
            }} 
            className="px-2 py-1 bg-muted hover:bg-muted/80 rounded-md text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              props.onConfirm();
              dismiss();
            }} 
            className="px-2 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    ),
    {
      duration: 5000,
    }
  );
};

export { useToast, toast, confirm };
