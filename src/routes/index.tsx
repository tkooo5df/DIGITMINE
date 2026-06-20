import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Ticker } from "@/components/Ticker";
import { ProductCard } from "@/components/ProductCard";
import { TrendingCarousel } from "@/components/TrendingCarousel";
import { AdBanner } from "@/components/AdBanner";
import { lowestDzd, useCatalogProducts } from "@/lib/catalog-data";
import { ArrowRight, ShieldCheck, Zap, MessageSquare, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t } = useTranslation();
  const { data: products = [] } = useCatalogProducts();
  const featured = products;
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const goSearch = (term: string) => {
    navigate({ to: "/shop", search: { q: term.trim() } });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    goSearch(q);
  };

  const suggestions = ["Netflix", "ChatGPT", "Spotify", "Steam", "IPTV", "Adobe"];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(to right, color-mix(in oklab, var(--foreground) 30%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 30%, transparent) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
            }}
          />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 sm:pt-32 pb-20 sm:pb-28 relative">
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-6">
              DIGITMINE · {t("Digital marketplace")}
            </p>

            <h1 className="text-center font-display text-4xl sm:text-6xl md:text-7xl leading-[1.02] tracking-tight">
              {t("Digital goods,")}<br />
              <span className="italic text-primary">{t("delivered in minutes.")}</span>
            </h1>

            <p className="mt-6 text-center max-w-xl mx-auto text-muted-foreground text-sm sm:text-base leading-relaxed">
              {t("Streaming, AI, music, gaming, IPTV and software — paid in dinars, delivered in minutes.")}
            </p>

            {/* Search */}
            <form onSubmit={submit} className="mt-10 mx-auto max-w-xl">
              <div className="flex items-center gap-2 bg-background border border-border rounded-full px-4 py-2 focus-within:border-primary transition-colors">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("Search Netflix, ChatGPT, Spotify…")}
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {t("Search")}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => goSearch(s)}
                    className="font-mono text-[11px] px-3 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </section>

        <AdBanner />

        <TrendingCarousel />

        <Ticker />

        {/* Featured */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="flex items-end justify-between mb-8 sm:mb-12 gap-4">
            <div>
              <p className="font-mono text-muted-foreground mb-2 text-[10px] sm:text-xs uppercase tracking-wider">
                {t("The Edit")}
              </p>
              <h2 className="font-display text-2xl sm:text-4xl md:text-5xl">
                {t("This week's")} <span className="italic text-primary">{t("picks.")}</span>
              </h2>
            </div>
            <Link to="/shop" className="font-mono text-muted-foreground hover:text-primary group inline-flex items-center gap-1.5 shrink-0 text-xs">
              {t("View all")} <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {featured.map((p) => (
              <ProductCard
                key={p.slug}
                name={p.name}
                category={p.categories?.name ?? t("Digital")}
                priceDzd={lowestDzd(p.product_offers)}
                slug={p.slug}
                image={p.main_image}
                offers={p.product_offers}
              />
            ))}
          </div>
        </section>

        {/* Values */}
        <section className="border-t border-border bg-surface">
          <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-6">
            <Value
              icon={<ShieldCheck className="w-5 h-5 text-primary" />}
              kicker={`01 — ${t("Trust")}`}
              title={t("Manually verified")}
              body={t("Every receipt is reviewed by a human. No leaked accounts, no shared chaos.")}
            />
            <Value
              icon={<Zap className="w-5 h-5 text-primary" />}
              kicker={`02 — ${t("Speed")}`}
              title={t("Minutes, not hours")}
              body={t("Auto-delivery for in-stock items. Manual orders shipped within minutes after verification.")}
            />
            <Value
              icon={<MessageSquare className="w-5 h-5 text-primary" />}
              kicker={`03 — ${t("Conversation")}`}
              title={t("Real-time chat")}
              body={t("Talk to the team inside every order. In Arabic, French or English.")}
            />
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-5xl mx-auto px-6 py-24 sm:py-32 text-center">
          <h2 className="font-display text-4xl sm:text-6xl leading-[1.02]">
            {t("Open the vault.")}<br />
            <span className="italic text-primary">{t("Pick something good.")}</span>
          </h2>
          <Link
            to="/shop"
            className="group mt-10 inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            {t("Enter the shop")}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Value({ icon, kicker, title, body }: { icon: React.ReactNode; kicker: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl p-6 bg-background border border-border">
      <div className="mb-5 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10">{icon}</div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-3">{kicker}</p>
      <h3 className="font-display text-2xl mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed text-sm">{body}</p>
    </div>
  );
}
