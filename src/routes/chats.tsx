import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MessageCircle, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/chats")({
  component: ChatsListPage,
});

function ChatsListPage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: orders = [] } = useQuery({
    queryKey: ["my-chats", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, created_at, products(name, main_image)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <p className="font-mono-label text-muted-foreground mb-3">{t("Conversations")}</p>
        <h1 className="font-display text-4xl mb-8">{t("My chats")}</h1>

        {orders.length === 0 ? (
          <div className="border border-border bg-surface rounded-lg p-12 text-center">
            <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("No chats yet. Start by ordering a product.")}</p>
            <Link to="/shop" className="inline-block mt-6 rounded-full bg-primary text-primary-foreground px-6 py-2.5 font-mono-label">
              {t("Browse the shop")}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border border border-border bg-surface rounded-lg overflow-hidden">
            {orders.map((o: any) => (
              <li key={o.id}>
                <Link
                  to="/orders/$orderId/chat"
                  params={{ orderId: o.id }}
                  className="flex items-center gap-4 p-4 hover:bg-surface-elevated transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border border-border grid place-items-center overflow-hidden shrink-0">
                    {o.products?.main_image ? (
                      <img src={o.products.main_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <MessageCircle className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display truncate">{o.products?.name ?? "Order"}</p>
                    <p className="font-mono-label text-muted-foreground truncate">
                      {o.order_number} · {o.status}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
