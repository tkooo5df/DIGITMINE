import { createFileRoute } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { STATUS_COLOR, timeAgo } from "@/lib/admin-data";
import { Send, MessageSquare, Search, Check, X, Truck, RefreshCw, Package, Copy, AlertTriangle, FileText, ArrowLeft, Info, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getReceiptAccessUrlFn } from "@/lib/receipts.functions";

export const Route = createFileRoute("/admin/chats")({
  component: ChatsPage,
});

type Thread = {
  id: string;
  order_number: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  product: string;
  offer: string;
  status: string;
  payment_status: string;
  total_dzd: number;
  payment_method: string;
  delivery_type: string;
  delivered_payload: string | null;
  delivered_at: string | null;
  created_at: string;
  last_message: string | null;
  last_at: string;
  unread: number;
};

type AdminChatMessage = {
  id: string;
  order_id: string;
  body: string | null;
  is_admin: boolean;
  sender_id: string;
  created_at: string;
  internal_note: boolean;
  attachment_url: string | null;
};

const THREAD_ORDER_LIMIT = 200;
const THREAD_MESSAGE_LIMIT = 600;
const ACTIVE_MESSAGE_LIMIT = 120;

function useThreads() {
  return useQuery({
    queryKey: ["admin", "chat-threads"],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, order_number, user_id, status, payment_status, total_dzd, payment_method, delivery_type, delivered_payload, delivered_at, created_at, products(name), product_offers(name)")
        .order("created_at", { ascending: false })
        .limit(THREAD_ORDER_LIMIT);
      if (error) throw error;
      const list = orders ?? [];
      const ids = list.map((o: any) => o.id);
      const userIds = Array.from(new Set(list.map((o: any) => o.user_id).filter(Boolean)));

      const [{ data: msgs }, { data: profiles }] = await Promise.all([
        ids.length
          ? supabase.from("order_messages")
              .select("order_id, body, created_at, is_admin")
              .in("order_id", ids)
              .order("created_at", { ascending: false })
              .limit(THREAD_MESSAGE_LIMIT)
          : Promise.resolve({ data: [] as any[] } as any),
        userIds.length
          ? supabase.from("profiles").select("id, full_name, phone").in("id", userIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const profileMap = new Map<string, any>();
      for (const p of profiles ?? []) profileMap.set(p.id, p);
      const lastByOrder = new Map<string, any>();
      const unreadByOrder = new Map<string, number>();
      for (const m of msgs ?? []) {
        if (!lastByOrder.has(m.order_id)) lastByOrder.set(m.order_id, m);
        if (!m.is_admin) unreadByOrder.set(m.order_id, (unreadByOrder.get(m.order_id) ?? 0) + 1);
      }
      const threads: Thread[] = list.map((o: any) => {
        const last = lastByOrder.get(o.id);
        const prof = profileMap.get(o.user_id);
        return {
          id: o.id,
          order_number: o.order_number,
          user_id: o.user_id,
          full_name: prof?.full_name ?? null,
          phone: prof?.phone ?? null,
          product: o.products?.name ?? "Order",
          offer: o.product_offers?.name ?? "",
          status: o.status,
          payment_status: o.payment_status,
          total_dzd: Number(o.total_dzd),
          payment_method: o.payment_method,
          delivery_type: o.delivery_type,
          delivered_payload: o.delivered_payload,
          delivered_at: o.delivered_at,
          created_at: o.created_at,
          last_message: last?.body ?? null,
          last_at: last?.created_at ?? o.created_at,
          unread: unreadByOrder.get(o.id) ?? 0,
        };
      });
      threads.sort((a, b) => +new Date(b.last_at) - +new Date(a.last_at));
      return threads;
    },
    staleTime: 2_000,
    refetchInterval: 4_000,
    refetchOnWindowFocus: true,
  });
}

function initials(name: string | null, fallback: string) {
  const src = (name && name.trim()) || fallback;
  return src.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
}

function ChatsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const getReceiptUrl = useServerFn(getReceiptAccessUrlFn);
  const { data: threads = [] } = useThreads();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      [t.full_name, t.phone, t.order_number, t.product].some((v) => v?.toLowerCase().includes(q))
    );
  }, [threads, search]);

  const active = filtered.find((t) => t.id === activeId) ?? threads.find((t) => t.id === activeId) ?? filtered[0] ?? threads[0];
  const orderId = active?.id;

  const { data: messages = [] } = useQuery({
    queryKey: ["admin", "chat-messages", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_messages")
        .select("id, order_id, body, is_admin, sender_id, created_at, internal_note, attachment_url")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(ACTIVE_MESSAGE_LIMIT);
      if (error) throw error;
      return ((data ?? []) as AdminChatMessage[]).reverse();
    },
    enabled: !!orderId,
    staleTime: 2_000,
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["admin", "chat-receipts", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_receipts")
        .select("id, file_path, created_at, amount_claimed, status")
        .eq("order_id", orderId)
        .order("created_at");
      const list = data ?? [];
      const signed = await Promise.all(
        list.map(async (r: any) => {
          try {
            if (r.file_path?.startsWith("txid:")) {
              return { ...r, url: null, isTxId: true, txId: r.file_path.substring(5) };
            }
            const { url } = await getReceiptUrl({ data: { receiptId: r.id } });
            return { ...r, url: url ?? null, isTxId: false };
          } catch {
            return { ...r, url: null, isTxId: false };
          }
        }),
      );
      return signed;
    },
    enabled: !!orderId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const mergedMessages = useMemo(() => {
    const synth = receipts.map((r: any) => ({
      id: `receipt-${r.id}`,
      order_id: orderId!,
      body: r.isTxId
        ? `🔑 Binance Pay ID: ${r.txId} — ${Number(r.amount_claimed ?? 0).toLocaleString()} DA`
        : `💳 إثبات الدفع — ${Number(r.amount_claimed ?? 0).toLocaleString()} DA`,
      is_admin: false,
      sender_id: "",
      created_at: r.created_at,
      internal_note: false,
      attachment_url: r.url,
    } as AdminChatMessage));
    const existingUrls = new Set(messages.filter(m => m.attachment_url).map(m => m.attachment_url));
    const filteredSynth = synth.filter(
      (s) =>
        (!!s.attachment_url && !existingUrls.has(s.attachment_url)) ||
        s.body.includes("Binance Pay ID")
    );
    return [...messages, ...filteredSynth].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  }, [messages, receipts, orderId]);

  const appendLiveMessage = useCallback((message: AdminChatMessage) => {
    qc.setQueryData<AdminChatMessage[]>(["admin", "chat-messages", message.order_id], (current) => {
      if (!current) return undefined;
      if (current.some((m) => m.id === message.id)) return current;
      return [...current, message].slice(-ACTIVE_MESSAGE_LIMIT);
    });
    qc.setQueryData<Thread[]>(["admin", "chat-threads"], (current = []) => {
      const existing = current.find((t) => t.id === message.order_id);
      if (!existing) return current;
      const updated = {
        ...existing,
        last_message: message.body,
        last_at: message.created_at,
        unread: message.is_admin ? existing.unread : existing.unread + 1,
      };
      return [updated, ...current.filter((t) => t.id !== message.order_id)];
    });
  }, [qc]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-chat-threads")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" },
        (payload) => appendLiveMessage(payload.new as AdminChatMessage))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" },
        () => qc.invalidateQueries({ queryKey: ["admin", "chat-threads"] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" },
        () => qc.invalidateQueries({ queryKey: ["admin", "chat-threads"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payment_receipts" },
        () => orderId && qc.invalidateQueries({ queryKey: ["admin", "chat-receipts", orderId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [appendLiveMessage, qc, orderId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mergedMessages.length, orderId]);

  const [text, setText] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [deliveryPayload, setDeliveryPayload] = useState("");
  const [rightTab, setRightTab] = useState<"delivery" | "order">("delivery");
  const [mobileView, setMobileView] = useState<"list" | "chat" | "info">("list");
  const [listCollapsed, setListCollapsed] = useState(false);
  const [infoCollapsed, setInfoCollapsed] = useState(false);

  useEffect(() => {
    setDeliveryPayload(active?.delivered_payload ?? "");
    setRightTab(active?.delivered_payload ? "order" : "delivery");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const send = async () => {
    if (!text.trim() || !orderId || !user) return;
    const body = text.trim();
    setText("");
    const { data } = await supabase.from("order_messages").insert({
      order_id: orderId, sender_id: user.id, is_admin: true, internal_note: internalNote, body,
    }).select("id, order_id, body, is_admin, sender_id, created_at, internal_note, attachment_url").single();
    if (data) appendLiveMessage(data as AdminChatMessage);
  };

  const updateOrder = async (patch: any) => {
    if (!orderId) return;
    await supabase.from("orders").update(patch).eq("id", orderId);
    // Sync receipt status so the Payments page reflects chat decisions
    if (patch.payment_status === "approved" || patch.payment_status === "rejected") {
      await supabase
        .from("payment_receipts")
        .update({ status: patch.payment_status, reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null })
        .eq("order_id", orderId);
    }
    qc.invalidateQueries({ queryKey: ["admin", "chat-threads"] });
    qc.invalidateQueries({ queryKey: ["admin", "receipts"] });
    qc.invalidateQueries({ queryKey: ["admin", "chat-receipts", orderId] });
    toast.success("Order updated");
  };

  const deliverNow = async () => {
    if (!orderId || !user) return;
    const payload = deliveryPayload.trim();
    if (!payload) return toast.error("أضف معلومات التسليم أولاً");
    await supabase.from("orders").update({
      delivered_payload: payload,
      delivered_at: new Date().toISOString(),
      status: "delivered",
    }).eq("id", orderId);
    await supabase.from("order_messages").insert({
      order_id: orderId, sender_id: user.id, is_admin: true, internal_note: false,
      body: `🎁 تم تسليم طلبك:\n\n${payload}\n\nاحتفظ بالمعلومات في مكان آمن. أي مشكلة؟ راسلنا هنا.`,
    });
    qc.invalidateQueries({ queryKey: ["admin", "chat-threads"] });
    qc.invalidateQueries({ queryKey: ["admin", "chat-messages", orderId] });
    toast.success("تم التسليم وإرسال المعلومات للزبون");
  };

  const quickReply = (body: string) => setText((t) => (t ? t + "\n" : "") + body);

  const deleteConversation = async () => {
    if (!orderId) return;
    if (!confirm("حذف كل رسائل هذه المحادثة نهائياً؟")) return;
    const { error } = await supabase.from("order_messages").delete().eq("order_id", orderId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "chat-messages", orderId] });
    qc.invalidateQueries({ queryKey: ["admin", "chat-threads"] });
    toast.success("تم حذف المحادثة");
  };

  const deleteMessage = async (messageId: string) => {
    if (!orderId) return;
    if (messageId.startsWith("receipt-")) {
      return toast.error("لا يمكن حذف الإيصال من هنا");
    }
    if (!confirm("حذف هذه الرسالة؟")) return;
    const { error } = await supabase.from("order_messages").delete().eq("id", messageId);
    if (error) return toast.error(error.message);
    qc.setQueryData<AdminChatMessage[]>(["admin", "chat-messages", orderId], (cur) =>
      cur ? cur.filter((m) => m.id !== messageId) : cur
    );
    qc.invalidateQueries({ queryKey: ["admin", "chat-threads"] });
  };

  const deleteAllConversations = async () => {
    const ids = threads.map((t) => t.id);
    if (!ids.length) return;
    if (!confirm(`⚠️ حذف رسائل ${ids.length} محادثة كلها؟ لا يمكن التراجع.`)) return;
    if (!confirm("تأكيد نهائي؟")) return;
    const { error } = await supabase.from("order_messages").delete().in("order_id", ids);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "chat-threads"] });
    qc.invalidateQueries({ queryKey: ["admin", "chat-messages", orderId] });
    toast.success("تم حذف كل المحادثات");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AdminTopbar title="Chats" subtitle={`${threads.length} conversations`} />
      <main className="flex-1 min-h-0 px-1 sm:px-2 xl:px-5 py-2 sm:py-3 overflow-hidden">
        <div className="flex border border-border bg-surface h-full min-w-0 overflow-hidden rounded-md">
          {listCollapsed && (
            <button
              onClick={() => setListCollapsed(false)}
              className="hidden md:flex w-6 shrink-0 border-r border-border bg-surface hover:bg-surface-elevated items-center justify-center text-muted-foreground hover:text-primary transition-colors group"
              title="Expand conversations"
            >
              <ChevronRight className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          )}
          {/* Sidebar — Messenger style */}
          <aside className={`border-r border-border flex-col min-h-0 min-w-0 md:w-[clamp(170px,22vw,230px)] xl:w-[260px] 2xl:w-[300px] md:shrink-0 ${listCollapsed ? "hidden" : "md:flex"} ${mobileView === "list" ? "flex flex-1" : "hidden"}`}>
            <div className="p-2.5 sm:p-3 border-b border-border flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full bg-background border border-border rounded-full pl-9 pr-3 py-1.5 text-xs sm:text-sm focus:border-primary outline-none"
                />
              </div>
              <button
                onClick={deleteAllConversations}
                title="حذف كل المحادثات"
                className="hidden md:grid place-items-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setListCollapsed(true)}
                className="hidden md:grid place-items-center w-7 h-7 rounded-md border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shrink-0"
                title="Collapse"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && <p className="p-6 text-muted-foreground font-mono-label text-center">No conversations.</p>}
              {filtered.map((t) => {
                const isActive = active?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setActiveId(t.id); setMobileView("chat"); }}
                    className={`w-full text-left px-2.5 sm:px-3 py-2.5 flex gap-2.5 items-center border-b border-border/40 transition-colors ${
                      isActive ? "bg-primary/10" : "hover:bg-surface-elevated/60"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 grid place-items-center font-display text-primary text-sm">
                        {initials(t.full_name, t.order_number)}
                      </div>
                      {t.unread > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-mono rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                          {t.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-display text-xs sm:text-sm truncate">{t.full_name || "Customer"}</p>
                        <span className="text-[9px] font-mono text-muted-foreground shrink-0">{timeAgo(t.last_at)}</span>
                      </div>
                      <p className={`text-[11px] sm:text-xs truncate ${t.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {t.last_message || `${t.product} · ${t.offer}`}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[9px] text-primary truncate">{t.order_number}</span>
                        <span className={`text-[9px] font-mono-label px-1.5 py-0.5 rounded ${STATUS_COLOR[t.status]}`}>{t.status}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Conversation */}
          <section className={`flex-col min-h-0 min-w-0 bg-background/30 md:flex md:flex-1 ${mobileView === "chat" ? "flex flex-1" : "hidden"}`}>
            {active ? (
              <>
                <header className="px-3 sm:px-5 py-2 sm:py-3 border-b border-border flex items-center gap-2 sm:gap-3">
                  <button onClick={() => setMobileView("list")} className="md:hidden p-1.5 -ml-1 rounded-md hover:bg-surface-elevated text-muted-foreground">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 grid place-items-center font-display text-primary text-sm">
                    {initials(active.full_name, active.order_number)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm sm:text-base truncate">{active.full_name || "Customer"}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground font-mono truncate">{active.phone || active.order_number}</p>
                  </div>
                  <span className={`hidden sm:inline font-mono-label text-xs px-2 py-1 rounded ${STATUS_COLOR[active.status]}`}>{active.status}</span>
                  <button
                    onClick={deleteConversation}
                    title="حذف المحادثة"
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setMobileView("info")} className="md:hidden p-1.5 rounded-md hover:bg-surface-elevated text-muted-foreground">
                    <Info className="w-4 h-4" />
                  </button>
                </header>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2">
                  {mergedMessages.length === 0 && (
                    <div className="h-full grid place-items-center text-center">
                      <div>
                        <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                        <p className="font-mono-label text-muted-foreground">No messages yet.</p>
                      </div>
                    </div>
                  )}
                  {mergedMessages.map((m: any) => {
                    const mine = m.is_admin;
                    const canDelete = !String(m.id).startsWith("receipt-");
                    return (
                      <div key={m.id} className={`group flex items-center gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                        {mine && canDelete && (
                          <button
                            onClick={() => deleteMessage(m.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="حذف الرسالة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        <div className={`max-w-[85%] sm:max-w-[70%] px-3 sm:px-4 py-2 rounded-2xl ${
                          m.internal_note
                            ? "bg-amber-500/10 border border-amber-500/30 text-amber-100"
                            : mine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-surface-elevated border border-border rounded-bl-sm"
                        }`}>
                          {m.internal_note && <p className="text-[10px] font-mono-label mb-1 opacity-70">Internal note</p>}
                          {m.body && <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                          {m.attachment_url && (
                            <a href={m.attachment_url} target="_blank" rel="noreferrer" className="block mt-2">
                              <img src={m.attachment_url} alt="receipt" className="max-w-full max-h-56 rounded border border-border/50" />
                            </a>
                          )}
                          <p className={`text-[10px] mt-1 ${mine && !m.internal_note ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {new Date(m.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        {!mine && canDelete && (
                          <button
                            onClick={() => deleteMessage(m.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="حذف الرسالة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border px-2 sm:px-3 pt-1.5 sm:pt-2 flex gap-1.5 bg-surface/60 overflow-x-auto whitespace-nowrap scrollbar-none">
                  {[
                    "مرحباً، نحن نراجع طلبك الآن.",
                    "تم تأكيد الدفع، سنبدأ التسليم.",
                    "نحتاج لقطة شاشة أوضح للإيصال.",
                    "الحساب جاهز للتسليم.",
                  ].map((q) => (
                    <button key={q} onClick={() => quickReply(q)} className="text-[10px] px-2 py-1 rounded-full border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground shrink-0">
                      {q}
                    </button>
                  ))}
                </div>
                <footer className="border-t border-border p-2 sm:p-3 flex gap-1.5 sm:gap-2 bg-surface items-center">
                  <label className="flex items-center gap-1 text-[10px] font-mono-label text-muted-foreground cursor-pointer select-none shrink-0">
                    <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} className="accent-amber-500" />
                    Note
                  </label>
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={internalNote ? "Internal note…" : "Message…"}
                    className={`flex-1 min-w-0 bg-background border rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm focus:border-primary outline-none ${internalNote ? "border-amber-500/40" : "border-border"}`}
                  />
                  <button onClick={send} className="p-2 sm:px-4 sm:py-2.5 bg-primary text-primary-foreground rounded-full hover:shadow-glow shrink-0">
                    <Send className="w-4 h-4" />
                  </button>
                </footer>
              </>
            ) : (
              <div className="flex-1 grid place-items-center text-muted-foreground font-mono-label text-xs">Select a conversation</div>
            )}
          </section>

          {/* Right panel: Delivery + Order */}
          {infoCollapsed && (
            <button
              onClick={() => setInfoCollapsed(false)}
              className="hidden md:flex w-6 shrink-0 border-l border-border bg-surface hover:bg-surface-elevated items-center justify-center text-muted-foreground hover:text-primary transition-colors group"
              title="Expand details"
            >
              <ChevronLeft className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          )}
          <aside className={`border-l border-border flex-col min-h-0 min-w-0 overflow-hidden md:w-[clamp(140px,18vw,200px)] xl:w-[260px] 2xl:w-[300px] md:shrink-0 ${infoCollapsed ? "hidden" : "md:flex"} ${mobileView === "info" ? "flex flex-1" : "hidden"}`}>
            {active ? (
              <>
                <div className="flex border-b border-border items-center shrink-0">
                  <button onClick={() => setMobileView("chat")} className="md:hidden p-3 text-muted-foreground">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setInfoCollapsed(true)}
                    className="hidden md:grid place-items-center w-8 h-8 ml-2 rounded-md text-muted-foreground hover:text-primary hover:bg-surface-elevated transition-colors shrink-0"
                    title="Collapse"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex flex-1">
                    <button
                      onClick={() => setRightTab("delivery")}
                      className={`flex-1 py-2.5 sm:py-3 text-[11px] sm:text-xs font-mono-label flex items-center justify-center gap-1.5 ${rightTab === "delivery" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
                    >
                      <Package className="w-3.5 h-3.5" /> Delivery
                    </button>
                    <button
                      onClick={() => setRightTab("order")}
                      className={`flex-1 py-2.5 sm:py-3 text-[11px] sm:text-xs font-mono-label flex items-center justify-center gap-1.5 ${rightTab === "order" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
                    >
                      <FileText className="w-3.5 h-3.5" /> Order
                    </button>
                  </div>
                </div>


                <div className="flex-1 min-h-0 overflow-y-auto">
                {rightTab === "delivery" ? (
                  <div className="p-3 sm:p-5 space-y-4">
                    <div>
                      <p className="font-mono-label text-muted-foreground">Product</p>
                      <p className="font-display text-sm mt-1 truncate">{active.product}</p>
                      <p className="text-xs text-muted-foreground truncate">{active.offer}</p>
                    </div>
                    <div>
                      <p className="font-mono-label text-muted-foreground text-[10px]">Delivery type</p>
                      <p className="text-sm font-mono mt-1 capitalize">{active.delivery_type}</p>
                    </div>

                    {active.delivered_at && (
                      <div className={`border rounded p-3 space-y-1 ${active.status === "completed" ? "bg-primary/10 border-primary/30" : "bg-amber-500/10 border-amber-500/30"}`}>
                        <p className={`font-mono-label text-[10px] flex items-center gap-1 ${active.status === "completed" ? "text-primary" : "text-amber-300"}`}>
                          <Check className="w-3 h-3" />
                          {active.status === "completed" ? `تم التأكيد ${timeAgo(active.delivered_at)}` : `أُرسل — بانتظار تأكيد الزبون (${timeAgo(active.delivered_at)})`}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="font-mono-label text-muted-foreground text-[10px] block mb-1">Account / credentials</label>
                      <textarea
                        value={deliveryPayload}
                        onChange={(e) => setDeliveryPayload(e.target.value)}
                        rows={6}
                        placeholder={"email: user@example.com\npassword: ••••••\nnotes: …"}
                        className="w-full bg-background border border-border rounded-md p-3 text-sm font-mono focus:border-primary outline-none resize-y"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={deliverNow}
                          className="flex-1 min-w-0 flex items-center justify-center gap-2 px-2 py-2 rounded-md bg-primary text-primary-foreground font-mono-label text-[10px] xl:text-xs hover:shadow-glow"
                        >
                          <Truck className="w-3.5 h-3.5" /> Deliver to customer
                        </button>
                        <button
                          onClick={() => { navigator.clipboard.writeText(deliveryPayload); toast.success("Copied"); }}
                          className="px-3 py-2 rounded-md border border-border hover:border-primary/30 text-muted-foreground"
                          title="Copy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">سيتم حفظ المعلومات وإرسالها مباشرة في المحادثة، وتغيير حالة الطلب إلى Delivered.</p>
                    </div>

                    <div className="pt-3 border-t border-border space-y-2">
                      <p className="font-mono-label text-muted-foreground mb-1">Delivery actions</p>
                      <QA icon={RefreshCw} label="Mark processing" onClick={() => updateOrder({ status: "processing" })} />
                      <QA icon={Check} label="Mark completed" onClick={() => updateOrder({ status: "completed" })} />
                      <QA icon={AlertTriangle} label="Open dispute" onClick={() => updateOrder({ status: "disputed" })} />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
                    <div>
                      <p className="font-mono-label text-muted-foreground">Order</p>
                      <p className="font-mono text-sm text-primary mt-1 break-all">{active.order_number}</p>
                    </div>
                    <div>
                      <p className="font-mono-label text-muted-foreground">Customer</p>
                      <p className="font-display text-sm mt-1">{active.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{active.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="font-mono-label text-muted-foreground">Total</p>
                      <p className="font-mono text-lg xl:text-2xl text-primary mt-1 break-words">{active.total_dzd.toLocaleString()} DA</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="font-mono-label text-muted-foreground text-[10px]">Method</p>
                        <p className="text-sm font-mono mt-1 capitalize">{active.payment_method}</p>
                      </div>
                      <div>
                        <p className="font-mono-label text-muted-foreground text-[10px]">Payment</p>
                        <p className="text-sm font-mono mt-1 capitalize">{active.payment_status}</p>
                      </div>
                    </div>
                    <div className="space-y-2 pt-3 border-t border-border">
                      <p className="font-mono-label text-muted-foreground mb-2">Payment</p>
                      {receipts.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {receipts.map((receipt: any) => (
                            <div
                              key={receipt.id}
                              className="overflow-hidden rounded-md border border-border bg-background/50"
                            >
                              {receipt.isTxId ? (
                                <div className="p-3 text-xs flex flex-col gap-1 select-all">
                                  <span className="text-muted-foreground font-mono-label">Binance Pay Transaction ID:</span>
                                  <span className="font-mono text-primary font-medium text-sm break-all">{receipt.txId}</span>
                                </div>
                              ) : receipt.url ? (
                                <a href={receipt.url} target="_blank" rel="noreferrer" className="block">
                                  <img src={receipt.url} alt="Payment receipt" className="w-full max-h-56 object-contain bg-background" />
                                </a>
                              ) : (
                                <div className="p-3 text-xs text-muted-foreground">Receipt image unavailable</div>
                              )}
                              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[10px] font-mono-label text-muted-foreground">
                                <span>{Number(receipt.amount_claimed ?? 0).toLocaleString()} DA</span>
                                <span className="capitalize">{receipt.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <QA icon={Check} label="Approve payment" primary onClick={() => updateOrder({ payment_status: "approved", status: "processing" })} />
                      <QA icon={X} label="Reject receipt" onClick={() => updateOrder({ payment_status: "rejected" })} />
                    </div>
                  </div>
                )}
                </div>
              </>
            ) : (
              <p className="p-5 text-muted-foreground font-mono-label">No order selected</p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function QA({ icon: Icon, label, primary, onClick }: { icon: any; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md font-mono-label text-xs transition-all ${
      primary ? "bg-primary text-primary-foreground hover:shadow-glow" : "border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
    }`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
