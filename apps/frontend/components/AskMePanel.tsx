// FILE: apps/frontend/components/AskMePanel.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User, Package } from "lucide-react";
import { askStoreAssistant, type AskMeChatMessage, type AskMeProduct } from "@/lib/store-assistant.actions";
import { ASK_ME_STARTERS } from "@/lib/store-assistant-knowledge";

/**
 * Shared "Ask Me" AI chat UI — used inside both StaffSupportBubble and
 * OwnerSupportBubble (Stage 6). Unlike ChatPanel (which polls a real
 * two-person thread on the server), this holds its own conversation in
 * local component state and calls askStoreAssistant() directly: there's no
 * "other party" to poll for, no typing indicator, and nothing persisted —
 * closing the chat bubble clears the conversation, which is fine since
 * every answer is re-derivable from the knowledge base at any time.
 */

interface Message {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  products?: AskMeProduct[];
}

function AiAvatar() {
  return (
    <div className="h-7 w-7 rounded-full bg-violet-600/15 border border-violet-500/30 flex items-center justify-center shrink-0">
      <Sparkles size={13} className="text-violet-400" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700/60 flex items-center justify-center shrink-0">
      <User size={13} className="text-slate-500" />
    </div>
  );
}

const NAIRA = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

function ProductCards({ products }: { products: AskMeProduct[] }) {
  return (
    <div className="max-w-[92%] grid grid-cols-2 gap-2 mt-1 ml-9">
      {products.map((p) => (
        <div
          key={p.id}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--bg-surface)] overflow-hidden"
        >
          <div className="h-20 w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
            {p.image ? (
              <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <Package size={20} className="text-slate-300 dark:text-slate-700" />
            )}
          </div>
          <div className="p-2">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{p.name}</p>
            <p className="text-[11px] text-slate-500">{NAIRA.format(p.price)}</p>
            <p className="text-[10px] text-violet-500 dark:text-violet-400">{p.unitsSold} sold · 30d</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AskMePanel({ role }: { role: "owner" | "staff" }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || sending) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const history: AskMeChatMessage[] = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const result = await askStoreAssistant(history);
      if (result.success) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.reply, products: result.products?.length ? result.products : undefined },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: result.error, isError: true }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong — please try again.", isError: true },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => ask(input);

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="h-14 w-14 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-3">
              <Sparkles size={24} className="text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ask Me anything about the app</p>
            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1 max-w-[240px] mb-5">
              How-to questions about using Garrison Market — I'll point you to the exact page and steps.
            </p>
            <div className="w-full space-y-2">
              {ASK_ME_STARTERS[role].map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="w-full text-left text-xs px-3.5 py-2.5 rounded-xl bg-violet-600/5 border border-violet-500/15 hover:border-violet-500/40 text-slate-600 dark:text-slate-400 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => {
              const isMine = m.role === "user";
              return (
                <div key={i}>
                  <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                    {!isMine && <AiAvatar />}
                    <div
                      className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        isMine
                          ? "bg-blue-600 text-white rounded-br-md"
                          : m.isError
                          ? "bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 rounded-bl-md"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md"
                      }`}
                    >
                      {m.content}
                    </div>
                    {isMine && <UserAvatar />}
                  </div>
                  {!isMine && m.products && m.products.length > 0 && <ProductCards products={m.products} />}
                </div>
              );
            })}

            {sending && (
              <div className="flex items-end gap-2 justify-start">
                <AiAvatar />
                <div className="px-3.5 py-3 rounded-2xl rounded-bl-md bg-slate-200 dark:bg-slate-800 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-slate-200/60 dark:border-slate-800/60 p-3 flex items-center gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask how to do something..."
          className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-sm text-[var(--text-primary)] outline-none focus:border-violet-500 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="h-10 w-10 shrink-0 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:dark:text-slate-600 text-white flex items-center justify-center transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}