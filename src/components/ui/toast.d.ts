
import * as React from "react"
import { type VariantProps } from "class-variance-authority"

export function Toast(props: ToastProps): React.ReactElement
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof toastVariants> {
  variant?: "default" | "destructive" | "success"
}

export function ToastTitle(props: ToastTitleProps): React.ReactElement
export interface ToastTitleProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ToastDescription(props: ToastDescriptionProps): React.ReactElement
export interface ToastDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ToastClose(props: ToastCloseProps): React.ReactElement
export interface ToastCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function ToastAction(props: ToastActionProps): React.ReactElement
export interface ToastActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}
