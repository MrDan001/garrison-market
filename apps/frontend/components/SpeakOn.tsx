"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, X, Send, ArrowRight, MessageCircle } from "lucide-react";
import { resolveSpeakOnRequest } from "@/lib/speak-on-routing";
import { askStoreAssistant } from "@/lib/store-assistant.actions";
import { addExpenseAction } from "@/lib/expense.actions";
import { addStockToInventoryAction, getInventoryForStaff, processSaleAction } from "@/lib/business.actions";
import { getOpenDebtsForOwner, getOpenDebtsForStaff, recordDebtPaymentAction } from "@/lib/debt.actions";
import { getScaleInventoryForStaff, processScaleSaleAction } from "@/lib/scale-inventory.actions";
import { submitWastageAction, getWastageForOwner, approveWastageAction, declineWastageAction } from "@/lib/scale-wastage.actions";
import { WASTAGE_REASONS, WASTAGE_REASON_LABELS } from "@/lib/wastage-constants";
import { getOpenConsignmentsForStaff, getOpenScaleConsignmentsForStaff, settleConsignment, settleScaleConsignment, signOutConsignment, signOutScaleConsignment, processMergedSaleAction } from "@/lib/consignment.actions";

type Role = "owner" | "staff";
type Entry = { role: "user" | "assistant"; text: string; href?: string; label?: string };
type PendingSale = { inventoryId?: number; productName?: string; quantity?: number; paymentMethod?: "cash" | "transfer"; unitPrice?: number };
type PendingStock = { inventoryId?: number; productName?: string; quantity?: number };
type PendingWastage = { mode: "submit" | "approve" | "decline"; wastageId?: number; itemId?: number; productName?: string; quantity?: number; unit?: string; reason?: string; note?: string; declineReason?: string };
type PendingConsignment = { mode: "settle"; kind: "standard" | "scale"; consignmentId: number; recipientName: string; items: { itemId: number; name: string; quantityOut: number; unit?: string; quantitySold?: number }[]; currentIndex: number };
type PendingSignOut = { kind: "standard" | "scale"; inventoryId: number; productName: string; quantity?: number; unit?: string; recipientName?: string; recipientPhone?: string };
type PendingScaleSale = { mode: "scale" | "merged-scale"; itemId: number; productName: string; quantity?: number; unit?: string; paymentMethod?: "cash" | "transfer"; price: number };
type PendingMixedSale = { standardItemId: number; standardName: string; standardQty?: number; standardPrice: number; scaleConsignmentItemId: number; scaleName: string; scaleQty?: number; scaleUnit: string; scalePrice: number; paymentMethod?: "cash" | "transfer" };
type PendingBasketSale = { items: { inventoryId: number; productName: string; quantity?: number; unitPrice: number }[]; paymentMethod?: "cash" | "transfer" };

export default function SpeakOn({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingExpense, setPendingExpense] = useState<{ amount?: number; note?: string } | null>(null);
  const [pendingSale, setPendingSale] = useState<PendingSale | null>(null);
  const [pendingStock, setPendingStock] = useState<PendingStock | null>(null);
  const [pendingWastage, setPendingWastage] = useState<PendingWastage | null>(null);
  const [pendingConsignment, setPendingConsignment] = useState<PendingConsignment | null>(null);
  const [pendingSignOut, setPendingSignOut] = useState<PendingSignOut | null>(null);
  const [pendingScaleSale, setPendingScaleSale] = useState<PendingScaleSale | null>(null);
  const [pendingMixedSale, setPendingMixedSale] = useState<PendingMixedSale | null>(null);
  const [pendingBasketSale, setPendingBasketSale] = useState<PendingBasketSale | null>(null);
  const [pendingDebt, setPendingDebt] = useState<{ debtId?: number; customerName?: string; amount?: number; paymentMethod?: "cash" | "transfer" } | null>(null);
  const [messages, setMessages] = useState<Entry[]>([
    { role: "assistant", text: "Hi, I’m Speak On. Tell me what you want to do in the store. You can speak or type, and I’ll guide you to the right existing workflow." },
  ]);
  const recognitionRef = useRef<any>(null);
  const micPermissionHelpShownRef = useRef(false);
  const sendRef = useRef<((spokenText?: string) => void) | null>(null);
  const voiceConversationRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    return () => {
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
      setListening(false);
    };
  }, [open]);

  const startListening = useCallback(async () => {
    if (typeof window === "undefined" || listening) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Voice recognition is not supported by this version of Chrome. Please update Chrome or type your request." }]);
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Chrome cannot access the microphone in this app context. Open Garrison Market using its secure Chrome app and check the microphone permission." }]);
      return;
    }

    let microphonePermission: PermissionState | "unknown" = "unknown";
    try {
      // IMPORTANT: request capture immediately in the microphone button's user gesture.
      // Awaiting Permissions.query() first can consume transient user activation on Android
      // Chrome, preventing the native Allow prompt from appearing.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      const recognition = new SpeechRecognition();
      recognition.lang = "en-NG";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setListening(true);
      recognition.onresult = (event: any) => {
        const spoken = String(event.results?.[0]?.[0]?.transcript ?? "").trim();
        // In voice-conversation mode, a completed utterance is submitted directly
        // to the assistant. It is not left sitting in the text field for manual send.
        if (spoken && voiceConversationRef.current) sendRef.current?.(spoken);
        else if (spoken) setDraft((current) => current ? current + " " + spoken : spoken);
      };
      recognition.onerror = (event: any) => {
        const messages: Record<string, string> = {
          "not-allowed": "Microphone access was blocked. Allow microphone access for Garrison Market in Chrome's site settings, then tap the microphone again.",
          "service-not-allowed": "Chrome's speech recognition service is unavailable or blocked. Check your internet connection and Chrome permissions, or type your request.",
          "audio-capture": "Chrome has permission, but it cannot access a working microphone. Check that your phone microphone is not being used by another app.",
          "no-speech": "I didn't detect speech. Please speak after tapping the microphone, then try again.",
          "network": "Chrome's speech recognition service could not connect. Check your internet connection and try again.",
          "aborted": "Voice input was stopped. Tap the microphone to try again.",
        };
        const message = messages[event?.error] || "Voice input failed (" + String(event?.error || "unknown error") + "). You can try the microphone again or type your request.";
        setMessages((prev) => [...prev, { role: "assistant", text: message }]);
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch (error: any) {
      // Only inspect permission state after the capture request has been made.
      // This keeps the initial getUserMedia() call inside the original tap gesture.
      if (navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
          microphonePermission = permission.state;
        } catch {
          microphonePermission = "unknown";
        }
      }
      const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      const unavailable = error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError";
      if (denied) {
        // Do not assume this is a site-level block: Android's microphone privacy
        // toggle, OS app permission, browser policy, and site permission can all deny capture.
        if (!micPermissionHelpShownRef.current) {
          micPermissionHelpShownRef.current = true;
          const message = microphonePermission === "denied"
            ? "Chrome reports that microphone permission for this site is blocked. Open the site controls for gmstock.co → Permissions → Microphone and change Block to Allow. If gmstock.co is not listed, check Chrome → Settings → Site settings → Microphone → Blocked."
            : microphonePermission === "granted"
              ? "Chrome says this site is allowed, but Android/browser microphone capture was still denied. Check Android Quick Settings and make sure the Microphone access privacy toggle is ON. Also check Android Settings → Apps → Chrome → Permissions → Microphone. Close other apps using the microphone, then retry."
              : "The microphone request was denied, but Chrome could not confirm that the website itself is blocked. Check Android Quick Settings and make sure the Microphone access privacy toggle is ON, then check Android Settings → Apps → Chrome → Permissions → Microphone. In Chrome, check gmstock.co → site controls → Permissions → Microphone. If it still fails, the browser is denying capture despite these settings.";
          setMessages((prev) => [...prev, { role: "assistant", text: message }]);
        }
      } else {
        const message = unavailable
          ? "No microphone was found on this device. Check your phone's microphone and try again."
          : "Chrome could not start microphone access (" + String(error?.name || "unknown error") + "). Check the app's microphone permission and try again.";
        setMessages((prev) => [...prev, { role: "assistant", text: message }]);
      }
      setListening(false);
    }
  }, [listening]);

  useEffect(() => {
    if (!open) return;
    // Speak the greeting, but do not start listening automatically. On Android,
    // microphone permission must be requested from an explicit user gesture.
    if ("speechSynthesis" in window) {
      const greeting = new SpeechSynthesisUtterance("Hi, I’m Speak On. What would you like to do?");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(greeting);
    }
    return () => {
      window.speechSynthesis?.cancel?.();
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
      setListening(false);
    };
  }, [open]);

  const send = useCallback(async (spokenText?: string) => {
    const text = (spokenText ?? draft).trim();
    if (!text || busy) return;
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setDraft("");

    const say = (reply: string, href?: string, label?: string) => {
      setMessages((prev) => [...prev, { role: "assistant", text: reply, href, label }]);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.onend = () => {
          // Keep the voice session conversational: after the assistant finishes
          // speaking, reopen recognition for the user's next turn.
          if (voiceConversationRef.current) window.setTimeout(() => startListening(), 350);
        };
        window.speechSynthesis.speak(utterance);
      }
    };

    try {
      const normalized = text.toLowerCase();
      const confirms = /^(yes|confirm|confirm it|go ahead|do it|save it)$/i.test(normalized);
      const cancels = /^(no|cancel|stop|don't|dont)$/i.test(normalized);

      if (pendingBasketSale) {
        if (cancels) {
          setPendingBasketSale(null);
          say("I cancelled the basket sale. No items were sold and stock was not changed.");
        } else if (confirms) {
          const p = pendingBasketSale;
          if (p.items.some((item) => !item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) || !p.paymentMethod) {
            say("I still need a valid whole-number quantity for every item and the payment method.");
          } else {
            const result = await processSaleAction(p.items.map((item) => ({ id: item.inventoryId, qty: item.quantity! })), p.paymentMethod);
            setPendingBasketSale(null);
            say("The basket sale was recorded successfully for " + p.items.map((item) => item.quantity + " × " + item.productName).join(", ") + "." + ("total" in result ? " Total: " + Number(result.total).toLocaleString() + "." : ""));
          }
        } else {
          const nextItems = pendingBasketSale.items.map((item) => ({ ...item }));
          const nextMissing = nextItems.findIndex((item) => item.quantity === undefined);
          const qtyMatch = text.match(/\b(\d+)\b/);
          if (nextMissing >= 0 && qtyMatch) nextItems[nextMissing].quantity = Number(qtyMatch[1]);
          const method: "cash" | "transfer" | undefined = pendingBasketSale.paymentMethod ?? (/\btransfer\b/i.test(text) ? "transfer" : /\bcash\b/i.test(text) ? "cash" : undefined);
          const next = { ...pendingBasketSale, items: nextItems, paymentMethod: method };
          setPendingBasketSale(next);
          const missing = next.items.find((item) => item.quantity === undefined);
          if (missing) say("How many units of " + missing.productName + " were sold?");
          else if (!next.paymentMethod) say("Was the basket payment cash or transfer?");
          else say("Please confirm this basket sale: " + next.items.map((item) => item.quantity + " × " + item.productName).join(", ") + ", paid by " + next.paymentMethod + ". Nothing has been recorded yet. Say yes or cancel.");
        }
      } else if (pendingMixedSale) {
        if (cancels) {
          setPendingMixedSale(null);
          say("I cancelled the mixed sale. No sale was recorded and no stock changed.");
        } else if (confirms) {
          const p = pendingMixedSale;
          if (!p.standardQty || p.standardQty <= 0 || !Number.isInteger(p.standardQty) || !p.scaleQty || p.scaleQty <= 0 || !p.paymentMethod) {
            say("I still need a whole-number quantity for " + p.standardName + ", a valid weight/volume quantity for " + p.scaleName + ", and the payment method.");
          } else {
            const result = await processMergedSaleAction(
              [{ id: p.standardItemId, qty: p.standardQty, price: p.standardPrice }],
              [{ consignmentItemId: p.scaleConsignmentItemId, enteredQty: p.scaleQty, enteredUnit: p.scaleUnit, price: p.scalePrice }],
              p.paymentMethod
            );
            setPendingMixedSale(null);
            say("The mixed sale containing " + p.standardName + " and " + p.scaleName + " was recorded successfully." + ("total" in result ? " Total: " + Number(result.total).toLocaleString() + "." : ""));
          }
        } else {
          const method: "cash" | "transfer" | undefined = pendingMixedSale.paymentMethod ?? (/\btransfer\b/i.test(text) ? "transfer" : /\bcash\b/i.test(text) ? "cash" : undefined);
          const scaleAmount = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b/i);
          const standardAmount = pendingMixedSale.standardQty === undefined ? text.match(/\b(\d+)\b/) : null;
          const next = {
            ...pendingMixedSale,
            standardQty: pendingMixedSale.standardQty ?? (standardAmount ? Number(standardAmount[1]) : undefined),
            scaleQty: pendingMixedSale.scaleQty ?? (scaleAmount ? Number(scaleAmount[1]) : undefined),
            scaleUnit: scaleAmount?.[2]?.toLowerCase() || pendingMixedSale.scaleUnit,
            paymentMethod: method,
          };
          setPendingMixedSale(next);
          if (!next.standardQty) say("How many units of " + next.standardName + " were sold?");
          else if (!next.scaleQty) say("How much " + next.scaleName + " was sold? Include kg, g, L or ml.");
          else if (!next.paymentMethod) say("Was the payment cash or transfer?");
          else say("Please confirm one mixed sale: " + next.standardQty + " × " + next.standardName + " and " + next.scaleQty + next.scaleUnit + " of " + next.scaleName + ", paid by " + next.paymentMethod + ". Nothing has been recorded yet. Say yes to confirm or cancel.");
        }
      } else if (pendingScaleSale) {
        if (cancels) { setPendingScaleSale(null); say("I cancelled that weight/volume sale. No sale or stock change was made."); }
        else if (confirms) {
          if (!pendingScaleSale.quantity || pendingScaleSale.quantity <= 0 || !pendingScaleSale.unit || !pendingScaleSale.paymentMethod) say("I still need a valid quantity, unit and payment method.");
          else {
            const result = pendingScaleSale.mode === "scale"
              ? await processScaleSaleAction([{ id: pendingScaleSale.itemId, enteredQty: pendingScaleSale.quantity, enteredUnit: pendingScaleSale.unit, price: pendingScaleSale.price }], pendingScaleSale.paymentMethod)
              : await processMergedSaleAction([], [{ consignmentItemId: pendingScaleSale.itemId, enteredQty: pendingScaleSale.quantity, enteredUnit: pendingScaleSale.unit, price: pendingScaleSale.price }], pendingScaleSale.paymentMethod);
            setPendingScaleSale(null);
            say("The " + pendingScaleSale.productName + " sale was recorded successfully." + ("total" in result ? " Total: " + Number(result.total).toLocaleString() + "." : ""));
          }
        } else {
          const amount = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml)?\b/i);
          const method = /\btransfer\b/i.test(text) ? "transfer" : /\bcash\b/i.test(text) ? "cash" : undefined;
          const next = { ...pendingScaleSale, quantity: pendingScaleSale.quantity ?? (amount ? Number(amount[1]) : undefined), unit: pendingScaleSale.unit ?? amount?.[2]?.toLowerCase(), paymentMethod: pendingScaleSale.paymentMethod ?? method };
          setPendingScaleSale(next);
          if (!next.quantity) say("How much " + next.productName + " was sold?");
          else if (!next.unit) say("Which unit was used: kg, g, L or ml?");
          else if (!next.paymentMethod) say("Was the payment cash or transfer?");
          else say("Confirm sale of " + next.quantity + next.unit + " of " + next.productName + " by " + next.paymentMethod + "? Estimated total: " + (next.quantity * next.price).toLocaleString() + ". Nothing has been recorded yet. Say yes or cancel.");
        }
      } else if (pendingSignOut) {
        if (cancels) { setPendingSignOut(null); say("I cancelled the consignment sign-out. No stock was moved."); }
        else if (confirms) {
          if (!pendingSignOut.quantity || pendingSignOut.quantity <= 0 || (pendingSignOut.kind === "standard" && !Number.isInteger(pendingSignOut.quantity)) || !pendingSignOut.recipientName?.trim() || !pendingSignOut.recipientPhone?.trim() || (pendingSignOut.kind === "scale" && !pendingSignOut.unit)) say("I still need the quantity, recipient name and phone number.");
          else {
            const result = pendingSignOut.kind === "standard"
              ? await signOutConsignment({ recipientName: pendingSignOut.recipientName, recipientPhone: pendingSignOut.recipientPhone, items: [{ inventoryId: pendingSignOut.inventoryId, quantityOut: pendingSignOut.quantity }] })
              : await signOutScaleConsignment({ recipientName: pendingSignOut.recipientName, recipientPhone: pendingSignOut.recipientPhone, items: [{ scaleInventoryId: pendingSignOut.inventoryId, enteredQty: pendingSignOut.quantity, enteredUnit: pendingSignOut.unit! }] });
            setPendingSignOut(null); say("Consignment stock was signed out for " + pendingSignOut.recipientName + ". Reference " + result.id + ".");
          }
        } else {
          const phone = text.match(/(?:\+?\d[\d\s()-]{6,}\d)/);
          const recipient = text.match(/\b(?:to|for)\s+([a-z][a-z .'-]{1,50})/i);
          const amount = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml)?\b/i);
          const next = { ...pendingSignOut, quantity: pendingSignOut.quantity ?? (amount ? Number(amount[1]) : undefined), unit: pendingSignOut.unit ?? amount?.[2]?.toLowerCase(), recipientPhone: pendingSignOut.recipientPhone ?? phone?.[0].replace(/\D/g, ""), recipientName: pendingSignOut.recipientName ?? recipient?.[1]?.trim() };
          setPendingSignOut(next);
          if (!next.quantity) say("How much " + next.productName + " should I sign out?");
          else if (next.kind === "scale" && !next.unit) say("What unit is that quantity in: kg, g, L or ml?");
          else if (!next.recipientName) say("Who is receiving the consignment?");
          else if (!next.recipientPhone) say("What is " + next.recipientName + "'s phone number?");
          else say("Confirm sign-out of " + next.quantity + (next.unit || " units") + " of " + next.productName + " to " + next.recipientName + " (" + next.recipientPhone + ")? Stock changes only after confirmation. Say yes or cancel.");
        }
      } else if (pendingConsignment) {
        if (cancels) {
          setPendingConsignment(null);
          say("Okay. I cancelled the consignment settlement. Nothing was settled and no stock was changed.");
        } else if (confirms) {
          const ready = pendingConsignment.items.every((item) => item.quantitySold !== undefined && item.quantitySold >= 0 && item.quantitySold <= item.quantityOut);
          if (!ready) say("I still need a valid sold quantity for every item before settlement.");
          else {
            const settlements = pendingConsignment.items.map((item) => ({ itemId: item.itemId, quantitySold: item.quantitySold!, quantityReturned: Math.max(0, item.quantityOut - item.quantitySold!) }));
            if (pendingConsignment.kind === "standard") await settleConsignment(pendingConsignment.consignmentId, settlements);
            else await settleScaleConsignment(pendingConsignment.consignmentId, settlements);
            setPendingConsignment(null);
            say("Consignment for " + pendingConsignment.recipientName + " was settled successfully. Sold quantities were recorded and unsold quantities returned to stock.");
          }
        } else {
          const current = pendingConsignment.items[pendingConsignment.currentIndex];
          const match = text.match(/\b(\d+(?:\.\d+)?)\b/);
          const sold = match ? Number(match[1]) : NaN;
          if (!Number.isFinite(sold) || sold < 0 || sold > current.quantityOut || (pendingConsignment.kind === "standard" && !Number.isInteger(sold))) say("Please enter a valid sold quantity between 0 and " + current.quantityOut + (current.unit || "") + " for " + current.name + (pendingConsignment.kind === "standard" ? " using a whole number." : "."));
          else {
            const items = pendingConsignment.items.map((item, index) => index === pendingConsignment.currentIndex ? { ...item, quantitySold: sold } : item);
            const nextIndex = items.findIndex((item) => item.quantitySold === undefined);
            if (nextIndex >= 0) {
              setPendingConsignment({ ...pendingConsignment, items, currentIndex: nextIndex });
              const nextItem = items[nextIndex];
              say("How many " + (nextItem.unit || "units") + " of " + nextItem.name + " were sold? " + nextItem.quantityOut + (nextItem.unit || "") + " were signed out.");
            } else {
              setPendingConsignment({ ...pendingConsignment, items, currentIndex: 0 });
              const summary = items.map((item) => item.name + ": " + item.quantitySold + " sold, " + (item.quantityOut - item.quantitySold!) + " returned").join("; ");
              say("Please confirm settlement for " + pendingConsignment.recipientName + ": " + summary + ". The existing settlement action will record the sale and return remaining stock. Say yes to confirm or cancel.");
            }
          }
        }
      } else if (pendingWastage) {
        if (cancels) {
          setPendingWastage(null);
          say("Okay. I cancelled the wastage action. No record or stock was changed.");
        } else if (confirms) {
          if (pendingWastage.mode === "submit" && pendingWastage.itemId && pendingWastage.quantity && pendingWastage.unit && pendingWastage.reason) {
            await submitWastageAction({ scaleInventoryId: pendingWastage.itemId, quantity: pendingWastage.quantity, unit: pendingWastage.unit, reason: pendingWastage.reason, note: pendingWastage.note });
            setPendingWastage(null);
            say("Wastage was submitted for owner approval. Stock has not been changed.");
          } else if (pendingWastage.mode === "approve" && pendingWastage.wastageId) {
            await approveWastageAction(pendingWastage.wastageId);
            setPendingWastage(null);
            say("Wastage entry approved. The existing approval action has applied the stock adjustment.");
          } else if (pendingWastage.mode === "decline" && pendingWastage.wastageId && pendingWastage.declineReason) {
            await declineWastageAction(pendingWastage.wastageId, pendingWastage.declineReason);
            setPendingWastage(null);
            say("Wastage entry declined. The staff member will be notified.");
          } else {
            say(pendingWastage.mode === "decline" ? "Please give a reason for declining this entry." : "I still need the item, quantity, unit and reason before submitting wastage.");
          }
        } else if (pendingWastage.mode === "submit") {
          const amountMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml)?\b/i);
          const quantity = pendingWastage.quantity ?? (amountMatch ? Number(amountMatch[1]) : undefined);
          const unit = amountMatch?.[2]?.toLowerCase() || pendingWastage.unit;
          const reason = pendingWastage.reason || WASTAGE_REASONS.find((r) => new RegExp(r, "i").test(text));
          const next = { ...pendingWastage, quantity, unit, reason };
          setPendingWastage(next);
          if (!quantity) say("How much " + (next.productName || "stock") + " was wasted? Include the unit.");
          else if (!reason) say("What was the reason: trimming, spillage, spoilage, sample or other?");
          else say("Please confirm: submit " + quantity + unit + " of " + next.productName + " as " + (WASTAGE_REASON_LABELS as any)[reason] + "? The owner must approve it. Say yes or cancel.");
        } else if (pendingWastage.mode === "decline" && !pendingWastage.declineReason) {
          const declineReason = text.replace(/^(because|reason)\s*/i, "").trim();
          setPendingWastage({ ...pendingWastage, declineReason });
          say("Please confirm declining " + pendingWastage.productName + " with this reason: " + declineReason + "? Say yes or cancel.");
        } else {
          say("Please say yes to confirm this wastage action, or cancel.");
        }
      } else if (pendingStock) {
        if (cancels) {
          setPendingStock(null);
          say("Okay. I cancelled that stock addition. Inventory has not changed.");
        } else if (confirms) {
          if (role !== "owner") {
            setPendingStock(null);
            say("Only the owner can add stock. Nothing has changed.");
          } else if (!pendingStock.inventoryId || !pendingStock.quantity || pendingStock.quantity <= 0) {
            say("I still need the exact product and a valid quantity.");
          } else {
            const formData = new FormData();
            formData.set("inventoryId", String(pendingStock.inventoryId));
            formData.set("quantity", String(pendingStock.quantity));
            const result = await addStockToInventoryAction(formData);
            setPendingStock(null);
            say(result.success ? "Stock was added successfully for " + pendingStock.productName + "." : result.error);
          }
        } else {
          const quantityMatch = text.match(/\b(\d+)\b/);
          const quantity = pendingStock.quantity ?? (quantityMatch ? Number(quantityMatch[1]) : undefined);
          const next = { ...pendingStock, quantity };
          setPendingStock(next);
          if (!next.quantity) say("How many units should I add to " + (next.productName || "this product") + "?");
          else say("Please confirm: add " + next.quantity + " units to " + next.productName + "? Nothing has changed yet. Say yes to confirm or cancel.");
        }
      } else if (/\b(sell|sale|sold)\b/i.test(text) && ( /\d\s*(?:kg|g|l|ml)\b/i.test(text) || /\b(grams?|litres?|liters?|millilit|scale|weight|volume)\b/i.test(text) )) {
        const mixedIntent = /\b(mixed|combined|merged|both)\b/i.test(text) && /\b(and|plus|both)\b/i.test(text);
        if (mixedIntent) {
          const [standardInventory, openScaleConsignments] = await Promise.all([getInventoryForStaff(), getOpenScaleConsignmentsForStaff()]);
          const standardMatches = standardInventory.filter((item: any) => text.toLowerCase().includes(String(item.name).toLowerCase()));
          const scaleMatches = openScaleConsignments.flatMap((entry: any) => (entry.scaleItems || []).map((line: any) => ({ line, entry }))).filter(({ line }: any) => text.toLowerCase().includes(String(line.scaleInventory?.name || "").toLowerCase()));
          if (standardMatches.length !== 1 || scaleMatches.length !== 1) {
            say("For a mixed sale I need exactly one ordinary inventory item and one weight/volume item from your open consignment. Please say both exact item names.");
          } else {
            const standardItem = standardMatches[0];
            const { line } = scaleMatches[0];
            const scaleAmount = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml)\b/i);
            const numbers = [...text.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((m) => Number(m[1]));
            const standardQty = numbers.find((n) => Number.isInteger(n) && n !== (scaleAmount ? Number(scaleAmount[1]) : -1));
            const method: "cash" | "transfer" | undefined = /\btransfer\b/i.test(text) ? "transfer" : /\bcash\b/i.test(text) ? "cash" : undefined;
            const pending: PendingMixedSale = {
              standardItemId: standardItem.id,
              standardName: standardItem.name,
              standardQty,
              standardPrice: Number(standardItem.price),
              scaleConsignmentItemId: line.id,
              scaleName: line.scaleInventory?.name || "scale item",
              scaleQty: scaleAmount ? Number(scaleAmount[1]) : undefined,
              scaleUnit: scaleAmount?.[2]?.toLowerCase() || line.unit,
              scalePrice: Number(line.priceAtTime),
              paymentMethod: method,
            };
            setPendingMixedSale(pending);
            if (!pending.standardQty) say("I found both items. How many units of " + pending.standardName + " were sold?");
            else if (!pending.scaleQty) say("How much " + pending.scaleName + " was sold? Include kg, g, L or ml.");
            else if (!pending.paymentMethod) say("Was the payment cash or transfer?");
            else say("Please confirm one mixed sale: " + pending.standardQty + " × " + pending.standardName + " and " + pending.scaleQty + pending.scaleUnit + " of " + pending.scaleName + ", paid by " + pending.paymentMethod + ". Nothing has been recorded yet. Say yes to confirm or cancel.");
          }
        } else {
          const mergedIntent = /\b(merged|combined)\b/i.test(text);
          if (mergedIntent) {
            const consignments = await getOpenScaleConsignmentsForStaff();
            const matches = consignments.flatMap((entry: any) => (entry.scaleItems || []).map((line: any) => ({ line, entry }))).filter(({ line }: any) => text.toLowerCase().includes(String(line.scaleInventory?.name || "").toLowerCase()));
            if (matches.length !== 1) say(matches.length ? "More than one consigned item matches. Please specify the exact item." : "I couldn't find that item in your open weight/volume consignments.");
            else {
              const { line } = matches[0];
              const amount = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml)?\b/i);
              const method: "cash" | "transfer" | undefined = /\btransfer\b/i.test(text) ? "transfer" : /\bcash\b/i.test(text) ? "cash" : undefined;
              const pending: PendingScaleSale = { mode: "merged-scale", itemId: line.id, productName: line.scaleInventory?.name || "scale item", quantity: amount ? Number(amount[1]) : undefined, unit: amount?.[2]?.toLowerCase() || line.unit, paymentMethod: method, price: Number(line.priceAtTime) };
              setPendingScaleSale(pending);
              if (!pending.quantity) say("How much " + pending.productName + " was sold?");
              else if (!pending.paymentMethod) say("Was the payment cash or transfer?");
              else say("Confirm sale of " + pending.quantity + pending.unit + " of " + pending.productName + " by " + pending.paymentMethod + "? Say yes or cancel.");
            }
          } else {
            const inventory = await getScaleInventoryForStaff();
            const matches = inventory.filter((item: any) => text.toLowerCase().includes(String(item.name).toLowerCase()));
            if (matches.length !== 1) say(matches.length ? "More than one weight/volume item matches. Please name the exact item." : "I couldn't identify that weight/volume inventory item.");
            else {
              const item = matches[0];
              const amount = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml)?\b/i);
              const method: "cash" | "transfer" | undefined = /\btransfer\b/i.test(text) ? "transfer" : /\bcash\b/i.test(text) ? "cash" : undefined;
              const pending: PendingScaleSale = { mode: "scale", itemId: item.id, productName: item.name, quantity: amount ? Number(amount[1]) : undefined, unit: amount?.[2]?.toLowerCase() || item.unit, paymentMethod: method, price: Number(item.price) };
              setPendingScaleSale(pending);
              if (!pending.quantity) say("How much " + item.name + " was sold?");
              else if (!pending.paymentMethod) say("Was the payment cash or transfer?");
              else say("Confirm sale of " + pending.quantity + pending.unit + " of " + item.name + " by " + pending.paymentMethod + "? Estimated total: " + (pending.quantity * pending.price).toLocaleString() + ". Say yes or cancel.");
            }
          }
        }
      } else if (pendingSale) {
        if (cancels) {
          setPendingSale(null);
          say("Okay. I cancelled that sale. Nothing has been recorded and stock has not changed.");
        } else if (confirms) {
          if (!pendingSale.inventoryId || !pendingSale.quantity || pendingSale.quantity <= 0 || !pendingSale.paymentMethod) {
            say("I still need the exact product, quantity, and payment method before I can prepare this sale.");
          } else {
            const result = await processSaleAction([{ id: pendingSale.inventoryId, qty: pendingSale.quantity }], pendingSale.paymentMethod);
            setPendingSale(null);
            say("The sale was recorded successfully." + ("total" in result ? " Total: " + Number(result.total).toLocaleString() + "." : "") + " The app has updated stock.");
          }
        } else {
          const quantityMatch = text.match(/\b(\d+)\b/);
          const quantity = pendingSale.quantity ?? (quantityMatch ? Number(quantityMatch[1]) : undefined);
          const paymentMethod: "cash" | "transfer" | undefined = pendingSale.paymentMethod ?? (/\btransfer\b/i.test(text) ? "transfer" : /\bcash\b/i.test(text) ? "cash" : undefined);
          const next = { ...pendingSale, quantity, paymentMethod };
          setPendingSale(next);
          if (!next.quantity) say("How many " + (next.productName || "units") + " were sold?");
          else if (!next.paymentMethod) say("Was the payment received by cash or transfer?");
          else say("Please confirm: sell " + next.quantity + " × " + next.productName + " by " + next.paymentMethod + " (estimated total " + (Number(next.unitPrice || 0) * next.quantity).toLocaleString() + "). Nothing has been recorded yet. Say yes to confirm or cancel.");
        }
      } else if (pendingDebt) {
        if (cancels) {
          setPendingDebt(null);
          say("Okay. I cancelled the debt payment. Nothing was recorded.");
        } else if (confirms) {
          if (!pendingDebt.debtId || !pendingDebt.amount || !pendingDebt.paymentMethod) {
            say("I still need the customer, amount, and payment method before I can prepare this payment.");
          } else {
            const result = await recordDebtPaymentAction(pendingDebt.debtId, pendingDebt.amount, pendingDebt.paymentMethod);
            setPendingDebt(null);
            say(result.settled ? "The payment was recorded and the debt is now fully settled." : "The debt payment was recorded successfully.");
          }
        } else {
          const amountMatch = text.match(/(?:₦|\$|£)?\s*(\d[\d,]*(?:\.\d{1,2})?)/);
          const amount = pendingDebt.amount ?? (amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : undefined);
          const paymentMethod: "cash" | "transfer" | undefined = pendingDebt.paymentMethod ?? (/\btransfer\b/i.test(text) ? "transfer" : /\bcash\b/i.test(text) ? "cash" : undefined);
          let debtId = pendingDebt.debtId;
          let customerName = pendingDebt.customerName;
          if (!debtId) {
            const debts = role === "owner" ? await getOpenDebtsForOwner() : await getOpenDebtsForStaff();
            const match = debts.filter((d: any) => customerName ? d.customer.name.toLowerCase() === customerName.toLowerCase() : d.customer.name.toLowerCase() === text.toLowerCase());
            if (match.length === 1) { debtId = match[0].id; customerName = match[0].customer.name; }
            else if (match.length > 1) say("I found more than one open debt for that customer. Please use the customer's full name.");
            else say("I couldn't match that to an open debt. Please give me the customer's exact name as it appears in Debtors.");
          }
          if (debtId) {
            const next = { ...pendingDebt, debtId, customerName, amount, paymentMethod };
            setPendingDebt(next);
            if (!amount) say("How much did " + customerName + " pay?");
            else if (!paymentMethod) say("Was the payment received by cash or transfer?");
            else say("Please confirm: record " + amount.toLocaleString() + " received from " + customerName + " by " + paymentMethod + ". Nothing has been recorded yet. Say yes to confirm or cancel.");
          }
        }
      } else if (pendingExpense) {
        if (cancels) {
          setPendingExpense(null);
          say("Okay. I cancelled that expense. Nothing has been saved.");
        } else if (confirms) {
          if (!pendingExpense.amount || pendingExpense.amount <= 0) {
            say("I still need the expense amount before I can prepare it.");
          } else {
            const result = await addExpenseAction({ amount: pendingExpense.amount, note: pendingExpense.note });
            setPendingExpense(null);
            if (result.success) say("The expense was saved successfully.");
            else say(result.error || "I couldn't save that expense. Nothing was recorded.");
          }
        } else {
          const amountMatch = text.match(/(?:₦|\$|£)?\s*(\d[\d,]*(?:\.\d{1,2})?)/);
          if (!pendingExpense.amount && amountMatch) {
            const amount = Number(amountMatch[1].replace(/,/g, ""));
            const next = { ...pendingExpense, amount };
            setPendingExpense(next);
            say(`Please confirm: log an expense of ${amount.toLocaleString()} for ${next.note || "no note"}? Say yes to save or cancel.`);
          } else {
            say("Please say yes to save this expense, or cancel to discard it.");
          }
        }
      } else if (/\b(wastage|wasted|spoilt|spoiled|damaged)\b/i.test(text)) {
        if (role === "staff") {
          const inventory = await getScaleInventoryForStaff();
          const amountMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml)?\b/i);
          const quantity = amountMatch ? Number(amountMatch[1]) : undefined;
          const unit = amountMatch?.[2]?.toLowerCase();
          const reason = WASTAGE_REASONS.find((r) => new RegExp(r, "i").test(text)) || (/\b(spoil|spoiled|spoilt)\b/i.test(text) ? "spoilage" : /\b(spill|spillage)\b/i.test(text) ? "spillage" : /\b(trim|trimming)\b/i.test(text) ? "trimming" : /\bsample\b/i.test(text) ? "sample" : undefined);
          const productQuery = text.replace(/\b(log|submit|record|wastage|wasted|spoilt|spoiled|damaged|of|for|the|a|an|kg|g|l|ml|spoilage|spillage|trimming|sample|other)\b/gi, " ").replace(/\b\d+(?:\.\d+)?\b/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
          const matches = inventory.filter((item: any) => productQuery && item.name.toLowerCase().includes(productQuery));
          if (matches.length !== 1) {
            say(matches.length ? "I found more than one matching scale item. Please give me its exact name." : "I couldn't identify that weight/volume item. Wastage submission is available for scale inventory; open the wastage form to select it.");
          } else {
            const item = matches[0];
            const next = { mode: "submit" as const, itemId: item.id, productName: item.name, quantity, unit: unit || item.unit, reason };
            setPendingWastage(next);
            if (!quantity) say("How much " + item.name + " was wasted? Include the unit, such as kg or g.");
            else if (!reason) say("What was the reason: trimming, spillage, spoilage, sample or other?");
            else say("Please confirm: submit " + quantity + (unit || item.unit) + " of " + item.name + " as " + (WASTAGE_REASON_LABELS as any)[reason] + "? The owner must approve it; stock will not change now. Say yes or cancel.");
          }
        } else {
          const data = await getWastageForOwner();
          const mode = /\b(decline|reject)\b/i.test(text) ? "decline" : /\b(approve|accept)\b/i.test(text) ? "approve" : undefined;
          if (!mode) {
            say("Would you like to approve or decline a pending wastage entry? Please say the action and item or staff name.");
          } else {
            const itemQuery = text.split(/because|reason/i)[0].replace(/\b(approve|accept|decline|reject|wastage|wasted|entry|for|the|of|please)\b/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
            const matches = data.pending.filter((entry: any) => itemQuery && (entry.scaleInventory.name.toLowerCase().includes(itemQuery) || entry.staff?.fullName?.toLowerCase().includes(itemQuery)));
            if (matches.length !== 1) {
              say(matches.length ? "Several pending wastage entries match. Please specify the item or staff member more clearly." : data.pending.length ? "I couldn't identify the pending entry. Mention its item name or staff member." : "There are no pending wastage entries awaiting approval.");
            } else {
              const entry = matches[0];
            const declineReason = mode === "decline" ? text.split(/because|reason/i).slice(1).join(" ").trim() : undefined;
            setPendingWastage({ mode, wastageId: entry.id, productName: entry.scaleInventory.name, quantity: Number(entry.quantity), unit: entry.unit, reason: entry.reason, declineReason });
              if (mode === "decline" && !declineReason) say("What reason should I give for declining this wastage entry?");
              else say("Please confirm: " + mode + " " + entry.quantity + entry.unit + " of " + entry.scaleInventory.name + " logged by " + (entry.staff?.fullName || "staff") + "? Say yes to confirm or cancel.");
            }
          }
        }
      } else if (/\bsettle\b.*\bconsignment\b|\bconsignment\b.*\bsettle\b/i.test(text)) {
        {
          const [standard, scale] = await Promise.all([getOpenConsignmentsForStaff(), getOpenScaleConsignmentsForStaff()]);
          const query = text.replace(/\b(settle|settlement|consignment|consignments|for|the|please|of)\b/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
          const candidates = [
            ...standard.map((entry: any) => ({ kind: "standard" as const, id: entry.id, recipientName: entry.recipientName, items: (entry.items || []).map((item: any) => ({ itemId: item.id, name: item.inventory?.name || "Item", quantityOut: Number(item.quantityOut) })) })),
            ...scale.filter((entry: any) => entry.staffId !== null).map((entry: any) => ({ kind: "scale" as const, id: entry.id, recipientName: entry.recipientName, items: (entry.scaleItems || []).map((item: any) => ({ itemId: item.id, name: item.scaleInventory?.name || "Item", quantityOut: Number(item.quantityOut), unit: item.unit })) })),
          ];
          const matches = candidates.filter((entry) => query && (entry.recipientName.toLowerCase().includes(query) || entry.items.some((item: { name: string }) => item.name.toLowerCase().includes(query))));
          if (matches.length !== 1) say(matches.length > 1 ? "More than one open consignment matches. Please say the recipient's exact name." : candidates.length ? "I couldn't identify the open consignment. Please mention its recipient's name." : "You have no open consignments to settle.");
          else if (!matches[0].items.length) say("That consignment has no items to settle. Please open the consignment page to review it.");
          else {
            const entry = matches[0];
            const pending: PendingConsignment = { mode: "settle", kind: entry.kind, consignmentId: entry.id, recipientName: entry.recipientName, items: entry.items, currentIndex: 0 };
            setPendingConsignment(pending);
            const first = pending.items[0];
            say("I found the open consignment for " + entry.recipientName + ". " + first.name + " has " + first.quantityOut + (first.unit || "") + " signed out. How many were sold? I will calculate the returned quantity.");
          }
        }
      } else if (/\b(sign\s*out|send\s*out|consign\s+out)\b/i.test(text)) {
        const scaleIntent = /\d\s*(?:kg|g|l|ml)\b/i.test(text) || /\b(grams?|litres?|liters?|millilit)\b/i.test(text);
        const inventory = scaleIntent ? await getScaleInventoryForStaff() : await getInventoryForStaff();
        const candidates = inventory.filter((item: any) => text.toLowerCase().includes(String(item.name).toLowerCase()));
        if (candidates.length !== 1) say(candidates.length > 1 ? "I found more than one matching item. Please name the exact item." : "I couldn't identify the item. Please say its exact inventory name and whether it is a weight/volume item.");
        else {
          const item = candidates[0];
          const amount = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|g|l|ml)?\b/i);
          const phone = text.match(/(?:\+?\d[\d\s()-]{6,}\d)/);
          const recipient = text.match(/\b(?:to|for)\s+([a-z][a-z .'-]{1,50})/i);
          const pending: PendingSignOut = { kind: scaleIntent ? "scale" : "standard", inventoryId: item.id, productName: item.name, quantity: amount ? Number(amount[1]) : undefined, unit: amount?.[2]?.toLowerCase() || (scaleIntent ? item.unit : undefined), recipientPhone: phone?.[0].replace(/\D/g, ""), recipientName: recipient?.[1]?.replace(/\s+\d[\d\s()-]*$/, "").trim() };
          setPendingSignOut(pending);
          if (!pending.quantity) say("How much " + item.name + " should I sign out?");
          else if (scaleIntent && !pending.unit) say("What unit is the quantity in: kg, g, L or ml?");
          else if (!pending.recipientName) say("Who is receiving the consignment?");
          else if (!pending.recipientPhone) say("What is " + pending.recipientName + "'s phone number?");
          else say("Confirm sign-out of " + pending.quantity + (pending.unit || " units") + " of " + item.name + " to " + pending.recipientName + " (" + pending.recipientPhone + ")? Stock changes only after confirmation. Say yes or cancel.");
        }
      } else if (/\b(restock|add stock|receive stock|stock in)\b/i.test(text)) {
        if (role !== "owner") {
          say("Only the owner can add or restock inventory. I won't make any stock changes.");
        } else {
          const inventory = await getInventoryForStaff();
          const quantityMatch = text.match(/\b(\d+)\b/);
          const quantity = quantityMatch ? Number(quantityMatch[1]) : undefined;
          const productQuery = text
            .replace(/\b(restock|add|stock|receive|in|please|to|the|for|units|unit)\b/gi, " ")
            .replace(/\b\d+\b/g, " ")
            .replace(/\s+/g, " ").trim().toLowerCase();
          const matches = inventory.filter((item: any) => productQuery && item.name.toLowerCase().includes(productQuery));
          if (matches.length === 1) {
            const item = matches[0];
            const next = { inventoryId: item.id, productName: item.name, quantity };
            setPendingStock(next);
            if (!quantity) say("I found " + item.name + ". How many units should I add?");
            else say("Please confirm: add " + quantity + " units to " + item.name + "? Nothing has changed yet. Say yes to confirm or cancel.");
          } else if (matches.length > 1) {
            say("I found several matching products. Please give me the exact product name.");
          } else {
            say("I couldn't match that product in the active store's inventory. Nothing has changed.");
          }
        }
      } else if (/\b(sell|sale|checkout|sold)\b/i.test(text)) {
        const inventory = await getInventoryForStaff();
        const quantityMatch = text.match(/\b(\d+)\b/);
        const quantity = quantityMatch ? Number(quantityMatch[1]) : undefined;
        const paymentMethod: "cash" | "transfer" | undefined = /\btransfer\b/i.test(text) ? "transfer" : /\bcash\b/i.test(text) ? "cash" : undefined;
        const matches = inventory.filter((item: any) => item.name && text.toLowerCase().includes(String(item.name).toLowerCase()));
        if (matches.length > 1) {
          const items = matches.map((item: any) => {
            const index = text.toLowerCase().indexOf(String(item.name).toLowerCase());
            const before = text.slice(Math.max(0, index - 18), index);
            const quantity = before.match(/\b(\d+)\s*(?:x|units?)?\s*$/i);
            return { inventoryId: item.id, productName: item.name, quantity: quantity ? Number(quantity[1]) : undefined, unitPrice: Number(item.price) };
          });
          const pending: PendingBasketSale = { items, paymentMethod };
          setPendingBasketSale(pending);
          const missing = items.find((item) => item.quantity === undefined);
          if (missing) say("I found a basket with " + items.map((item) => item.productName).join(" and ") + ". How many units of " + missing.productName + " were sold?");
          else if (!paymentMethod) say("I found a basket with " + items.map((item) => item.quantity + " × " + item.productName).join(", ") + ". Was the payment cash or transfer?");
          else say("Please confirm this basket sale: " + items.map((item) => item.quantity + " × " + item.productName).join(", ") + ", paid by " + paymentMethod + ". Nothing has been recorded yet. Say yes or cancel.");
        } else if (matches.length === 1) {
          const item = matches[0];
          const next = { inventoryId: item.id, productName: item.name, quantity, paymentMethod, unitPrice: Number(item.price) };
          setPendingSale(next);
          if (!quantity) say("I found " + item.name + ". How many units were sold?");
          else if (!paymentMethod) say("I found " + item.name + ". Was the payment received by cash or transfer?");
          else say("Please confirm: sell " + quantity + " × " + item.name + " by " + paymentMethod + " (estimated total " + (Number(item.price) * quantity).toLocaleString() + "). Nothing has been recorded yet. Say yes to confirm or cancel.");
        } else if (matches.length > 1) {
          say("I found several matching products. Please say the exact product name so I don't sell the wrong item.");
        } else {
          say("I couldn't match that product in the active store's inventory. Nothing has been recorded. Please use its exact inventory name.");
        }
      } else if (/\b(debt|debtor|owe|payment from|paid by)\b/i.test(text)) {
        const debts = role === "owner" ? await getOpenDebtsForOwner() : await getOpenDebtsForStaff();
        const amountMatch = text.match(/(?:₦|\$|£)?\s*(\d[\d,]*(?:\.\d{1,2})?)/);
        const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : undefined;
        const paymentMethod: "cash" | "transfer" | undefined = /\btransfer\b/i.test(text) ? "transfer" : /\bcash\b/i.test(text) ? "cash" : undefined;
        const customerQuery = text
          .replace(/\b(record|log|a|the|debt|debtor|payment|paid|pay|from|by|customer|owe|owes|cash|transfer|naira|ngn)\b/gi, " ")
          .replace(/(?:₦|\$|£)?\s*\d[\d,]*(?:\.\d{1,2})?/g, " ")
          .replace(/\s+/g, " ").trim();
        const matches = debts.filter((d: any) => customerQuery && d.customer.name.toLowerCase().includes(customerQuery.toLowerCase()));
        if (matches.length === 1) {
          const next = { debtId: matches[0].id, customerName: matches[0].customer.name, amount, paymentMethod };
          setPendingDebt(next);
          if (!amount) say("I found " + next.customerName + "'s open debt. How much did they pay?");
          else if (!paymentMethod) say("I found " + next.customerName + "'s open debt. Was the " + amount.toLocaleString() + " received by cash or transfer?");
          else say("Please confirm: record " + amount.toLocaleString() + " received from " + next.customerName + " by " + paymentMethod + ". Nothing has been recorded yet. Say yes to confirm or cancel.");
        } else if (matches.length > 1) {
          say("I found multiple matching debt records. Please give me the customer's exact full name.");
          setPendingDebt({ amount, paymentMethod });
        } else {
          say(debts.length ? "I couldn't identify that customer. Check the exact name on the Debtors page; nothing has been recorded." : "There are no open debt records available to pay.");
        }
      } else if (/\b(expense|spent|spending|log.*cost)\b/i.test(text)) {
        const amountMatch = text.match(/(?:₦|\$|£)?\s*(\d[\d,]*(?:\.\d{1,2})?)/);
        const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : undefined;
        const note = text
          .replace(/\b(log|record|add|an?|the|expense|spent|spending|cost|of|for|naira|ngn)\b/gi, " ")
          .replace(/(?:₦|\$|£)?\s*\d[\d,]*(?:\.\d{1,2})?/g, " ")
          .replace(/\s+/g, " ").trim();
        setPendingExpense({ amount, note: note || undefined });
        if (amount) say(`I’m ready to log an expense of ${amount.toLocaleString()} for ${note || "no note"}. Nothing has been saved yet. Say yes to confirm or cancel.`);
        else say("I can log that expense. What amount should I record?");
      } else {
        const previousAction = [...messages].reverse().find((message) => message.role === "assistant" && message.href);
        const isContextualOpen = /^(open it|go there|yes|continue|take me there)$/i.test(text);
        if (isContextualOpen && previousAction?.href) {
          say("I’ll open the workflow we were just discussing.", previousAction.href, previousAction.label);
        } else {
          // Speak On shares the authenticated, store-scoped Ask Me intelligence.
          // The conversation history lets it answer follow-up questions naturally;
          // it is read-only here. Mutations still use the explicit, confirmed
          // Speak On action flows above and the existing server actions.
          const history = [
            ...messages.slice(-8).map((message) => ({ role: message.role, content: message.text })),
            { role: "user" as const, content: text },
          ];
          const result = await askStoreAssistant(history);
          if (result.success && result.reply) {
            say(result.reply);
          } else {
            const fallback = resolveSpeakOnRequest(text, role);
            say(result.success ? fallback.reply : "I’m having trouble reaching the store assistant right now. " + result.error);
          }
        }
      }
    } catch (error: any) {
      say(error?.message || "I couldn't complete that request. No success has been assumed.");
    } finally {
      setBusy(false);
    }
  }, [draft, busy, role, messages, pendingExpense, pendingDebt, pendingSale, pendingStock, pendingWastage, pendingConsignment, pendingSignOut, pendingScaleSale, pendingMixedSale, pendingBasketSale, startListening]);

  sendRef.current = send;

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
              <button type="button" onClick={() => { voiceConversationRef.current = false; window.speechSynthesis?.cancel?.(); recognitionRef.current?.stop?.(); setOpen(false); }} aria-label="Close Speak On" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={19}/></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => <div key={i} className={m.role === "user" ? "ml-8" : "mr-5"}>
                <div className={m.role === "user" ? "rounded-2xl rounded-br-md bg-blue-600 text-white px-3.5 py-2.5 text-sm" : "rounded-2xl rounded-bl-md bg-slate-100 dark:bg-slate-800 text-[var(--text-primary)] px-3.5 py-2.5 text-sm leading-relaxed"}>{m.text}</div>
                {m.href && <button type="button" onClick={() => { setOpen(false); router.push(m.href!); }} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-violet-500/30 px-3 py-2 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10">{m.label}<ArrowRight size={14}/></button>}
              </div>)}
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={listening ? () => { voiceConversationRef.current = false; recognitionRef.current?.stop?.(); } : () => { voiceConversationRef.current = true; startListening(); }} className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-white ${listening ? "bg-rose-600" : "bg-violet-600"}`} aria-label={listening ? "Stop listening" : "Start voice input"}>{listening ? <MicOff size={18}/> : <Mic size={18}/>}</button>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder={listening ? "Listening… speak now" : "Speak or type your request"} className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-violet-500"/>
                <button type="button" onClick={send} disabled={!draft.trim() || busy} className="h-11 w-11 shrink-0 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-40 flex items-center justify-center" aria-label="Send request"><Send size={17}/></button>
              </div>
              <p className="text-[10px] text-slate-400 text-center">Speak On asks for confirmation before recording supported sales, stock additions, expenses, debt payments and weight/volume wastage. Staff cannot add stock. Other workflows open their existing forms.</p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
