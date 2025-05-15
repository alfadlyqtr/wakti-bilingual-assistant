
import { toast } from "@/hooks/use-toast";
import { ToastActionElement } from "@/components/ui/toast";
import { ReactNode } from "react";

// This is a helper hook that makes it easier to use toast
export function useToastHelper() {
  return {
    success: (title: string, description?: string, action?: ToastActionElement) => {
      toast.success({ title, description, action });
    },
    error: (title: string, description?: string, action?: ToastActionElement) => {
      toast.error({ title, description, action });
    },
    info: (title: string, description?: string, action?: ToastActionElement) => {
      toast.default({ title, description, action });
    },
    show: (props: {
      title?: ReactNode;
      description?: ReactNode;
      action?: ToastActionElement;
      variant?: "default" | "destructive" | "success";
    }) => {
      toast.show(props);
    }
  };
}
