import { createContext, useContext } from "react";

type DragHandleContextValue = {
  registerHandle: (node: HTMLElement | null) => void;
  listeners: Record<string, any>;
  attributes: Record<string, any>;
  isDragging: boolean;
};

const noop = () => {};

const defaultValue: DragHandleContextValue = {
  registerHandle: noop,
  listeners: {},
  attributes: {},
  isDragging: false,
};

const WidgetDragHandleContext = createContext<DragHandleContextValue>(defaultValue);

export const WidgetDragHandleProvider = WidgetDragHandleContext.Provider;

export const useWidgetDragHandle = () => useContext(WidgetDragHandleContext);
