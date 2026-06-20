import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const lang = i18n.language?.startsWith("ar") ? "ar" : "en";
  const toggle = () => {
    const next = lang === "ar" ? "en" : "ar";
    i18n.changeLanguage(next);
    try { localStorage.setItem("lang", next); } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={t("Toggle language")}
      className={`inline-flex items-center gap-1.5 border border-border hover:border-primary hover:text-primary rounded-full font-mono-label transition-colors ${
        compact ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
      }`}
    >
      <Languages className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {lang === "ar" ? "EN" : "AR"}
    </button>
  );
}
