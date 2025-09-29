import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { completeWhoopCallback } from "@/services/whoopService";
import { supabase } from "@/integrations/supabase/client";

export default function FitnessWhoopCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState<string>("Completing WHOOP connection...");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get("code");
      const state = params.get("state");
      // Use the actual current callback path to match the registered redirect URI
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      if (!code) {
        setMessage("Missing code parameter.");
        return;
      }
      try {
        // Ensure Supabase session is ready (access token available) before calling Edge Function
        const deadline = Date.now() + 2000; // up to 2s
        while (Date.now() < deadline) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        await completeWhoopCallback(code, state, redirectUri);
        setMessage("Connected! Redirecting...");
        setTimeout(() => navigate("/fitness"), 800);
      } catch (e: any) {
        console.error(e);
        setMessage("Failed to connect. Please try again.");
        const msg = e?.message || String(e);
        setDetail(msg.slice(0, 500));
      }
    };
    run();
  }, [location.search, navigate]);

  return (
    <div className="p-6 text-sm text-muted-foreground">
      <div>{message}</div>
      {detail && (
        <pre className="mt-2 text-xs whitespace-pre-wrap break-all opacity-80">{detail}</pre>
      )}
    </div>
  );
}
