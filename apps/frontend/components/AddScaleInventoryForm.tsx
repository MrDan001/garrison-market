"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { compressImage } from "@/lib/image-compress";
import { withTimeout } from "@/lib/with-timeout";
import { addScaleItemAction } from "@/lib/scale-inventory.actions";
import UpgradeLimitModal, { isLimitReachedError } from "@/components/UpgradeLimitModal";
import CategoryPickerModal from "@/components/CategoryPickerModal";
import MultiImageUploadField from "@/components/MultiImageUploadField";
import { ArrowLeft, Scale as ScaleIcon, Tag, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";

export default function AddScaleInventoryForm() {
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [limitModalMessage, setLimitModalMessage] = useState<string | null>(null);
  const [unit, setUnit] = useState<"kg" | "L">("kg");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const handleImageChange = (index: number, file: File | null) => {
    setImageFiles((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
    if (!file) {
      setImagePreviews((prev) => {
        const next = [...prev];
        next[index] = null;
        return next;
      });
      return;
    }
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
    setSubmitError(null);
    const formData = new FormData(formRef.current);

    try {
      const uploadFieldNames = ["imageUrl", "image2Url", "image3Url"];
      for (let i = 0; i < 3; i++) {
        const file = imageFiles[i];
        if (!file) continue;
        setUploadStatus(`Optimizing image ${i + 1}...`);
        const compressed = await compressImage(file, { maxDimension: 1000, quality: 0.82 });
        setUploadStatus(`Uploading image ${i + 1}...`);
        const blob = await withTimeout(
          upload(compressed.name, compressed, {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
          }),
          30000,
          "Image upload timed out. Check your connection and try again."
        );
        formData.set(uploadFieldNames[i], blob.url);
      }

      formData.set("categoryId", categoryId != null ? String(categoryId) : "");
      formData.set("trackExpiry", trackExpiry ? "true" : "false");
      if (!trackExpiry) formData.delete("expiryDate");

      setUploadStatus("Saving item...");
      const result: { success: true } | { success: false; error: string } = await withTimeout(
        addScaleItemAction(formData),
        20000,
        "Saving timed out. Check your connection and try again."
      );

      if (result && result.success === false) {
        if (isLimitReachedError(result.error)) {
          setLimitModalMessage(result.error);
        } else {
          setSubmitError(result.error);
        }
        setUploadStatus("");
        setIsSubmitting(false);
        return;
      }

      router.push("/owner/inventory?status=added&tab=scale");
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setUploadStatus("");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-800 dark:text-slate-200">
      {limitModalMessage && (
        <UpgradeLimitModal message={limitModalMessage} onClose={() => setLimitModalMessage(null)} />
      )}
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
      <div className="sticky top-0 z-10 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-4">
        <Link href="/owner/inventory?tab=scale" className="text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]">
          <ArrowLeft size={24} />
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Add products</h1>
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
            <ScaleIcon size={10} /> Scale
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6 pb-20">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 max-w-lg mx-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Product name *</label>
            <input name="name" required className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="Optional notes about this product"
              className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600 resize-none"
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

          {/* Unit — chosen once here, then locked permanently for this product */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Stocking Unit *
            </label>
            <p className="text-[11px] text-slate-500 mb-2">This cannot be changed later for this product.</p>
            <input type="hidden" name="unit" value={unit} />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUnit("kg")}
                className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                  unit === "kg"
                    ? "border-amber-600 bg-amber-600/10 text-amber-500"
                    : "border-slate-200 dark:border-slate-800 bg-[var(--bg-surface)] text-slate-500"
                }`}
              >
                kg (weight)
              </button>
              <button
                type="button"
                onClick={() => setUnit("L")}
                className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                  unit === "L"
                    ? "border-amber-600 bg-amber-600/10 text-amber-500"
                    : "border-slate-200 dark:border-slate-800 bg-[var(--bg-surface)] text-slate-500"
                }`}
              >
                L (volume)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Starting Quantity ({unit}) *
            </label>
            <input
              name="quantity"
              type="number"
              step="0.001"
              min="0"
              required
              placeholder={`e.g. 50 (${unit})`}
              className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cost Price (per {unit}) *</label>
              <input name="costPrice" type="number" step="0.01" required className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Selling Price (per {unit}) *</label>
              <input name="price" type="number" step="0.01" required className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">SKU (Stock Keeping Unit)</label>
            <input name="sku" placeholder="Optional" className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Restock alert level ({unit})
            </label>
            <input
              name="restockLevel"
              type="number"
              step="0.001"
              min="0"
              defaultValue={10}
              className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600"
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
                className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600"
              />
            </div>
          )}

          <MultiImageUploadField previews={imagePreviews} onChange={handleImageChange} />

          {submitError && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm font-semibold text-rose-500">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm mt-6 transition-colors shadow-md shadow-blue-500/10"
          >
            {isSubmitting ? uploadStatus || "Saving..." : "Save Item"}
          </button>
        </form>
      </div>
    </div>
  );
}