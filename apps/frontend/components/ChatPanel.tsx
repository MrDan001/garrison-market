"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Headphones } from "lucide-react";

interface Message {
  id: number;
  content: string;
  senderId: number;
  senderRole: string;
  createdAt: string;
  sender?: { fullName: string; role: string };
}

export default function ChatPanel({
  messages,
  currentUserId,
  onSend,
  placeholder = "Type a message...",
  emptyStateTitle = "No messages yet",
  emptyStateSub = "Start the conversation below.",
}: {
  messages: Message[];
  currentUserId: number;
  onSend: (content: string) => Promise<void>;
  placeholder?: string;
  emptyStateTitle?: string;
  emptyStateSub?: string;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    try {
      await onSend(text);
    } catch (err) {
      console.error(err);
      setInput(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="h-14 w-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
              <Headphones size={24} className="text-slate-700" />
            </div>
            <p className="text-sm font-semibold text-slate-300">{emptyStateTitle}</p>
            <p className="text-xs text-slate-600 mt-1 max-w-[220px]">{emptyStateSub}</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {!isMine && (
                    <span className="text-[10px] text-slate-500 px-1 capitalize">
                      {m.sender?.fullName || m.senderRole}
                    </span>
                  )}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMine
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-slate-800 text-slate-200 rounded-bl-md"
                    }`}
                  >
                    {m.content}
                  </div>
                  <span className="text-[9px] text-slate-600 px-1">
                    {new Date(m.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-800/60 p-3 flex items-center gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={placeholder}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-4 text-sm text-white outline-none focus:border-blue-600 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="h-10 w-10 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}