import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { AppStoreBanner } from "@/components/AppStoreBanner";
import AdminRouter from "@/routes/AdminRouter";
import ConsumerRouter from "@/routes/ConsumerRouter";
import { ColorBlindFilters } from "@/components/accessibility/ColorBlindFilters";
import ErrorBoundary from "@/components/ErrorBoundary";

import "./App.css";

const ProjectPreview = lazy(() => import("@/pages/ProjectPreview"));

const queryClient = new QueryClient();

// Item #8 Medium #5+#6: Side-effects that used to live at module scope here
// (color-blind filter, text size, admin body class) are now consolidated with
// the main.tsx monkey-patches in src/bootstrap/preRender.ts and invoked by
// main.tsx before React mounts. Leaves this file purely declarative.

// Detect user project subdomains (e.g. mozi.wakti.ai or mozi.wakti.qa)
function getSubdomain(): string | null {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  const parts = hostname.split('.');
  for (const tld of ['ai', 'qa']) {
    if (
      parts.length >= 3 &&
      parts[parts.length - 2] === 'wakti' &&
      parts[parts.length - 1] === tld
    ) {
      const sub = parts.slice(0, -2).join('.');
      if (sub && !['www', 'app', 'api'].includes(sub)) return sub;
    }
  }
  return null;
}

// Detect admin path so we only mount the admin router tree.
// Note: preRender.ts uses the same list for tagging <body class="admin-page">.
function isAdminPath(): boolean {
  const adminPaths = ['/admindash', '/admin/', '/admin-setup', '/admin-settings', '/mqtr'];
  return adminPaths.some(p => window.location.pathname.startsWith(p));
}

const detectedSubdomain = getSubdomain();
const adminPath = isAdminPath();

function App() {
  // Subdomain project preview — completely isolated
  if (detectedSubdomain) {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Suspense fallback={null}>
              <ProjectPreview subdomain={detectedSubdomain} />
            </Suspense>
            <SpeedInsights />
            <Analytics />
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }

  // Admin path — only mount admin providers + admin router
  if (adminPath) {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <BrowserRouter>
                <AdminRouter />
              </BrowserRouter>
            </AuthProvider>
            <Toaster />
            <SpeedInsights />
            <Analytics />
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }

  // Consumer app — normal users
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <UserProfileProvider>
                <BrowserRouter>
                  <ColorBlindFilters />
                  <div className="bg-background font-sans antialiased">
                    <ConsumerRouter />
                    <AppStoreBanner position="bottom" dismissible={true} />
                  </div>
                </BrowserRouter>
              </UserProfileProvider>
            </AuthProvider>
            <Toaster />
            <SpeedInsights />
            <Analytics />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;