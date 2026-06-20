import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useOrder, STATUS_COLOR, useExchangeRates } from "@/lib/admin-data";
import { Check, X, Truck, RefreshCw, MessageSquare, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetail,
});

const TIMELINE = ["pending", "submitted", "verified", "processing", "delivered", "completed"];

function OrderDetail() {
  const { id } = Route.useParams();
  const { data: order, isLoading } = useOrder(id);
  const { data: rates = [] } = useExchangeRates();
  const qc = useQueryClient();

  if (isLoading) return <><AdminTopbar title="Order" /><main className="px-10 py-10 text-muted-foreground font-mono-label">Loading…</main></>;
  if (!order) return <><AdminTopbar title="Order not found" /><main className="px-10 py-10"><Link to="/admin/orders" className="text-primary">← All orders</Link></main></>;

  const o: any = order;
  const receipt = o.payment_receipts?.[0];
  const stepIndex = TIMELINE.indexOf(o.status);

  const update = async (patch: any) => {
    await supabase.from("orders").update(patch).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "order", id] });
    qc.invalidateQueries({ queryKey: ["admin", "orders"] });
  };

  return (
    <>
      <AdminTopbar title={o.order_number} subtitle={`${o.products?.name} · ${o.profiles?.full_name ?? "Customer"}`} />
      <main className="px-6 lg:px-10 py-10">
        <Link to="/admin/orders" className="font-mono-label text-muted-foreground hover:text-primary">← All orders</Link>

        <div className="grid lg:grid-cols-3 gap-3 mt-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="border border-border bg-surface p-8">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <p className="font-mono-label text-muted-foreground">Order</p>
                  <h2 className="font-display text-4xl mt-2">{o.products?.name}</h2>
                  <p className="text-muted-foreground mt-1">{o.product_offers?.name} · qty {o.quantity}</p>
                </div>
                <span className={`font-mono-label px-3 py-1.5 rounded ${STATUS_COLOR[o.status]}`}>{o.status}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-border">
                <Field label="USD total" value={`$${o.total_usd}`} />
                <Field label="DZD total" value={`${Number(o.total_dzd).toLocaleString()}`} />
                <Field label="Exchange rate" value={`1 USD ≈ ${o.exchange_rate_used} DZD`} />
                <Field label="Method" value={o.payment_method} />
              </div>
            </div>

            <div className="border border-border bg-surface p-8">
              <p className="font-mono-label text-muted-foreground mb-6">Status timeline</p>
              <ol className="space-y-4">
                {TIMELINE.map((step, i) => {
                  const done = i <= stepIndex;
                  return (
                    <li key={step} className="flex items-center gap-4">
                      <span className={`w-2 h-2 rounded-full ${done ? "bg-primary shadow-glow" : "bg-border"}`} />
                      <span className={`font-mono-label capitalize ${done ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="border border-border bg-surface p-8">
              <p className="font-mono-label text-muted-foreground mb-4">Internal notes</p>
              <textarea
                defaultValue={o.internal_notes ?? ""}
                onBlur={(e) => update({ internal_notes: e.target.value })}
                placeholder="Add a note for the team…"
                className="w-full bg-background border border-border rounded-md px-4 py-3 text-sm min-h-[100px] focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="border border-border bg-surface p-6">
              <p className="font-mono-label text-muted-foreground mb-4">Receipt</p>
              <div className="aspect-[4/5] bg-gradient-to-br from-surface-elevated to-background border border-border rounded grid place-items-center">
                <FileWarning className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-3">
                {receipt ? `${receipt.status} · ${new Date(receipt.created_at).toLocaleString()}` : "No receipt uploaded"}
              </p>
            </div>

            <div className="border border-border bg-surface p-6 space-y-2">
              <p className="font-mono-label text-muted-foreground mb-3">Quick actions</p>
              <Action icon={Check} label="Approve payment" primary onClick={() => update({ payment_status: "approved", status: "verified" })} />
              <Action icon={X} label="Reject receipt" onClick={() => update({ payment_status: "rejected" })} />
              <Action icon={RefreshCw} label="Mark processing" onClick={() => update({ status: "processing" })} />
              <Action icon={Truck} label="Mark delivered" onClick={() => update({ status: "delivered", delivered_at: new Date().toISOString() })} />
              <Action icon={Check} label="Mark completed" onClick={() => update({ status: "completed" })} />
              <Action icon={MessageSquare} label="Open dispute" onClick={() => update({ status: "disputed" })} />
            </div>

            <div className="border border-border bg-surface p-6">
              <p className="font-mono-label text-muted-foreground mb-3">Customer</p>
              <p className="font-display text-xl">{o.profiles?.full_name ?? "Customer"}</p>
              <p className="text-sm text-muted-foreground mt-1 font-mono">{o.profiles?.phone ?? "—"}</p>
            </div>
          </div>
        </div>
        {rates[0] && <p className="sr-only">rate {rates[0].rate}</p>}
      </main>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono-label text-muted-foreground">{label}</p>
      <p className="font-mono mt-2 capitalize">{value}</p>
    </div>
  );
}

function Action({ icon: Icon, label, primary, onClick }: { icon: any; label: string; primary?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md font-mono-label transition-all
      ${primary
        ? "bg-primary text-primary-foreground hover:shadow-glow"
        : "border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
