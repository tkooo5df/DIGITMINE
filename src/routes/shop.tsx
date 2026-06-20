import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Search, X, SlidersHorizontal, ArrowUpDown, Heart, RotateCcw, HelpCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { lowestDzd, useCatalogProducts } from "@/lib/catalog-data";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

const shopSearch = z.object({
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/shop")({
  validateSearch: zodValidator(shopSearch),
  head: () => ({
    meta: [
      { title: "Shop — DIGITMINE" },
      { name: "description", content: "Browse the curated catalogue of digital subscriptions, accounts, gift cards and software keys." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { t } = useTranslation();
  const { data: products = [], isLoading } = useCatalogProducts();
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const { isAdmin } = useAuth();

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedAccountType, setSelectedAccountType] = useState<string>("All");
  const [selectedOfferType, setSelectedOfferType] = useState<string>("All");
  const [selectedDuration, setSelectedDuration] = useState<string>("All");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("All");
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(30000);
  const [sortBy, setSortBy] = useState<string>("default");
  const [showWishlistOnly, setShowWishlistOnly] = useState<boolean>(false);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);
  const [query, setQuery] = useState<string>(q);

  const [wishlist, setWishlist] = useState<string[]>([]);
  const [priceInitialized, setPriceInitialized] = useState(false);

  // Sync with localStorage wishlist
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("wishlist");
      if (stored) setWishlist(JSON.parse(stored));
    }

    const handleWishlistUpdate = () => {
      const stored = localStorage.getItem("wishlist");
      if (stored) setWishlist(JSON.parse(stored));
    };

    window.addEventListener("wishlist-updated", handleWishlistUpdate);
    return () => window.removeEventListener("wishlist-updated", handleWishlistUpdate);
  }, []);

  // Extract Filter Options Dynamically
  const categoryOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(products.map((p) => p.categories?.name).filter(Boolean)))];
  }, [products]);

  const accountTypeOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(products.map((p) => p.account_type).filter(Boolean)))];
  }, [products]);

  const offerTypeOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(products.map((p) => p.offer_type).filter(Boolean)))];
  }, [products]);

  const durationOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(products.flatMap((p) => p.product_offers.map((o) => o.duration)).filter(Boolean)))];
  }, [products]);

  const supplierOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(products.flatMap((p) => p.product_offers.map((o) => o.supplier)).filter(Boolean)))];
  }, [products]);

  // Find min/max DZD prices across loaded products
  const dzdPriceBounds = useMemo(() => {
    const prices = products
      .flatMap((p) => p.product_offers.map((o) => o.price_dzd))
      .filter((price): price is number => price !== null && price !== undefined);
    if (prices.length === 0) return [0, 30000];
    return [Math.min(...prices), Math.ceil(Math.max(...prices))];
  }, [products]);

  // Set initial slider limits
  useEffect(() => {
    if (products.length > 0 && !priceInitialized) {
      setMinPrice(dzdPriceBounds[0]);
      setMaxPrice(dzdPriceBounds[1]);
      setPriceInitialized(true);
    }
  }, [products, dzdPriceBounds, priceInitialized]);

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search Query
    const needle = q.toLowerCase().trim();
    if (needle) {
      result = result.filter((p) => {
        return (
          p.name.toLowerCase().includes(needle) ||
          (p.description ?? "").toLowerCase().includes(needle) ||
          (p.categories?.name ?? "").toLowerCase().includes(needle) ||
          (isAdmin && p.product_offers.some((o) => (o.supplier ?? "").toLowerCase().includes(needle)))
        );
      });
    }

    // Category
    if (selectedCategory !== "All") {
      result = result.filter((p) => p.categories?.name === selectedCategory);
    }

    // Account Type
    if (selectedAccountType !== "All") {
      result = result.filter((p) => p.account_type === selectedAccountType);
    }

    // Offer Type
    if (selectedOfferType !== "All") {
      result = result.filter((p) => p.offer_type === selectedOfferType);
    }

    // Duration
    if (selectedDuration !== "All") {
      result = result.filter((p) => p.product_offers.some((o) => o.duration === selectedDuration));
    }

    // Supplier
    if (selectedSupplier !== "All") {
      result = result.filter((p) => p.product_offers.some((o) => o.supplier === selectedSupplier));
    }

    // Price Range (DZD)
    result = result.filter((p) => {
      const offerPrice = lowestDzd(p.product_offers) ?? 0;
      return offerPrice >= minPrice && offerPrice <= maxPrice;
    });

    // Wishlist
    if (showWishlistOnly) {
      result = result.filter((p) => wishlist.includes(p.slug));
    }

    // Sorting
    if (sortBy === "price-asc") {
      result.sort((a, b) => (lowestDzd(a.product_offers) ?? 0) - (lowestDzd(b.product_offers) ?? 0));
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => (lowestDzd(b.product_offers) ?? 0) - (lowestDzd(a.product_offers) ?? 0));
    } else if (sortBy === "rating") {
      result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sortBy === "sales") {
      result.sort((a, b) => (b.sales_count ?? 0) - (a.sales_count ?? 0));
    }

    return result;
  }, [products, q, selectedCategory, selectedAccountType, selectedOfferType, selectedDuration, selectedSupplier, minPrice, maxPrice, showWishlistOnly, wishlist, sortBy, isAdmin]);

  const handleResetFilters = () => {
    setSelectedCategory("All");
    setSelectedAccountType("All");
    setSelectedOfferType("All");
    setSelectedDuration("All");
    setSelectedSupplier("All");
    setMinPrice(dzdPriceBounds[0]);
    setMaxPrice(dzdPriceBounds[1]);
    setSortBy("default");
    setShowWishlistOnly(false);
    setQuery("");
    navigate({ search: { q: "" } });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== "All") count++;
    if (selectedAccountType !== "All") count++;
    if (selectedOfferType !== "All") count++;
    if (selectedDuration !== "All") count++;
    if (selectedSupplier !== "All") count++;
    if (showWishlistOnly) count++;
    if (minPrice > dzdPriceBounds[0] || maxPrice < dzdPriceBounds[1]) count++;
    return count;
  }, [selectedCategory, selectedAccountType, selectedOfferType, selectedDuration, selectedSupplier, showWishlistOnly, minPrice, maxPrice, dzdPriceBounds]);

  // Sidebar Filter Component Markup
  const filtersSidebar = (
    <div className="space-y-6">
      {/* Title & Reset */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span>{t("Filters")}</span>
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-mono flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 font-mono-label text-[10px] text-muted-foreground hover:text-primary transition-colors duration-300"
          >
            <RotateCcw className="w-3 h-3 transition-transform hover:-rotate-45" />
            <span>{t("Clear")}</span>
          </button>
        )}
      </div>

      {/* Wishlist Toggle */}
      <div className="flex items-center justify-between p-3 border border-border/40 bg-surface/50 rounded-lg hover:border-primary/20 transition-all duration-300">
        <label htmlFor="wishlist-toggle" className="flex items-center gap-2 font-mono-label text-xs text-foreground cursor-pointer select-none">
          <Heart className={`w-3.5 h-3.5 ${showWishlistOnly ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          <span>{t("Wishlist Only")}</span>
        </label>
        <button
          id="wishlist-toggle"
          onClick={() => setShowWishlistOnly(!showWishlistOnly)}
          className={`w-9 h-5 rounded-full transition-colors duration-300 ${showWishlistOnly ? "bg-primary" : "bg-border"}`}
        >
          <span className={`block w-4 h-4 bg-background rounded-full transition-transform duration-300 ${showWishlistOnly ? "translate-x-4.5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {/* Category Accordion */}
      <div className="space-y-2">
        <label className="font-mono-label text-xs text-muted-foreground block">{t("Category")}</label>
        <div className="flex flex-col gap-1">
          {categoryOptions.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-start px-3 py-1.5 rounded font-mono text-xs transition-colors duration-300 ${
                selectedCategory === cat
                  ? "bg-primary/10 border-l-2 border-primary text-primary font-bold"
                  : "text-muted-foreground hover:bg-surface/50 hover:text-foreground"
              }`}
            >
              {cat === "All" ? t("All Categories") : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Account Type Selector */}
      <div className="space-y-2">
        <label className="font-mono-label text-xs text-muted-foreground block">{t("Account Type")}</label>
        <div className="grid grid-cols-2 gap-1.5">
          {accountTypeOptions.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedAccountType(type)}
              className={`px-2 py-1.5 border rounded text-center font-mono text-[10px] transition-all duration-300 ${
                selectedAccountType === type
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border/60 text-muted-foreground hover:border-primary/45 hover:text-foreground"
              }`}
            >
              {type === "All" ? t("All Types") : type}
            </button>
          ))}
        </div>
      </div>

      {/* Offer Type Selector */}
      <div className="space-y-2">
        <label className="font-mono-label text-xs text-muted-foreground block">{t("Offer Type")}</label>
        <div className="flex flex-wrap gap-1">
          {offerTypeOptions.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedOfferType(type)}
              className={`px-2 py-1 border rounded font-mono text-[9px] transition-all duration-300 ${
                selectedOfferType === type
                  ? "border-primary bg-primary/10 text-primary font-bold"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {type === "All" ? t("All Offers") : type}
            </button>
          ))}
        </div>
      </div>

      {/* Duration Selector */}
      <div className="space-y-2">
        <label className="font-mono-label text-xs text-muted-foreground block">{t("Duration")}</label>
        <select
          value={selectedDuration}
          onChange={(e) => setSelectedDuration(e.target.value)}
          className="w-full bg-surface border border-border/60 rounded px-2 py-1.5 font-mono text-xs text-foreground focus:border-primary outline-none"
        >
          <option value="All">{t("All Durations")}</option>
          {durationOptions.filter(d => d !== "All").map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Supplier Selector */}
      {isAdmin && (
        <div className="space-y-2">
          <label className="font-mono-label text-xs text-muted-foreground block">{t("Supplier")}</label>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="w-full bg-surface border border-border/60 rounded px-2 py-1.5 font-mono text-xs text-foreground focus:border-primary outline-none"
          >
            <option value="All">{t("All Suppliers")}</option>
            {supplierOptions.filter(s => s !== "All").map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {/* Price Range Slider (DZD) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between font-mono-label text-xs text-muted-foreground">
          <span>نطاق السعر (بالدينار)</span>
          <span className="text-emerald-400 font-bold font-sans">{minPrice.toFixed(0)} DA - {maxPrice.toFixed(0)} DA</span>
        </div>
        <div className="space-y-2">
          <input
            type="range"
            min={dzdPriceBounds[0]}
            max={dzdPriceBounds[1]}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full accent-primary h-1 bg-border rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>{dzdPriceBounds[0].toFixed(0)} DA</span>
            <span>{dzdPriceBounds[1].toFixed(0)} DA</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      
      {/* Hero Header */}
      <div className="relative border-b border-border/30 bg-mesh py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
          <p className="font-mono-label text-primary text-[10px] sm:text-xs">
            {t("digitmine - your first choice for digital products")}
          </p>
          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl mt-2 tracking-tight">
            {q.trim().length > 0 ? (
              <>{t("Results for")} <span className="italic text-primary">"{q}"</span></>
            ) : (
              <>{t("Digital Premium")} <span className="italic text-primary">{t("Vault.")}</span></>
            )}
          </h1>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
        {/* Sorting, Mobile Filter Trigger, Search Bar Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ search: { q: query.trim() } });
            }}
            className="flex items-center gap-2 bg-surface border border-border/60 hover:border-primary/30 rounded px-4 py-2.5 flex-1 max-w-xl transition-all duration-300"
          >
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search by title, category, supplier…")}
              className="bg-transparent outline-none text-xs sm:text-sm flex-1 placeholder:text-muted-foreground/80 text-foreground"
            />
            {(query || q) && (
              <button
                type="button"
                onClick={() => { setQuery(""); navigate({ search: { q: "" } }); }}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t("Clear")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-2.5 justify-between md:justify-end">
            {/* Mobile Filters Button */}
            <button
              onClick={() => setShowMobileFilters(true)}
              className="lg:hidden flex items-center gap-2 px-4 py-2.5 border border-border/60 bg-surface rounded text-xs text-foreground font-mono-label hover:border-primary/50 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              <span>{t("Filters")}</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-mono flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-surface border border-border/60 rounded px-3 py-2.5 font-mono text-xs text-foreground focus:border-primary outline-none min-w-[140px]"
              >
                <option value="default">{t("Sort by: Featured")}</option>
                <option value="price-asc">{t("Price: Low to High")}</option>
                <option value="price-desc">{t("Price: High to Low")}</option>
                <option value="sales">{t("Top Sellers")}</option>
                <option value="rating">{t("Highest Rated")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Grid & Filters Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Left Filters Panel */}
          <aside className="hidden lg:block lg:col-span-1 border border-border/40 bg-surface/30 p-5 rounded-xl self-start h-fit glass">
            {filtersSidebar}
          </aside>

          {/* Right Cards list */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex justify-between items-center text-xs font-mono text-muted-foreground pb-2">
              <span>{t("Showing {{count}} of {{total}} offers", { count: filteredProducts.length, total: products.length })}</span>
            </div>

            {isLoading && (
              <div className="py-24 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground font-mono text-xs">{t("Loading catalog…")}</p>
              </div>
            )}

            {!isLoading && filteredProducts.length === 0 && (
              <div className="border border-border/30 bg-surface/10 rounded-xl p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto">
                <HelpCircle className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-display text-lg font-semibold mb-2">{t("No matches found")}</h3>
                <p className="text-muted-foreground font-mono text-xs mb-6">
                  {t("Try clearing search or adjusting your filters bounds.")}
                </p>
                <button
                  onClick={handleResetFilters}
                  className="font-mono-label px-4 py-2 border border-primary text-primary hover:bg-primary/10 rounded transition-colors"
                >
                  {t("Reset Filters")}
                </button>
              </div>
            )}

            {!isLoading && filteredProducts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((p) => (
                  <ProductCard
                    key={p.slug}
                    name={p.name}
                    category={p.categories?.name ?? "Digital"}
                    priceDzd={lowestDzd(p.product_offers)}
                    slug={p.slug}
                    image={p.main_image}
                    offers={p.product_offers}
                    accountType={p.account_type}
                    offerType={p.offer_type}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Drawer Slide-in Overlay */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-background border-l border-border h-full p-6 overflow-y-auto ml-auto relative flex flex-col justify-between shadow-2xl animate-slide-in-right">
            <div>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1"
                aria-label={t("Close Filters")}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="pt-6">
                {filtersSidebar}
              </div>
            </div>
            <button
              onClick={() => setShowMobileFilters(false)}
              className="w-full bg-primary text-primary-foreground font-mono-label py-3 mt-6 hover:opacity-95 text-center block rounded-md"
            >
              {t("Show Results ({{count}})", { count: filteredProducts.length })}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
