import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { ar } from "./ar";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "ar"],
  interpolation: { escapeValue: false },
});

export function applyDirection(lang: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

i18n.on("languageChanged", applyDirection);

// Restore user's language only after the initial page has hydrated.
if (typeof window !== "undefined") {
  const restoreLanguage = () => {
    try {
      const stored = localStorage.getItem("lang");
      if (stored && stored !== i18n.language && (stored === "ar" || stored === "en")) {
        i18n.changeLanguage(stored);
      } else {
        applyDirection(i18n.language || "en");
      }
    } catch {
      applyDirection(i18n.language || "en");
    }
  };
  if (document.readyState === "complete") {
    window.setTimeout(restoreLanguage, 250);
  } else {
    window.addEventListener("load", () => window.setTimeout(restoreLanguage, 250), { once: true });
  }
}

export default i18n;
