"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Mic, MicOff, X, Send, Volume2, ArrowRight, MessageCircle } from "lucide-react";

type Role = "owner" | "staff";
type Entry = { role: "user" | "assistant"; text: string; href?: string; label?: string };

export const resolveSpeakOnRequest = (text: string, role: Role): { reply: string; href?: string; label?: string } => {
  const q = text.toLowerCase();
  if (/\b(add|create|new)\b.*\b(product|item)\b/.test(q)) {
    return role === "owner"
      ? { reply: "I’ll take you to the existing Add Product form. You can review and complete the fields there before saving.", href: "/owner/inventory/add", label: "Open Add Product" }
      : { reply: "Only the owner can add a new product. Please ask the owner to add this product for the store." };
  }
  if (/\b(restock|add stock|receive stock|stock in)\b/.test(q)) {
    return role === "owner"
      ? { reply: "Choose the product first, then use its existing Add Stock form. I won’t guess which product or quantity.", href: "/owner/inventory", label: "Open Inventory" }
      : { reply: "Only the owner can add or restock inventory. Please ask the owner to handle this." };
  }
  if (/\b(expense|spent|spending|log.*cost)\b/.test(q)) {
    return { reply: "Open the existing expense form. Enter the amount and any category or note, then save when you’re satisfied.", href: role === "owner" ? "/owner/expenses" : "/staff/expenses", label: "Open Expenses" };
  }
  if (/\b(wastage|wasted|spoilt|spoiled|damaged)\b/.test(q)) {
    return { reply: role === "owner" ? "Open the wastage page to review and approve or decline staff submissions." : "Open the existing wastage form to submit the item, quantity, unit and reason. The owner must approve it before stock changes.", href: role === "owner" ? "/owner/wastage" : "/staff/wastage", label: "Open Wastage" };
  }
  if (/\b(consignment|sign.?out|settle.*consignment)\b/.test(q)) {
    return { reply: "Open the existing consignment workflow. It will ask for the recipient and item quantities, or the sold and returned quantities when settling.", href: role === "owner" ? "/owner/consignments" : "/staff/consignment", label: "Open Consignments" };
  }
  if (/\b(debt|debtor|owe|payment.*customer|customer.*pay)\b/.test(q)) {
    return { reply: "Open the existing debt records. Select the correct customer and debt, then enter the payment amount and method.", href: role === "owner" ? "/owner/customers" : "/staff/debts", label: "Open Debtors" };
  }
  if (/\b(sale|sell|checkout|sold)\b/.test(q)) {
    return { reply: "Open the inventory and use its existing sales/checkout controls. Select the exact products, quantities and payment details there.", href: role === "owner" ? "/owner/inventory" : "/staff/inventory", label: "Open Inventory & Sales" };
  }
  if (/\b(inventory|stock|products|items)\b/.test(q)) {
    return { reply: "Here is your inventory. Choose the item and use the existing controls available to your account.", href: role === "owner" ? "/owner/inventory" : "/staff/inventory", label: "Open Inventory" };
  }
  return { reply: "I can help you reach the right Garrison Market workflow. Try saying: record a sale, log an expense, submit wastage, settle a consignment, record a debt payment, or open inventory. I’ll keep the existing forms and their checks in place." };
};

export default function SpeakOn({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Entry[]>([
    { role: "assistant", text: "Hi, I’m Speak On. Tell me what you want to do in the store. You can speak or type, and I’ll guide you to the right existing workflow." },
  ]);
  const recognitionRef = useRef<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    return () => {
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
      setListening(false);
    };
  }, [open]);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Voice recognition is not available in this browser. You can type your request below instead." }]);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-NG";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const spoken = String(event.results?.[0]?.[0]?.transcript ?? "").trim();
      if (spoken) setDraft((current) => current ? current + " " + spoken : spoken);
    };
    recognition.onerror = () => setMessages((prev) => [...prev, { role: "assistant", text: "I couldn’t hear that clearly. Please try again or type it." }]);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => startListening(), 350);
    return () => window.clearTimeout(timer);
  }, [open, startListening]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    const result = resolveSpeakOnRequest(text, role);
    setMessages((prev) => [...prev, { role: "user", text }, { role: "assistant", ...result }]);
    setDraft("");
    setBusy(false);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(result.reply));
    }
  }, [draft, busy, role]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open Speak On voice assistant" className="fixed bottom-24 right-4 z-[70] h-14 w-14 rounded-full bg-violet-600 text-white shadow-xl shadow-violet-900/25 flex items-center justify-center hover:bg-violet-500 active:scale-95 transition">
        <Mic size={23} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Speak On assistant">
          <section className="w-full sm:max-w-md h-[min(78vh,680px)] rounded-t-3xl sm:rounded-3xl bg-[var(--bg-surface)] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2"><span className="h-9 w-9 rounded-xl bg-violet-600/10 text-violet-500 flex items-center justify-center"><MessageCircle size={18}/></span><div><p className="text-sm font-bold text-[var(--text-primary)]">Speak On</p><p className="text-[11px] text-slate-500">Voice assistance · {role}</p></div></div>
              <button type="button" onClick={() => { recognitionRef.current?.stop?.(); setOpen(false); }} aria-label="Close Speak On" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={19}/></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-8" : "mr-5"}>
                <div className={m.role === "user" ? "rounded-2xl rounded-br-md bg-blue-600 text-white px-3.5 py-2.5 text-sm" : "rounded-2xl rounded-bl-md bg-slate-100 dark:bg-slate-800 text-[var(--text-primary)] px-3.5 py-2.5 text-sm leading-relaxed"}>{m.text}</div>
                {m.href && <button type="button" onClick={() => { setOpen(false); router.push(m.href!); }} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-violet-500/30 px-3 py-2 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10">{m.label}<ArrowRight size={14}/></button>}
              </div>)}
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={listening ? () => recognitionRef.current?.stop?.() : startListening} className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-white ${listening ? "bg-rose-600" : "bg-violet-600"}`} aria-label={listening ? "Stop listening" : "Start voice input"}>{listening ? <MicOff size={18}/> : <Mic size={18}/>}</button>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder={listening ? "Listening… speak now" : "Speak or type your request"} className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-violet-500"/>
                <button type="button" onClick={send} disabled={!draft.trim() || busy} className="h-11 w-11 shrink-0 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 flex items-center justify-center" aria-label="Send request"><Send size={17}/></button>
              </div>
              <p className="text-[10px] text-slate-400 text-center">Speak On guides you through existing forms. Review details and save using the app’s normal controls.</p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
