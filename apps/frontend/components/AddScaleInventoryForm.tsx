"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { compressImage } from "@/lib/image-compress";
import { withTimeout } from "@/lib/with-timeout";
import { addScaleItemAction } from "@/lib/scale-inventory.actions";
import UpgradeLimitModal, { isLimitReachedError } from "@/components/UpgradeLimitModal";
import { ArrowLeft, UploadCloud, Scale as ScaleIcon } from "lucide-react";
import Link from "next/link";

export default function AddScaleInventoryForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [limitModalMessage, setLimitModalMessage] = useState<string | null>(null);
  const [unit, setUnit] = useState<"kg" | "L">("kg");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const handleCardClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;

    setIsSubmitting(true);
    setSubmitError(null);
    const formData = new FormData(formRef.current);

    try {
      if (selectedFile) {
        setUploadStatus("Optimizing image...");
        const compressed = await compressImage(selectedFile, { maxDimension: 1000, quality: 0.82 });
        setUploadStatus("Uploading image...");
        const blob = await withTimeout(
          upload(compressed.name, compressed, {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
          }),
          30000,
          "Image upload timed out. Check your connection and try again."
        );
        formData.set("imageUrl", blob.url);
      }
      formData.delete("image");

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

      router.push("/owner/inventory?status=added");
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
      <div className="sticky top-0 z-10 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center gap-4">
        <Link href="/owner/inventory" className="text-slate-600 dark:text-slate-400 hover:text-[var(--text-primary)]">
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
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Add product image</label>

            <input
              type="file"
              name="image"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            <div
              onClick={handleCardClick}
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-500 min-h-32 bg-[var(--bg-surface)] cursor-pointer transition-all relative overflow-hidden group"
            >
              {imagePreview ? (
                <div className="absolute inset-0 w-full h-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                  <img src={imagePreview} alt="Upload Preview" className="w-full h-full object-cover" />
                  <div className="absolute bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[var(--text-primary)] rounded-xl px-3 py-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <UploadCloud size={14} /> Change Picture
                  </div>
                </div>
              ) : (
                <>
                  <UploadCloud size={32} className="group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs mt-2 group-hover:text-slate-700 group-hover:dark:text-slate-300">Tap to upload</span>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Restock alert level ({unit})
            </label>
            <input name="restockLevel" type="number" step="0.001" min="0" className="w-full bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-600" />
          </div>

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