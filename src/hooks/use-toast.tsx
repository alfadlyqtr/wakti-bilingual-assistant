import {
  atom,
  useAtom,
} from 'jotai';

import {
  Toast,
  ToastActionElement,
  ToastProps,
  ToastViewportProps
} from "@/components/ui/toast"

type ToastsState = {
  toasts: Toast[]
}

const toastsAtom = atom<ToastsState>({
  toasts: [],
});

type ActionType = 'ADD_TOAST' | 'UPDATE_TOAST' | 'DISMISS_TOAST' | 'REMOVE_TOAST';

type Action =
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'UPDATE_TOAST'; toast: Partial<Toast> }
  | { type: 'DISMISS_TOAST'; toastId: string }
  | { type: 'REMOVE_TOAST'; toastId: string };

const reducer = (state: ToastsState, action: Action): ToastsState => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.toast],
      };
    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };
    case 'DISMISS_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toastId ? { ...t, open: false } : t
        ),
      };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
    default:
      return state;
  }
};

const updateToasts = (dispatch: React.Dispatch<Action>, toast: Partial<Toast>, actionType: ActionType) => {
  switch (actionType) {
    case 'ADD_TOAST':
      dispatch({ type: 'ADD_TOAST', toast: toast as Toast });
      break;
    case 'UPDATE_TOAST':
      dispatch({ type: 'UPDATE_TOAST', toast: toast });
      break;
    case 'DISMISS_TOAST':
      dispatch({ type: 'DISMISS_TOAST', toastId: toast.id as string });
      break;
    case 'REMOVE_TOAST':
      dispatch({ type: 'REMOVE_TOAST', toastId: toast.id as string });
      break;
    default:
      break;
  }
};

export function useToast() {
  const [state, dispatch] = useAtom(toastsAtom);

  const toasts = state.toasts;

  const toast = ({ ...props }: ToastProps) => {
    const id = props.id || Math.random().toString(36).substring(2);
    const toast = {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => {
        updateToasts(dispatch, { id, open }, open ? 'UPDATE_TOAST' : 'DISMISS_TOAST');
      },
    };
    updateToasts(dispatch, toast, 'ADD_TOAST');
  };

  const dismiss = (toastId: string) => {
    updateToasts(dispatch, { id: toastId }, 'DISMISS_TOAST');
  };

  const remove = (toastId: string) => {
    updateToasts(dispatch, { id: toastId }, 'REMOVE_TOAST');
  };

  return {
    toasts,
    toast,
    dismiss,
    remove,
  };
}

// Add confirm function
export function confirm(props: { title: string; description?: string; onConfirm: () => void; onCancel?: () => void }) {
  const { toast } = useToast();
  
  toast({
    title: props.title,
    description: props.description,
    action: (
      <div className="flex gap-2">
        <Button variant="default" size="sm" onClick={() => {
          props.onConfirm();
        }}>
          Confirm
        </Button>
        {props.onCancel && (
          <Button variant="outline" size="sm" onClick={() => {
            props.onCancel?.();
          }}>
            Cancel
          </Button>
        )}
      </div>
    ),
    duration: 10000,
  });
}
