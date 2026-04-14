import React from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const Bone = ({ className }: { className?: string }) => (
  <div className={cn("rounded-lg bg-white/5 animate-pulse", className)} />
);

// ── Per-page content skeletons ──────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="px-3 pt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Bone className="h-28 rounded-2xl" />
        <Bone className="h-28 rounded-2xl" />
        <Bone className="h-28 rounded-2xl" />
        <Bone className="h-28 rounded-2xl" />
      </div>
      <Bone className="h-36 rounded-2xl" />
      <Bone className="h-24 rounded-2xl" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="px-3 pt-3 space-y-2">
      <Bone className="h-8 w-40 mb-4 rounded-full" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 animate-pulse">
          <Bone className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3 w-3/4 rounded-full" />
            <Bone className="h-3 w-1/2 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="px-3 pt-3 space-y-3">
      <Bone className="h-10 rounded-2xl" />
      <div className="grid grid-cols-7 gap-1">
        {[...Array(35)].map((_, i) => (
          <Bone key={i} className="h-9 rounded-xl" />
        ))}
      </div>
      <Bone className="h-4 w-32 rounded-full" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 animate-pulse">
          <Bone className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3 w-2/3 rounded-full" />
            <Bone className="h-3 w-1/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="px-3 pt-3 flex flex-col gap-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "flex-row" : "flex-row-reverse")}>
          <Bone className="h-8 w-8 rounded-full shrink-0 self-end" />
          <Bone className={cn("h-14 rounded-2xl", i % 2 === 0 ? "w-2/3" : "w-1/2")} />
        </div>
      ))}
    </div>
  );
}

function AISkeleton() {
  return (
    <div className="px-3 pt-3 space-y-4 flex flex-col items-center">
      <Bone className="h-16 w-16 rounded-full mt-6" />
      <Bone className="h-4 w-48 rounded-full" />
      <Bone className="h-3 w-64 rounded-full" />
      <div className="w-full space-y-2 mt-4">
        {[...Array(3)].map((_, i) => (
          <Bone key={i} className="h-12 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="px-3 pt-3 space-y-3">
      <div className="flex flex-col items-center gap-3 py-4">
        <Bone className="h-20 w-20 rounded-full" />
        <Bone className="h-4 w-32 rounded-full" />
        <Bone className="h-3 w-48 rounded-full" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 animate-pulse">
          <Bone className="h-8 w-8 rounded-xl shrink-0" />
          <Bone className="h-3 w-40 rounded-full flex-1" />
          <Bone className="h-4 w-4 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

function CardListSkeleton() {
  return (
    <div className="px-3 pt-3 space-y-3">
      <Bone className="h-8 w-40 mb-2 rounded-full" />
      {[...Array(4)].map((_, i) => (
        <Bone key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

function TasjeelSkeleton() {
  return (
    <div className="px-3 pt-3 flex flex-col items-center gap-4">
      <Bone className="h-3 w-40 rounded-full mt-4" />
      <Bone className="h-32 w-32 rounded-full mt-2" />
      <div className="flex gap-4 mt-2">
        <Bone className="h-12 w-12 rounded-full" />
        <Bone className="h-12 w-12 rounded-full" />
        <Bone className="h-12 w-12 rounded-full" />
      </div>
      <div className="w-full space-y-2 mt-4">
        {[...Array(3)].map((_, i) => (
          <Bone key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ── Route → skeleton mapping ────────────────────────────────────────────────

function pickSkeleton(path: string): React.ReactNode {
  if (path === "/dashboard" || path === "/") return <DashboardSkeleton />;
  if (path === "/tasks-reminders" || path === "/tr") return <ListSkeleton />;
  if (path === "/calendar") return <CalendarSkeleton />;
  if (path === "/contacts" || path.startsWith("/contacts/")) return <ListSkeleton />;
  if (path.startsWith("/wakti-ai")) return <AISkeleton />;
  if (path === "/tasjeel") return <TasjeelSkeleton />;
  if (path === "/account") return <AccountSkeleton />;
  if (path === "/settings") return <AccountSkeleton />;
  if (path === "/maw3d" || path.startsWith("/maw3d/")) return <CardListSkeleton />;
  if (path.startsWith("/contacts/")) return <ChatSkeleton />;
  if (path === "/music") return <CardListSkeleton />;
  if (path === "/journal") return <ListSkeleton />;
  if (path === "/projects" || path.startsWith("/projects/")) return <CardListSkeleton />;
  if (path === "/games" || path.startsWith("/games/")) return <CardListSkeleton />;
  if (path === "/fitness") return <CardListSkeleton />;
  if (path.startsWith("/tools/")) return <AISkeleton />;
  return <ListSkeleton />;
}

// ── Mobile header skeleton ──────────────────────────────────────────────────

function MobileHeaderSkeleton() {
  return (
    <div className="h-16 bg-background border-b border-white/5 px-3 flex items-center justify-between shrink-0">
      <Bone className="h-8 w-8 rounded-full" />
      <div className="flex items-center gap-2">
        <Bone className="h-8 w-20 rounded-full" />
        <Bone className="h-8 w-8 rounded-full" />
        <Bone className="h-8 w-8 rounded-full" />
        <Bone className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
}

// ── Desktop sidebar skeleton ────────────────────────────────────────────────

function DesktopSidebarSkeleton() {
  return (
    <div className="w-[70px] h-full bg-background border-r border-white/5 flex flex-col items-center py-4 gap-4 shrink-0">
      <Bone className="h-9 w-9 rounded-full" />
      {[...Array(7)].map((_, i) => (
        <Bone key={i} className="h-9 w-9 rounded-xl" />
      ))}
    </div>
  );
}

// ── Main exported component ─────────────────────────────────────────────────

export function AppShellSkeleton() {
  const location = useLocation();
  const path = location.pathname;
  const content = pickSkeleton(path);

  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1280;

  if (isMobile) {
    return (
      <div className="h-[100dvh] bg-background flex flex-col overflow-hidden">
        <MobileHeaderSkeleton />
        <div className="flex-1 overflow-hidden">
          {content}
        </div>
      </div>
    );
  }

  if (isTablet) {
    return (
      <div className="h-[100dvh] bg-background flex overflow-hidden">
        <DesktopSidebarSkeleton />
        <div className="flex-1 overflow-hidden pt-3">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-background flex overflow-hidden">
      <DesktopSidebarSkeleton />
      <div className="flex-1 overflow-hidden pt-3">
        {content}
      </div>
    </div>
  );
}
