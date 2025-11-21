import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Lock, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * AdminLogin v2.2 (no auto-check on mount)
 * - No useEffect on load (prevents "Authenticating..." freeze)
 * - On submit:
 *    1) supabase.auth.signInWithPassword
 *    2) RPC: get_admin_by_auth_id(auth_user_id)
 *    3) On success -> HARD REDIRECT to /admindash
 *    4) On failure -> signOut + error
 */

export default function AdminLogin() {
  console.log("[AdminLogin] v2.2 loaded");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      console.log("[AdminLogin] Attempting admin login for:", email);

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      console.log("[AdminLogin] Auth response:", { authData, authError });

      if (authError) {
        console.error("[AdminLogin] Auth error:", authError);
        setErrorMsg("Invalid admin credentials");
        toast.error("Invalid admin credentials");
        setIsLoading(false);
        return;
      }

      const userId = authData?.session?.user?.id;
      if (!userId) {
        console.error("[AdminLogin] No session/user id returned");
        setErrorMsg("Authentication failed");
        toast.error("Authentication failed");
        setIsLoading(false);
        return;
      }

      console.log("[AdminLogin] Verifying admin via RPC for:", userId);
      const { data: adminData, error: adminError } = await supabase.rpc(
        "get_admin_by_auth_id",
        { auth_user_id: userId }
      );

      if (adminError) {
        console.error("[AdminLogin] RPC error:", adminError);
        await supabase.auth.signOut();
        setErrorMsg("Access denied - not an admin user");
        toast.error("Access denied - not an admin user");
        setIsLoading(false);
        return;
      }

      const row = Array.isArray(adminData) ? adminData[0] : adminData;
      if (!row) {
        console.warn("[AdminLogin] RPC returned no admin row");
        await supabase.auth.signOut();
        setErrorMsg("Access denied - not an admin user");
        toast.error("Access denied - not an admin user");
        setIsLoading(false);
        return;
      }

      console.log("[AdminLogin] Admin verified:", row);
      
      // Store admin session in localStorage
      const adminSession = {
        admin_id: row.admin_id,
        email: row.email,
        full_name: row.full_name,
        role: row.role,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };
      localStorage.setItem('admin_session', JSON.stringify(adminSession));
      console.log("[AdminLogin] Admin session stored:", adminSession);
      
      toast.success("Admin login successful");

      // HARD redirect; cache-buster avoids stale SW bundles
      window.location.replace('/admindash?ts=' + Date.now());
      return;
    } catch (err) {
      console.error("[AdminLogin] Exception:", err);
      setErrorMsg("Login failed. Please try again.");
      toast.error("Login failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-slate-800 rounded-lg shadow-xl p-8 border border-slate-700">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-full mb-4">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Access</h1>
            <p className="text-slate-400 mt-2">Authorized personnel only</p>

            {errorMsg && (
              <div className="mt-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md p-3">
                {errorMsg}
              </div>
            )}
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">
                Admin Email
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <Input
                  id="email"
                  placeholder="admin@tmw.qa"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 py-3 bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-red-500 focus:ring-red-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                Password
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter admin password"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 py-3 bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-red-500 focus:ring-red-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-slate-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium"
              disabled={isLoading}
            >
              {isLoading ? "Authenticating..." : "Access Admin Panel"}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            This is a restricted area. All access attempts are logged.
          </div>
        </div>
      </motion.div>
    </div>
  );
}
