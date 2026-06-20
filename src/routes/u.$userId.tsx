import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Star, Award, ShoppingBag, MessageSquare, Trophy, Sparkles, Shield, Flame, User as UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/u/$userId")({
  component: PublicProfilePage,
});

interface Stats {
  orders_count: number;
  total_spent_dzd: number;
  reviews_count: number;
  score: number;
}

function tier(score: number) {
  if (score >= 500) return { label: "Legend", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/40", icon: Trophy };
  if (score >= 200) return { label: "Expert", color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/40", icon: Sparkles };
  if (score >= 80) return { label: "Trusted", color: "text-primary", bg: "bg-primary/10", border: "border-primary/40", icon: Shield };
  if (score >= 20) return { label: "Active", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/40", icon: Flame };
  return { label: "Newcomer", color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border", icon: UserIcon };
}

function badges(stats: Stats) {
  const list: { label: string; icon: any }[] = [];
  if (stats.orders_count >= 1) list.push({ label: "First order", icon: ShoppingBag });
  if (stats.orders_count >= 5) list.push({ label: "Repeat customer", icon: Flame });
  if (stats.orders_count >= 20) list.push({ label: "VIP customer", icon: Trophy });
  if (stats.reviews_count >= 1) list.push({ label: "Reviewer", icon: Star });
  if (stats.reviews_count >= 10) list.push({ label: "Pro critic", icon: Award });
  if (stats.total_spent_dzd >= 50000) list.push({ label: "Big spender", icon: Sparkles });
  return list;
}

function PublicProfilePage() {
  const { t } = useTranslation();
  const { userId } = Route.useParams();

  const { data: profile, isLoading: pl } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_profile", { _user_id: userId });
      return (data as any)?.[0] ?? null;
    },
  });

  const { data: stats } = useQuery<Stats | null>({
    queryKey: ["public-stats", userId],
    queryFn: async () => {
      const { data } = await supabase.rpc("user_public_stats", { _user_id: userId });
      return (data as any)?.[0] ?? null;
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["public-reviews", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select("id, rating, comment, suggestions, created_at, product_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const profileTier = tier(stats?.score ?? 0);
  const TierIcon = profileTier.icon;
  const userBadges = stats ? badges(stats) : [];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        {pl ? (
          <p className="font-mono-label text-muted-foreground">{t("Loading…")}</p>
        ) : !profile ? (
          <p className="font-mono-label text-muted-foreground">{t("User not found")}</p>
        ) : (
          <>
            <div className={`border ${profileTier.border} ${profileTier.bg} rounded-lg p-8`}>
              <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/40 to-primary/5 border border-border grid place-items-center shrink-0">
                  <UserIcon className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-3xl truncate">{profile.full_name || t("Customer")}</h1>
                  <p className="font-mono-label text-muted-foreground mt-1">
                    {t("Member since")} {new Date(profile.created_at).toLocaleDateString()}
                  </p>
                  <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full ${profileTier.bg} border ${profileTier.border}`}>
                    <TierIcon className={`w-3.5 h-3.5 ${profileTier.color}`} />
                    <span className={`font-mono-label ${profileTier.color}`}>{t(profileTier.label)}</span>
                    <span className="font-mono text-xs text-muted-foreground">· {stats?.score ?? 0} {t("points")}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-6">
                <Stat icon={ShoppingBag} label={t("Orders")} value={stats?.orders_count ?? 0} />
                <Stat icon={MessageSquare} label={t("reviews")} value={stats?.reviews_count ?? 0} />
                <Stat icon={Sparkles} label={t("Spend DA")} value={Math.round(Number(stats?.total_spent_dzd ?? 0))} />
              </div>
            </div>

            {userBadges.length > 0 && (
              <section className="mt-6">
                <p className="font-mono-label text-muted-foreground mb-3">{t("Achievements")}</p>
                <div className="flex flex-wrap gap-2">
                  {userBadges.map((b) => {
                    const Ic = b.icon;
                    return (
                      <span key={b.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-surface rounded-full font-mono-label text-xs">
                        <Ic className="w-3.5 h-3.5 text-primary" />
                        {t(b.label)}
                      </span>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="font-display text-xl mb-4">{t("Recent reviews")}</h2>
              {reviews.length === 0 ? (
                <p className="font-mono-label text-muted-foreground">{t("No reviews yet")}</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r: any) => (
                    <div key={r.id} className="border border-border bg-surface p-4 rounded">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                          ))}
                        </div>
                        <span className="font-mono-label text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Link to="/" className="inline-block mt-8 font-mono-label text-muted-foreground hover:text-primary">{t("← Home")}</Link>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Stat({ icon: Ic, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="border border-border bg-background/50 rounded p-3 text-center">
      <Ic className="w-4 h-4 text-primary mx-auto mb-1" />
      <div className="font-display text-lg">{value.toLocaleString()}</div>
      <div className="font-mono-label text-muted-foreground text-[10px]">{label}</div>
    </div>
  );
}
