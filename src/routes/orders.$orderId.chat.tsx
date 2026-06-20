import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Send, Shield, Clock, AlertTriangle, Copy, CheckCircle2, Package } from "lucide-react";
import { toast } from "sonner";
import { ReviewForm } from "@/components/ReviewForm";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/orders/$orderId/chat")({
  component: ChatPage,
});

type Msg = {
  id: string;
  body: string | null;
  is_admin: boolean;
  sender_id: string;
  created_at: string;
  attachment_url: string | null;
};

function ChatPage() {
  const { t } = useTranslation();
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const confirmLockRef = useRef(false);
  const autoConfirmingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: order } = useQuery({
    queryKey: ["order-chat", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, product_id, total_dzd, status, payment_status, payment_method, delivered_payload, delivered_at, products(name), product_offers(name)")
        .eq("id", orderId)
        .maybeSingle();
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 4_000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["order-messages", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_messages")
        .select("id, body, is_admin, sender_id, created_at, internal_note, attachment_url")
        .eq("order_id", orderId)
        .eq("internal_note", false)
        .order("created_at");
      return (data ?? []) as Msg[];
    },
    enabled: !!orderId,
    refetchInterval: 3_000,
  });

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        () => qc.invalidateQueries({ queryKey: ["order-messages", orderId] })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => qc.invalidateQueries({ queryKey: ["order-chat", orderId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!user) return;
    const body = text.trim();
    if (!body) return;
    setText("");
    const { data } = await supabase.from("order_messages").insert({
      order_id: orderId,
      sender_id: user.id,
      is_admin: false,
      internal_note: false,
      body,
    }).select("id, body, is_admin, sender_id, created_at, attachment_url").single();
    if (data) {
      qc.setQueryData<Msg[]>(["order-messages", orderId], (cur = []) =>
        cur.some((m) => m.id === (data as any).id) ? cur : [...cur, data as Msg]
      );
    }
  };

  const reportIssue = async (reason: string) => {
    if (!user) return;
    await supabase.from("order_messages").insert({
      order_id: orderId, sender_id: user.id, is_admin: false, internal_note: false,
      body: `🚨 ${t("Customer report")}: ${reason}`,
    });
    toast.success(t("Report sent. The team will contact you soon."));
  };

  const delivered = (order as any)?.delivered_payload;
  const deliveredAt = (order as any)?.delivered_at;
  const isCompleted = order?.status === "completed";
  const awaitingConfirm = !!delivered && !isCompleted;

  const deadlineMs = deliveredAt ? new Date(deliveredAt).getTime() + 24 * 60 * 60 * 1000 : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!awaitingConfirm) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [awaitingConfirm]);
  const remainingMs = Math.max(0, deadlineMs - now);

  const confirmReceipt = async () => {
    if (!user || confirmLockRef.current || isCompleted) return;
    confirmLockRef.current = true;
    setConfirming(true);
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "completed" })
      .eq("id", orderId)
      .eq("user_id", user.id)
      .eq("status", "delivered")
      .select("id")
      .maybeSingle();

    if (error) {
      confirmLockRef.current = false;
      setConfirming(false);
      toast.error(t("Could not confirm receipt. Please try again."));
      return;
    }

    if (data?.id) {
      await supabase.from("order_messages").insert({
        order_id: orderId, sender_id: user.id, is_admin: false, internal_note: false,
        body: t("✅ I confirmed receiving the product. Thank you!"),
      });
      toast.success(t("Receipt confirmed"));
    }
    qc.invalidateQueries({ queryKey: ["order-chat", orderId] });
    confirmLockRef.current = false;
    setConfirming(false);
  };

  useEffect(() => {
    if (awaitingConfirm && deadlineMs && now >= deadlineMs && !autoConfirmingRef.current) {
      autoConfirmingRef.current = true;
      confirmReceipt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingConfirm, deadlineMs, now]);

  const fmtRemaining = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const REPORTS = [
    { label: "Account is not working", icon: AlertTriangle },
    { label: "Service is down", icon: AlertTriangle },
    { label: "Password is incorrect", icon: AlertTriangle },
    { label: "I have not received the product yet", icon: Clock },
  ];


  const statusColor = order?.payment_status === "approved" ? "text-primary" : "text-amber-300";

  if (authLoading) return null;
  if (!user) { navigate({ to: "/auth" }); return null; }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 max-w-4xl mx-auto px-4 py-4 w-full grid grid-cols-1 md:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px] gap-4 overflow-hidden">
        <section className="border border-border bg-surface flex flex-col min-h-0 overflow-hidden">
          <header className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="font-mono-label text-muted-foreground">{order?.order_number}</p>
              <p className="font-display text-lg">{(order as any)?.products?.name ?? "Order"}</p>
            </div>
            <span className={`font-mono-label flex items-center gap-1 ${statusColor}`}>
              <Clock className="w-3 h-3" /> {order?.payment_status}
            </span>
          </header>

          {delivered && (
            <div className={`shrink-0 border-b ${isCompleted ? "border-primary/40 bg-primary/10" : "border-amber-500/40 bg-amber-500/10"} px-4 py-3 space-y-2 shadow-lg`}>
              <div className={`flex items-center gap-2 ${isCompleted ? "text-primary" : "text-amber-300"}`}>
                <CheckCircle2 className="w-4 h-4" />
                <p className="font-display text-sm">
                  {isCompleted ? t("Receipt confirmed") : t("Account details sent — awaiting your confirmation")}
                </p>
              </div>
              <pre className="bg-background/60 border border-border rounded p-3 text-xs font-mono whitespace-pre-wrap break-words max-h-32 overflow-auto">{delivered}</pre>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(delivered); toast.success(t("Copied")); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border hover:border-primary/40"
                >
                  <Copy className="w-3.5 h-3.5" /> {t("Copy")}
                </button>
                {awaitingConfirm && (
                  <button
                    onClick={confirmReceipt}
                    disabled={confirming}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground font-mono-label"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {confirming ? t("Confirming…") : t("Confirm receipt")}
                  </button>
                )}
              </div>
              {awaitingConfirm && (
                <div className="border border-amber-500/40 bg-background/40 rounded p-2 text-center">
                  <p className="text-[10px] font-mono-label text-amber-300">⏳ {t("Auto-confirming in")} <span className="font-mono text-amber-200">{fmtRemaining(remainingMs)}</span></p>
                </div>
              )}
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
            <div className="text-center text-xs text-muted-foreground border border-border/50 bg-background/40 py-2 px-3 rounded">
              <Shield className="w-3 h-3 inline mr-1" />
              {t("Your order was received. The team will review the receipt and reply here soon.")}
            </div>

            {messages.map((m) => {
              const mine = m.sender_id === user.id && !m.is_admin;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-lg ${
                    mine ? "bg-primary text-primary-foreground" : "bg-surface-elevated border border-border"
                  }`}>
                    {m.is_admin && <p className="text-xs text-primary mb-1 font-mono-label">{t("Support")}</p>}
                    {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.attachment_url && (
                      <a href={m.attachment_url} target="_blank" rel="noreferrer" className="block mt-2">
                        <img src={m.attachment_url} alt={t("Attachment")} className="max-w-full max-h-64 rounded border border-border/50" />
                      </a>
                    )}
                    <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}

            {isCompleted && (order as any)?.product_id && (
              <ReviewForm orderId={orderId} productId={(order as any).product_id} userId={user.id} />
            )}
          </div>

          <footer className="border-t border-border p-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t("Type a message…")}
              className="flex-1 bg-background border border-border rounded-md px-4 py-2.5 text-sm focus:border-primary outline-none"
            />
            <button onClick={send} className="px-4 bg-primary text-primary-foreground rounded-md hover:shadow-glow">
              <Send className="w-4 h-4" />
            </button>
          </footer>
        </section>

        <aside className="border border-border bg-surface p-5 space-y-4 overflow-y-auto min-h-0">
          <div>
            <p className="font-mono-label text-muted-foreground">{t("Product")}</p>
            <p className="font-display text-lg mt-1">{(order as any)?.products?.name}</p>
            <p className="text-sm text-muted-foreground">{(order as any)?.product_offers?.name}</p>
          </div>
          <div>
            <p className="font-mono-label text-muted-foreground">{t("Amount")}</p>
            <p className="font-mono text-2xl text-primary mt-1">{Number(order?.total_dzd ?? 0).toLocaleString()} DA</p>
          </div>
          <div>
            <p className="font-mono-label text-muted-foreground">{t("Payment method")}</p>
            <p className="font-mono mt-1">{order?.payment_method}</p>
          </div>
          <div>
            <p className="font-mono-label text-muted-foreground">{t("Status")}</p>
            <p className="font-mono mt-1 capitalize">{order?.status}</p>
          </div>

          <div className="pt-3 border-t border-border space-y-2">
            <p className="font-mono-label text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400" /> {t("Report a problem")}
            </p>
            {REPORTS.map((r) => (
              <button
                key={r.label}
                onClick={() => reportIssue(r.label)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:border-amber-400/40 text-xs text-muted-foreground hover:text-foreground transition-colors text-right"
              >
                <r.icon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="flex-1 text-right">{t(r.label)}</span>
              </button>
            ))}
          </div>

          <Link to="/shop" className="block text-center text-sm text-muted-foreground hover:text-primary mt-2">
            {t("← Continue shopping")}
          </Link>
        </aside>
      </main>
    </div>
  );
}
