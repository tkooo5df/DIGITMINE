import { createFileRoute } from "@tanstack/react-router";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { useCategories } from "@/lib/admin-data";
import { GripVertical, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data: cats = [], isLoading } = useCategories();
  const qc = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState<any>(null); // null means adding a new category
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [visible, setVisible] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [parentId, setParentId] = useState<string | null>(null);

  const openAdd = () => {
    setSelectedCat(null);
    setName("");
    setSlug("");
    setVisible(true);
    setParentId(null);
    setSortOrder(cats.length > 0 ? Math.max(...cats.map((c: any) => c.sort_order ?? 0)) + 1 : 0);
    setIsOpen(true);
  };

  const openEdit = (cat: any) => {
    setSelectedCat(cat);
    setName(cat.name);
    setSlug(cat.slug || "");
    setVisible(cat.visible !== false);
    setParentId(cat.parent_id || null);
    setSortOrder(cat.sort_order ?? 0);
    setIsOpen(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!selectedCat) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("الاسم مطلوب");
    
    const finalSlug = slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const payload = {
      name: name.trim(),
      slug: finalSlug,
      visible,
      sort_order: Number(sortOrder),
      parent_id: parentId || null
    };

    try {
      if (selectedCat) {
        // Update category
        const { error } = await supabase
          .from("categories")
          .update(payload)
          .eq("id", selectedCat.id);
        if (error) throw error;
        toast.success("تم تعديل الفئة بنجاح");
      } else {
        // Insert new category
        const { error } = await supabase
          .from("categories")
          .insert({
            id: Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2),
            ...payload
          });
        if (error) throw error;
        toast.success("تم إضافة الفئة بنجاح");
      }
      setIsOpen(false);
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err: any) {
      toast.error(err.message || "خطأ أثناء الحفظ");
    }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الفئة "${catName}"؟ المنتجات المرتبطة بها ستصبح بدون فئة.`)) return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      toast.success("تم حذف الفئة بنجاح");
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err: any) {
      toast.error(err.message || "خطأ أثناء الحذف");
    }
  };

  const moveCategory = async (cat: any, direction: "up" | "down") => {
    const siblings = cats
      .filter((c: any) => c.parent_id === cat.parent_id)
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const index = siblings.findIndex((c: any) => c.id === cat.id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const cat1 = siblings[index];
    const cat2 = siblings[targetIndex];

    const tempOrder = cat1.sort_order;

    try {
      await supabase.from("categories").update({ sort_order: cat2.sort_order }).eq("id", cat1.id);
      await supabase.from("categories").update({ sort_order: tempOrder }).eq("id", cat2.id);
      qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("تم تحديث ترتيب الفئات");
    } catch (err: any) {
      toast.error("فشل إعادة الترتيب");
    }
  };

  // Get top-level categories
  const parentCats = cats
    .filter((c: any) => !c.parent_id)
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const subCatsByParent = (pid: string) =>
    cats
      .filter((c: any) => c.parent_id === pid)
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Orphans: subcategories whose parent doesn't exist
  const orphanCats = cats
    .filter((c: any) => c.parent_id && !cats.some((p: any) => p.id === c.parent_id))
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const renderCategoryRow = (c: any, isSub: boolean = false) => {
    const siblings = cats.filter((sibling: any) => sibling.parent_id === c.parent_id);
    const siblingIndex = siblings.findIndex((sibling: any) => sibling.id === c.id);
    const isFirst = siblingIndex === 0;
    const isLast = siblingIndex === siblings.length - 1;

    return (
      <li key={c.id} className={`flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-surface-elevated/40 transition-colors ${isSub ? "ps-14 bg-surface-elevated/10 border-r-2 border-primary/20" : ""}`}>
        <div className="flex items-center gap-4 flex-1 min-w-[200px]">
          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {isSub && <span className="text-primary/60 font-mono text-sm">↳</span>}
              <span className="font-display text-lg text-foreground">{c.name}</span>
              {isSub && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono-label">
                  عائلة / فئة فرعية
                </span>
              )}
            </div>
            <span className="font-mono text-xs text-muted-foreground">slug: {c.slug}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <span className="font-mono text-xs text-muted-foreground">
            {(c.products ?? []).length} منتج
          </span>
          
          <span className={`inline-flex items-center gap-1 font-mono-label text-xs px-2.5 py-1 rounded-full ${c.visible ? "text-primary bg-primary/10" : "text-muted-foreground bg-surface-elevated"}`}>
            {c.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {c.visible ? "مرئي" : "مخفي"}
          </span>

          <div className="flex items-center gap-1.5 border-l border-r border-border px-3">
            <button
              onClick={() => moveCategory(c, "up")}
              disabled={isFirst}
              className="p-1.5 border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
              title="تحريك لأعلى"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => moveCategory(c, "down")}
              disabled={isLast}
              className="p-1.5 border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
              title="تحريك لأسفل"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openEdit(c)}
              className="p-2 border border-border text-muted-foreground hover:text-primary hover:border-primary/40"
              title="تعديل"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(c.id, c.name)}
              className="p-2 border border-destructive/30 text-destructive hover:bg-destructive/10"
              title="حذف"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      <AdminTopbar title="Categories" subtitle={`${cats.length} categories`} />
      <main className="px-6 lg:px-10 py-10 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="font-display text-2xl text-foreground">قائمة الفئات والعائلات</h2>
          <button
            onClick={openAdd}
            className="font-mono-label px-4 py-2 bg-primary text-primary-foreground inline-flex items-center gap-2 hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> فئة جديدة
          </button>
        </div>

        {isLoading && <p className="text-center text-muted-foreground font-mono-label">Loading…</p>}
        {!isLoading && cats.length === 0 && (
          <p className="text-center text-muted-foreground py-12">لا توجد فئات حالياً.</p>
        )}

        <ul className="border border-border bg-surface divide-y divide-border">
          {parentCats.map((parent: any) => (
            <div key={parent.id} className="divide-y divide-border">
              {renderCategoryRow(parent, false)}
              {subCatsByParent(parent.id).map((sub: any) => renderCategoryRow(sub, true))}
            </div>
          ))}
          {orphanCats.length > 0 && (
            <div className="divide-y divide-border border-t border-dashed border-border/60">
              <div className="px-6 py-2 bg-destructive/5 text-destructive/80 font-mono-label text-xs">
                فئات فرعية يتيمة (بدون فئة رئيسية صالحة)
              </div>
              {orphanCats.map((orphan: any) => renderCategoryRow(orphan, true))}
            </div>
          )}
        </ul>
      </main>

      {/* Modal Dialog for Category Create/Update */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-border p-6 shadow-xl relative">
            <h2 className="font-display text-2xl mb-4 text-foreground">
              {selectedCat ? "تعديل الفئة" : "إضافة فئة جديدة"}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="font-mono-label text-muted-foreground block mb-1 text-sm">اسم الفئة</label>
                <input
                  type="text"
                  className={inp}
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="font-mono-label text-muted-foreground block mb-1 text-sm">Slug (الرابط)</label>
                <input
                  type="text"
                  className={inp}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto-generated"
                />
              </div>
              <div>
                <label className="font-mono-label text-muted-foreground block mb-1 text-sm">الفئة الرئيسية (Parent Category)</label>
                <select
                  className={inp}
                  value={parentId ?? ""}
                  onChange={(e) => setParentId(e.target.value || null)}
                >
                  <option value="">— فئة رئيسية (لا يوجد) —</option>
                  {cats
                    .filter((c: any) => !c.parent_id && (!selectedCat || c.id !== selectedCat.id))
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="font-mono-label text-muted-foreground block mb-1 text-sm">الترتيب (Sort Order)</label>
                <input
                  type="number"
                  className={inp}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between py-2 border-t border-b border-border/50">
                <span className="font-mono-label text-sm text-foreground">مرئية للزبائن في المتجر</span>
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center ${visible ? "bg-primary justify-end" : "bg-border justify-start"}`}
                >
                  <span className="block w-5 h-5 bg-background rounded-full mx-0.5 shadow" />
                </button>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="font-mono-label px-4 py-2 border border-border text-muted-foreground hover:text-foreground"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="font-mono-label px-5 py-2 bg-primary text-primary-foreground hover:opacity-90"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const inp = "w-full bg-background border border-border px-3 py-2 font-mono text-sm focus:border-primary outline-none text-foreground";
