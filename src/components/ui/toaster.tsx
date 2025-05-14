
import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/providers/ThemeProvider";

export function Toaster() {
  const { theme } = useTheme();
  
  return (
    <SonnerToaster 
      position="top-center"
      toastOptions={{
        className: "my-toast-class",
        duration: 5000,
        style: {
          background: theme === "dark" ? "#1a1a1a" : "#ffffff",
          color: theme === "dark" ? "#ffffff" : "#1a1a1a",
          border: `1px solid ${theme === "dark" ? "#333333" : "#e0e0e0"}`,
        }
      }}
      theme={theme}
    />
  );
}
