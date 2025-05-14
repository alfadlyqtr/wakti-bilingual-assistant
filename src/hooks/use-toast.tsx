
import { toast as sonnerToast } from "sonner";
import React from "react";

type ToastProps = {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: React.ReactNode;
  duration?: number;
  icon?: React.ReactNode;
};

type ConfirmProps = {
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

export const useToast = () => {
  const showToast = ({ title, description, variant, action, duration, icon }: ToastProps) => {
    if (variant === "destructive") {
      sonnerToast.error(title, {
        description,
        action,
        duration,
        icon,
      });
    } else {
      sonnerToast.success(title, {
        description,
        action,
        duration,
        icon,
      });
    }
  };

  const showConfirm = ({ title, description, onConfirm, onCancel }: ConfirmProps) => {
    sonnerToast(title, {
      description,
      action: {
        label: "Confirm",
        onClick: onConfirm,
      },
      cancel: {
        label: "Cancel",
        onClick: onCancel,
      },
      className: "w-full",
    });
  };

  return {
    toast: showToast,
    confirm: showConfirm,
  };
};

// These are for direct use without the hook
export const toast = (props: ToastProps) => {
  if (props.variant === "destructive") {
    sonnerToast.error(props.title, {
      description: props.description,
      action: props.action,
      duration: props.duration,
      icon: props.icon,
    });
  } else {
    sonnerToast.success(props.title, {
      description: props.description,
      action: props.action,
      duration: props.duration,
      icon: props.icon,
    });
  }
};

export const confirm = ({ title, description, onConfirm, onCancel }: ConfirmProps) => {
  sonnerToast(title, {
    description,
    action: {
      label: "Confirm",
      onClick: onConfirm,
    },
    cancel: {
      label: "Cancel",
      onClick: onCancel,
    },
    className: "w-full",
  });
};
