import { Outlet } from "react-router-dom";
import { WaktiHeader } from "./WaktiHeader";
import { WaktiFooter } from "./WaktiFooter";
import { useState } from "react";

export type WaktiLang = "en" | "ar";

export function WaktiLayout() {
  const [lang, setLang] = useState<WaktiLang>("en");
  const isRtl = lang === "ar";

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col"
      style={{ background: "#0c0f14" }}
    >
      <WaktiHeader lang={lang} setLang={setLang} />
      <main className="flex-1">
        <Outlet context={{ lang, setLang }} />
      </main>
      <WaktiFooter lang={lang} />
    </div>
  );
}
