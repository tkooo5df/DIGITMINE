import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AdBanner() {
  const { data } = useQuery({
    queryKey: ["site_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("ad_banner_url, ad_banner_link, ad_banner_visible")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!data?.ad_banner_visible || !data?.ad_banner_url) return null;

  const img = (
    <img
      src={data.ad_banner_url}
      alt="Ad banner"
      className="w-full h-auto object-cover"
      loading="lazy"
    />
  );

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
      <div className="overflow-hidden border border-border bg-surface">
        {data.ad_banner_link ? (
          <a href={data.ad_banner_link} target="_blank" rel="noopener noreferrer" className="block">
            {img}
          </a>
        ) : (
          img
        )}
      </div>
    </section>
  );
}
