
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export default function AdminPayments() {
  const { language } = useTheme();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">{t("adminPayments", language)}</h1>
        <div className="bg-card rounded-lg border p-6">
          <p className="text-muted-foreground">
            Admin payments management system will be implemented here.
          </p>
        </div>
      </div>
    </div>
  );
}
