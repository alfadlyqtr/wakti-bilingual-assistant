import { toast as sonnerToast } from "sonner";
import React from "react";

type ToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
  duration?: number;
};

type ConfirmProps = {
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

const useToast = () => {
  const showToast = ({ title, description, variant, action, duration }: ToastProps) => {
    if (variant === "destructive") {
      sonnerToast.error(title, {
        description,
        action,
        duration,
      });
    } else {
      sonnerToast.success(title, {
        description,
        action,
        duration,
      });
    }
  };

  const confirm = ({ title, description, onConfirm, onCancel }: ConfirmProps) => {
    sonnerToast.custom((id) => (
      <div className="flex flex-col gap-2 w-full p-2">
        <div className="font-semibold">{title}</div>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
        <div className="flex gap-2 justify-end mt-1">
          <button 
            onClick={() => {
              if (onCancel) onCancel();
              sonnerToast.dismiss(id);
            }} 
            className="px-2 py-1 bg-muted hover:bg-muted/80 rounded-md text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onConfirm();
              sonnerToast.dismiss(id);
            }} 
            className="px-2 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
    });
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
      duration: props.duration,
    });
  } else {
    sonnerToast.success(props.title, {
      description: props.description,
      action: props.action,
      duration: props.duration,
    });
  }
};

// Export a confirm function for direct use like the toast function
const confirm = (props: ConfirmProps) => {
  sonnerToast.custom((id) => (
    <div className="flex flex-col gap-2 w-full p-2">
      <div className="font-semibold">{props.title}</div>
      {props.description && <div className="text-sm text-muted-foreground">{props.description}</div>}
      <div className="flex gap-2 justify-end mt-1">
        <button 
          onClick={() => {
            if (props.onCancel) props.onCancel();
            sonnerToast.dismiss(id);
          }} 
          className="px-2 py-1 bg-muted hover:bg-muted/80 rounded-md text-sm transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={() => {
            props.onConfirm();
            sonnerToast.dismiss(id);
          }} 
          className="px-2 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  ), {
    duration: 5000,
  });
};

export { useToast, toast, confirm };
