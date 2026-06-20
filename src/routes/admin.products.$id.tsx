import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useCategories } from "@/lib/admin-data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Save, Trash2, ArrowLeft, Star, Copy, Link as LinkIcon, Loader, Search } from "lucide-react";
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
  if (t.includes("prime video") || t.includes("amazon prime")) return "Amazon Prime";
  if (t.includes("disney")) return "Disney+";
  if (t.includes("hbo") || t.includes("max")) return "HBO Max";
  if (t.includes("canva")) return "Canva";
  if (t.includes("adobe") && t.includes("cc")) return "Adobe CC";
  if (t.includes("adobe") && t.includes("express")) return "Adobe Express";
  if (t.includes("microsoft") || t.includes("office 365")) return "Microsoft 365";
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
  if (t.includes("alight")) return "Alight Motion";
  if (t.includes("kling")) return "Kling AI";
  if (t.includes("elevenlabs") || t.includes("eleven laps")) return "ElevenLabs";
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
  if (t.includes("viu")) return "Viu";
  if (t.includes("wetv")) return "WeTV";
  if (t.includes("iptv")) return "IPTV";
  if (t.includes("brazzers") || t.includes("pornhub") || t.includes("faphouse")) return "Adult";
  if (t.includes("pubg") && t.includes("uc")) return "PUBG";
  if (t.includes("gpt") && t.includes("go")) return "GPT Go";
  if (t.includes("hma") && t.includes("vpn")) return "HMA VPN";
  if (t.includes("sms") && (t.includes("panel") || t.includes("otp"))) return "SMS Panel";
  if (t.includes("getcontact")) return "Getcontact";
  if (t.includes("zoom")) return "Zoom";
  return "Other";
}

export const Route = createFileRoute("/admin/products/$id")({
  component: ProductEditPage,
});

type Product = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  category_id: string | null;
  family: string | null;
  main_image: string | null;
  banner_image: string | null;
  gallery: string[] | null;
  tags: string[] | null;
  delivery_type: string;
  featured: boolean;
  visible: boolean;
  rating: number;
  rating_count: number;
  sales_count: number;
  original_price_dzd: number | null;
  seo_title: string | null;
  seo_description: string | null;
  account_type: string | null;
  offer_type: string | null;
};

type Offer = {
  id: string;
  product_id: string;
  name: string;
  duration: string | null;
  warranty: string | null;
  delivery_method: string | null;
  delivery_type: string;
  supplier: string | null;
  price_dzd: number | null;
  price_usd: number;
  discount_usd: number | null;
  stock: number;
  active: boolean;
  sort_order: number;
  delivery_notes: string | null;
  product_url: string | null;
};

function ProductEditPage() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "product-edit", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data: product, error: pErr } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (pErr) throw pErr;

      const { data: offers, error: oErr } = await supabase
        .from("product_offers")
        .select("*")
        .eq("product_id", id)
        .order("sort_order");
      if (oErr) throw oErr;

      return { product, offers: offers ?? [] };
    },
  });

  const { data: allData } = useQuery({
    queryKey: ["admin", "all-offers-grouped"],
    queryFn: async () => {
      const [productsRes, offersRes] = await Promise.all([
        supabase.from("products").select("id, name, family"),
        supabase.from("product_offers").select("*"),
      ]);
      if (productsRes.error) throw productsRes.error;
      if (offersRes.error) throw offersRes.error;
      return {
        products: (productsRes.data ?? []) as { id: string; name: string; family: string | null }[],
        offers: (offersRes.data ?? []) as Offer[],
      };
    },
  });

  const productMap = useMemo(() => {
    const map = new Map<string, { name: string; family: string | null }>();
    allData?.products.forEach((prod) => map.set(prod.id, { name: prod.name, family: prod.family }));
    return map;
  }, [allData]);

  const groupedOffers = useMemo(() => {
    const groups = new Map<string, Offer[]>();
    (allData?.offers ?? [])
      .filter((o) => o.product_id === id)
      .forEach((o) => {
        const duration = o.duration?.trim() || "No Duration";
        if (!groups.has(duration)) groups.set(duration, []);
        groups.get(duration)!.push(o);
      });
    groups.forEach((list) => list.sort((a, b) => (a.price_usd ?? 0) - (b.price_usd ?? 0)));
    const durationOrder = ["1 Month", "3 Months", "6 Months", "1 Year", "12 Months"];
    const entries = Array.from(groups.entries()).sort((a, b) => {
      const ia = durationOrder.indexOf(a[0]);
      const ib = durationOrder.indexOf(b[0]);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [allData, id]);

  const [p, setP] = useState<Partial<Product>>({
    name: "",
    slug: "",
    short_description: "",
    description: "",
    category_id: null,
    family: null,
    main_image: "",
    delivery_type: "manual",
    featured: false,
    visible: true,
    rating: 0,
    rating_count: 0,
    sales_count: 0,
    original_price_dzd: null,
    account_type: null,
    offer_type: null,
  });
  const [offers, setOffers] = useState<Offer[]>([]);

  // Z2U import state
  const [z2uOpen, setZ2uOpen] = useState(false);
  const [z2uUrl, setZ2uUrl] = useState("");
  const [z2uLoading, setZ2uLoading] = useState(false);
  const [z2uResult, setZ2uResult] = useState<any>(null);
  const [z2uShowHtml, setZ2uShowHtml] = useState(false);
  const [z2uSaving, setZ2uSaving] = useState(false);

  useEffect(() => {
    if (data?.product) setP(data.product as any);
    if (data?.offers) setOffers(data.offers as any);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!p.name?.trim()) throw new Error("Name is required");
      const slug = (
        p.slug?.trim() ||
        (p.name ?? "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      );
      if (!slug) throw new Error("Invalid slug");

      const payload = {
        name: p.name!.trim(),
        slug,
        short_description: p.short_description || null,
        description: p.description || null,
        category_id: p.category_id || null,
        family: p.family?.trim() ? p.family.trim().toLowerCase() : null,
        main_image: p.main_image || null,
        banner_image: p.banner_image || null,
        delivery_type: p.delivery_type ?? "manual",
        featured: !!p.featured,
        visible: p.visible !== false,
        rating: Number(p.rating ?? 0),
        rating_count: Number(p.rating_count ?? 0),
        sales_count: Number(p.sales_count ?? 0),
        original_price_dzd: p.original_price_dzd ? Number(p.original_price_dzd) : null,
        seo_title: p.seo_title || null,
        seo_description: p.seo_description || null,
        account_type: p.account_type || null,
        offer_type: p.offer_type || null,
        tags: [p.account_type, p.offer_type].filter(Boolean) as string[],
      };

      let pid: string;

      if (isNew) {
        const { data: newProd, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        pid = newProd.id;
      } else {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
        pid = id;
      }

      const keepIds = offers.filter((o) => !o.id.startsWith("new-")).map((o) => o.id);
      if (!isNew && keepIds.length < (data?.offers?.length ?? 0)) {
        const toDelete = (data?.offers ?? [])
          .map((o: any) => o.id)
          .filter((oid: string) => !keepIds.includes(oid));
        if (toDelete.length > 0) {
          await supabase.from("product_offers").delete().in("id", toDelete);
        }
      }

      for (const o of offers) {
        const offerPayload = {
          product_id: pid,
          name: o.name || o.duration || "Offer",
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
        };

        if (o.id.startsWith("new-")) {
          const { error } = await supabase.from("product_offers").insert(offerPayload);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("product_offers")
            .update(offerPayload)
            .eq("id", o.id);
          if (error) throw error;
        }
      }

      return pid;
    },
    onSuccess: (pid) => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      if (isNew && pid) navigate({ to: "/admin/products/$id", params: { id: pid } });
    },
    onError: (e: any) => {
      console.error("save product error", e);
      toast.error(e?.message ?? "Save failed");
    },
  });

  const deleteOffer = async (offerId: string) => {
    if (offerId.startsWith("new-")) {
      setOffers((x) => x.filter((o) => o.id !== offerId));
      return;
    }
    if (!confirm("Delete this offer?")) return;
    const { error } = await supabase.from("product_offers").delete().eq("id", offerId);
    if (error) return toast.error(error.message);
    setOffers((x) => x.filter((o) => o.id !== offerId));
    qc.invalidateQueries({ queryKey: ["admin"] });
    toast.success("Deleted");
  };

  const toggleOfferVisibility = async (offerId: string, currentActive: boolean) => {
    const nextActive = currentActive === false;
    const { error } = await supabase
      .from("product_offers")
      .update({ active: nextActive })
      .eq("id", offerId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin"] });
    toast.success(nextActive ? "Offer is now visible" : "Offer is now hidden");
  };

  // Z2U link import handlers
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
      toast.success(`Scraped: ${data.title}`);
    } catch (e: any) {
      toast.error(e.message || "Scrape failed");
    } finally {
      setZ2uLoading(false);
    }
  };

  const handleZ2uSave = async () => {
    if (!z2uResult || z2uSaving) return;
    setZ2uSaving(true);
    try {
      // Save to all_products.json via Express
      const resp = await fetch(`${EXPRESS_API}/api/product/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...z2uResult, active: true }),
      });
      const saved = await resp.json();
      if (!resp.ok) throw new Error(saved.error || "Save failed");

      // Add as new offer to the current product
      setOffers((x) => [
        ...x,
        {
          id: "new-" + Math.random().toString(36).slice(2),
          product_id: id,
          name: z2uResult.title || "Z2U Import",
          duration: z2uResult.duration || "",
          warranty: z2uResult.duration || "Period of Subscription",
          delivery_method: z2uResult.delivery_method || "",
          delivery_type: "manual",
          supplier: z2uResult.supplier || "",
          price_dzd: z2uResult.price_dzd || 0,
          price_usd: z2uResult.price_usd || 0,
          discount_usd: null,
          stock: 99,
          active: true,
          sort_order: x.length,
          delivery_notes: "",
          product_url: z2uResult.product_url || "",
        },
      ]);

      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success(`Added offer: ${z2uResult.title}`);
      setZ2uOpen(false);
      setZ2uUrl("");
      setZ2uResult(null);
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setZ2uSaving(false);
    }
  };

  const deleteProduct = async () => {
    if (isNew) return;
    if (!confirm("Delete product permanently?")) return;
    await supabase.from("product_offers").delete().eq("product_id", id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin"] });
    navigate({ to: "/admin/products" });
  };

  const addOffer = () => {
    setOffers((x) => [
      ...x,
      {
        id: "new-" + Math.random().toString(36).slice(2),
        product_id: id,
        name: "New Offer",
        duration: "",
        warranty: "",
        delivery_method: "",
        delivery_type: "manual",
        supplier: "",
        price_dzd: 0,
        price_usd: 0,
        discount_usd: null,
        stock: 0,
        active: true,
        sort_order: x.length,
        delivery_notes: "",
        product_url: "",
      },
    ]);
  };

  const duplicateOffer = (i: number) => {
    setOffers((x) => {
      const src = x[i];
      if (!src) return x;
      const copy: Offer = {
        ...src,
        id: "new-" + Math.random().toString(36).slice(2),
        name: (src.name || src.duration || "Offer") + " (Copy)",
        sort_order: x.length,
      };
      const next = [...x];
      next.splice(i + 1, 0, copy);
      return next;
    });
    toast.success("Offer copied");
  };

  if (!isNew && isLoading) {
    return (
      <>
        <AdminTopbar title="Edit Product" />
        <main className="px-6 lg:px-10 py-10 text-muted-foreground font-mono-label">Loading...</main>
      </>
    );
  }

  return (
    <>
      <AdminTopbar title={isNew ? "New product" : p.name || "Edit product"} subtitle={isNew ? "Create" : id} />
      <main className="px-6 lg:px-10 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Link to="/admin/products" className="font-mono-label text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex-1" />
          {!isNew && (
            <button onClick={deleteProduct} className="font-mono-label px-4 py-2 text-destructive border border-destructive/30 hover:bg-destructive/10 inline-flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="font-mono-label px-5 py-2 bg-primary text-primary-foreground inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {save.isPending ? "..." : "Save"}
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 border border-border bg-surface p-6 space-y-4">
            <h2 className="font-display text-xl mb-2">Basic Information</h2>
            <Field label="Name">
              <input className={inp} value={p.name ?? ""} onChange={(e) => setP({ ...p, name: e.target.value })} />
            </Field>
            <Field label="Slug">
              <input className={inp} value={p.slug ?? ""} onChange={(e) => setP({ ...p, slug: e.target.value })} placeholder="auto-generated" />
            </Field>
            <Field label="Category">
              <select className={inp} value={p.category_id ?? ""} onChange={(e) => setP({ ...p, category_id: e.target.value || null })}>
                <option value="">-- None --</option>
                {(() => {
                  const sortedCats: any[] = [];
                  const parentCats = categories.filter((c: any) => !c.parent_id);
                  const subCats = categories.filter((c: any) => c.parent_id);
                  parentCats.forEach((parent: any) => {
                    sortedCats.push({ id: parent.id, name: parent.name });
                    subCats
                      .filter((sub: any) => sub.parent_id === parent.id)
                      .forEach((sub: any) => {
                        sortedCats.push({ id: sub.id, name: `    > ${sub.name}` });
                      });
                  });
                  const orphaned = subCats.filter((sub: any) => !categories.some((pc: any) => pc.id === sub.parent_id));
                  orphaned.forEach((sub: any) => {
                    sortedCats.push({ id: sub.id, name: `> ${sub.name}` });
                  });
                  return sortedCats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ));
                })()}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Account Type">
                <select className={inp} value={p.account_type ?? ""} onChange={(e) => setP({ ...p, account_type: e.target.value || null })}>
                  <option value="">-- None --</option>
                  <option value="Private">Private</option>
                  <option value="Shared">Shared</option>
                  <option value="Family">Family</option>
                </select>
              </Field>
              <Field label="Offer Type">
                <select className={inp} value={p.offer_type ?? ""} onChange={(e) => setP({ ...p, offer_type: e.target.value || null })}>
                  <option value="">-- None --</option>
                  <option value="Premium">Premium</option>
                  <option value="Pro">Pro</option>
                  <option value="Plus">Plus</option>
                  <option value="Max">Max</option>
                  <option value="Basic">Basic</option>
                  <option value="Standard">Standard</option>
                  <option value="Free">Free</option>
                  <option value="Trial">Trial</option>
                  <option value="Lite">Lite</option>
                </select>
              </Field>
            </div>
            <Field label="Family (products with same value show as Similar)">
              <input
                className={inp}
                value={p.family ?? ""}
                onChange={(e) => setP({ ...p, family: e.target.value })}
                placeholder="e.g. spotify, netflix, chatgpt"
              />
            </Field>
            <Field label="Short Description">
              <input className={inp} value={p.short_description ?? ""} onChange={(e) => setP({ ...p, short_description: e.target.value })} />
            </Field>
            <Field label="Full Description">
              <textarea className={`${inp} min-h-32`} value={p.description ?? ""} onChange={(e) => setP({ ...p, description: e.target.value })} />
            </Field>
            <Field label="Main Image URL">
              <input className={inp} value={p.main_image ?? ""} onChange={(e) => setP({ ...p, main_image: e.target.value })} placeholder="/products/xxx.jpg or https://..." />
              {p.main_image && (
                <img src={p.main_image} alt="" className="mt-3 max-h-40 object-contain border border-border" />
              )}
            </Field>
          </section>

          <section className="space-y-6">
            <div className="border border-border bg-surface p-6 space-y-4">
              <h2 className="font-display text-xl">Store Display</h2>
              <Toggle label="Visible to customers" value={p.visible !== false} onChange={(v) => {
                setP({ ...p, visible: v });
                supabase.from("products").update({ visible: v }).eq("id", id).then(() => {
                  qc.invalidateQueries({ queryKey: ["admin"] });
                  qc.invalidateQueries({ queryKey: ["catalog"] });
                });
              }} />
              <Toggle label="Featured" value={!!p.featured} onChange={(v) => setP({ ...p, featured: v })} />
              <Field label="Original Price before discount (DA)">
                <input type="number" className={inp} value={p.original_price_dzd ?? ""} onChange={(e) => setP({ ...p, original_price_dzd: e.target.value ? Number(e.target.value) : null })} placeholder="optional - shows as strikethrough" />
              </Field>
            </div>
            <div className="border border-border bg-surface p-6 space-y-4">
              <h2 className="font-display text-xl flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" /> Rating & Sales
              </h2>
              <Field label="Rating (0 - 5)">
                <input type="number" step="0.1" min="0" max="5" className={inp} value={p.rating ?? 0} onChange={(e) => setP({ ...p, rating: Number(e.target.value) })} />
              </Field>
              <Field label="Review Count">
                <input type="number" className={inp} value={p.rating_count ?? 0} onChange={(e) => setP({ ...p, rating_count: Number(e.target.value) })} />
              </Field>
              <Field label="Buyer Count">
                <input type="number" className={inp} value={p.sales_count ?? 0} onChange={(e) => setP({ ...p, sales_count: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="border border-border bg-surface p-6 space-y-4">
              <h2 className="font-display text-xl">SEO</h2>
              <Field label="SEO Title">
                <input className={inp} value={p.seo_title ?? ""} onChange={(e) => setP({ ...p, seo_title: e.target.value })} />
              </Field>
              <Field label="SEO Description">
                <textarea className={`${inp} min-h-20`} value={p.seo_description ?? ""} onChange={(e) => setP({ ...p, seo_description: e.target.value })} />
              </Field>
            </div>
          </section>
        </div>

        <section className="border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">Offers / Prices / Stock</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => { setZ2uOpen(true); setZ2uResult(null); setZ2uUrl(""); setZ2uShowHtml(false); }} className="font-mono-label px-3 py-2 border border-primary/40 text-primary hover:bg-primary/10 inline-flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> Z2U Import
              </button>
              <button onClick={addOffer} className="font-mono-label px-3 py-2 border border-primary text-primary hover:bg-primary/10 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Offer
              </button>
            </div>
          </div>

          {/* Current product offers (editable) */}
          <div className="mb-8">
            <h3 className="font-mono-label text-muted-foreground mb-3">Product Offers</h3>
            <div className="space-y-3">
              {offers.length === 0 && <p className="text-muted-foreground font-mono-label">No offers. Add one.</p>}
              {offers.map((o, i) => (
                <div key={o.id} className={`border border-border bg-background ${o.active === false ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-surface">
                    <span className="font-display text-sm">{p.name || 'Product'}{o.duration ? ` - ${o.duration}` : ''}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleOfferVisibility(o.id, o.active)}
                        className={`font-mono-label text-[10px] px-2 py-1 border ${o.active === false ? 'border-muted-foreground/30 text-muted-foreground' : 'border-primary/30 text-primary'} hover:opacity-80`}
                      >
                        {o.active === false ? 'Hidden' : 'Visible'}
                      </button>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-12 gap-3 items-end p-3">
                    <div className="md:col-span-2">
                      <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Duration</label>
                      <input className={inp} placeholder="e.g. 1 Month" value={o.duration ?? ""} onChange={(e) => updOffer(setOffers, i, { duration: e.target.value, name: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Price (DA)</label>
                      <input type="number" className={inp} placeholder="DA" value={o.price_dzd ?? 0} onChange={(e) => updOffer(setOffers, i, { price_dzd: Number(e.target.value) })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Price (USD)</label>
                      <input type="number" step="0.01" className={inp} placeholder="USD" value={o.price_usd ?? 0} onChange={(e) => updOffer(setOffers, i, { price_usd: Number(e.target.value) })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Stock</label>
                      <input type="number" className={inp} value={o.stock ?? 0} onChange={(e) => updOffer(setOffers, i, { stock: Number(e.target.value) })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Supplier</label>
                      <input className={inp} placeholder="@username" value={o.supplier ?? ""} onChange={(e) => updOffer(setOffers, i, { supplier: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Product URL</label>
                      <input className={inp} placeholder="https://..." value={o.product_url ?? ""} onChange={(e) => updOffer(setOffers, i, { product_url: e.target.value })} />
                    </div>
                    <div className="md:col-span-1">
                      <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Sort</label>
                      <input type="number" className={inp} value={o.sort_order ?? 0} onChange={(e) => updOffer(setOffers, i, { sort_order: Number(e.target.value) })} />
                    </div>
                    <div className="md:col-span-1 flex justify-end gap-2 items-end pb-1">
                      <button onClick={() => duplicateOffer(i)} className="font-mono-label text-primary hover:underline inline-flex items-center gap-1 text-[10px]" title="Copy">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                      <button onClick={() => deleteOffer(o.id)} className="font-mono-label text-destructive hover:underline inline-flex items-center gap-1 text-[10px]">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* All offers grouped by duration */}
          <div>
            <h3 className="font-mono-label text-muted-foreground mb-3">All Offers by Duration (Lowest price first)</h3>
            {groupedOffers.length === 0 && <p className="text-muted-foreground font-mono-label">Loading all offers...</p>}
            <div className="space-y-6">
              {groupedOffers.map(([duration, list]) => (
                <div key={duration}>
                  <h4 className="font-display text-lg mb-2 text-primary">{duration}</h4>
                  <div className="space-y-2">
                    {list.map((o) => {
                      const prod = productMap.get(o.product_id);
                      const fullName = o.name || `${prod?.name || 'Unknown'}${o.duration ? ` - ${o.duration}` : ''}`;
                      return (
                        <div key={o.id} className={`border border-border bg-background ${o.active === false ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-surface">
                            <div className="flex items-center gap-2">
                              <input
                                className="font-display text-sm bg-transparent border-b border-transparent focus:border-primary outline-none min-w-[200px]"
                                value={fullName}
                                onChange={(e) => {
                                  const allOffers = allData?.offers ?? [];
                                  const idx = allOffers.findIndex((x) => x.id === o.id);
                                  if (idx !== -1) {
                                    const next = [...allOffers];
                                    next[idx] = { ...next[idx], name: e.target.value };
                                    // Update via Supabase directly for simplicity
                                    supabase.from("product_offers").update({ name: e.target.value }).eq("id", o.id).then(() => qc.invalidateQueries({ queryKey: ["admin"] }));
                                  }
                                }}
                              />
                              {prod?.family && <span className="font-mono-label text-[10px] text-muted-foreground bg-surface-elevated px-2 py-0.5">{prod.family}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono-label text-[10px] text-muted-foreground">${o.price_usd}</span>
                              <button
                                onClick={() => toggleOfferVisibility(o.id, o.active)}
                                className={`font-mono-label text-[10px] px-2 py-1 border ${o.active === false ? 'border-muted-foreground/30 text-muted-foreground' : 'border-primary/30 text-primary'} hover:opacity-80`}
                              >
                                {o.active === false ? 'Hidden' : 'Visible'}
                              </button>
                            </div>
                          </div>
                          <div className="grid md:grid-cols-12 gap-3 items-end p-3">
                            <div className="md:col-span-2">
                              <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Price (DA)</label>
                              <input type="number" className={inp} value={o.price_dzd ?? 0} onChange={(e) => {
                                supabase.from("product_offers").update({ price_dzd: Number(e.target.value) }).eq("id", o.id).then(() => qc.invalidateQueries({ queryKey: ["admin"] }));
                              }} />
                            </div>
                            <div className="md:col-span-2">
                              <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Price (USD)</label>
                              <input type="number" step="0.01" className={inp} value={o.price_usd ?? 0} onChange={(e) => {
                                supabase.from("product_offers").update({ price_usd: Number(e.target.value) }).eq("id", o.id).then(() => qc.invalidateQueries({ queryKey: ["admin"] }));
                              }} />
                            </div>
                            <div className="md:col-span-2">
                              <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Stock</label>
                              <input type="number" className={inp} value={o.stock ?? 0} onChange={(e) => {
                                supabase.from("product_offers").update({ stock: Number(e.target.value) }).eq("id", o.id).then(() => qc.invalidateQueries({ queryKey: ["admin"] }));
                              }} />
                            </div>
                            <div className="md:col-span-2">
                              <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Supplier</label>
                              <input className={inp} value={o.supplier ?? ""} onChange={(e) => {
                                supabase.from("product_offers").update({ supplier: e.target.value }).eq("id", o.id).then(() => qc.invalidateQueries({ queryKey: ["admin"] }));
                              }} />
                            </div>
                            <div className="md:col-span-3">
                              <label className="font-mono-label text-muted-foreground block mb-1 text-[10px]">Product URL</label>
                              <input className={inp} value={o.product_url ?? ""} onChange={(e) => {
                                supabase.from("product_offers").update({ product_url: e.target.value }).eq("id", o.id).then(() => qc.invalidateQueries({ queryKey: ["admin"] }));
                              }} />
                            </div>
                            <div className="md:col-span-1 flex justify-end items-end pb-1">
                              <Link to="/admin/products/$id" params={{ id: o.product_id }} className="font-mono-label text-primary hover:underline text-[10px]">
                                Edit Product
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Z2U Import Dialog */}
      <Dialog open={z2uOpen} onOpenChange={setZ2uOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Z2U Link Import</DialogTitle>
            <DialogDescription>
              Paste a Z2U product URL to scrape and add it as an offer.
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
              {z2uSaving ? "Saving..." : "Add as Offer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const inp = "w-full bg-background border border-border px-3 py-2 font-mono text-sm focus:border-primary outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono-label text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <span className="font-mono-label">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-colors ${value ? "bg-primary" : "bg-border"}`}
      >
        <span className={`block w-5 h-5 bg-background rounded-full transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

function updOffer(setOffers: React.Dispatch<React.SetStateAction<Offer[]>>, i: number, patch: Partial<Offer>) {
  setOffers((x) => x.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
}
