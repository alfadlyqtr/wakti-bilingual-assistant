import * as React from "react";
import {
  Toast,
  ToastProps,
  ToastActionElement,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "@/components/ui/toast";

import { createContext, useContext } from "react";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_VALUE;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
      id: string;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId: string;
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId: string;
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.id ? { ...t, ...action.toast } : t
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === "all"
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case actionTypes.REMOVE_TOAST:
      if (action.toastId === "all") {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
    default:
      return state;
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

interface Toast {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: "default" | "destructive" | "success";
  open: boolean;
}

type ToastContextType = {
  toast: (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
    variant?: "default" | "destructive" | "success";
  }) => void;
  dismiss: (toastId?: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

function useToastInternal(): ToastContextType {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    toast: ({ title, description, action, variant }) => {
      const id = genId();

      const update = (props: ToasterToast) =>
        dispatch({
          type: actionTypes.UPDATE_TOAST,
          id,
          toast: { ...props },
        });

      const dismiss = () =>
        dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

      dispatch({
        type: actionTypes.ADD_TOAST,
        toast: {
          id,
          title,
          description,
          action,
          variant,
          open: true,
          onOpenChange: (open) => {
            if (!open) dismiss();
          },
        },
      });

      return {
        id,
        dismiss,
        update,
      };
    },
    dismiss: (toastId) =>
      dispatch({
        type: actionTypes.DISMISS_TOAST,
        toastId: toastId || "all",
      }),
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toast, dismiss } = useToastInternal();
  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToasterInternal />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function Toaster() {
  return <ToasterInternal />;
}

function ToasterInternal() {
  const [state] = React.useState<State>(memoryState);

  return (
    <ToastProvider>
      <ToastViewport />
      {state.toasts.map(function ({
        id,
        title,
        description,
        action,
        ...props
      }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
    </ToastProvider>
  );
}

// Create toast utility functions
export const toast = {
  success: (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
  }) => {
    const context = useContext(ToastContext);
    if (!context) {
      throw new Error("useToast must be used within a ToastProvider");
    }
    context.toast({ ...props, variant: "success" });
  },
  error: (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
  }) => {
    const context = useContext(ToastContext);
    if (!context) {
      throw new Error("useToast must be used within a ToastProvider");
    }
    context.toast({ ...props, variant: "destructive" });
  },
  default: (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
  }) => {
    const context = useContext(ToastContext);
    if (!context) {
      throw new Error("useToast must be used within a ToastProvider");
    }
    context.toast({ ...props, variant: "default" });
  },
  // Add a function that can be called directly as a function
  show: (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
    variant?: "default" | "destructive" | "success";
  }) => {
    const context = useContext(ToastContext);
    if (!context) {
      throw new Error("useToast must be used within a ToastProvider");
    }
    context.toast(props);
  }
};

// Confirmation dialog types
export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Confirmation dialog implementation
export function confirm(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    description,
    confirmText = "Continue",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
  } = options;

  return new Promise<boolean>((resolve) => {
    // Create root element for the dialog
    const rootElement = document.createElement("div");
    document.body.appendChild(rootElement);

    // Function to handle dialog cleanup
    const cleanup = () => {
      // Use ReactDOM.unmountComponentAtNode instead of direct React.unmountComponentAtNode
      const unmountResult = ReactDOM.unmountComponentAtNode(rootElement);
      if (unmountResult && rootElement.parentNode) {
        rootElement.parentNode.removeChild(rootElement);
      }
    };

    // Render the confirmation dialog
    const handleConfirm = () => {
      if (onConfirm) onConfirm();
      resolve(true);
      cleanup();
    };

    const handleCancel = () => {
      if (onCancel) onCancel();
      resolve(false);
      cleanup();
    };

    // Import necessary components using dynamic import
    import("@/components/ui/alert-dialog").then((AlertDialogModule) => {
      import("react-dom").then((ReactDOMModule) => {
        const ReactDOM = ReactDOMModule.default;
        
        // Create AlertDialog component tree
        const alertDialog = React.createElement(
          AlertDialogModule.AlertDialog,
          { defaultOpen: true },
          React.createElement(
            AlertDialogModule.AlertDialogContent,
            null,
            React.createElement(
              AlertDialogModule.AlertDialogHeader,
              null,
              React.createElement(AlertDialogModule.AlertDialogTitle, null, title),
              React.createElement(AlertDialogModule.AlertDialogDescription, null, description)
            ),
            React.createElement(
              AlertDialogModule.AlertDialogFooter,
              null,
              React.createElement(AlertDialogModule.AlertDialogCancel, { onClick: handleCancel }, cancelText),
              React.createElement(AlertDialogModule.AlertDialogAction, { onClick: handleConfirm }, confirmText)
            )
          )
        );
        
        // Render the dialog
        ReactDOM.render(alertDialog, rootElement);
      });
    });
  });
}
