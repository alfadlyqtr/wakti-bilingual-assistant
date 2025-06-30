
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { Logo3D } from "@/components/Logo3D";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { language } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (error: any) {
      console.error("Login error:", error);
      setError(error.message || t("loginError", language));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <Logo3D size="lg" />
          </div>
          <CardTitle className="text-2xl text-center">
            {t("signIn", language)}
          </CardTitle>
          <CardDescription className="text-center">
            {t("signInDescription", language)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email", language)}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder", language)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password", language)}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("passwordPlaceholder", language)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t("signingIn", language) : t("signIn", language)}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            <Link
              to="/forgot-password"
              className="text-sm text-muted-foreground hover:text-primary underline"
            >
              {t("forgotPassword", language)}
            </Link>
            <div className="text-sm text-muted-foreground">
              {t("noAccount", language)}{" "}
              <Link to="/signup" className="text-primary hover:underline">
                {t("signUp", language)}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
