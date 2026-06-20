export function gradientFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, oklch(0.35 0.12 ${h1}), oklch(0.22 0.08 ${h2}))`;
}

export function letterFromName(name: string): string {
  return (name.trim()[0] || "V").toUpperCase();
}
