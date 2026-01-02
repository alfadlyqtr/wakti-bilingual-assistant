import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { completeWhoopCallback } from "@/services/whoopService";
import { supabase } from "@/integrations/supabase/client";

export default function FitnessWhoopCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState<string>("Completing WHOOP connection...");
  const [detail, setDetail] = useState<string | null>(null);

  const processedRef = React.useRef<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get("code");
      const state = params.get("state");
      
      // Check for error from WHOOP OAuth
      const error = params.get("error");
      const errorDesc = params.get("error_description");
      if (error) {
        setMessage("WHOOP authorization failed.");
        setDetail(errorDesc || error);
        return;
      }
      
      if (!code) {
        if (!processedRef.current) {
            setMessage("Missing code parameter.");
            setDetail("The WHOOP authorization did not return a code. Please try connecting again.");
        }
        return;
      }

      // Prevent double-processing
      if (processedRef.current === code) return;
      processedRef.current = code;
      
      // Clear the code from the URL immediately to prevent reuse/issues on refresh
      window.history.replaceState({}, document.title, location.pathname);
      
      try {
        // Wait longer for session restoration (up to 5s) - session may need time after redirect
        const deadline = Date.now() + 5000;
        let hasSession = false;
        while (Date.now() < deadline) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            hasSession = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 200));
        }
        
        // Even if no session, completeWhoopCallback will try backup token
        console.log('Callback: session check complete', { hasSession });
        
        await completeWhoopCallback(code, state);
        setMessage("Connected! Redirecting...");
        setTimeout(() => navigate("/fitness"), 800);
      } catch (e: any) {
        console.error('WHOOP callback error:', e);
        const msg = e?.message || String(e);
        
        // If session expired, redirect to login with pending state
        if (msg.includes('Session expired') || msg.includes('log in')) {
          setMessage("Session expired. Redirecting to login...");
          setDetail("After logging in, your WHOOP connection will complete automatically.");
          // Store pending code for auto-resume after login
          try { 
            localStorage.setItem('whoop_pending_code', code); 
            if (state) localStorage.setItem('whoop_pending_state', state);
          } catch (_) {}
          setTimeout(() => navigate("/login"), 2000);
          return;
        }
        
        setMessage("Failed to connect. Please try again.");
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
