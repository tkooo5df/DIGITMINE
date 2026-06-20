import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <span className="block w-2 h-2 rounded-full bg-primary shadow-glow" />
      <span className="font-display text-xl tracking-tight uppercase">
        DIGIT<span className="text-primary">MINE</span>
      </span>
    </Link>
  );
}
