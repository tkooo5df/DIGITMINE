import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { usePaymentMethods } from "@/lib/admin-data";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

const SECTIONS = ["General", "Branding", "Payments", "Delivery", "Notifications", "Security", "Legal"];

function SettingsPage() {
  const { data: methods = [] } = usePaymentMethods();
  return (
    <>
      <AdminTopbar title="Settings" subtitle="Workspace configuration" />
      <main className="px-6 lg:px-10 py-10 grid lg:grid-cols-[220px_1fr] gap-3">
        <nav className="space-y-1">
          {SECTIONS.map((s, i) => (
            <button key={s} className={`w-full text-left px-4 py-2.5 rounded-md font-mono-label transition-all
              ${i === 0 ? "bg-surface-elevated text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated/60"}`}>
              {s}
            </button>
          ))}
        </nav>

        <div className="space-y-3">
          <div className="border border-border bg-surface p-8 space-y-6">
            <div>
              <h2 className="font-display text-3xl">General</h2>
              <p className="text-sm text-muted-foreground mt-1">Public marketplace identity</p>
            </div>
            <Field label="Store name" defaultValue="DIGITMINE" />
            <Field label="Tagline" defaultValue="Premium digital subscriptions for Algeria" />
            <Field label="Support email" defaultValue="hello@digitmine.dz" />
            <Field label="WhatsApp" defaultValue="+213 555 000 000" />
          </div>

          <AdBannerCard />

          <div className="border border-border bg-surface p-8 space-y-4">
            <h2 className="font-display text-2xl">Payment methods</h2>
            <ul className="divide-y divide-border">
              {methods.map((m: any) => (
                <li key={m.id} className="py-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-lg">{m.display_name}</p>
                    <p className="font-mono text-xs text-muted-foreground mt-1">{m.account_info}</p>
                    {m.instructions && <p className="text-sm text-muted-foreground mt-2 max-w-xl">{m.instructions}</p>}
                  </div>
                  <span className={`font-mono-label px-2 py-1 rounded ${m.active ? "text-primary bg-primary/10" : "text-muted-foreground bg-surface-elevated"}`}>
                    {m.active ? "Active" : "Off"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}

function AdBannerCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [link, setLink] = useState<string>("");
  const [visible, setVisible] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("ad_banner_url, ad_banner_link, ad_banner_visible")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUrl(data.ad_banner_url);
          setLink(data.ad_banner_link ?? "");
          setVisible(data.ad_banner_visible ?? true);
        }
      });
  }, []);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const path = `ad-banners/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setUrl(data.publicUrl);
      toast.success("Banner uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("site_settings")
      .update({ ad_banner_url: url, ad_banner_link: link || null, ad_banner_visible: visible })
      .eq("id", true);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  return (
    <div className="border border-border bg-surface p-8 space-y-5">
      <div>
        <h2 className="font-display text-2xl">Homepage ad banner</h2>
        <p className="text-sm text-muted-foreground mt-1">Large promotional image displayed on the homepage</p>
      </div>

      {url ? (
        <div className="relative border border-border overflow-hidden">
          <img src={url} alt="Banner preview" className="w-full h-auto object-cover" />
          <button
            onClick={() => setUrl(null)}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur p-2 rounded-md hover:bg-background"
            aria-label="Remove"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-md py-12 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
          <span className="font-mono-label text-xs">{uploading ? "Uploading…" : "Upload banner image"}</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />

      <Field label="Click-through link (optional)" value={link} onChange={setLink} placeholder="https://..." />

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="w-4 h-4 accent-primary" />
        <span className="font-mono-label text-sm">Show on homepage</span>
      </label>

      <button
        onClick={save}
        disabled={saving}
        className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function Field({
  label,
  defaultValue,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="font-mono-label text-muted-foreground">{label}</label>
      <input
        defaultValue={defaultValue}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        className="w-full mt-2 bg-background border border-border rounded-md px-4 py-2.5 text-sm focus:border-primary outline-none"
      />
    </div>
  );
}
