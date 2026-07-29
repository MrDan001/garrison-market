"use client";
// components/CustomerFields.tsx
//
// The "Customer Name / Phone Number" pair used at checkout on every sale
// screen (list, scale, merged). As the staff member types, it looks up
// existing customers for the active store (searchCustomersAction) and
// offers them as suggestions; picking one fills both fields so the sale
// gets linked to that customer's profile instead of creating a new one.
// Typing a name/phone that doesn't match anyone is still totally fine —
// it behaves exactly like the old plain text inputs and the sale goes
// through as a fresh (or unlinked, if left blank) customer.

import { useEffect, useRef, useState } from "react";
import { User, Phone } from "lucide-react";
import { searchCustomersAction } from "@/lib/customer.actions";

type Suggestion = { id: number; name: string; phone: string };

interface CustomerFieldsProps {
  name: string;
  phone: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}

export default function CustomerFields({ name, phone, onNameChange, onPhoneChange }: CustomerFieldsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [openField, setOpenField] = useState<"name" | "phone" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = openField === "name" ? name : openField === "phone" ? phone : "";
    if (!openField || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const results = await searchCustomersAction(query);
      setSuggestions(results);
    }, 200);
    return () => clearTimeout(timeout);
  }, [name, phone, openField]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenField(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function pick(s: Suggestion) {
    onNameChange(s.name);
    onPhoneChange(s.phone);
    setOpenField(null);
    setSuggestions([]);
  }

  return (
    <div ref={containerRef} className="relative grid grid-cols-2 gap-3">
      <div className="relative">
        <input
          type="text"
          placeholder="Customer Name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={() => setOpenField("name")}
          autoComplete="off"
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
        />
        {openField === "name" && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <User size={13} className="text-slate-400 shrink-0" />
                <span className="font-medium text-[var(--text-primary)] truncate">{s.name}</span>
                <span className="text-slate-500 text-xs ml-auto shrink-0">{s.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <input
          type="tel"
          placeholder="Phone Number"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          onFocus={() => setOpenField("phone")}
          autoComplete="off"
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
        />
        {openField === "phone" && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Phone size={13} className="text-slate-400 shrink-0" />
                <span className="font-medium text-[var(--text-primary)] truncate">{s.phone}</span>
                <span className="text-slate-500 text-xs ml-auto shrink-0 truncate">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}