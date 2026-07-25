"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, UploadCloud, Trash2, Scale as ScaleIcon } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { compressImage } from "@/lib/image-compress";
import { updateScaleItemAction, deleteScaleItemAction } from "@/lib/scale-inventory.actions";

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
}: Props) {
  const [name, setName] = useState(initialName);
  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [costPrice, setCostPrice] = useState<number>(initialCostPrice);
  const [price, setPrice] = useState<number>(initialPrice);
  const [restockLevel, setRestockLevel] = useState<number>(initialRestockLevel);
  const [imagePreview, setImagePreview] = useState<string | null>(initialImage);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const handleDivClick = () => {
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
    const formData = new FormData(formRef.current);

    try {
      if (selectedFile) {
        setStatus("Optimizing image...");
        const compressed = await compressImage(selectedFile, { maxDimension: 1000, quality: 0.82 });
        setStatus("Uploading image...");
        const blob = await upload(compressed.name, compressed, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        });
        formData.set("imageUrl", blob.url);
      }
      formData.delete("image");

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
                Cost Price (per {initialUnit}) *
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
                Selling Price (per {initialUnit}) *
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
              Update product image
            </label>
            <input
              type="file"
              name="image"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            <div
              onClick={handleDivClick}
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-600/50 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-500 min-h-36 bg-[var(--bg-surface)] cursor-pointer transition-all overflow-hidden group relative"
            >
              {imagePreview ? (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition-colors">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute flex flex-col items-center text-[var(--text-primary)] bg-slate-50/80 dark:bg-slate-950/80 px-3 py-1.5 rounded-xl text-xs gap-1 border border-slate-200 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                    <UploadCloud size={14} className="text-blue-400" />
                    <span>Change Image</span>
                  </div>
                </div>
              ) : (
                <>
                  <UploadCloud size={32} className="group-hover:text-blue-400 transition-colors" />
                  <span className="text-xs mt-2 group-hover:text-slate-700 group-hover:dark:text-slate-300">Tap to browse or change product picture</span>
                </>
              )}
            </div>
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