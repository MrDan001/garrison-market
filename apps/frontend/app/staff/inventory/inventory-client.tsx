"use client";

import { useState } from "react";
import { ArrowLeft, Search, ShoppingCart, Plus, Minus, X, Package } from "lucide-react";
import Link from "next/link";
import { processSaleAction } from "@/lib/business.actions";

export default function InventoryClient({ initialItems }: { initialItems: any[] }) {
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = initialItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      const currentQtyInCart = existing ? existing.qty : 0;
      if (currentQtyInCart >= item.quantity) return prev;
      if (existing) {
        return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (itemId: number) => {
    setCart((prev) =>
      prev.map((i) => i.id === itemId ? { ...i, qty: i.qty - 1 } : i)
          .filter((i) => i.qty > 0)
    );
  };

  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const handleProcessSale = async () => {
    setLoading(true);
    try {
      await processSaleAction(cart);
      setCart([]);
      setShowCart(false);
      alert("Sale completed successfully!");
    } catch (error: any) {
      alert(error.message || "Failed to process sale.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-200 pb-32">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0a0c10]/90 backdrop-blur-xl border-b border-slate-800/50 px-4 py-3.5 flex items-center gap-3">
        <Link href="/staff/dashboard" className="flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={16} />
        </Link>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        {/* Cart icon button */}
        <button
          onClick={() => cart.length > 0 && setShowCart(true)}
          className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <ShoppingCart size={16} />
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center z-10">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Page title */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Package size={20} className="text-blue-500" /> Inventory
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">{filteredItems.length} items</p>
      </div>

      {/* Grid */}
      <div className="px-4">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={36} className="mx-auto mb-3 text-slate-700" />
            <p className="text-slate-500 text-sm">
              {searchQuery ? `No items match "${searchQuery}"` : "No items in inventory"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map((item) => {
              const cartItem = cart.find(c => c.id === item.id);
              const isOutOfStock = item.quantity <= 0;
              const qtyInCart = cartItem?.qty || 0;

              return (
                <div
                  key={item.id}
                  className={`relative bg-slate-900/60 border rounded-2xl overflow-hidden flex flex-col transition-all ${
                    isOutOfStock
                      ? "border-slate-800 opacity-50"
                      : qtyInCart > 0
                        ? "border-blue-500/50 shadow-lg shadow-blue-500/10"
                        : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Product image container — updated to support Vercel Blob URLs natively */}
                  <div className="relative bg-slate-950 aspect-square flex items-center justify-center overflow-hidden">
                    {item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center">
                        <Package size={24} className="text-slate-500" />
                      </div>
                    )}

                    {/* Out of stock badge */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-full">
                          OUT OF STOCK
                        </span>
                      </div>
                    )}

                    {/* Qty badge if in cart */}
                    {qtyInCart > 0 && (
                      <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center z-10">
                        {qtyInCart}
                      </div>
                    )}

                    {/* Cart button — bottom right of image */}
                    {!isOutOfStock && (
                      <button
                        onClick={() => addToCart(item)}
                        className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-90 flex items-center justify-center shadow-lg transition-all z-10"
                      >
                        <ShoppingCart size={14} className="text-white" />
                      </button>
                    )}
                  </div>

                  {/* Item info */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.quantity} in stock</p>
                    </div>
                    <p className="text-sm font-bold text-blue-400">₦{Number(item.price).toLocaleString()}</p>

                    {/* Qty controls */}
                    {qtyInCart > 0 && (
                      <div className="flex items-center justify-between mt-auto bg-slate-800/60 rounded-xl px-3 py-1.5">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 hover:text-white active:scale-90 transition-all"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-bold text-white">{qtyInCart}</span>
                        <button
                          onClick={() => addToCart(item)}
                          disabled={qtyInCart >= item.quantity}
                          className="text-slate-400 hover:text-white active:scale-90 transition-all disabled:opacity-30"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating checkout bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a0c10]/95 backdrop-blur-xl border-t border-slate-800 z-40">
          <button
            onClick={() => setShowCart(true)}
            className="w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-2xl px-5 py-4 transition-all shadow-lg shadow-emerald-900/10"
          >
            <span className="flex items-center gap-2 font-bold text-white">
              <ShoppingCart size={18} />
              {cartCount} item{cartCount !== 1 ? "s" : ""}
            </span>
            <span className="font-bold text-white">₦{total.toLocaleString()}</span>
          </button>
        </div>
      )}

           {/* Cart bottom sheet */}
           {showCart && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop Click Dismiss Mask */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-xs" 
            onClick={() => setShowCart(false)} 
          />
          
          {/* Bottom Drawer Sheet Layout */}
          <div className="relative w-full bg-[#111318] border-t border-slate-800 rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto z-10">
            
            {/* Drawer Header Block */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingCart size={20} /> Checkout
              </h2>
              <button 
                onClick={() => setShowCart(false)} 
                className="p-2 text-slate-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Cart Selected Items List array */}
            <div className="space-y-3 mb-5">
              {cart.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800"
                >
                  {/* Left Side: Thumbnail Preview and Product Text info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-10 w-10 bg-slate-950 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-800">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package size={16} className="text-slate-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        ₦{Number(item.price).toLocaleString()} each
                      </p>
                    </div>
                  </div>
                  
                  {/* Center: Interactive Counter Adjustment buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={() => removeFromCart(item.id)} 
                      className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-white">{item.qty}</span>
                    <button 
                      onClick={() => addToCart(item)} 
                      disabled={item.qty >= item.quantity}
                      className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-30"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  {/* Right Side: Total Price Calculation per single product map context */}
                  <span className="text-sm font-bold text-white shrink-0 w-20 text-right">
                    ₦{(Number(item.price) * item.qty).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Aggregate Summary Row Footer */}
            <div className="border-t border-slate-800 pt-4 mb-5 flex justify-between items-center">
              <span className="text-slate-400 font-medium">Total</span>
              <span className="text-2xl font-bold text-white">₦{total.toLocaleString()}</span>
            </div>

            {/* Form Processing Checkout Trigger action button */}
            <button
              disabled={loading}
              onClick={handleProcessSale}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 py-4 rounded-2xl font-bold text-white transition-colors shadow-lg shadow-emerald-900/10"
            >
              {loading ? "Processing..." : "Confirm Sale"}
            </button>
          </div>
        </div>
         )}
       </div>
     );
   }