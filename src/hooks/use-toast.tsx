
import { useToast as useToastShadcn } from "@/components/ui/toast";
import { toast as toastShadcn } from "@/components/ui/toast";

export function useToast() {
  return useToastShadcn();
}

export const toast = toastShadcn;

export const confirm = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const confirmed = window.confirm(message);
    resolve(confirmed);
  });
};
