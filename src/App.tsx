import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { AppStoreBanner } from "@/components/AppStoreBanner";
import AdminRouter from "@/routes/AdminRouter";
import ConsumerRouter from "@/routes/ConsumerRouter";

import "./App.css";

const ProjectPreview = lazy(() => import("@/pages/ProjectPreview"));

const queryClient = new QueryClient();

// Synchronously tag body for admin pages BEFORE first render so CSS works immediately
const _adminPaths = ['/admindash', '/admin/', '/admin-setup', '/admin-settings', '/mqtr'];
if (_adminPaths.some(p => window.location.pathname.startsWith(p))) {
  document.body.classList.add('admin-page');
}

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

// Detect admin path so we only mount the admin router tree
function isAdminPath(): boolean {
  return _adminPaths.some(p => window.location.pathname.startsWith(p));
}

const detectedSubdomain = getSubdomain();
const adminPath = isAdminPath();

function App() {
  // Subdomain project preview — completely isolated
  if (detectedSubdomain) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Suspense fallback={null}>
            <ProjectPreview subdomain={detectedSubdomain} />
          </Suspense>
          <SpeedInsights />
          <Analytics />
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  // Admin path — only mount admin providers + admin router
  if (adminPath) {
    return (
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
    );
  }

  // Consumer app — normal users
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <BrowserRouter>
              <div className="bg-background font-sans antialiased">
                <ConsumerRouter />
                <AppStoreBanner position="bottom" dismissible={true} />
              </div>
            </BrowserRouter>
          </AuthProvider>
          <Toaster />
          <SpeedInsights />
          <Analytics />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;