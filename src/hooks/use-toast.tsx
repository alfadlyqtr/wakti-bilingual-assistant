
import * as React from "react";
import { toast as sonnerToast } from "sonner";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Define the toast types for consistency
export type ToastProps = {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
  icon?: React.ReactNode;
};

// Custom hook to create toasts with a simpler API
export const useToast = () => {
  const [openConfirm, setOpenConfirm] = React.useState(false);
  const [confirmData, setConfirmData] = React.useState<{
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Simple toast function
  const toast = (props: ToastProps) => {
    sonnerToast(props.title, {
      description: props.description,
      className: props.variant === "destructive" ? "bg-destructive text-destructive-foreground" : undefined,
      duration: props.duration,
      icon: props.icon,
    });
  };

  // Confirmation dialog
  const confirm = (props: {
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }) => {
    setConfirmData(props);
    setOpenConfirm(true);
  };

  const ConfirmationDialog = () => (
    <AlertDialog open={openConfirm} onOpenChange={setOpenConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmData.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmData.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              if (confirmData.onCancel) confirmData.onCancel();
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              confirmData.onConfirm();
              setOpenConfirm(false);
            }}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    toast,
    confirm,
    ConfirmationDialog,
  };
};

// Export standalone toast function for easy use
export const toast = (props: ToastProps) => {
  sonnerToast(props.title, {
    description: props.description,
    className: props.variant === "destructive" ? "bg-destructive text-destructive-foreground" : undefined,
    duration: props.duration,
    icon: props.icon,
  });
};

// Export standalone confirm function
export const confirm = (props: {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel?: () => void;
}) => {
  throw new Error("The standalone confirm function can only be used inside a component. Use useToast().confirm instead.");
};
