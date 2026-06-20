import { TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({ label, value, trend, up }: { label: string; value: string; trend: string; up: boolean }) {
  return (
    <div className="group p-6 border border-border bg-surface hover:border-primary/30 transition-all duration-500">
      <p className="font-mono-label text-muted-foreground">{label}</p>
      <p className="font-display text-4xl mt-4 tracking-tight">{value}</p>
      <div className={`flex items-center gap-1.5 mt-3 font-mono text-xs ${up ? "text-primary" : "text-destructive"}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {trend}
      </div>
    </div>
  );
}

export function Sparkline({ points = [4, 7, 5, 9, 6, 11, 8, 13, 10, 15, 12, 18] }: { points?: number[] }) {
  const w = 320, h = 80, max = Math.max(...points), min = Math.min(...points);
  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.88 0.24 135)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.88 0.24 135)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#sparkfill)" />
      <polyline points={pts} fill="none" stroke="oklch(0.88 0.24 135)" strokeWidth="1.5" />
    </svg>
  );
}
