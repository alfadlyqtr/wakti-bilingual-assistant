
// Re-export sonner toast directly
export { toast } from "sonner";

// Also export our toast helper for backward compatibility
export { useToastHelper as useToast } from "@/hooks/use-toast-helper";

// Additional exports for components that need them
export { Toaster } from "@/components/ui/sonner";
