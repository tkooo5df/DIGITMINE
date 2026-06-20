export const REVIEW_SUGGESTION_KEYS = [
  "Fast delivery",
  "Great price",
  "Helpful support",
  "Easy to use",
  "Reliable",
  "High quality",
] as const;

const LEGACY_ARABIC_SUGGESTIONS: Record<string, (typeof REVIEW_SUGGESTION_KEYS)[number]> = {
  "سريع التسليم": "Fast delivery",
  "سعر ممتاز": "Great price",
  "دعم مفيد": "Helpful support",
  "سهل الاستخدام": "Easy to use",
  "موثوق": "Reliable",
  "جودة عالية": "High quality",
};

export function normalizeReviewSuggestion(value: string) {
  return LEGACY_ARABIC_SUGGESTIONS[value] ?? value;
}