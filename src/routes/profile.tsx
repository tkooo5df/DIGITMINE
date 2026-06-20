import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { LogOut, User as UserIcon, ShoppingBag, MessageCircle, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, country, created_at")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const { data: ordersCount = 0 } = useQuery({
    queryKey: ["profile-orders-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("Profile saved"));
    refetch();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <p className="font-mono-label text-muted-foreground mb-3">{t("Account")}</p>
        <h1 className="font-display text-4xl mb-8">{t("My profile")}</h1>

        <div className="border border-border bg-surface rounded-lg p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border border-border grid place-items-center">
              <UserIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-xl truncate">{fullName || user.email}</p>
              <p className="font-mono-label text-muted-foreground truncate">{user.email}</p>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 mt-1 font-mono-label text-primary">
                  <Shield className="w-3 h-3" /> Admin
                </span>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono-label text-muted-foreground">{t("Full name")}</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full mt-2 bg-background border border-border rounded-md px-4 py-2.5 text-sm focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="font-mono-label text-muted-foreground">{t("Phone")}</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full mt-2 bg-background border border-border rounded-md px-4 py-2.5 text-sm focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-primary text-primary-foreground px-6 py-2.5 font-mono-label hover:shadow-glow transition-all disabled:opacity-50"
            >
              {saving ? "…" : t("Save")}
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 font-mono-label text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-3.5 h-3.5" /> {t("Sign out")}
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          <Link to="/chats" className="border border-border bg-surface rounded-lg p-5 hover:border-primary/40 transition-colors flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-primary" />
            <div>
              <p className="font-display">{t("My chats")}</p>
              <p className="font-mono-label text-muted-foreground">{t("Talk with support")}</p>
            </div>
          </Link>
          <Link to="/chats" className="border border-border bg-surface rounded-lg p-5 hover:border-primary/40 transition-colors flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <div>
              <p className="font-display">{t("My orders")}</p>
              <p className="font-mono-label text-muted-foreground">{ordersCount} {t("total")}</p>
            </div>
          </Link>
        </div>

        {isAdmin && (
          <Link to="/admin" className="block mt-3 border border-primary/40 bg-primary/5 rounded-lg p-5 hover:bg-primary/10 transition-colors">
            <p className="font-display text-primary">{t("Open admin panel →")}</p>
          </Link>
        )}
      </main>
      <Footer />
    </div>
  );
}
