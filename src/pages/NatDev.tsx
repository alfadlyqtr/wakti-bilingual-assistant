import React from "react";
import { Button } from "@/components/ui/button";

export default function NatDev() {
  const handleOpenConsole = () => {
    try {
      (window as any)?.natively?.openConsole?.();
    } catch (error) {
      console.warn("Natively debug console failed", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <h1 className="text-2xl font-semibold mb-4">Natively Dev Test</h1>
      <p className="mb-6 text-center max-w-md text-muted-foreground">
        This page is for BuildNatively testing only. Use the button below to open the Natively debug console from inside the Wakti shell.
      </p>
      <Button onClick={handleOpenConsole} className="px-6 py-2 text-base font-medium">
        Open Natively Console
      </Button>
    </div>
  );
}
