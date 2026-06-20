import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useReceipts } from "@/lib/admin-data";
import { Check, X, ZoomIn, Search, User, Trash2, CheckSquare, Square, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { timeAgo } from "@/lib/admin-data";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { syncReceiptStatusToTelegram } from "@/lib/telegram.functions";
import { deleteReceiptFiles, getReceiptAccessUrlFn } from "@/lib/receipts.functions";

export const Route = createFileRoute("/admin/payments")({
  component: PaymentsPage,
});

const STATUS_STYLES: Record<string, string> = {
  submitted: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  approved: "text-primary bg-primary/10 border-primary/30",
  rejected: "text-destructive bg-destructive/10 border-destructive/30",
  pending: "text-muted-foreground bg-surface border-border",
};

const TABS = ["all", "submitted", "approved", "rejected"] as const;

function PaymentsPage() {
  const { data: receipts = [], isLoading } = useReceipts();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ url: string; meta: string } | null>(null);

  const userIds = useMemo(
    () => Array.from(new Set(receipts.map((r: any) => r.user_id).filter(Boolean))),
    [receipts]
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin", "receipts-profiles", userIds.join(",")],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, phone").in("id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of profiles as any[]) m.set(p.id, p);
    return m;
  }, [profiles]);

  const syncTg = useServerFn(syncReceiptStatusToTelegram);
  const getReceiptUrl = useServerFn(getReceiptAccessUrlFn);
  const removeReceiptFiles = useServerFn(deleteReceiptFiles);

  const review = async (id: string, orderId: string, status: "approved" | "rejected") => {
    await supabase.from("payment_receipts").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("orders").update({ payment_status: status, status: status === "approved" ? "processing" : "submitted" }).eq("id", orderId);
    qc.invalidateQueries({ queryKey: ["admin", "receipts"] });
    qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    qc.invalidateQueries({ queryKey: ["admin", "chat-threads"] });
    try { await syncTg({ data: { receiptId: id } }); } catch (e) { console.warn("telegram sync failed", e); }
  };

  const openReceipt = async (r: any) => {
    if (!r.file_path) return toast.error("لا يوجد ملف للفاتورة");
    if (r.file_path.startsWith("txid:")) {
      const txid = r.file_path.substring(5);
      navigator.clipboard.writeText(txid);
      return toast.success(`تم نسخ معرف دفع Binance Pay: ${txid}`);
    }
    const { url } = await getReceiptUrl({ data: { receiptId: r.id } });
    if (!url) return toast.error("تعذّر فتح الفاتورة");
    const meta = `${r.orders?.order_number ?? ""} · ${Number(r.amount_claimed ?? r.orders?.total_dzd ?? 0).toLocaleString()} DA · ${r.status}`;
    setPreview({ url, meta });
  };

  const deleteReceipts = async (ids: string[]) => {
    if (ids.length === 0) return;
    await removeReceiptFiles({ data: { receiptIds: ids } });
    const { error } = await supabase.from("payment_receipts").delete().in("id", ids);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "receipts"] });
    setSelected(new Set());
    toast.success(`تم حذف ${ids.length} فاتورة`);
  };

  const deleteOne = async (r: any) => {
    if (!confirm(`حذف هذه الفاتورة نهائياً؟`)) return;
    await deleteReceipts([r.id]);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`حذف ${selected.size} فاتورة المحددة نهائياً؟`)) return;
    await deleteReceipts(Array.from(selected));
  };

  const deleteAll = async () => {
    const ids = (receipts as any[]).map((r) => r.id);
    if (!ids.length) return;
    if (!confirm(`⚠️ حذف كل الفواتير (${ids.length}) نهائياً؟`)) return;
    if (!confirm("تأكيد نهائي؟")) return;
    await deleteReceipts(ids);
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Group receipts by customer (CRM-style)
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, { user_id: string; profile: any; receipts: any[] }>();
    for (const r of receipts as any[]) {
      if (tab !== "all" && r.status !== tab) continue;
      const prof = profileMap.get(r.user_id);
      if (q) {
        const hay = [prof?.full_name, prof?.phone, r.orders?.order_number, r.orders?.products?.name]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const cur: { user_id: string; profile: any; receipts: any[] } =
        map.get(r.user_id) ?? { user_id: r.user_id, profile: prof, receipts: [] };
      cur.receipts.push(r);
      map.set(r.user_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => {
      const at = Math.max(...a.receipts.map((r) => +new Date(r.created_at)));
      const bt = Math.max(...b.receipts.map((r) => +new Date(r.created_at)));
      return bt - at;
    });
  }, [receipts, profileMap, tab, search]);

  const counts = useMemo(() => ({
    submitted: receipts.filter((r: any) => r.status === "submitted").length,
    approved: receipts.filter((r: any) => r.status === "approved").length,
    rejected: receipts.filter((r: any) => r.status === "rejected").length,
    total: receipts.length,
  }), [receipts]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  return (
    <>
      <AdminTopbar title="Payments CRM" subtitle={`${counts.submitted} pending · ${counts.total} total receipts`} />
      <main className="px-6 lg:px-10 py-10 space-y-6">
        <div className="grid sm:grid-cols-4 gap-3">
          {[
            { l: "Pending", v: counts.submitted, key: "submitted" as const },
            { l: "Approved", v: counts.approved, key: "approved" as const },
            { l: "Rejected", v: counts.rejected, key: "rejected" as const },
            { l: "Total", v: counts.total, key: "all" as const },
          ].map((s) => (
            <button
              key={s.l}
              onClick={() => setTab(s.key)}
              className={`text-left border bg-surface p-5 transition-colors ${tab === s.key ? "border-primary" : "border-border hover:border-primary/30"}`}
            >
              <p className="font-mono-label text-muted-foreground">{s.l}</p>
              <p className="font-display text-3xl mt-3">{s.v}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`font-mono-label px-3 py-1.5 rounded-md border capitalize ${tab === t ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer, phone, order, product…"
              className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-1.5 text-sm focus:border-primary outline-none"
            />
          </div>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <button
                onClick={deleteSelected}
                className="font-mono-label px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> حذف المحدد ({selected.size})
              </button>
            )}
            <button
              onClick={deleteAll}
              className="font-mono-label px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" /> حذف الكل
            </button>
          </div>
        </div>

        {isLoading && <p className="text-center text-muted-foreground font-mono-label py-12">Loading…</p>}
        {!isLoading && grouped.length === 0 && (
          <p className="text-center text-muted-foreground font-mono-label py-12">No receipts match.</p>
        )}

        <div className="space-y-3">
          {grouped.map((g) => (
            <div key={g.user_id} className="border border-border bg-surface">
              <div className="px-5 py-3 border-b border-border flex items-center gap-3 bg-surface-elevated/40">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 grid place-items-center text-primary">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base truncate">{g.profile?.full_name || "Customer"}</p>
                  <p className="font-mono text-xs text-muted-foreground truncate">{g.profile?.phone ?? "—"}</p>
                </div>
                <span className="font-mono-label text-xs text-muted-foreground">
                  {g.receipts.length} payment{g.receipts.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="divide-y divide-border/50">
                {g.receipts.map((r: any) => {
                  const isSel = selected.has(r.id);
                  return (
                  <div key={r.id} className={`px-5 py-4 grid md:grid-cols-12 gap-3 items-center ${isSel ? "bg-primary/5" : ""}`}>
                    <div className="md:col-span-1 flex justify-start">
                      <button
                        onClick={() => toggle(r.id)}
                        className={`w-6 h-6 grid place-items-center rounded border ${isSel ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                      >
                        {isSel ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="md:col-span-3 min-w-0">
                      <Link to="/admin/orders/$id" params={{ id: r.orders?.id ?? r.order_id }} className="font-mono text-xs text-primary hover:underline">
                        {r.orders?.order_number ?? "—"}
                      </Link>
                      <p className="font-display text-sm truncate mt-0.5">{r.orders?.products?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{r.orders?.payment_method ?? "—"}</p>
                    </div>
                    <div className="md:col-span-2 text-right md:text-left">
                      <p className="font-display text-base">${Number(r.orders?.total_usd ?? 0)}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {Number(r.orders?.total_dzd ?? r.amount_claimed ?? 0).toLocaleString()} DA
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <span className={`inline-block font-mono-label text-xs px-2 py-1 rounded border capitalize ${STATUS_STYLES[r.status] ?? STATUS_STYLES.pending}`}>
                        {r.status}
                      </span>
                      <p className="font-mono text-[11px] text-muted-foreground mt-1">{timeAgo(r.created_at)} ago</p>
                    </div>
                    <div className="md:col-span-1 hidden md:flex justify-center">
                      {r.file_path?.startsWith("txid:") ? (
                        <button
                          onClick={() => openReceipt(r)}
                          className="w-9 h-9 grid place-items-center border border-border rounded hover:border-primary/40 text-muted-foreground hover:text-primary"
                          title={`نسخ معرف الدفع: ${r.file_path.substring(5)}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => openReceipt(r)}
                          className="w-9 h-9 grid place-items-center border border-border rounded hover:border-primary/40 text-muted-foreground hover:text-primary"
                          title="استعراض الفاتورة"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="md:col-span-3 flex gap-2 justify-end flex-wrap">
                      {r.status !== "approved" && (
                        <button
                          onClick={() => review(r.id, r.order_id, "approved")}
                          className="flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-full px-3 py-1.5 font-mono-label text-xs hover:shadow-glow"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button
                          onClick={() => review(r.id, r.order_id, "rejected")}
                          className="flex items-center justify-center gap-1.5 border border-border rounded-full px-3 py-1.5 font-mono-label text-xs hover:border-destructive/50 hover:text-destructive"
                        >
                          <X className="w-3 h-3" /> Reject
                        </button>
                      )}
                      <button
                        onClick={() => deleteOne(r)}
                        className="flex items-center justify-center gap-1.5 border border-border rounded-full px-3 py-1.5 font-mono-label text-xs hover:border-destructive/50 hover:text-destructive"
                        title="حذف"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      {preview && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-surface border border-border rounded-md overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="font-mono text-xs text-muted-foreground truncate">{preview.meta}</p>
              <div className="flex items-center gap-2">
                <a href={preview.url} target="_blank" rel="noreferrer" className="font-mono-label text-xs text-primary hover:underline">فتح في تبويب</a>
                <button onClick={() => setPreview(null)} className="w-8 h-8 grid place-items-center rounded hover:bg-surface-elevated">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-background grid place-items-center p-4">
              {/\.pdf(\?|$)/i.test(preview.url) ? (
                <iframe src={preview.url} className="w-full h-[75vh]" title="receipt" />
              ) : (
                <img src={preview.url} alt="receipt" className="max-w-full max-h-[75vh] object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
