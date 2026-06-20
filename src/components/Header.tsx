import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "./Logo";
import { LanguageSwitch } from "./LanguageSwitch";
import { Search, ShoppingBag, User, MessageCircle, X, Sun, Moon } from "lucide-react";
import { useCatalogProducts } from "@/lib/catalog-data";
import { gradientFromName, letterFromName } from "@/lib/product-visual";
import { useTheme } from "@/hooks/use-theme";

export function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: products = [] } = useCatalogProducts();
  const { theme, toggleTheme } = useTheme();

  const NAV = [
    { label: t("Shop"), to: "/shop" as const },
    { label: t("Categories"), to: "/categories" as const },
    { label: t("How it works"), to: "/how-it-works" as const },
    { label: t("Support"), to: "/support" as const },
  ];

  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const compact = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

  const suggestions = useMemo(() => {
    const term = norm(q);
    const termC = compact(q);
    if (!term || !products.length) return [];
    const scored = products
      .map((p) => {
        const name = norm(p.name);
        const nameC = compact(p.name);
        const cat = norm(p.categories?.name ?? "");
        const catC = compact(p.categories?.name ?? "");
        const fam = norm(p.family ?? "");
        const famC = compact(p.family ?? "");
        const desc = norm(p.short_description ?? "");
        let score = 0;
        if (nameC.startsWith(termC)) score = 100;
        else if (nameC.includes(termC)) score = 80;
        else if (name.includes(term)) score = 70;
        else if (famC.includes(termC) || fam.includes(term)) score = 50;
        else if (catC.includes(termC) || cat.includes(term)) score = 30;
        else if (desc.includes(term)) score = 15;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    return scored.map((x) => x.p);
  }, [q, products]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/shop", search: { q: q.trim() } });
    setSearchOpen(false);
    setQ("");
  };

  const goToProduct = (slug: string) => {
    navigate({ to: "/product/$slug", params: { slug } });
    setSearchOpen(false);
    setQ("");
  };

  return (
    <header className="sticky top-0 z-50 px-3 pt-3">
      <div className="max-w-7xl mx-auto glass rounded-2xl h-14 px-4 flex items-center justify-between shadow-soft">
        <Logo />
        {!searchOpen && (
          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="px-4 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                activeProps={{ className: "px-4 py-1.5 rounded-full text-sm text-foreground bg-foreground/10" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        {searchOpen && (
          <div className="absolute left-1/2 -translate-x-1/2 w-[min(420px,60vw)] z-[60]">
            <form
              onSubmit={submit}
              className="flex items-center gap-2 bg-background/80 border border-border rounded-full px-4 py-1.5"
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("Search") + "…"}
                className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
              />
              <button type="button" onClick={() => { setSearchOpen(false); setQ(""); }} aria-label={t("Close")}>
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </form>
            {q.trim() && (
              <div className="mt-2 bg-background/95 backdrop-blur border border-border rounded-xl shadow-soft overflow-hidden">
                {suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-muted-foreground font-mono-label">
                    {t("No results")}
                  </div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {suggestions.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => goToProduct(p.slug)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-start hover:bg-foreground/5 transition-colors"
                        >
                          <div
                            className="w-9 h-9 rounded-md overflow-hidden flex items-center justify-center shrink-0"
                            style={{ background: gradientFromName(p.name) }}
                          >
                            {p.main_image ? (
                              <img src={p.main_image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-display text-lg italic text-foreground/90">
                                {letterFromName(p.name)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm truncate">{p.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono-label truncate">
                              {p.categories?.name ?? "—"}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        onClick={submit}
                        className="w-full px-3 py-2 text-center text-xs font-mono-label text-primary hover:bg-primary/10 border-t border-border"
                      >
                        {t("See all results")} →
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <LanguageSwitch />
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
            aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
            aria-label={t("Search")}
          >
            <Search className="w-4 h-4" />
          </button>
          <Link to="/cart" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all" aria-label={t("Cart")}>
            <ShoppingBag className="w-4 h-4" />
          </Link>
          <Link to="/chats" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all" aria-label={t("Chats")}>
            <MessageCircle className="w-4 h-4" />
          </Link>
          <Link to="/profile" className="ml-1 p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all" aria-label={t("Profile")}>
            <User className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
