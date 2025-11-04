import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

function useQueryFlag() {
  const location = useLocation();
  return useMemo(() => {
    const usp = new URLSearchParams(location.search);
    return usp.get("authdebug") === "1" || usp.get("authdebug") === "true";
  }, [location.search]);
}

export default function AuthDebug() {
  const show = useQueryFlag();
  const location = useLocation();
  const { user, session, isLoading } = useAuth();
  const [lastEvent, setLastEvent] = useState<string>("(none)");
  const [gsSession, setGsSession] = useState<"yes" | "no" | "err" | "pending">("pending");
  const [errLine, setErrLine] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;

    let sub: { unsubscribe: () => void } | undefined;
    try {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        setLastEvent(event);
      });
      sub = data.subscription;
    } catch (e) {
      setErrLine(`subscribe failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    (async () => {
      try {
        setGsSession("pending");
        const { data } = await supabase.auth.getSession();
        setGsSession(data?.session ? "yes" : "no");
      } catch (e) {
        setGsSession("err");
        setErrLine(`getSession error: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();

    const onRejection = (ev: PromiseRejectionEvent) => {
      setErrLine(`unhandledrejection: ${ev.reason instanceof Error ? ev.reason.message : String(ev.reason)}`);
    };
    const onError = (ev: ErrorEvent) => {
      setErrLine(`error: ${ev.message}`);
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);

    return () => {
      try { sub?.unsubscribe(); } catch {}
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, [show]);

  if (!show) return null;

  const truncate = (s?: string | null, n = 6) => (s ? `${s.slice(0, n)}…${s.slice(-n)}` : "-");

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        fontSize: 12,
        padding: "8px 10px",
        borderRadius: 8,
        maxWidth: 320,
        pointerEvents: "auto",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>AuthDebug</div>
      <div>path: {location.pathname}</div>
      <div>auth.loading: {String(isLoading)}</div>
      <div>auth.user: {user ? truncate(user.id) : "null"}</div>
      <div>auth.email: {user?.email ?? "-"}</div>
      <div>auth.session: {session ? "yes" : "no"}</div>
      <div>getSession(): {gsSession}</div>
      <div>last event: {lastEvent}</div>
      {errLine ? <div style={{ color: "#ff8" }}>note: {errLine}</div> : null}
      <button
        onClick={async () => {
          try {
            const { data } = await supabase.auth.getSession();
            setGsSession(data?.session ? "yes" : "no");
          } catch (e) {
            setGsSession("err");
            setErrLine(`getSession error: ${e instanceof Error ? e.message : String(e)}`);
          }
        }}
        style={{
          marginTop: 6,
          fontSize: 12,
          padding: "4px 8px",
          background: "#4b6bfb",
          color: "#fff",
          border: 0,
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        Re-check session
      </button>
    </div>
  );
}
