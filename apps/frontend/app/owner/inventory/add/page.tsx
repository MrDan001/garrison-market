"use client";

import { useState, useRef } from "react";
import { addItemAction } from "@/lib/business.actions";
import { ArrowLeft, UploadCloud } from "lucide-react";
import Link from "next/link";

export default function AddInventoryItemPage() {
  // States to hold image file representation properties
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger hidden native system file explorer when clicking the card grid block
  const handleCardClick = () => {
    fileInputRef.current?.click();
  };

  // Convert the chosen file input to a transient base64 url string for visual preview
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

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">
      <div className="sticky top-0 z-10 bg-[#0f1117]/80 backdrop-blur-xl border-b border-slate-800 px-4 py-4 flex items-center gap-4">
        <Link href="/owner/inventory" className="text-slate-400 hover:text-white">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold text-white">Add products</h1>
      </div>

      <div className="p-4 sm:p-6 pb-20">
        <form action={addItemAction} className="space-y-5 max-w-lg mx-auto">
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Product name *</label>
            <input name="name" required className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-600" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quantity *</label>
            <input name="quantity" type="number" required className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-600" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cost Price *</label>
              <input name="costPrice" type="number" step="0.01" required className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Selling Price *</label>
              <input name="price" type="number" step="0.01" required className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-600" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Categories *</label>
            <select name="category" className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-600">
              <option value="phones">Phones</option>
              <option value="charger">Charger</option>
              <option value="headsets">Headsets</option>
              <option value="pouch">Pouch</option>
            </select>
          </div>

          {/* Clickable Image Selector Field Container Block */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Add product image</label>
            
            {/* Hidden actual file input node targeting name property */}
            <input 
              type="file" 
              name="image" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />

            {/* Visual upload card proxy handling click triggers */}
            <div 
              onClick={handleCardClick}
              className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-500 min-h-32 bg-[#1a1d24] cursor-pointer transition-all relative overflow-hidden group"
            >
              {imagePreview ? (
                <div className="absolute inset-0 w-full h-full bg-slate-950 flex items-center justify-center">
                  <img src={imagePreview} alt="Upload Preview" className="w-full h-full object-cover" />
                  <div className="absolute bg-slate-900/80 border border-slate-800 text-white rounded-xl px-3 py-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <UploadCloud size={14} /> Change Picture
                  </div>
                </div>
              ) : (
                <>
                  <UploadCloud size={32} className="group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs mt-2 group-hover:text-slate-300">Tap to upload</span>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Restock alert level *</label>
            <input name="restockLevel" type="number" className="w-full bg-[#1a1d24] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-600" />
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-sm mt-6 transition-colors shadow-md shadow-blue-500/10">
            Save Item
          </button>
        </form>
      </div>
    </div>
  );
}
