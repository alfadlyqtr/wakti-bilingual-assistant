
import React from 'react';
import { useToast } from "@/hooks/use-toast";
import { ToastActionElement } from "@/components/ui/toast";

// This is a helper hook that makes it easier to use toast
export function useToastHelper() {
  const { toast } = useToast();
  
  const showSuccess = (title: string, description?: string, action?: ToastActionElement) => {
    toast({
      title,
      description,
      action,
      variant: "success"
    });
  };
  
  const showError = (title: string, description?: string, action?: ToastActionElement) => {
    toast({
      title,
      description,
      action,
      variant: "destructive"
    });
  };
  
  const showInfo = (title: string, description?: string, action?: ToastActionElement) => {
    toast({
      title,
      description,
      action,
      variant: "default"
    });
  };
  
  return {
    success: showSuccess,
    error: showError,
    info: showInfo,
    toast // Original toast function
  };
}
