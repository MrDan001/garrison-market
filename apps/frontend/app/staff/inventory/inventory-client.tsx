"use client";

import { useState } from "react";
import { ArrowLeft, Package, ShoppingCart, Plus, Minus, X, Search } from "lucide-react";
import Link from "next/link";
import { processSaleAction } from "@/lib/business.actions";

export default function InventoryClient({ initialItems }: { initialItems: any[] }) {
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter items based on search query
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
    <div className="min-h-screen bg-[#0f1117] text-slate-200 pb-24 lg:pb-8">
      <div className="p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* Item List Section */}
        <div className="lg:col-span-2">
          <Link href="/staff/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-white mb-6 w-fit">
            <ArrowLeft size={20} /> Back
          </Link>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <Package className="text-blue-500" /> Market Inventory
            </h1>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Mobile/Tablet: Card list */}
          <div className="lg:hidden space-y-3">
            {filteredItems.map((item) => {
              const cartItem = cart.find(c => c.id === item.id);
              const isOutOfStock = item.quantity <= 0;
              return (
                <div key={item.id} className={`bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 ${isOutOfStock ? "opacity-50" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{item.name}</p>
                    <p className="text-sm text-slate-400 mt-0.5">₦{Number(item.price).toLocaleString()} · {item.quantity} in stock</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => removeFromCart(item.id)} disabled={!cartItem} className="bg-slate-800 p-2 rounded-lg disabled:opacity-30"><Minus size={16} /></button>
                    <span className="w-6 text-center font-bold">{cartItem?.qty || 0}</span>
                    <button disabled={isOutOfStock} onClick={() => addToCart(item)} className={`p-2 rounded-lg ${isOutOfStock ? "bg-slate-800" : "bg-blue-600 hover:bg-blue-500"}`}><Plus size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: Table */}
          <div className="hidden lg:block bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-950/50 text-slate-400">
                <tr>
                  <th className="p-4">Item Name</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Price</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const cartItem = cart.find(c => c.id === item.id);
                  const isOutOfStock = item.quantity <= 0;
                  return (
                    <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-800/20">
                      <td className="p-4 font-semibold text-white">{item.name}</td>
                      <td className="p-4">{item.quantity}</td>
                      <td className="p-4">₦{Number(item.price).toLocaleString()}</td>
                      <td className="p-4 flex items-center justify-center gap-2">
                        <button onClick={() => removeFromCart(item.id)} className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700"><Minus size={16} /></button>
                        <span className="w-8 text-center font-bold">{cartItem?.qty || 0}</span>
                        <button disabled={isOutOfStock} onClick={() => addToCart(item)} className={`p-2 rounded-lg ${isOutOfStock ? "bg-slate-800" : "bg-blue-600 hover:bg-blue-500"}`}><Plus size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Desktop: Sidebar cart */}
        <div className="hidden lg:block bg-slate-900 border border-slate-800 rounded-3xl p-6 h-fit sticky top-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><ShoppingCart /> Checkout</h2>
          <div className="space-y-4 mb-6">
            {cart.length === 0 && <p className="text-slate-500 italic text-sm">Cart is empty</p>}
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <span className="truncate pr-2">{item.name} (x{item.qty})</span>
                <span className="shrink-0 font-mono">₦{(Number(item.price) * item.qty).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 pt-4 text-2xl font-bold">
            Total: ₦{total.toLocaleString()}
          </div>
          <button
            disabled={cart.length === 0 || loading}
            onClick={handleProcessSale}
            className="w-full mt-6 bg-emerald-600 py-3 rounded-xl font-bold hover:bg-emerald-500 disabled:bg-slate-700 transition-colors"
          >
            {loading ? "Processing..." : "Process Sale"}
          </button>
        </div>
      </div>

      {/* Mobile: Floating checkout bar */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-[#0f1117] border-t border-slate-800 z-40">
          <button
            onClick={() => setShowCart(true)}
            className="w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all rounded-2xl px-5 py-4"
          >
            <span className="flex items-center gap-2 font-bold">
              <ShoppingCart size={18} /> {cartCount} item{cartCount !== 1 ? "s" : ""}
            </span>
            <span className="font-bold">₦{total.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* Mobile: Cart bottom sheet */}
      {showCart && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCart(false)} />
          <div className="relative w-full bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><ShoppingCart /> Checkout</h2>
              <button onClick={() => setShowCart(false)} className="p-2 text-slate-500"><X size={20} /></button>
            </div>
            <div className="space-y-4 mb-6">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-sm">
                  <span className="truncate pr-2">{item.name} (x{item.qty})</span>
                  <span className="shrink-0 font-mono">₦{(Number(item.price) * item.qty).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-800 pt-4 text-2xl font-bold mb-6">
              Total: ₦{total.toLocaleString()}
            </div>
            <button
              disabled={cart.length === 0 || loading}
              onClick={handleProcessSale}
              className="w-full bg-emerald-600 py-4 rounded-xl font-bold hover:bg-emerald-500 disabled:bg-slate-700 transition-colors"
            >
              {loading ? "Processing..." : "Process Sale"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}