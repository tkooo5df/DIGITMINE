import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { REVIEW_SUGGESTION_KEYS, normalizeReviewSuggestion } from "@/lib/review-suggestions";

interface Props {
  orderId: string;
  productId: string;
  userId: string;
}

export function ReviewForm({ orderId, productId, userId }: Props) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (data) setExisting(data);
      setLoading(false);
    })();
  }, [orderId]);

  const toggle = (s: string) =>
    setTags((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const submit = async () => {
    if (rating < 1) { toast.error(t("Pick a star count")); return; }
    setSubmitting(true);
    const { data, error } = await supabase.from("product_reviews").insert({
      order_id: orderId,
      product_id: productId,
      user_id: userId,
      rating,
      comment: comment.trim() || null,
      suggestions: tags,
    }).select().single();
    setSubmitting(false);
    if (error) { toast.error(t("Could not submit review")); return; }
    setExisting(data);
    toast.success(t("Thanks for your review!"));
  };

  if (loading) return null;

  if (existing) {
    return (
      <div className="border border-primary/40 bg-primary/5 p-4 rounded space-y-2">
        <div className="flex items-center gap-2">
          <p className="font-display text-sm text-primary">{t("Your review")}</p>
          <div className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`w-4 h-4 ${n <= existing.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            ))}
          </div>
        </div>
        {existing.comment && <p className="text-sm text-muted-foreground">{existing.comment}</p>}
        {existing.suggestions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {existing.suggestions.map((s: string) => (
              <span key={s} className="text-[10px] font-mono-label px-2 py-0.5 border border-border rounded">{t(normalizeReviewSuggestion(s))}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-primary/40 bg-primary/5 text-primary font-mono-label py-2.5 rounded hover:bg-primary/10"
      >
        {t("★ Rate your experience")}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md border border-border bg-surface-elevated p-5 rounded-lg shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-3 left-3 text-muted-foreground hover:text-foreground"
          aria-label={t("Close")}
        >
          <X className="w-4 h-4" />
        </button>
        <p className="font-display text-base">{t("Rate your experience")}</p>
        <div className="flex gap-1 justify-center">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
            >
              <Star className={`w-8 h-8 transition-colors ${n <= (hover || rating) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {REVIEW_SUGGESTION_KEYS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`text-xs font-mono-label px-2.5 py-1 rounded border transition-colors ${
                tags.includes(s) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t(s)}
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("Leave a comment (optional)…")}
          rows={3}
          className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none resize-none"
        />
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-primary text-primary-foreground font-mono-label py-2.5 rounded hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? t("Submitting…") : t("Submit review")}
        </button>
      </div>
    </div>
  );
}
