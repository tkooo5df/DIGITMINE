import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Star,
  Package,
  Clock,
  ExternalLink,
  Send,
  ShieldCheck,
  Truck,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { gradientFromName, letterFromName } from "@/lib/product-visual";
import { useCatalogProduct, type CatalogOffer } from "@/lib/catalog-data";
import { BuyFlowDialog } from "@/components/BuyFlowDialog";
import { ProductReviews } from "@/components/ProductReviews";
import { ProductRelated } from "@/components/ProductRelated";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/product/$slug")({
  component: ProductPage,
});

function getAccountTypeStyles(type: string | null | undefined) {
  if (!type) return "border-border/45 text-muted-foreground/90";
  const t = type.toLowerCase();
  if (t === "private") return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  if (t === "shared") return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  if (t === "family") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-border/45 text-muted-foreground/90";
}

function getOfferTypeStyles(type: string | null | undefined) {
  if (!type) return "border-border/45 text-muted-foreground/90";
  const t = type.toLowerCase();
  if (t === "premium" || t === "max" || t === "pro")
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (t === "plus") return "border-indigo-500/30 bg-indigo-500/10 text-indigo-300";
  if (t === "basic" || t === "standard" || t === "lite")
    return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  if (t === "free" || t === "trial")
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  return "border-border/45 text-muted-foreground/90";
}

function ProductPage() {
  const { slug } = Route.useParams();
  const { t } = useTranslation();
  const fallbackName = slug
    .split("-")
    .map((w: string) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
  const { data: product, isLoading } = useCatalogProduct(slug);
  const { isAdmin } = useAuth();
  const name = product?.name ?? fallbackName;
  const originalTitle =
    product?.product_offers?.[0]?.original_title ||
    product?.product_offers?.[0]?.name ||
    name;

  const [selectedService, setSelectedService] = useState<{
    offer_type: string | null;
    account_type: string | null;
  } | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const serviceTypes = useMemo(() => {
    if (!product?.product_offers) return [];
    const seen = new Set<string>();
    const result: {
      offer_type: string | null;
      account_type: string | null;
      label: string;
    }[] = [];

    product.product_offers.forEach((o) => {
      const key = `${o.offer_type ?? ""}|${o.account_type ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        const parts = [];
        if (o.offer_type && o.offer_type !== "Standard") parts.push(o.offer_type);
        if (o.account_type) {
          const accLabel =
            o.account_type.toLowerCase() === "private"
              ? "خاص (Private)"
              : o.account_type.toLowerCase() === "shared"
              ? "مشترك (Shared)"
              : o.account_type.toLowerCase() === "family"
              ? "عائلي (Family)"
              : o.account_type;
          parts.push(accLabel);
        } else {
          parts.push("عادي");
        }
        result.push({ offer_type: o.offer_type, account_type: o.account_type, label: parts.join(" · ") });
      }
    });
    return result;
  }, [product]);

  const durations = useMemo(() => {
    if (!product?.product_offers) return [];
    return Array.from(
      new Set(product.product_offers.map((o) => o.duration).filter(Boolean))
    ) as string[];
  }, [product]);

  const isDurationAvailable = (dur: string) => {
    if (!selectedService || !product?.product_offers) return false;
    const offer = product.product_offers.find(
      (o) =>
        o.offer_type === selectedService.offer_type &&
        o.account_type === selectedService.account_type &&
        o.duration === dur
    );
    return offer && (offer.stock ?? 0) > 0;
  };

  const matchedOffer = useMemo(() => {
    if (!product?.product_offers || !selectedService || !selectedDuration) return null;
    return (
      product.product_offers.find(
        (o) =>
          o.offer_type === selectedService.offer_type &&
          o.account_type === selectedService.account_type &&
          o.duration === selectedDuration
      ) || null
    );
  }, [product, selectedService, selectedDuration]);

  useEffect(() => {
    if (product?.product_offers && product.product_offers.length > 0) {
      const first = product.product_offers[0];
      setSelectedService({ offer_type: first.offer_type, account_type: first.account_type });
      setSelectedDuration(first.duration);
    }
  }, [product]);

  const { data: buyerCount = 0 } = useQuery({
    queryKey: ["product-buyers", product?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("product_buyer_count", {
        _product_id: product!.id,
      });
      return (data as number) ?? 0;
    },
    enabled: !!product?.id,
  });

  const activeOffer = matchedOffer;
  const totalStock = product?.product_offers?.reduce((s, o) => s + (o.stock ?? 0), 0) ?? 0;
  const isOrderable = activeOffer && (activeOffer.stock ?? 0) > 0;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1 w-full">
        {/* ─── Loading ─── */}
        {isLoading && (
          <div className="py-32 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground font-mono text-xs">{t("Loading product details…")}</p>
          </div>
        )}

        {!isLoading && !product && (
          <div className="py-32 text-center font-mono text-muted-foreground text-sm">
            {t("Product not found.")}
          </div>
        )}

        {/* ─── Main Product Section ─── */}
        {!isLoading && product && (
          <>
            {/* Hero: image left + info right */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-4">
              <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start">

                {/* ── Image Column ── */}
                <div className="w-full lg:w-[480px] shrink-0 space-y-3">
                  {/* Main image */}
                  <div
                    className="w-full aspect-square rounded-2xl overflow-hidden relative border border-border/40 shadow-2xl"
                    style={{ background: gradientFromName(name) }}
                  >
                    {product.main_image ? (
                      <img
                        src={product.main_image}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-display text-[120px] leading-none italic text-foreground/80">
                          {letterFromName(name)}
                        </span>
                      </div>
                    )}

                    {/* Flash Sale Badge */}
                    {totalStock > 0 && totalStock < 20 && (
                      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
                        <Zap className="w-3.5 h-3.5" />
                        <span>كمية محدودة</span>
                      </div>
                    )}

                    {/* Out of stock overlay */}
                    {totalStock <= 0 && (
                      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                        <span className="font-display text-2xl text-destructive border border-destructive/30 bg-destructive/10 px-6 py-3 rounded-xl">
                          نفدت الكمية
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Trust badges row */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: ShieldCheck, label: "دفع آمن" },
                      { icon: Truck, label: "تسليم فوري" },
                      { icon: RotateCcw, label: "ضمان الجودة" },
                    ].map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="flex flex-col items-center gap-1 py-3 rounded-xl border border-border/30 bg-surface/30 glass"
                      >
                        <Icon className="w-5 h-5 text-primary" />
                        <span className="font-mono text-[10px] text-muted-foreground text-center leading-tight">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Info Column ── */}
                <div className="flex-1 min-w-0 space-y-5">

                  {/* Category crumb */}
                  <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
                    {product.categories?.name ?? "Digital"}{product.family ? ` › ${product.family}` : ""}
                  </p>

                  {/* Product title */}
                  <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold leading-tight text-foreground">
                    {originalTitle}
                  </h1>

                  {/* Badges row */}
                  <div className="flex flex-wrap gap-2">
                    {product.account_type && (
                      <span
                        className={`font-mono text-[11px] px-3 py-1 border rounded-full ${getAccountTypeStyles(product.account_type)}`}
                      >
                        {product.account_type}
                      </span>
                    )}
                    {product.offer_type && (
                      <span
                        className={`font-mono text-[11px] px-3 py-1 border rounded-full ${getOfferTypeStyles(product.offer_type)}`}
                      >
                        {product.offer_type}
                      </span>
                    )}
                  </div>

                  {/* Rating + buyers */}
                  <div className="flex flex-wrap items-center gap-4">
                    {(product.rating_count ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((i) => {
                            const r = Number(product.rating ?? 0);
                            const filled = i <= Math.round(r);
                            return (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                              />
                            );
                          })}
                        </div>
                        <span className="font-mono text-sm font-semibold text-amber-400">
                          {Number(product.rating ?? 0).toFixed(1)}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          ({product.rating_count} تقييم)
                        </span>
                      </div>
                    )}
                    {(product.sales_count ?? 0) > 0 && (
                      <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground border-r border-border/30 pr-4">
                        <Users className="w-3.5 h-3.5" />
                        {(product.sales_count ?? 0).toLocaleString()} طلب
                      </span>
                    )}
                  </div>

                  {/* ── BIG Price Block ── */}
                  <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-surface/60 to-surface/20 glass p-5 space-y-4">
                    {activeOffer ? (
                      <>
                        <div className="flex items-end gap-3 flex-wrap">
                          {activeOffer.price_dzd != null ? (
                            <span className="font-display text-5xl sm:text-6xl font-extrabold text-emerald-400 leading-none">
                              {activeOffer.price_dzd.toLocaleString()}
                              <span className="text-2xl font-bold ml-1 opacity-70">DA</span>
                            </span>
                          ) : (
                            <span className="text-lg text-muted-foreground">السعر غير متوفر</span>
                          )}
                          {qty > 1 && activeOffer.price_dzd != null && (
                            <span className="font-mono text-lg text-muted-foreground">
                              × {qty} ={" "}
                              <span className="text-foreground font-bold">
                                {(Number(activeOffer.price_dzd) * qty).toLocaleString()} DA
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Delivery Method */}
                        {activeOffer.delivery_method && (
                          <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground pt-2 border-t border-border/20">
                            <Truck className="w-4 h-4 text-primary shrink-0" />
                            <span>نوع التسليم: <span className="text-foreground font-semibold">{activeOffer.delivery_method}</span></span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-destructive font-mono text-sm">
                        هذا العرض غير متوفر حالياً — اختر تشكيلة أخرى.
                      </div>
                    )}
                  </div>

                  {/* ── Description (Fixed) ── */}
                  <div className="rounded-xl border border-border/30 bg-surface/20 overflow-hidden">
                    <div className="px-5 py-4 space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          {product.name || originalTitle}
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                          {product.description ||
                            "اشتراك موثّق ومضمون. ادفع بالدينار واستلم خلال دقائق بعد التحقق."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── All Offers (Price Focus) ── */}
                  {product.product_offers && product.product_offers.length > 0 && (
                    <div className="border-t border-border/20 pt-3">
                      <h3 className="font-mono-label text-[9px] text-muted-foreground uppercase tracking-wider mb-2">
                        العروض ({product.product_offers.length})
                      </h3>
                      <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-1.5">
                        {product.product_offers.map((o) => {
                          const outOfStock = (o.stock ?? 0) <= 0;
                          const isSelected =
                            selectedService?.offer_type === o.offer_type &&
                            selectedService?.account_type === o.account_type &&
                            selectedDuration === o.duration;

                          return (
                            <button
                              key={o.id}
                              type="button"
                              disabled={outOfStock}
                              onClick={() => {
                                if (!outOfStock) {
                                  setSelectedService({
                                    offer_type: o.offer_type,
                                    account_type: o.account_type,
                                  });
                                  setSelectedDuration(o.duration);
                                }
                              }}
                              className={`relative flex flex-col overflow-hidden rounded border transition-all text-start w-full ${
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : outOfStock
                                  ? "border-border/20 opacity-40 cursor-not-allowed"
                                  : "border-border/30 hover:border-primary/50 cursor-pointer"
                              }`}
                            >
                              {/* Mini image */}
                              <div
                                className="relative w-full aspect-square overflow-hidden flex items-center justify-center"
                                style={{ background: gradientFromName(name) }}
                              >
                                {product.main_image ? (
                                  <img
                                    src={product.main_image}
                                    alt={name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="font-display text-xl italic text-foreground/80">
                                    {letterFromName(name)}
                                  </span>
                                )}

                                {outOfStock && (
                                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                                    <span className="font-mono-label text-[7px] text-destructive">
                                      ×
                                    </span>
                                  </div>
                                )}

                                {isSelected && (
                                  <div className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                                    <svg
                                      className="w-2 h-2 text-white"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={3}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              {/* Price only - bigger */}
                              <div className="p-1.5 text-center">
                                {o.price_dzd != null ? (
                                  <span className="font-mono font-bold text-emerald-400 text-sm block leading-tight">
                                    {o.price_dzd.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="font-mono text-[8px] text-muted-foreground block">
                                    غير متوفر
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Selectors ── */}
                  {product.product_offers.length > 1 && (
                    <div className="space-y-5">
                      {/* Service / Account type */}
                      {serviceTypes.length > 1 && (
                        <div className="space-y-3">
                          <p className="font-mono-label text-[11px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-primary" />
                            نوع العرض / الحساب
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {serviceTypes.map((st) => {
                              const active =
                                selectedService?.offer_type === st.offer_type &&
                                selectedService?.account_type === st.account_type;
                              return (
                                <button
                                  key={`${st.offer_type ?? ""}|${st.account_type ?? ""}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedService({
                                      offer_type: st.offer_type,
                                      account_type: st.account_type,
                                    });
                                    const matched = product.product_offers.find(
                                      (o) =>
                                        o.offer_type === st.offer_type &&
                                        o.account_type === st.account_type &&
                                        o.duration === selectedDuration
                                    );
                                    if (!matched || (matched.stock ?? 0) <= 0) {
                                      const available = product.product_offers.find(
                                        (o) =>
                                          o.offer_type === st.offer_type &&
                                          o.account_type === st.account_type &&
                                          (o.stock ?? 0) > 0
                                      );
                                      if (available) setSelectedDuration(available.duration);
                                    }
                                  }}
                                  className={`px-4 py-2.5 border rounded-xl text-sm font-medium transition-all duration-200 ${
                                    active
                                      ? "border-primary bg-primary/10 text-primary shadow-glow font-bold"
                                      : "border-border/50 hover:border-primary/50 text-foreground hover:bg-surface/40"
                                  }`}
                                >
                                  {st.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Duration */}
                      {durations.length > 1 && (
                        <div className="space-y-3">
                          <p className="font-mono-label text-[11px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            مدة الاشتراك
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {durations.map((dur) => {
                              const active = selectedDuration === dur;
                              const available = isDurationAvailable(dur);
                              return (
                                <button
                                  key={dur}
                                  type="button"
                                  onClick={() => available && setSelectedDuration(dur)}
                                  disabled={!available}
                                  className={`px-5 py-2.5 border rounded-xl text-sm font-mono font-semibold transition-all duration-200 ${
                                    active
                                      ? "border-primary bg-primary/10 text-primary shadow-glow"
                                      : "border-border/50 hover:border-primary/50 text-foreground"
                                  } ${!available ? "opacity-30 line-through cursor-not-allowed" : ""}`}
                                >
                                  {dur}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Quantity + CTA ── */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {/* Qty stepper */}
                    <div className="flex items-center border border-border/50 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="w-11 h-12 flex items-center justify-center text-xl text-muted-foreground hover:text-foreground hover:bg-surface/50 transition-colors border-r border-border/50"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-14 h-12 text-center bg-transparent text-foreground text-sm font-bold font-mono outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQty((q) => q + 1)}
                        className="w-11 h-12 flex items-center justify-center text-xl text-muted-foreground hover:text-foreground hover:bg-surface/50 transition-colors border-l border-border/50"
                      >
                        +
                      </button>
                    </div>

                    {/* CTA button */}
                    <button
                      type="button"
                      disabled={!isOrderable}
                      onClick={() => {
                        if (!activeOffer) {
                          toast.error("الرجاء اختيار عرض صالح متوفر");
                          return;
                        }
                        setOpen(true);
                      }}
                      className={`flex-1 h-14 px-8 rounded-xl font-display text-base font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${
                        isOrderable
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow hover:shadow-glow/80 cursor-pointer"
                          : "bg-muted-foreground/10 text-muted-foreground border border-border/30 cursor-not-allowed"
                      }`}
                    >
                      {isOrderable ? (
                        <>
                          <Zap className="w-5 h-5" />
                          {t("Order Now")}
                        </>
                      ) : (
                        "غير متوفر حالياً"
                      )}
                    </button>
                  </div>

                </div>
              </div>
            </div>

            {/* ─── Reviews + Related ─── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              {product?.id && <ProductReviews productId={product.id} />}
              {product && <ProductRelated product={product} />}
            </div>
          </>
        )}
      </main>

      {product && (
        <BuyFlowDialog
          product={product}
          offer={activeOffer}
          quantity={qty}
          open={open}
          onOpenChange={setOpen}
        />
      )}
      <Footer />
    </div>
  );
}