import { createFileRoute } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useOrders, useOffers, timeAgo } from "@/lib/admin-data";
import { Zap, AlertTriangle, Clock, Send, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/delivery")({
  component: DeliveryCenter,
});

function DeliveryCenter() {
  const { data: orders = [] } = useOrders();
  const { data: offers = [] } = useOffers();
  const qc = useQueryClient();

  const queue = orders.filter((o: any) => ["verified", "processing"].includes(o.status));
  const totalStock = offers.reduce((s: number, o: any) => s + (o.stock ?? 0), 0);
  const lowStock = offers.filter((o: any) => o.stock < 10).length;

  const fulfill = async (id: string) => {
    await supabase.from("orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin", "orders"] });
  };

  return (
    <>
      <AdminTopbar title="Delivery Center" subtitle="Real-time fulfillment workspace" />
      <main className="px-6 lg:px-10 py-10 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={Clock} label="In queue" value={String(queue.length)} />
          <Stat icon={Zap} label="Auto stock" value={String(totalStock)} />
          <Stat icon={AlertTriangle} label="Failed auto" value="0" />
          <Stat icon={AlertTriangle} label="Low stock" value={String(lowStock)} />
        </section>

        <section className="grid lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <p className="font-mono-label text-muted-foreground">Pending queue</p>
            {queue.length === 0 && <p className="text-muted-foreground font-mono-label py-8 text-center border border-border bg-surface">Queue is empty.</p>}
            {queue.map((o: any) => (
              <div key={o.id} className="border border-border bg-surface p-6 flex items-start justify-between hover:border-primary/30 transition-colors">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-primary">{o.order_number}</span>
                    <span className="font-mono-label text-muted-foreground">{o.delivery_type}</span>
                    {o.status === "processing" && <span className="font-mono-label text-amber-300">processing</span>}
                  </div>
                  <p className="font-display text-xl mt-2">{o.products?.name}</p>
                  <p className="text-sm text-muted-foreground">{o.product_offers?.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-muted-foreground">{timeAgo(o.created_at)} ago</p>
                  <button onClick={() => fulfill(o.id)} className="mt-3 font-mono-label bg-primary text-primary-foreground px-4 py-2 rounded-full hover:shadow-glow transition-all">
                    Fulfill
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border border-border bg-surface p-6 space-y-4">
            <p className="font-mono-label text-muted-foreground">Manual delivery</p>
            <h3 className="font-display text-2xl">Send credentials</h3>
            <input placeholder="Email / username" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none" />
            <input placeholder="Password / code" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none" />
            <textarea placeholder="Delivery instructions…" className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm min-h-[100px] focus:border-primary outline-none" />
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-full py-2.5 font-mono-label hover:shadow-glow">
                <Send className="w-3.5 h-3.5" /> Deliver
              </button>
              <button className="px-3 border border-border rounded-md hover:border-primary/30">
                <Copy className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="border border-border bg-surface p-5">
      <div className="flex justify-between items-start">
        <p className="font-mono-label text-muted-foreground">{label}</p>
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className="font-display text-3xl mt-3">{value}</p>
    </div>
  );
}
