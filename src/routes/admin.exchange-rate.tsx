import { createFileRoute } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useExchangeRates } from "@/lib/admin-data";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants";

export const Route = createFileRoute("/admin/exchange-rate")({
  component: RatePage,
});

function RatePage() {
  const { data: rates = [], isLoading } = useExchangeRates();
  const current = rates[0];
  const [newRate, setNewRate] = useState<string>("");
  const qc = useQueryClient();

  const save = async () => {
    const r = Number(newRate);
    if (!r) return;
    await supabase.from("exchange_rate").insert({ rate: r });
    setNewRate("");
    qc.invalidateQueries({ queryKey: ["admin", "exchange-rates"] });
    qc.invalidateQueries({ queryKey: ["admin", "dashboard-stats"] });
  };

  const rate = current?.rate ?? DEFAULT_EXCHANGE_RATE;

  return (
    <>
      <AdminTopbar title="Exchange Rate" subtitle="USD → DZD" />
      <main className="px-6 lg:px-10 py-10 grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 border border-border bg-surface p-10">
          <p className="font-mono-label text-muted-foreground">Current rate</p>
          <div className="flex items-baseline gap-3 mt-4">
            <span className="font-display text-7xl tracking-tight">{rate}</span>
            <span className="font-mono text-muted-foreground">DZD / USD</span>
          </div>
          {current && <p className="text-sm text-muted-foreground mt-2">Last updated {new Date(current.created_at).toLocaleString()}</p>}

          <div className="mt-10 flex gap-3 items-end">
            <div className="flex-1">
              <label className="font-mono-label text-muted-foreground">New rate</label>
              <input
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder={String(rate)}
                className="w-full mt-2 bg-background border border-border rounded-md px-4 py-3 font-mono text-2xl focus:border-primary outline-none"
              />
            </div>
            <button onClick={save} className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-mono-label hover:shadow-glow flex items-center gap-2">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Update
            </button>
          </div>

          <div className="mt-10 p-6 bg-background border border-border">
            <p className="font-mono-label text-muted-foreground">Preview</p>
            <p className="font-display text-2xl mt-3">$10 ≈ <span className="text-primary">{(10 * rate).toLocaleString()} DZD</span></p>
            <p className="font-display text-2xl mt-1">$25 ≈ <span className="text-primary">{(25 * rate).toLocaleString()} DZD</span></p>
          </div>
        </div>

        <div className="border border-border bg-surface p-6">
          <p className="font-mono-label text-muted-foreground mb-4">History</p>
          {isLoading && <p className="text-muted-foreground font-mono-label">Loading…</p>}
          <ul className="divide-y divide-border">
            {rates.map((h: any) => (
              <li key={h.id} className="py-3">
                <div className="flex justify-between">
                  <span className="font-mono text-sm">{h.rate} DZD</span>
                  <span className="font-mono-label text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
