// FILE: apps/frontend/components/AskMePanel.tsx

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Send, Sparkles, User, Package, ImagePlus, X, Wand2 } from "lucide-react";
import {
  askStoreAssistant,
  type AskMeChatMessage,
  type AskMeProduct,
  type AskMeGeneratedImage,
} from "@/lib/store-assistant.actions";
import { ASK_ME_STARTERS } from "@/lib/store-assistant-knowledge";

/**
 * Shared "Ask Me" AI chat UI — used inside both StaffSupportBubble and
 * OwnerSupportBubble. Unlike ChatPanel (which polls a real two-person
 * thread on the server), this holds its own conversation in local
 * component state and calls askStoreAssistant() directly: there's no
 * "other party" to poll for, no typing indicator, and nothing persisted —
 * closing the chat bubble clears the conversation, which is fine since
 * every answer is re-derivable from the knowledge base at any time. The
 * same applies to attached/generated images — neither is ever saved
 * anywhere, they only exist for the current chat session.
 */

interface Message {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  products?: AskMeProduct[];
  generatedImage?: AskMeGeneratedImage;
  attachedImage?: string; // data URL preview of a photo the user sent
}

// Client-side pre-check only — the server independently re-validates size
// and MIME type regardless of what's enforced here (see
// store-assistant.actions.ts). This just avoids a slow upload + a round
// trip for an image the server would reject anyway.
const MAX_ATTACH_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

// Parses the assistant's reply for [Label](/path) markdown-style links and
// renders each as a real, tappable in-app link (client-side navigation via
// next/link — no full page reload). Only paths starting with "/" are ever
// treated as links; anything else in that bracket-paren shape is left as
// plain text, since link targets come from an LLM and an internal-only
// allowlist is the safest way to render them.
function renderMessageContent(content: string, onNavigate?: () => void) {
  const pattern = /\[([^\]]+)\]\((\/[^\s()]*)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <Link
        key={key++}
        href={match[2]}
        onClick={() => onNavigate?.()}
        className="font-semibold underline decoration-2 underline-offset-2 text-violet-600 dark:text-violet-400 hover:text-violet-500"
      >
        {match[1]}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  return parts;
}

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

function GeneratedImageCard({ image }: { image: AskMeGeneratedImage }) {
  return (
    <div className="max-w-[78%] mt-1 ml-9">
      <div className="rounded-xl overflow-hidden border border-violet-500/25 bg-[var(--bg-surface)]">
        <img src={image.url} alt={image.prompt} className="w-full h-auto block" loading="lazy" />
        <div className="px-2.5 py-1.5 flex items-center gap-1.5 bg-violet-600/5">
          <Wand2 size={11} className="text-violet-500 shrink-0" />
          <p className="text-[10px] text-violet-600 dark:text-violet-400 leading-snug">
            AI-generated mockup — not a real product photo
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AskMePanel({ role, onNavigate }: { role: "owner" | "staff"; onNavigate?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const handleFileSelect = (file: File | undefined) => {
    setAttachError(null);
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setAttachError("Please attach a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_ATTACH_BYTES) {
      setAttachError("That image is too large — please attach something under 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAttachedImage(reader.result as string);
    reader.onerror = () => setAttachError("Couldn't read that image — please try another.");
    reader.readAsDataURL(file);
  };

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if ((!trimmed && !attachedImage) || sending) return;

    const imageToSend = attachedImage;
    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: trimmed || "(sent a photo)", attachedImage: imageToSend ?? undefined },
    ];
    setMessages(nextMessages);
    setInput("");
    setAttachedImage(null);
    setAttachError(null);
    setSending(true);

    try {
      const history: AskMeChatMessage[] = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const result = await askStoreAssistant(history, imageToSend ?? undefined);
      if (result.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.reply,
            products: result.products?.length ? result.products : undefined,
            generatedImage: result.generatedImage ?? undefined,
          },
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
                      {isMine && m.attachedImage && (
                        <img
                          src={m.attachedImage}
                          alt="Attached"
                          className="max-h-40 w-auto rounded-lg mb-1.5 border border-white/20"
                        />
                      )}
                      {isMine ? m.content : renderMessageContent(m.content, onNavigate)}
                    </div>
                    {isMine && <UserAvatar />}
                  </div>
                  {!isMine && m.products && m.products.length > 0 && <ProductCards products={m.products} />}
                  {!isMine && m.generatedImage && <GeneratedImageCard image={m.generatedImage} />}
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

      <div className="border-t border-slate-200/60 dark:border-slate-800/60 shrink-0">
        {(attachedImage || attachError) && (
          <div className="px-3 pt-2.5 flex items-center gap-2">
            {attachedImage && (
              <div className="relative">
                <img src={attachedImage} alt="Attached preview" className="h-12 w-12 rounded-lg object-cover border border-slate-300 dark:border-slate-700" />
                <button
                  onClick={() => setAttachedImage(null)}
                  className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 rounded-full bg-slate-700 text-white flex items-center justify-center"
                  aria-label="Remove attached image"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            {attachError && <p className="text-[11px] text-amber-600 dark:text-amber-400">{attachError}</p>}
          </div>
        )}
        <div className="p-3 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              handleFileSelect(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-violet-500 hover:border-violet-500/40 disabled:opacity-50 flex items-center justify-center transition-colors"
            aria-label="Attach an image"
          >
            <ImagePlus size={16} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask how to do something..."
            className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-4 text-sm text-[var(--text-primary)] outline-none focus:border-violet-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={sending || (!input.trim() && !attachedImage)}
            className="h-10 w-10 shrink-0 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:dark:text-slate-600 text-white flex items-center justify-center transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}