import { createFileRoute, Outlet, Link, Navigate } from "@tanstack/react-router";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAuth } from "@/hooks/use-auth";
import { ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function useAdminRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "order"] });
      qc.invalidateQueries({ queryKey: ["admin", "receipts"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
    };
    const channel = supabase
      .channel("admin-orders-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_receipts" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  useAdminRealtime();
  const DEV_BYPASS = true; // TODO: remove before production

  if (!DEV_BYPASS && loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <p className="font-mono-label text-muted-foreground animate-pulse">Verifying access…</p>
      </div>
    );
  }

  if (!DEV_BYPASS && !user) {
    return <Navigate to="/auth" />;
  }

  if (!DEV_BYPASS && !isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-6">
        <div className="max-w-md text-center">
          <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-6" />
          <p className="font-mono-label text-muted-foreground mb-3">403 — Restricted</p>
          <h1 className="font-display text-4xl">
            Admins <span className="italic text-primary">only.</span>
          </h1>
          <p className="text-muted-foreground mt-4">
            Your account doesn't have admin privileges. Ask the workspace owner to grant you the admin role.
          </p>
          <Link to="/" className="inline-block mt-8 font-mono-label text-primary hover:underline">
            ← Back to storefront
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
