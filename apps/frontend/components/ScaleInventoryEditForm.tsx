"use client";

import { useBusinessCurrency } from "@/components/BusinessCurrencyProvider";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Scale as ScaleIcon, Tag, ChevronRight, Clock } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { compressImage } from "@/lib/image-compress";
import { updateScaleItemAction, deleteScaleItemAction } from "@/lib/scale-inventory.actions";
import CategoryPickerModal from "@/components/CategoryPickerModal";
import MultiImageUploadField from "@/components/MultiImageUploadField";

interface Props {
  itemId: string;
  initialName: string;
  initialQuantity: number;
  initialUnit: string; // "kg" | "L" — fixed, never editable
  initialCostPrice: number;
  initialPrice: number;
  initialCategory: string;
  initialRestockLevel: number;
  initialImage: string | null;
  initialImage2?: string | null;
  initialImage3?: string | null;
  initialDescription?: string | null;
  initialSku?: string | null;
  initialCategoryId?: number | null;
  initialCategoryName?: string | null;
  initialTrackExpiry?: boolean;
  initialExpiryDate?: string | null; // "YYYY-MM-DD", for the date input
}

export default function ScaleInventoryEditForm({
  itemId,
  initialName,
  initialQuantity,
  initialUnit,
  initialCostPrice,
  initialPrice,
  initialCategory,
  initialRestockLevel,
  initialImage,
  initialImage2 = null,
  initialImage3 = null,
  initialDescription = null,
  initialSku = null,
  initialCategoryId = null,
  initialCategoryName = null,
  initialTrackExpiry = false,
  initialExpiryDate = null,
}: Props) {
  const { currencyCode } = useBusinessCurrency();
  const [name, setName] = useState(initialName);
  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [costPrice, setCostPrice] = useState<number>(initialCostPrice);
  const [price, setPrice] = useState<number>(initialPrice);
  const [restockLevel, setRestockLevel] = useState<number>(initialRestockLevel);

  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([initialImage, initialImage2, initialImage3]);

  const [categoryId, setCategoryId] = useState<number | null>(initialCategoryId);
  const [categoryName, setCategoryName] = useState<string | null>(initialCategoryName);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [trackExpiry, setTrackExpiry] = useState(initialTrackExpiry);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const handleImageChange = (index: number, file: File | null) => {
    setImageFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviews((prev) => {
        const next = [...prev];
        next[index] = reader.result as string;
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;

    setIsSubmitting(true);
    const formData = new FormData(formRef.current);

    try {
      const fieldNames = ["imageUrl", "image2Url", "image3Url"];
      for (let i = 0; i < 3; i++) {
        const file = imageFiles[i];
        if (!file) continue;
        setStatus(`Optimizing image ${i + 1}...`);
        const compressed = await compressImage(file, { maxDimension: 1000, quality: 0.82 });
        setStatus(`Uploading image ${i + 1}...`);
        const blob = await upload(compressed.name, compressed, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        });
        formData.set(fieldNames[i], blob.url);
      }

      formData.set("categoryId", categoryId != null ? String(categoryId) : "");
      formData.set("trackExpiry", trackExpiry ? "true" : "false");
      if (!trackExpiry) formData.delete("expiryDate");

      setStatus("Saving changes...");
      const result = await updateScaleItemAction(formData);
      if (result && result.success === false) {
        setStatus("");
        setIsSubmitting(false);
        alert(result.error);
        return;
      }
      router.push("/owner/inventory?status=updated&tab=scale");
    } catch (err) {
      console.error("Update failed:", err);
      setStatus("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${name}"? If it has sales history, it'll be marked Out of Stock instead of being removed, so past orders stay intact.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.set("id", itemId);
      const result = await deleteScaleItemAction(formData);
      const statusParam = result?.archived ? "archived" : "deleted";
      router.push(`/owner/inventory?status=${statusParam}&tab=scale`);
    } catch (err: any) {
      console.error("Delete failed:", err);
      setIsDeleting(false);
      alert(err?.message || "Failed to delete item. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200">
      {showCategoryPicker && (
        <CategoryPickerModal
          selectedCategoryId={categoryId}
          onSelect={(id, name) => {
            setCategoryId(id);
            setCategoryName(name);
            setShowCategoryPicker(false);
          }}
          onClose={() => setShowCategoryPicker(false)}
        />
      )}
      <div className="sticky top-0 z-10 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/owner/inventory?tab=scale" className="text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Edit Product</h1>
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
              <ScaleIcon size={10} /> {initialUnit}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 disabled:opacity-50 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={14} />
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>

      <div className="p-4 sm:p-6 pb-20">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 max-w-lg mx-auto">
          <input type="hidden" name="id" value={itemId} />

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Product name *
            </label>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={initialDescription ?? ""}
              placeholder="Optional notes about this product"
              className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category</label>
            <button
              type="button"
              onClick={() => setShowCategoryPicker(true)}
              className="w-full flex items-center justify-between bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-left hover:border-blue-500/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Tag size={14} className="text-slate-400" />
                <span className={categoryName ? "text-[var(--text-primary)] font-semibold" : "text-slate-500"}>
                  {categoryName ?? "No Category"}
                </span>
              </span>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Quantity ({initialUnit}) *
            </label>
            <input
              name="quantity"
              type="number"
              step="0.001"
              min="0"
              required
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Stocked in {initialUnit} — this unit is fixed for this product and can't be changed.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Cost Price ({currencyCode} per {initialUnit}) *
              </label>
              <input
                name="costPrice"
                type="number"
                step="0.01"
                required
                value={costPrice}
                onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Selling Price ({currencyCode} per {initialUnit}) *
              </label>
              <input
                name="price"
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              SKU (Stock Keeping Unit)
            </label>
            <input
              name="sku"
              defaultValue={initialSku ?? ""}
              placeholder="Optional"
              className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Restock alert level ({initialUnit})
            </label>
            <input
              name="restockLevel"
              type="number"
              step="0.001"
              min="0"
              value={restockLevel}
              onChange={(e) => setRestockLevel(parseFloat(e.target.value) || 0)}
              className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Clock size={14} className="text-slate-400" />
              Track expiry date
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={trackExpiry}
              onClick={() => setTrackExpiry((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${trackExpiry ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${trackExpiry ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {trackExpiry && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Expiry date *</label>
              <input
                name="expiryDate"
                type="date"
                required={trackExpiry}
                defaultValue={initialExpiryDate ?? ""}
                className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          )}

          <MultiImageUploadField previews={imagePreviews} onChange={handleImageChange} />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white py-4 rounded-xl font-bold text-sm mt-6 transition-colors shadow-lg shadow-blue-500/10"
          >
            <Save size={16} /> {isSubmitting ? status || "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}