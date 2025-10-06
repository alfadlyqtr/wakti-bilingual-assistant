
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-16 items-center gap-1 rounded-2xl p-1 text-muted-foreground border",
      // 3D bar look: subtle gradient + inner highlight
      "bg-gradient-to-b from-background/70 to-muted/50",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.25),_0_8px_24px_rgba(0,0,0,0.12)]",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex flex-col items-center justify-center whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      // Flat-but-3D tab: gradient surface + inner highlight + soft shadow
      "bg-gradient-to-b from-card to-muted/20 border border-border",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.65),_0_6px_16px_rgba(0,0,0,0.10)]",
      "hover:border-pink-500/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),_0_8px_18px_rgba(0,0,0,0.14)] hover:scale-[1.02] active:scale-[0.98]",
      // Active: match DesktopSidebar journal button border/glow (no fill change)
      "data-[state=active]:text-foreground data-[state=active]:border-pink-500/40",
      "data-[state=active]:shadow-[0_0_15px_rgba(236,72,153,0.7),_inset_0_1px_0_rgba(255,255,255,0.85)] data-[state=active]:-translate-y-[1px]",
      "touch-manipulation select-none cursor-pointer",
      "min-h-[56px] min-w-[80px] gap-0.5",
      className
    )}
    {...props}
  >
    {typeof children === 'string' ? (
      children.split(' ').length > 1 ? (
        // Split text into two lines for multi-word labels
        <>
          <span className="leading-tight">{children.split(' ')[0]}</span>
          <span className="leading-tight">{children.split(' ').slice(1).join(' ')}</span>
        </>
      ) : (
        <span className="leading-tight">{children}</span>
      )
    ) : (
      children
    )}
  </TabsPrimitive.Trigger>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
