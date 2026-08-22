import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Owner Admin Portal — SAATVIK ANNA FOODS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRouteComponent,
});

function AdminRouteComponent() {
  const [admin, setAdmin] = useState<{ id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/.netlify/functions/admin-auth?action=verify");
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.authenticated && data.admin) {
          setAdmin(data.admin);
        } else {
          setAdmin(null);
        }
      } catch {
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/.netlify/functions/admin-auth?action=logout", { method: "POST" });
    } catch {}
    setAdmin(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Loading Admin Portal...
          </p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return <AdminLogin onLoginSuccess={(adminData) => setAdmin(adminData)} />;
  }

  return <AdminDashboard admin={admin} onLogout={handleLogout} />;
}

