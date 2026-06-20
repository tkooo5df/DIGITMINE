import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Star, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { normalizeReviewSuggestion } from "@/lib/review-suggestions";

export function ProductReviews({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const { data: reviews = [] } = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select("id, rating, comment, suggestions, created_at, user_id")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!productId,
  });

  const { data: buyerCount = 0 } = useQuery({
    queryKey: ["product-buyers", productId],
    queryFn: async () => {
      const { data } = await supabase.rpc("product_buyer_count", { _product_id: productId });
      return (data as number) ?? 0;
    },
    enabled: !!productId,
  });

  const userIds = Array.from(new Set(reviews.map((r: any) => r.user_id)));
  const { data: nameMap = {} } = useQuery({
    queryKey: ["reviewer-names", userIds.sort().join(",")],
    queryFn: async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        userIds.map(async (uid) => {
          const { data } = await supabase.rpc("get_public_profile", { _user_id: uid });
          map[uid] = (data as any)?.[0]?.full_name || t("Customer");
        })
      );
      return map;
    },
    enabled: userIds.length > 0,
  });

  const avg = reviews.length
    ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <section className="mt-10 border-t border-border pt-8">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h2 className="font-display text-2xl">{t("Reviews")}</h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-primary text-primary" />
            <span className="font-mono text-primary">{avg.toFixed(1)}</span>
            <span className="font-mono-label text-muted-foreground">({reviews.length})</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 font-mono-label text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span className="font-mono text-foreground">{buyerCount}</span>
          <span>{t(buyerCount === 1 ? "buyer" : "buyers")}</span>
        </div>
      </div>

      {!reviews.length ? (
        <p className="font-mono-label text-muted-foreground">{t("No reviews yet")}</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r: any) => (
            <div key={r.id} className="border border-border bg-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Link
                    to="/u/$userId"
                    params={{ userId: r.user_id }}
                    className="font-display text-sm hover:text-primary transition-colors"
                  >
                    {nameMap[r.user_id] ?? t("Customer")}
                  </Link>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                </div>
                <span className="font-mono-label text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              {r.comment && <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>}
              {r.suggestions?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {r.suggestions.map((s: string) => (
                    <span key={s} className="text-[10px] font-mono-label px-2 py-0.5 border border-border rounded text-muted-foreground">{t(normalizeReviewSuggestion(s))}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
