
import * as React from "react";
import {
  Toast,
  ToastProps,
  ToastActionElement,
  ToastProvider as ToastUiProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "@/components/ui/toast";

import { createContext, useContext } from "react";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000; // 5 seconds timeout

type ToasterToast = ToastProps & {
  id: string;
  // Enforce string type for title and description to match Radix UI requirements
  title?: string;
  description?: string;
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

/**
 * Safely converts any ReactNode content to a string to satisfy Radix UI's
 * strict string type requirements for toast content.
 */
function renderToastContent(content: React.ReactNode): string {
  if (content === null || content === undefined) return "";
  if (typeof content === "string") return content;
  if (typeof content === "number" || typeof content === "boolean") return content.toString();
  // For React elements or objects, return empty string to satisfy typing
  return "";
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

export interface ToastContextValue {
  toast: (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
    variant?: "default" | "destructive" | "success";
  }) => void;
  dismiss: (toastId?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function useToastInternal(): ToastContextValue {
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

      // Convert ReactNode to string before dispatching to state
      const stringTitle = title ? renderToastContent(title) : undefined;
      const stringDescription = description ? renderToastContent(description) : undefined;

      dispatch({
        type: actionTypes.ADD_TOAST,
        toast: {
          id,
          title: stringTitle,
          description: stringDescription,
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
    confirm: (options: ConfirmOptions) => confirmDialog(options),
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toast, dismiss, confirm } = useToastInternal();
  
  // Set up event listener for external toast events
  React.useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        toast(customEvent.detail);
      }
    };
    
    document.addEventListener("lovable:toast", handleToastEvent);
    return () => {
      document.removeEventListener("lovable:toast", handleToastEvent);
    };
  }, [toast]);
  
  return (
    <ToastContext.Provider value={{ toast, dismiss, confirm }}>
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
    <ToastUiProvider>
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
              {title && (
                <ToastTitle>
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription>
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
    </ToastUiProvider>
  );
}

// Helper functions for using toast
export const showToast = (props: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: "default" | "destructive" | "success";
}): void => {
  // We'll dispatch an event that will be caught by the toast provider
  const event = new CustomEvent("lovable:toast", { detail: props });
  document.dispatchEvent(event);
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
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
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
      const ReactDOM = require('react-dom');
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
        const React = require('react');
        
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

// Export confirm function directly so it can be used outside of useToast
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return confirmDialog(options);
}

// Fix for the toast object to make it callable and have methods
interface ToastFunction {
  (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
    variant?: "default" | "destructive" | "success";
  }): void;
  success: (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
  }) => void;
  error: (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
  }) => void;
  default: (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
  }) => void;
  show: (props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
    variant?: "default" | "destructive" | "success";
  }) => void;
}

// Create a callable function with methods
const createToastFunction = (): ToastFunction => {
  // Base function
  const toastFn = ((props: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
    variant?: "default" | "destructive" | "success";
  }) => {
    showToast(props);
  }) as ToastFunction;
  
  // Add methods
  toastFn.success = (props) => {
    showToast({ ...props, variant: "success" });
  };
  
  toastFn.error = (props) => {
    showToast({ ...props, variant: "destructive" });
  };
  
  toastFn.default = (props) => {
    showToast({ ...props, variant: "default" });
  };
  
  toastFn.show = (props) => {
    showToast(props);
  };
  
  return toastFn;
};

// Export the callable toast function
export const toast = createToastFunction();
