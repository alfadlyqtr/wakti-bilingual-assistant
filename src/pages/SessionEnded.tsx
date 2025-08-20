import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/providers/ThemeProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Globe, Moon, Sun, LogOut as _LogOut, ThumbsUp } from "lucide-react";
import { t } from "@/utils/translations";
import { Logo3D } from "@/components/Logo3D";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SessionEnded() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, language, toggleLanguage } = useTheme();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleTakeover = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) throw new Error('No user');
      const nonce = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random()}`;
      const { error: upsertErr } = await supabase
        .from('user_session_locks')
        .upsert({ user_id: userId, nonce }, { onConflict: 'user_id' });
      if (upsertErr) throw upsertErr;
      await supabase.auth.signOut();
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (e: any) {
      const msg = e?.message || 'Failed to log out other device';
      try { toast.error(msg); } catch {}
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Best-effort cleanup if flags still exist
    try {
      localStorage.removeItem("wakti_session_kicked");
      localStorage.removeItem("wakti_session_blocked");
    } catch {}
  }, []);

  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center px-4 relative">
      {/* Top-right quick toggles (language + theme) */}
      <div className="absolute top-4 right-4 flex items-center space-x-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={toggleLanguage}
                className="rounded-full h-8 w-8 p-0"
                aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
          </Tooltip>
        </TooltipProvider>

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="rounded-full h-8 w-8 p-0 relative"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      <div className="w-full max-w-md bg-card/40 border rounded-xl p-6 shadow-soft">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative mb-6">
            <div className="relative">
              <Logo3D size="md" className="opacity-80" />
              <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground p-1.5 rounded-full border-2 border-background shadow-sm">
                <_LogOut className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">{t("sessionEnded_title", language)}</h1>
            <p className="text-muted-foreground text-sm">
              {t("sessionEnded_message", language)}
            </p>
          </div>
          
          {success ? (
            <div className="flex flex-col items-center gap-2">
              <ThumbsUp className="h-8 w-8 text-green-600" />
              <p className="text-sm text-muted-foreground">Other device logged out. Redirecting to login...</p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setShowForm((s) => !s)}
              >
                Log out other device
              </Button>

              {showForm && (
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={busy || !email || !password}
                    onClick={handleTakeover}
                  >
                    {busy ? "Working..." : "Confirm and log out other device"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {!success && (
            <div className="flex flex-wrap gap-2 justify-center pt-1 w-full">
              <Button 
                size="sm"
                className="flex-1 min-w-[120px]"
                onClick={() => navigate("/login", { replace: true, state: { from: location } })}
              >
                {t("sessionEnded_goToLogin", language)}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 min-w-[120px]"
                onClick={() => navigate("/home", { replace: true })}
              >
                {t("sessionEnded_goToHome", language)}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
