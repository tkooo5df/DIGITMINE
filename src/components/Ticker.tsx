const ITEMS = [
  "Netflix", "Spotify", "ChatGPT Plus", "PUBG UC", "IPTV", "Disney+",
  "Apple Music", "Steam", "PlayStation", "Xbox", "Amazon Prime", "YouTube Premium",
  "Crunchyroll", "Adobe CC", "Canva Pro", "Discord Nitro", "Tinder Gold", "Office 365",
];

export function Ticker() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="border-y border-border overflow-hidden bg-surface">
      <div className="flex gap-12 py-5 animate-[scroll_60s_linear_infinite] whitespace-nowrap">
        {row.map((item, i) => (
          <span key={i} className="font-mono-label text-muted-foreground flex items-center gap-12">
            {item}
            <span className="text-primary">✦</span>
          </span>
        ))}
      </div>
      <style>{`@keyframes scroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}
