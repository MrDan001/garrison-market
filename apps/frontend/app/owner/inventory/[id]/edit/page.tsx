"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, UploadCloud } from "lucide-react";
import { updateItemAction } from "@/lib/business.actions";

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default function EditItemPage({ params }: EditPageProps) {
  const resolvedParams = use(params);
  const itemId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [category, setCategory] = useState("phones");
  const [restockLevel, setRestockLevel] = useState<number>(0);
  
  // Handled and preserved correctly
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadItemData() {
      try {
        const res = await fetch(`/api/inventory/${itemId}`);
        if (res.ok) {
          const data = await res.json();
          setName(data.name || "");
          setQuantity(data.quantity || 0);
          setCostPrice(data.costPrice ? Number(data.costPrice) : 0);
          setPrice(data.price ? Number(data.price) : 0);
          setCategory(data.category || "phones");
          setRestockLevel(data.restockLevel || 0);
          
          // CRITICAL FIX: Binds existing database image to state
          setImagePreview(data.image || null);
        }
      } catch (err) {
        console.error("Failed to load initial form defaults:", err);
      } finally {
        setLoading(false);
      }
    }
    loadItemData();
  }, [itemId]);

  const handleDivClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0C10] flex items-center justify-center text-slate-400 text-sm">
        Loading product details...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0C10] text-slate-200">
      <div className="sticky top-0 z-10 bg-[#0A0C10]/80 backdrop-blur-xl border-b border-slate-800/50 px-4 py-4 flex items-center gap-4">
        <Link href="/owner/inventory" className="text-slate-400 hover:text-white">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-white">Edit Product</h1>
      </div>

      <div className="p-4 sm:p-6 pb-20">
        <form action={updateItemAction} className="space-y-5 max-w-lg mx-auto">
          <input type="hidden" name="id" value={itemId} />

          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Product name *
            </label>
            <input 
              name="name" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none" 
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Quantity *
            </label>
            <input 
              name="quantity" 
              type="number" 
              required 
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none" 
            />
          </div>

          {/* Prices Layout split */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Cost Price *
              </label>
              <input 
                name="costPrice" 
                type="number" 
                step="0.01" 
                required 
                value={costPrice}
                onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Selling Price *
              </label>
              <input 
                name="price" 
                type="number" 
                step="0.01" 
                required 
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none" 
              />
            </div>
          </div>

          {/* Category Dropdown Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Categories *
            </label>
            <select 
              name="category" 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none appearance-none"
            >
              <option value="phones">Phones</option>
              <option value="charger">Charger</option>
              <option value="headsets">Headsets</option>
              <option value="pouch">Pouch</option>
            </select>
          </div>

          {/* Clickable Image Input Box Container */}
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
              className="border-2 border-dashed border-slate-800 hover:border-blue-600/50 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-500 min-h-36 bg-[#1a1d24] cursor-pointer transition-all overflow-hidden group relative"
            >
              {imagePreview ? (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition-colors">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute flex flex-col items-center text-white bg-slate-950/80 px-3 py-1.5 rounded-xl text-xs gap-1 border border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                    <UploadCloud size={14} className="text-blue-400" />
                    <span>Change Image</span>
                  </div>
                </div>
              ) : (
                <>
                  <UploadCloud size={32} className="group-hover:text-blue-400 transition-colors" />
                  <span className="text-xs mt-2 group-hover:text-slate-300">Tap to browse or change product picture</span>
                </>
              )}
            </div>
          </div>

          {/* Restock Alert Level field */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Restock alert level *
            </label>
            <input 
              name="restockLevel" 
              type="number" 
              value={restockLevel}
              onChange={(e) => setRestockLevel(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none" 
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center gap-2 text-white py-4 rounded-xl font-bold text-sm mt-6 transition-colors shadow-lg shadow-blue-500/10"
          >
            <Save size={16} /> Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
