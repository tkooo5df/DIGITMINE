import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useProducts, useCategories } from "@/lib/admin-data";
import { gradientFromName, letterFromName } from "@/lib/product-visual";
import { Plus, Star, Trash2, CheckSquare, Square, Download, Upload, Eye, EyeOff, Link as LinkIcon, Loader, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const EXPRESS_API = "http://localhost:3001";

// Family detection based on product title
function detectFamily(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("chatgpt") || t.includes("chat gpt")) return "ChatGPT";
  if (t.includes("netflix")) return "Netflix";
  if (t.includes("spotify")) return "Spotify";
  if (t.includes("youtube") || t.includes("yt ")) return "YouTube";
  if (t.includes("prime video") || t.includes("amazon prime") || t.includes("primevideo")) return "Amazon Prime";
  if (t.includes("disney")) return "Disney+";
  if (t.includes("hbo") || t.includes("max")) return "HBO Max";
  if (t.includes("canva")) return "Canva";
  if (t.includes("adobe") && t.includes("cc")) return "Adobe CC";
  if (t.includes("adobe") && t.includes("express")) return "Adobe Express";
  if (t.includes("microsoft") || t.includes("office 365") || t.includes("office365")) return "Microsoft 365";
  if (t.includes("capcut")) return "CapCut";
  if (t.includes("duolingo")) return "Duolingo";
  if (t.includes("perplexity")) return "Perplexity";
  if (t.includes("claude")) return "Claude AI";
  if (t.includes("gemini")) return "Gemini";
  if (t.includes("grok")) return "Grok";
  if (t.includes("suno")) return "Suno";
  if (t.includes("grammarly")) return "Grammarly";
  if (t.includes("notion")) return "Notion";
  if (t.includes("nordvpn") || t.includes("nord vpn")) return "NordVPN";
  if (t.includes("surfshark")) return "Surfshark";
  if (t.includes("picsart")) return "Picsart";
  if (t.includes("linkedin")) return "LinkedIn";
  if (t.includes("coursera")) return "Coursera";
  if (t.includes("alight") || t.includes("motion")) return "Alight Motion";
  if (t.includes("kling")) return "Kling AI";
  if (t.includes("elevenlabs") || t.includes("eleven laps") || t.includes("elevenlaps")) return "ElevenLabs";
  if (t.includes("lovable")) return "Lovable";
  if (t.includes("replit")) return "Replit";
  if (t.includes("cursor")) return "Cursor";
  if (t.includes("tradingview") || t.includes("trading view")) return "TradingView";
  if (t.includes("crunchyroll")) return "Crunchyroll";
  if (t.includes("headspace")) return "Headspace";
  if (t.includes("quillbot")) return "Quillbot";
  if (t.includes("apify")) return "Apify";
  if (t.includes("n8n")) return "n8n";
  if (t.includes("github") && (t.includes("student") || t.includes("edu"))) return "GitHub Student";
  if (t.includes("vid") && t.includes("plat")) return "VidPlat";
  if (t.includes("viu")) return "Viu";
  if (t.includes("wetv")) return "WeTV";
  if (t.includes("ip.tv") || t.includes("iptv")) return "IPTV";
  if (t.includes("brazzers") || t.includes("pornhub") || t.includes("faphouse")) return "Adult";
  if (t.includes("pubg") && t.includes("uc")) return "PUBG";
  if (t.includes("gpt") && t.includes("go")) return "GPT Go";
  if (t.includes("hma") && t.includes("vpn")) return "HMA VPN";
  if (t.includes("sms") && (t.includes("panel") || t.includes("otp"))) return "SMS Panel";
  if (t.includes("getcontact")) return "Getcontact";
  if (t.includes("zoom")) return "Zoom";
  if (t.includes("antigravity") || t.includes("anti gravity")) return "Anti Gravity";
  return "Other";
}

export const Route = createFileRoute("/admin/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const qc = useQueryClient();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedCat, setSelectedCat] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // Z2U import state
  const [z2uOpen, setZ2uOpen] = useState(false);
  const [z2uUrl, setZ2uUrl] = useState("");
  const [z2uLoading, setZ2uLoading] = useState(false);
  const [z2uResult, setZ2uResult] = useState<any>(null);
  const [z2uPreview, setZ2uPreview] = useState<any>(null);
  const [z2uShowHtml, setZ2uShowHtml] = useState(false);
  const [z2uSaving, setZ2uSaving] = useState(false);

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const matchesCategory = selectedCat === "All" || p.categories?.name === selectedCat;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (p.slug || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCat, searchQuery]);

  const allIds = useMemo(() => filteredProducts.map((p: any) => p.id), [filteredProducts]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;

  const deleteProducts = async (ids: string[]) => {
    await supabase.from("product_offers").delete().in("product_id", ids);
    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["catalog"] });
    setSelected(new Set());
    toast.success(`تم حذف ${ids.length} منتج`);
  };

  const deleteOne = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`حذف "${name}" نهائياً؟`)) return;
    await deleteProducts([id]);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`حذف ${selected.size} منتج المحدد نهائياً؟`)) return;
    await deleteProducts(Array.from(selected));
    setSelectMode(false);
  };

  const deleteAll = async () => {
    if (allIds.length === 0) return;
    if (!confirm(`⚠️ حذف كل المنتجات (${allIds.length}) نهائياً؟ لا يمكن التراجع!`)) return;
    if (!confirm("تأكيد نهائي: حذف كل المنتجات؟")) return;
    await deleteProducts(allIds);
    setSelectMode(false);
  };

  // Z2U link import
  const handleZ2uScrape = async () => {
    if (!z2uUrl.trim()) return;
    setZ2uLoading(true);
    setZ2uResult(null);
    try {
      const resp = await fetch(`${EXPRESS_API}/api/scrape/z2u`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: z2uUrl.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (data.blockedByCloudflare) setZ2uShowHtml(true);
        throw new Error(data.error || "Scrape failed");
      }
      setZ2uResult(data);
      setZ2uPreview({ ...data });
      toast.success(`Scraped: ${data.title}`);
    } catch (e: any) {
      toast.error(e.message || "Scrape failed");
    } finally {
      setZ2uLoading(false);
    }
  };

  const handleZ2uSave = async () => {
    if (!z2uPreview || z2uSaving) return;
    setZ2uSaving(true);
    try {
      const family = detectFamily(z2uPreview.title);
      const newProduct = {
        ...z2uPreview,
        family,
        active: true,
      };
      const resp = await fetch(`${EXPRESS_API}/api/product/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });
      const saved = await resp.json();
      if (!resp.ok) throw new Error(saved.error || "Save failed");
      
      // Also save to mock Supabase
      await supabase.from("products").insert([{
        id: saved.id,
        name: saved.title,
        slug: saved.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + saved.id,
        family: saved.family,
        visible: true,
      } as any]).select("id").single();

      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(`Added: ${saved.title} (${saved.family})`);
      setZ2uOpen(false);
      setZ2uUrl("");
      setZ2uResult(null);
      setZ2uPreview(null);
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setZ2uSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      toast.loading("جاري تصدير البيانات...", { id: "export-toast" });
      const [pRes, oRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("product_offers").select("*"),
      ]);

      if (pRes.error) throw pRes.error;
      if (oRes.error) throw oRes.error;

      const exportData = (pRes.data ?? []).map((prod) => {
        const prodOffers = (oRes.data ?? [])
          .filter((off) => off.product_id === prod.id)
          .map(({ id, product_id, created_at, ...rest }) => rest);
        return {
          ...prod,
          offers: prodOffers,
        };
      });

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products_export_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير المنتجات بنجاح", { id: "export-toast" });
    } catch (err: any) {
      console.error(err);
      toast.error(`فشل التصدير: ${err.message}`, { id: "export-toast" });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.loading("جاري استيراد البيانات...", { id: "import-toast" });
      const text = await file.text();
      let items = JSON.parse(text);

      if (!Array.isArray(items)) {
        if (items && Array.isArray(items.categories)) {
          items = items.categories;
        } else if (items && Array.isArray(items.products)) {
          items = items.products;
        } else {
          throw new Error("ملف JSON غير صالح. يجب أن يحتوي على مصفوفة من المنتجات.");
        }
      }

      const { data: catData, error: catErr } = await supabase.from("categories").select("id");
      if (catErr) throw catErr;
      const validCategoryIds = new Set((catData ?? []).map((c) => c.id));

      let importedCount = 0;

      for (const item of items) {
        const name = item.name || item.title;
        if (!name) {
          console.warn("Skipping invalid item without name/title:", item);
          continue;
        }

        const id = item.id || `product-${Math.random().toString(36).slice(2)}`;
        const slug = item.slug || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${id}`;
        
        let category_id = item.category_id && validCategoryIds.has(item.category_id) ? item.category_id : null;
        
        if (!category_id) {
          // auto categorize based on name/title
          const titleLower = name.toLowerCase();
          if (titleLower.includes("netflix") || titleLower.includes("spotify") || titleLower.includes("crunchyroll") || titleLower.includes("disney") || titleLower.includes("prime video") || titleLower.includes("youtube") || titleLower.includes("shahid") || titleLower.includes("apple") || titleLower.includes("starzplay") || titleLower.includes("iptv")) {
            category_id = "1d989115-74bc-429e-8184-f9d7d0a2468e"; // Streaming
          } else if (titleLower.includes("chatgpt") || titleLower.includes("claude") || titleLower.includes("midjourney") || titleLower.includes("cursor") || titleLower.includes("adobe") || titleLower.includes("deepseek") || titleLower.includes("office") || titleLower.includes("windows") || titleLower.includes("canva") || titleLower.includes("capcut") || titleLower.includes("antigravity")) {
            category_id = "bb650ce7-1aa2-40f1-b1f4-5e1229681e4d"; // AI & Software
          } else {
            category_id = "5187e97d-4bca-40ba-b130-1dc3ae377f63"; // Education & Utilities
          }
        }

        const family = item.family || name.split(" - ")[0].trim();

        const productPayload = {
          name,
          slug,
          short_description: item.short_description || (item.description ? item.description.slice(0, 100) + "..." : null),
          description: item.description || null,
          category_id,
          family,
          main_image: item.main_image || item.logo_url || null,
          banner_image: item.banner_image || null,
          gallery: item.gallery || null,
          tags: item.tags || [item.account_type, item.offer_type].filter(Boolean),
          delivery_type: item.delivery_type ?? "manual",
          featured: !!item.featured,
          visible: item.visible !== false,
          rating: Number(item.rating ?? 5),
          rating_count: Number(item.rating_count ?? 0),
          sales_count: Number(item.sales_count ?? 0),
          original_price_dzd: item.original_price_dzd ? Number(item.original_price_dzd) : null,
          seo_title: item.seo_title || name,
          seo_description: item.seo_description || item.description || null,
          account_type: item.account_type || null,
          offer_type: item.offer_type || null,
        };

        let existingProduct: any = null;

        if (id) {
          const { data } = await supabase
            .from("products")
            .select("id")
            .eq("id", id)
            .maybeSingle();
          if (data) {
            existingProduct = data;
          }
        }

        if (!existingProduct && slug) {
          const { data } = await supabase
            .from("products")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();
          if (data) {
            existingProduct = data;
          }
        }

        let productId: string;

        if (existingProduct) {
          productId = existingProduct.id;
          const { error: updErr } = await supabase
            .from("products")
            .update(productPayload as any)
            .eq("id", productId);
          if (updErr) throw updErr;
        } else {
          const payloadToInsert = { ...productPayload } as any;
          if (id) {
            payloadToInsert.id = id;
          }
          const { data: newProd, error: insErr } = await supabase
            .from("products")
            .insert(payloadToInsert)
            .select("id")
            .single();
          if (insErr) throw insErr;
          productId = newProd.id;
        }

        const { error: delErr } = await supabase
          .from("product_offers")
          .delete()
          .eq("product_id", productId);
        if (delErr) throw delErr;

        let offersPayload: any[] = [];
        if (Array.isArray(item.offers) && item.offers.length > 0) {
          offersPayload = item.offers.map((o: any) => ({
            product_id: productId,
            name: o.name ?? "عرض",
            duration: o.duration || null,
            warranty: o.warranty || null,
            delivery_method: o.delivery_method || null,
            delivery_type: o.delivery_type ?? "manual",
            supplier: o.supplier || null,
            price_dzd: o.price_dzd ? Number(o.price_dzd) : null,
            price_usd: Number(o.price_usd ?? 0),
            discount_usd: o.discount_usd ? Number(o.discount_usd) : null,
            stock: Number(o.stock ?? 0),
            active: o.active !== false,
            sort_order: Number(o.sort_order ?? 0),
            delivery_notes: o.delivery_notes || null,
            product_url: o.product_url || null,
          }));
        } else {
          // Flat item mapping
          offersPayload = [{
            product_id: productId,
            name: name,
            duration: item.duration || null,
            warranty: item.duration || "Period of Subscription",
            delivery_method: item.delivery_method || null,
            delivery_type: "manual",
            supplier: item.supplier || null,
            price_dzd: item.price_dzd ? Number(item.price_dzd) : null,
            price_usd: Number(item.price_usd ?? 0),
            discount_usd: null,
            stock: 99,
            active: true,
            sort_order: 0,
            delivery_notes: null,
            product_url: item.product_url || null,
          }];
        }

        const { error: offersErr } = await supabase
          .from("product_offers")
          .insert(offersPayload);
        if (offersErr) throw offersErr;

        importedCount++;
      }

      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(`تم استيراد ${importedCount} منتج بنجاح`, { id: "import-toast" });

      e.target.value = "";
    } catch (err: any) {
      console.error(err);
      toast.error(`فشل الاستيراد: ${err.message}`, { id: "import-toast" });
    }
  };

  return (
    <>
      <AdminTopbar title="Products" subtitle={`${products.length} products`} />
      <main className="px-6 lg:px-10 py-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setSelectMode((s) => !s); setSelected(new Set()); }}
              className={`font-mono-label px-3 py-2 border inline-flex items-center gap-2 ${selectMode ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {selectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selectMode ? "إنهاء التحديد" : "تحديد"}
            </button>
            {selectMode && (
              <>
                <button
                  onClick={() => setSelected(allSelected ? new Set() : new Set(allIds))}
                  className="font-mono-label px-3 py-2 border border-border text-muted-foreground hover:text-foreground"
                >
                  {allSelected ? "إلغاء الكل" : "تحديد الكل"}
                </button>
                <button
                  onClick={deleteSelected}
                  disabled={selected.size === 0}
                  className="font-mono-label px-3 py-2 border border-destructive/30 text-destructive hover:bg-destructive/10 inline-flex items-center gap-2 disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" /> حذف المحدد ({selected.size})
                </button>
                <button
                  onClick={deleteAll}
                  className="font-mono-label px-3 py-2 bg-destructive/10 border border-destructive text-destructive hover:bg-destructive/20 inline-flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> حذف الكل
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="font-mono-label px-3 py-2 border border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> تصدير JSON
            </button>
            <label className="font-mono-label px-3 py-2 border border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> استيراد JSON
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <button
              onClick={() => { setZ2uOpen(true); setZ2uResult(null); setZ2uPreview(null); setZ2uUrl(""); setZ2uShowHtml(false); }}
              className="font-mono-label px-3 py-2 border border-primary/40 text-primary hover:bg-primary/10 inline-flex items-center gap-2"
            >
              <LinkIcon className="w-4 h-4" /> Z2U Import
            </button>
            <Link to="/admin/products/$id" params={{ id: "new" }} className="font-mono-label px-4 py-2 bg-primary text-primary-foreground inline-flex items-center gap-2 hover:opacity-90">
              <Plus className="w-4 h-4" /> منتج جديد
            </Link>
          </div>
        </div>
        {/* Search & Category Filtering Bar */}
        {!isLoading && (
          <div className="space-y-4 bg-surface border border-border p-4">
            <div className="max-w-md">
              <input
                type="text"
                placeholder="البحث عن منتج بالاسم أو الرابط (slug)..."
                className="w-full bg-background border border-border px-3 py-2 font-mono text-sm focus:border-primary outline-none text-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
              <button
                onClick={() => setSelectedCat("All")}
                className={`font-mono-label px-3 py-1.5 text-xs border ${
                  selectedCat === "All"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                الكل ({products.length})
              </button>
              {categories.map((c: any) => {
                const count = products.filter((p: any) => p.category_id === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCat(c.name)}
                    className={`font-mono-label px-3 py-1.5 text-xs border ${
                      selectedCat === c.name
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {c.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {isLoading && <p className="text-center text-muted-foreground font-mono-label">Loading…</p>}
{!isLoading && filteredProducts.length === 0 && (
  <p className="text-center text-muted-foreground font-mono-label py-12">No products found.</p>
)}
{Object.entries(
  filteredProducts.reduce((acc: Record<string, any[]>, p) => {
    const family = p.family || "Other";
    if (!acc[family]) acc[family] = [];
    acc[family].push(p);
    return acc;
  }, {} as Record<string, any[]>)
).map(([family, prods]) => {
  const isOpen = expandedFamilies?.has(family);
  const toggleFamily = () => setExpandedFamilies(prev => {
    const next = new Set(prev);
    if (next.has(family)) next.delete(family);
    else next.add(family);
    return next;
  });
  return (
    <div key={family} className="border border-border rounded-lg overflow-hidden mb-4">
      <button
        onClick={toggleFamily}
        className="w-full flex items-center justify-between px-4 py-2 bg-surface hover:bg-surface/80 transition-colors"
      >
        <span className="font-display text-lg">{family}</span>
        <span className="text-sm text-muted-foreground">{prods.length} منتجات</span>
      </button>
      {isOpen && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4 bg-background">
          {prods.map((p) => {
            const stock = (p.product_offers ?? []).reduce((s, o) => s + (o.stock ?? 0), 0);
            const offers = (p.product_offers ?? []).length;
            const status = !p.visible ? "Hidden" : stock < 10 ? "Low" : "Live";
            const isSel = selected.has(p.id);
            return (
              <div key={p.id} className="relative">
                <Link
                  to="/admin/products/$id"
                  params={{ id: p.id }}
                  onClick={(e) => { if (selectMode) { e.preventDefault(); toggleOne(p.id); } }}
                  className={`border bg-surface hover:border-primary/50 transition-all duration-500 group block ${isSel ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
                >
                  {/* Visibility toggle button */}
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const newVisible = !p.visible;
                      const { error } = await supabase
                        .from('products')
                        .update({ visible: newVisible })
                        .eq('id', p.id);
                      if (error) toast.error(error.message);
                      else { qc.invalidateQueries({ queryKey: ["admin"] }); toast.success(`تم ${newVisible ? "إظهار" : "إخفاء"} المنتج`); }
                    }}
                    className="absolute top-3 right-8 z-20 p-1 bg-background/70 rounded-full hover:bg-background/90"
                  >
                    {p.visible ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {/* Card content */}
                  <div className="aspect-[4/3] relative overflow-hidden" style={{ background: gradientFromName(p.name) }}>
                    {p.main_image ? (
                      <img src={p.main_image} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center">
                        <span className="font-display italic text-7xl text-foreground/90">{letterFromName(p.name)}</span>
                      </div>
                    )}
                    <span className="absolute top-3 left-3 font-mono-label bg-background/70 backdrop-blur px-2 py-1 z-10">{p.categories?.name ?? "—"}</span>
                    <span className={`absolute top-3 right-3 font-mono-label px-2 py-1 z-10 ${status === "Low" ? "text-destructive bg-destructive/10" : status === "Hidden" ? "text-muted-foreground bg-surface" : "text-primary bg-primary/10"}`}>{status}</span>
                    {selectMode && (
                      <span className={`absolute bottom-3 left-3 w-7 h-7 grid place-items-center rounded border z-10 ${isSel ? "bg-primary border-primary text-primary-foreground" : "bg-background/70 border-border"}`}>
                        {isSel ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-xl group-hover:text-primary transition-colors">{p.name}</h3>
                    <div className="text-sm text-muted-foreground mt-1">{p.family}</div>
                    <div className="flex justify-between mt-3 font-mono text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-primary" /> {Number(p.rating ?? 0).toFixed(1)} ({p.rating_count ?? 0})</span>
                      <span>{p.sales_count ?? 0} مشتري</span>
                    </div>
                    <div className="flex justify-between mt-2 font-mono text-xs text-muted-foreground">
                      <span>{offers} عرض</span>
                      <span>مخزون {stock}</span>
                    </div>
                  </div>
                </Link>
                {!selectMode && (
                  <button
                    onClick={(e) => deleteOne(e, p.id, p.name)}
                    className="absolute bottom-3 right-3 w-8 h-8 grid place-items-center rounded bg-background/80 backdrop-blur border border-border hover:border-destructive hover:text-destructive text-muted-foreground transition-colors z-20"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
})}

      {/* Z2U Import Dialog */}
      <Dialog open={z2uOpen} onOpenChange={setZ2uOpen}>
        <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Z2U Link Import</DialogTitle>
              <DialogDescription>
                Paste a Z2U product URL to scrape and add it to your catalog.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://www.z2u.com/items-..."
                value={z2uUrl}
                onChange={(e) => setZ2uUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleZ2uScrape()}
                className="flex-1 bg-background border border-border px-3 py-2 font-mono text-sm focus:border-primary outline-none"
              />
              <button
                onClick={handleZ2uScrape}
                disabled={z2uLoading || !z2uUrl.trim()}
                className="font-mono-label px-4 py-2 bg-primary text-primary-foreground inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
              >
                {z2uLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Scrape
              </button>
            </div>

            <details open={z2uShowHtml} className="border border-border p-3 bg-surface/50">
              <summary className="font-mono-label text-xs text-muted-foreground cursor-pointer">
                Or paste HTML source (if Z2U blocks the request)
              </summary>
              <textarea
                placeholder="Right-click on Z2U page → View Page Source → Copy all → Paste here..."
                className="w-full bg-background border border-border px-3 py-2 font-mono text-xs focus:border-primary outline-none mt-3 min-h-24"
                onChange={async (e) => {
                  const html = e.target.value;
                  if (html.length < 500) return;
                  setZ2uLoading(true);
                  try {
                    const resp = await fetch(`${EXPRESS_API}/api/scrape/z2u`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ html }),
                    });
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data.error);
                    setZ2uResult(data);
                    setZ2uPreview({ ...data });
                    toast.success(`Scraped: ${data.title}`);
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setZ2uLoading(false);
                  }
                }}
              />
            </details>

            {z2uResult && (
              <div className="border border-border p-4 space-y-2 bg-surface max-h-96 overflow-y-auto">
                <h4 className="font-semibold">{z2uResult.title}</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono">
                  <span className="text-muted-foreground">Price USD:</span>
                  <span className="tabular-nums">${z2uResult.price_usd}</span>
                  <span className="text-muted-foreground">Price DZD:</span>
                  <span className="tabular-nums">{z2uResult.price_dzd} DA</span>
                  <span className="text-muted-foreground">Duration:</span>
                  <span>{z2uResult.duration || "—"}</span>
                  <span className="text-muted-foreground">Account Type:</span>
                  <span>{z2uResult.account_type}</span>
                  <span className="text-muted-foreground">Offer Type:</span>
                  <span>{z2uResult.offer_type}</span>
                  <span className="text-muted-foreground">Supplier:</span>
                  <span>{z2uResult.supplier}</span>
                  <span className="text-muted-foreground">Delivery:</span>
                  <span>{z2uResult.delivery_method}</span>
                  <span className="text-muted-foreground">Family:</span>
                  <span className="text-primary">{detectFamily(z2uResult.title)}</span>
                </div>
                {z2uResult.logo_url && (
                  <div className="pt-2">
                    <span className="text-xs text-muted-foreground">Logo:</span>
                    <img src={z2uResult.logo_url} alt="logo" className="max-h-12 mt-1 border border-border" />
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => setZ2uOpen(false)}
              className="font-mono-label px-3 py-2 border border-border text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleZ2uSave}
              disabled={!z2uResult || z2uSaving}
              className="font-mono-label px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {z2uSaving && <Loader className="w-4 h-4 animate-spin" />}
              {z2uSaving ? "Saving..." : "Save Product"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
