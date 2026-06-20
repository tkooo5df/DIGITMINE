import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Upload, Loader2, FileCheck, CheckCircle2, XCircle, ShieldCheck, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { notifyReceipt } from "@/lib/telegram.functions";
import { prepareReceiptUpload, submitBinanceTransaction } from "@/lib/receipts.functions";
import { getActivePaymentMethods } from "@/lib/orders.functions";

export const Route = createFileRoute("/orders/$orderId/pay")({
  component: PayPage,
});

type VerifyStep = "idle" | "checking-duplicate" | "calling-binance" | "verifying-amount" | "approved" | "failed";

function BinanceVerifyAnimation({ step }: { step: VerifyStep }) {
  const steps: { key: VerifyStep; label: string }[] = [
    { key: "checking-duplicate", label: "Checking transaction uniqueness…" },
    { key: "calling-binance",    label: "Contacting Binance Pay API…" },
    { key: "verifying-amount",   label: "Verifying amount & status…" },
    { key: "approved",           label: "Payment approved!" },
  ];

  if (step === "idle") return null;

  return (
    <div className="mt-4 border border-border bg-background/60 p-4 space-y-3 rounded-md">
      <p className="font-mono-label text-xs text-muted-foreground uppercase tracking-widest mb-3">
        Auto-Verification
      </p>
      {steps.map((s, i) => {
        const activeIdx  = steps.findIndex(x => x.key === step);
        const thisIdx    = i;
        const isActive   = s.key === step && step !== "approved" && step !== "failed";
        const isDone     = step === "approved" ? true : thisIdx < activeIdx;
        const isFailed   = step === "failed" && s.key === steps[activeIdx]?.key;

        return (
          <div key={s.key} className="flex items-center gap-3">
            <span className="w-5 h-5 flex-shrink-0 grid place-items-center">
              {isFailed ? (
                <XCircle className="w-4 h-4 text-destructive" />
              ) : isDone ? (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              ) : isActive ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-border" />
              )}
            </span>
            <span className={`font-mono text-xs ${
              isDone   ? "text-primary" :
              isActive ? "text-foreground" :
              isFailed ? "text-destructive" :
              "text-muted-foreground"
            }`}>
              {s.label}
            </span>
          </div>
        );
      })}

      {step === "approved" && (
        <div className="flex items-center gap-2 mt-2 text-primary">
          <ShieldCheck className="w-5 h-5" />
          <span className="font-mono-label text-sm font-semibold">Verified by Binance API</span>
        </div>
      )}
    </div>
  );
}

function PayPage() {
  const { t, i18n } = useTranslation();
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyStep, setVerifyStep] = useState<VerifyStep>("idle");
  const notify = useServerFn(notifyReceipt);
  const prepareUpload = useServerFn(prepareReceiptUpload);
  const submitBinance = useServerFn(submitBinanceTransaction);
  const fetchActiveMethods = useServerFn(getActivePaymentMethods);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-pay", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total_dzd, payment_method, status, payment_status, products(name), product_offers(name)")
        .eq("id", orderId)
        .maybeSingle();
      return data;
    },
    enabled: !!orderId,
  });

  const { data: method } = useQuery({
    queryKey: ["pm", order?.payment_method],
    queryFn: async () => {
      const list = await fetchActiveMethods();
      return list.find((m) => m.method === order!.payment_method) ?? null;
    },
    enabled: !!order?.payment_method,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 grid place-items-center text-muted-foreground font-mono-label">{t("Loading…")}</main>
      </div>
    );
  }

  if (!user) {
    navigate({ to: "/auth" });
    return null;
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 grid place-items-center">
          <div className="text-center">
            <p className="font-mono-label text-muted-foreground">{t("Order not found")}</p>
            <Link to="/shop" className="text-primary mt-2 inline-block">{t("Back to shop")}</Link>
          </div>
        </main>
      </div>
    );
  }

  const isBinance = order?.payment_method === "binance";

  const upload = async () => {
    if (isBinance) {
      if (!transactionId.trim()) return;
      setError(null);
      setSubmitting(true);
      setVerifyStep("checking-duplicate");

      try {
        // Animate through the steps while the server call runs
        const stepTimer = setTimeout(() => setVerifyStep("calling-binance"), 800);
        const stepTimer2 = setTimeout(() => setVerifyStep("verifying-amount"), 2000);

        const result = await submitBinance({
          data: {
            orderId,
            transactionId: transactionId.trim(),
            locale: i18n.language || "ar",
          },
        });

        clearTimeout(stepTimer);
        clearTimeout(stepTimer2);
        setVerifyStep("approved");

        setTimeout(() => {
          setSubmitting(false);
          navigate({ to: "/orders/$orderId/chat", params: { orderId } });
        }, 1200);

        return;
      } catch (err: any) {
        setVerifyStep("failed");
        setError(err?.message ?? t("Verification failed"));
        setSubmitting(false);
        return;
      }
    }

    if (!file) return;
    setError(null);
    setSubmitting(true);

    const ext = file.name.split(".").pop() ?? "jpg";
    let path = `${user.id}/${orderId}-${Date.now()}.${ext}`;
    let receiptUrl: string | null = null;

    const localMockMode =
      import.meta.env.DEV &&
      typeof window !== "undefined" &&
      localStorage.getItem("use_real_supabase") !== "true";

    if (localMockMode) {
      receiptUrl = URL.createObjectURL(file);
      path = `local-receipts/${path}`;
    } else {
      try {
        const uploadTarget = await prepareUpload({
          data: {
            orderId,
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
          },
        });

        path = uploadTarget.objectKey;
        receiptUrl = uploadTarget.viewUrl ?? null;

        const uploadResponse = await fetch(uploadTarget.uploadUrl, {
          method: "PUT",
          headers: file.type ? { "Content-Type": file.type } : undefined,
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }
      } catch (uploadError: any) {
        setError(uploadError?.message ?? t("Could not upload payment proof"));
        setSubmitting(false);
        return;
      }
    }

    let recRow: { id?: string } | null = null;
    let recErr: { message?: string } | null = null;

    if (localMockMode) {
      const insertResult = await supabase.from("payment_receipts").insert({
        order_id: orderId,
        user_id: user.id,
        file_path: path,
        amount_claimed: Number(order.total_dzd),
        status: "submitted",
      });
      recRow = Array.isArray(insertResult.data) ? insertResult.data[0] : insertResult.data;
      recErr = insertResult.error;
    } else {
      const insertResult = await supabase.from("payment_receipts").insert({
        order_id: orderId,
        user_id: user.id,
        file_path: path,
        amount_claimed: Number(order.total_dzd),
        status: "submitted",
      }).select("id").single();
      recRow = insertResult.data;
      recErr = insertResult.error;
    }

    if (recErr) {
      setError(recErr.message);
      setSubmitting(false);
      return;
    }
    await supabase.from("orders").update({ payment_status: "submitted", status: "submitted" }).eq("id", orderId);
    await supabase.from("order_messages").insert({
      order_id: orderId,
      sender_id: user.id,
      is_admin: false,
      internal_note: false,
      body: `💳 ${t("Payment proof")}\n• ${t("Product")}: ${(order as any)?.products?.name ?? ""}\n• ${t("Offer")}: ${(order as any)?.product_offers?.name ?? ""}\n• ${t("Amount")}: ${Number(order.total_dzd).toLocaleString()} DA\n• ${t("Payment method")}: ${order.payment_method}`,
      attachment_url: receiptUrl,
    });
    await supabase.from("notifications").insert({
      type: "receipt_submitted",
      title: t("New payment proof"),
      body: `${t("Order")} ${order.order_number} — ${(order as any).products?.name}`,
      link: `/admin/chats`,
    });
    if (recRow?.id && !localMockMode) {
      try { await notify({ data: { receiptId: recRow.id } }); } catch (e) { console.warn("telegram notify failed", e); }
    }
    setSubmitting(false);
    navigate({ to: "/orders/$orderId/chat", params: { orderId } });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">
        <p className="font-mono-label text-muted-foreground">{order.order_number}</p>
        <h1 className="font-display text-4xl mt-2">{t("Upload payment proof")}</h1>

        <div className="mt-8 grid md:grid-cols-2 gap-3">
          <div className="border border-border bg-surface p-6">
            <p className="font-mono-label text-muted-foreground">{t("Amount")}</p>
            <p className="font-mono text-3xl text-primary mt-2">{Number(order.total_dzd).toLocaleString()} DA</p>
            <div className="mt-6 space-y-1">
              <p className="font-mono-label text-muted-foreground">{t("Payment method")}</p>
              <p className="font-display text-lg">{method?.display_name ?? order.payment_method}</p>
            </div>
            {method?.account_info && (
              <div className="mt-4">
                <p className="font-mono-label text-muted-foreground">{t("Receiving account")}</p>
                <p className="font-mono text-sm bg-background/40 p-3 mt-1 break-all">{method.account_info}</p>
              </div>
            )}
            {method?.instructions && (
              <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{method.instructions}</p>
            )}
            {method?.qr_code_url && (
              <img src={method.qr_code_url} alt="QR" className="mt-4 w-40 h-40 object-contain border border-border" />
            )}
          </div>

          <div className="border border-border bg-surface p-6">
            {isBinance ? (
              <div className="space-y-4">
                {/* Binance Pay badge */}
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                  <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-300 font-mono-label">
                    Auto-verified instantly via Binance Pay API
                  </p>
                </div>

                <div>
                  <label htmlFor="txid" className="block font-mono-label text-muted-foreground mb-2">
                    {t("Binance Pay Transaction ID")}
                  </label>
                  <input
                    type="text"
                    id="txid"
                    value={transactionId}
                    onChange={(e) => {
                      setTransactionId(e.target.value);
                      if (verifyStep === "failed") setVerifyStep("idle");
                      setError(null);
                    }}
                    placeholder={t("Enter your Binance Pay Transaction ID")}
                    className="w-full bg-background border border-border rounded-md px-4 py-3 text-sm focus:border-primary outline-none font-mono"
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Find it in Binance App → Pay → Order History → Transaction ID
                  </p>
                </div>

                {/* Animated verification steps */}
                <BinanceVerifyAnimation step={verifyStep} />

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (verifyStep === "failed") {
                      setVerifyStep("idle");
                      setError(null);
                    }
                    upload();
                  }}
                  disabled={!transactionId.trim() || submitting}
                  className="w-full mt-2 bg-primary text-primary-foreground py-3 rounded-md font-mono-label hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : verifyStep === "failed" ? (
                    <RefreshCw className="w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  {verifyStep === "failed"
                    ? t("Retry Verification")
                    : submitting
                    ? t("Verifying…")
                    : t("Submit Transaction ID")}
                </button>
              </div>
            ) : (
              <>
                <p className="font-mono-label text-muted-foreground mb-3">{t("Payment receipt image")}</p>
                <label className="block aspect-[4/5] border-2 border-dashed border-border hover:border-primary/60 transition-colors cursor-pointer relative overflow-hidden">
                  {file ? (
                    <img src={URL.createObjectURL(file)} alt="receipt" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-center text-muted-foreground">
                      <div>
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p className="font-mono-label">{t("Click to choose an image")}</p>
                      </div>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                {file && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                    <FileCheck className="w-3 h-3 text-primary" /> {file.name}
                  </p>
                )}
                {error && <p className="text-sm text-destructive mt-3">{error}</p>}
                <button
                  onClick={upload}
                  disabled={!file || submitting}
                  className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-md font-mono-label hover:shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("Submit proof")}
                </button>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
