import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import AdminRoute from "@/components/auth/AdminRoute";

const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminSetup = lazy(() => import("@/pages/AdminSetup"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const AdminMessages = lazy(() => import("@/pages/AdminMessages"));
const AdminSubscriptions = lazy(() => import("@/pages/AdminSubscriptions"));
const AdminQuotas = lazy(() => import("@/pages/AdminQuotas"));
const AdminAnalytics = lazy(() => import("@/pages/AdminAnalytics"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const AdminAuditLog = lazy(() => import("@/pages/AdminAuditLog"));
const AdminAIUsage = lazy(() => import("@/pages/AdminAIUsage"));

function AdminFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AdminRouter() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Routes>
        <Route path="/mqtr" element={<AdminLogin />} />
        <Route path="/admin-setup" element={<AdminRoute><AdminSetup /></AdminRoute>} />
        <Route path="/admindash" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/messages" element={<AdminRoute><AdminMessages /></AdminRoute>} />
        <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
        <Route path="/admin/quotas" element={<AdminRoute><AdminQuotas /></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
        <Route path="/admin/audit-log" element={<AdminRoute><AdminAuditLog /></AdminRoute>} />
        <Route path="/admin/ai-usage" element={<AdminRoute><AdminAIUsage /></AdminRoute>} />
        <Route path="/admin-settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
      </Routes>
    </Suspense>
  );
}
