
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";
import React, { useState, useEffect } from "react";

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
  // This is a dummy array to satisfy the type requirements in Toaster component
  // Sonner manages its own internal toast state
  const toasts: any[] = [];

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
    toasts, // Return the dummy toasts array
  };
};

// These are for direct use without the hook
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
