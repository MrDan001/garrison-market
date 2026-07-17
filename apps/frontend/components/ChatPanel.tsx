"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Headphones } from "lucide-react";

interface Message {
  id: number;
  content: string;
  senderId: number;
  senderRole: string;
  createdAt: string;
  sender?: { fullName: string; role: string; image?: string | null };
}

function Avatar({ name, image }: { name?: string | null; image?: string | null }) {
  return (
    <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-[10px] font-bold text-blue-400 shrink-0 overflow-hidden">
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        name?.charAt(0).toUpperCase() || "?"
      )}
    </div>
  );
}

export default function ChatPanel({
  messages,
  currentUserId,
  onSend,
  onTyping,
  otherTyping = false,
  otherPartyName,
  otherPartyImage,
  placeholder = "Type a message...",
  emptyStateTitle = "No messages yet",
  emptyStateSub = "Start the conversation below.",
}: {
  messages: Message[];
  currentUserId: number;
  onSend: (content: string) => Promise<void>;
  onTyping?: () => void;
  otherTyping?: boolean;
  otherPartyName?: string | null;
  otherPartyImage?: string | null;
  placeholder?: string;
  emptyStateTitle?: string;
  emptyStateSub?: string;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTypingPing = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, otherTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (onTyping) {
      const now = Date.now();
      if (now - lastTypingPing.current > 2000) {
        lastTypingPing.current = now;
        onTyping();
      }
    }
  };

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

  const showEmptyState = messages.length === 0 && !otherTyping;

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {showEmptyState ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="h-14 w-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
              <Headphones size={24} className="text-slate-700" />
            </div>
            <p className="text-sm font-semibold text-slate-300">{emptyStateTitle}</p>
            <p className="text-xs text-slate-600 mt-1 max-w-[220px]">{emptyStateSub}</p>
          </div>
        ) : (
          <>
            {messages.map((m) => {
              const isMine = m.senderId === currentUserId;
              return (
                <div key={m.id} className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                  {!isMine && <Avatar name={m.sender?.fullName} image={m.sender?.image} />}
                  <div className={`max-w-[72%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
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
                  {isMine && <Avatar name={m.sender?.fullName} image={m.sender?.image} />}
                </div>
              );
            })}

            {otherTyping && (
              <div className="flex items-end gap-2 justify-start">
                <Avatar name={otherPartyName} image={otherPartyImage} />
                <div className="px-3.5 py-3 rounded-2xl rounded-bl-md bg-slate-800 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-slate-800/60 p-3 flex items-center gap-2 shrink-0">
        <input
          value={input}
          onChange={handleInputChange}
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