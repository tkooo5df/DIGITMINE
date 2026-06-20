import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { gradientFromName, letterFromName } from "@/lib/product-visual";
import type { CatalogOffer } from "@/lib/catalog-data";
import { Zap, Mail, UserPlus, Key, Send, Clock, Heart } from "lucide-react";

interface Props {
  name: string;
  category: string;
  badge?: string;
  priceDzd: number | null;
  slug: string;
  image?: string | null;
  offers?: CatalogOffer[];
  accountType?: string | null;
  offerType?: string | null;
}

function getDeliveryIcon(method: string | null | undefined) {
  if (!method) return null;
  const m = method.toLowerCase();
  if (m.includes("instant")) return <Zap className="w-3 h-3 text-amber-400 shrink-0" />;
  if (m.includes("email")) return <Mail className="w-3 h-3 text-blue-400 shrink-0" />;
  if (m.includes("invite")) return <UserPlus className="w-3 h-3 text-teal-400 shrink-0" />;
  if (m.includes("link") || m.includes("code")) return <Key className="w-3 h-3 text-purple-400 shrink-0" />;
  return <Send className="w-3 h-3 text-muted-foreground shrink-0" />;
}

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
  if (t === "premium" || t === "max" || t === "pro") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (t === "plus") return "border-indigo-500/30 bg-indigo-500/10 text-indigo-300";
  if (t === "basic" || t === "standard" || t === "lite") return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  if (t === "free" || t === "trial") return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  return "border-border/45 text-muted-foreground/90";
}

export function ProductCard({ name, category, badge, priceDzd, slug, image, offers, accountType, offerType }: Props) {
  const { t } = useTranslation();
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem("wishlist");
      const list = stored ? JSON.parse(stored) : [];
      setIsLiked(list.includes(slug));
    }

    const handleUpdate = () => {
      const stored = localStorage.getItem("wishlist");
      const list = stored ? JSON.parse(stored) : [];
      setIsLiked(list.includes(slug));
    };

    window.addEventListener("wishlist-updated", handleUpdate);
    return () => window.removeEventListener("wishlist-updated", handleUpdate);
  }, [slug]);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const stored = localStorage.getItem("wishlist");
    let list = stored ? JSON.parse(stored) : [];
    if (list.includes(slug)) {
      list = list.filter((s: string) => s !== slug);
      setIsLiked(false);
    } else {
      list.push(slug);
      setIsLiked(true);
    }
    localStorage.setItem("wishlist", JSON.stringify(list));
    window.dispatchEvent(new Event("wishlist-updated"));
  };

  const firstOffer = offers?.[0];
  const duration = firstOffer?.duration;
  const deliveryMethod = firstOffer?.delivery_method;

  // Account and offer type fallback checks
  const displayAccountType = accountType || 
    (name.toLowerCase().includes("private") ? "Private" : name.toLowerCase().includes("shared") ? "Shared" : name.toLowerCase().includes("family") ? "Family" : null);
  const displayOfferType = offerType || 
    (name.toLowerCase().includes("premium") ? "Premium" : name.toLowerCase().includes("pro") ? "Pro" : name.toLowerCase().includes("plus") ? "Plus" : name.toLowerCase().includes("max") ? "Max" : name.toLowerCase().includes("basic") ? "Basic" : name.toLowerCase().includes("standard") ? "Standard" : name.toLowerCase().includes("free") ? "Free" : name.toLowerCase().includes("trial") ? "Trial" : name.toLowerCase().includes("lite") ? "Lite" : null);

  return (
    <Link
      to="/product/$slug"
      params={{ slug }}
      className="group relative block overflow-hidden bg-surface border border-border/60 hover:border-primary/40 hover-lift rounded-lg"
    >
      {/* Visual Container */}
      <div
        className="aspect-square relative overflow-hidden bg-surface"
        style={{ background: gradientFromName(name) }}
      >
        {/* Top Badges */}
        {badge && (
          <span className="absolute top-2.5 left-2.5 z-10 text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-background/80 backdrop-blur text-primary border border-primary/20">
            {badge}
          </span>
        )}
        <span className="absolute top-2.5 right-2.5 z-10 text-[9px] font-mono-label px-2 py-0.5 rounded bg-background/60 backdrop-blur text-foreground/80 border border-border/20">
          {category}
        </span>

        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={toggleWishlist}
          className="absolute bottom-2.5 right-2.5 z-10 p-1.5 rounded-full bg-background/70 backdrop-blur border border-border/40 hover:border-primary/50 text-foreground transition-all duration-300 hover:scale-105"
        >
          <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-foreground"}`} />
        </button>
        
        {/* Logo Image */}
        <div className="absolute inset-0 flex items-center justify-center transition-transform duration-700 group-hover:scale-105">
          {image ? (
            <img src={image} alt={name} loading="lazy" className="h-full w-full object-cover filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" />
          ) : (
            <span className="font-display text-7xl leading-none text-foreground/95 italic">
              {letterFromName(name)}
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
      </div>

      {/* Info Container */}
      <div className="p-3.5 space-y-2.5">
        <h3 className="font-display text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors duration-300" title={name}>
          {name}
        </h3>

        {/* Account and Offer Badges */}
        <div className="flex flex-wrap gap-1">
          {displayAccountType && (
            <span className={`font-mono text-[9px] px-1.5 py-0.5 border rounded ${getAccountTypeStyles(displayAccountType)}`}>
              {displayAccountType}
            </span>
          )}
          {displayOfferType && (
            <span className={`font-mono text-[9px] px-1.5 py-0.5 border rounded ${getOfferTypeStyles(displayOfferType)}`}>
              {displayOfferType}
            </span>
          )}
          {duration && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 border border-border/60 bg-surface text-muted-foreground inline-flex items-center gap-0.5 rounded">
              <Clock className="w-2.5 h-2.5 shrink-0" />
              {duration}
            </span>
          )}
        </div>

        {/* Pricing Display */}
        <div className="flex items-baseline justify-between pt-1">
          <div className="flex flex-col">
            {priceDzd != null ? (
              <>
                <span className="text-[9px] text-muted-foreground font-mono-label mb-0.5">
                  السعر ابتداءً من:
                </span>
                <span className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-emerald-400">
                  {priceDzd.toLocaleString()}
                  <span className="text-[11px] sm:text-xs text-emerald-400 ms-1 font-sans font-bold">DA</span>
                </span>
              </>
            ) : (
              <span className="font-display text-sm text-muted-foreground">{t("Unavailable")}</span>
            )}
          </div>

          <span
            className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-3 py-1.5 bg-primary text-primary-foreground group-hover:-translate-y-px transition-all duration-300 shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            {t("Buy")}
            <span className="rtl:rotate-180 transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>

        {/* Delivery Method Footer */}
        {deliveryMethod && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground border-t border-border/30 pt-2 font-mono">
            {getDeliveryIcon(deliveryMethod)}
            <span className="truncate">{deliveryMethod}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
