
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster 
      position="top-right"
      toastOptions={{
        className: "my-toast-class",
        duration: 3000,
      }}
    />
  );
}
