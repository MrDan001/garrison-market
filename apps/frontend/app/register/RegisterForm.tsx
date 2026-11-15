// FILE: apps/frontend/app/register/RegisterForm.tsx
//
// The actual owner-registration form — moved out of page.tsx unchanged
// (Stage 2 of the 100-day waitlist gate) so page.tsx can be a Server
// Component that checks the registration gate BEFORE this client
// bundle ever ships to the browser. No logic in this file changed.

"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { compressImage } from "@/lib/image-compress";
import { Store, Phone, Upload, Camera, AlertCircle, Mail, Lock, Eye, EyeOff, Loader2, ChevronRight, ShoppingBag, Building2, Tag } from "lucide-react";
import { registerOwnerAction } from "@/lib/auth.actions";
import { BUSINESS_COUNTRIES, BUSINESS_CURRENCIES } from "@/lib/business-localization";

export default function RegisterForm() {
  const router = useRouter();

  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [businessCountry, setBusinessCountry] = useState("NG");
  const [currencyCode, setCurrencyCode] = useState("NGN");
  const [products, setProducts] = useState("");
  const [shopAddress, setShopAddress] = useState(""); 
  const [businessRegion, setBusinessRegion] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [referralCode, setReferralCode] = useState(""); // NEW: Added local state tracking for referral input
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // If the visitor arrived via an affiliate link (see
  // app/ref/[code]/route.ts), pre-fill and lock the Referral Code field
  // with their code so it's visibly confirmed — not editable, so it
  // can't be swapped out by mistake. Attribution itself doesn't depend
  // on this field either way: resolveAffiliateAttribution() in
  // affiliate.actions.ts reads the same cookie independently,
  // server-side, when the account is actually created.
  const [affiliateLocked, setAffiliateLocked] = useState(false);
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )gm_aff_ref=([^;]*)/);
    if (match) {
      const [code] = decodeURIComponent(match[1]).split(":");
      if (code) {
        setReferralCode(code);
        setAffiliateLocked(true);
      }
    }
  }, []);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const handleCountryChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const countryCode = e.target.value;
    setBusinessCountry(countryCode);
    const country = BUSINESS_COUNTRIES.find((entry) => entry.code === countryCode);
    if (country) setCurrencyCode(country.currency);
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG/JPEG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image is too large. Maximum size is 5MB.");
      return;
    }

    setErrorMessage("");
    setImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    if (!notificationConsent || !marketingConsent) {
      setErrorMessage("Please consent to both notifications and marketing emails to continue.");
      setIsSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();

      formData.append("email", email);
      formData.append("password", password);
      formData.append("fullName", ownerName);
      formData.append("storeName", storeName);
      formData.append("phoneNumber", phone.trim());
      formData.append("businessCountry", businessCountry);
      formData.append("currencyCode", currencyCode);
      formData.append("productsSold", products);
      formData.append("shopAddress", shopAddress); 
      formData.append("shopState", businessRegion);
      formData.append("shopCity", businessCity);
      formData.append("referralCode", referralCode); // NEW: Append tracking identifier to standard request matrix
      // The server action validates these fields from FormData. The checkbox
      // state above is already validated before submission, so send the
      // checked values explicitly instead of relying on the checkbox DOM.
      formData.append("notificationConsent", "on");
      formData.append("marketingConsent", "on");

      if (imageFile) {
        const compressed = await compressImage(imageFile, { maxDimension: 800, quality: 0.82 });
        const blob = await upload(compressed.name, compressed, {
          access: "public",
          handleUploadUrl: "/api/blob/register-upload",
        });
        formData.append("imageUrl", blob.url);
      }

      const result = await registerOwnerAction(formData);

      if (result?.redirectUrl) {
        router.push(result.redirectUrl);
      } else if (result?.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
      }
    } catch (err) {
      setErrorMessage("Registration sequence failed. Please verify connection credentials.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col justify-between" style={{ fontFamily: "var(--font-body)" }}>

      <header className="border-b border-[var(--border-subtle)]/10 bg-[var(--bg-app)]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-sm bg-[#F1EEE3] flex items-center justify-center">
              <span className="text-[#0D1527] font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>G</span>
            </div>
            <span className="font-bold tracking-tight text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>GARRISON MARKET</span>
          </Link>
          <span className="text-xs uppercase tracking-widest text-[var(--text-primary)]/40" style={{ fontFamily: "var(--font-mono)" }}>Node Setup</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full bg-[var(--bg-surface)] rounded-sm p-8 border border-[var(--border-subtle)]/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]">

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight uppercase text-[var(--text-primary)]" style={{ fontFamily: "var(--font-display)" }}>
                REGISTER YOUR BUSINESS
              </h1>
              <p className="text-xs text-[var(--text-primary)]/50 uppercase tracking-wider mt-1" style={{ fontFamily: "var(--font-mono)" }}>
                System Architecture Access Point
              </p>
            </div>

            {errorMessage && (
              <div className="bg-[#E55345]/10 border border-[#E55345]/20 text-[#E55345] rounded-sm p-3 flex items-center gap-2 text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>
                Store / Verification Image
              </label>
              <div className="flex items-center gap-4 p-4 bg-[var(--bg-app)] rounded-sm border border-[var(--border-subtle)]/10">
                <div className="relative h-16 w-16 bg-[var(--bg-surface)] border border-dashed border-[var(--border-subtle)]/20 rounded-sm flex items-center justify-center overflow-hidden shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <Camera size={20} className="text-[var(--text-primary)]/30" />
                  )}
                </div>
                <div className="space-y-1 flex-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)]/10 hover:border-[var(--border-subtle)]/30 cursor-pointer text-[var(--text-primary)] transition">
                    <Upload size={14} className="text-[#E55345]" />
                    <span>{imageFile ? "Change Image" : "Upload Photo"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                  <p className="text-[10px] text-[var(--text-primary)]/40 leading-normal">
                    JPEG or PNG format. Max file restriction: 5MB limit.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Store Name</label>
                <div className="relative">
                  <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30" />
                  <input required type="text" placeholder="e.g. Garrison Outlets" value={storeName} onChange={(e) => setStoreName(e.target.value)}
                         className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Owner Name</label>
                <input required type="text" placeholder="First & Last Name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                       className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] px-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30" />
                  <input required type="email" placeholder="owner@garrison.market" value={email} onChange={(e) => setEmail(e.target.value)}
                         className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-12 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/40 hover:text-[var(--text-primary)] transition focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>
                Products / Services Description
              </label>
              <div className="relative">
                <ShoppingBag size={16} className="absolute left-3 top-3.5 text-[var(--text-primary)]/30" />
                <textarea
                  required
                  rows={3}
                  placeholder="What are you selling? (e.g. Designer Shoes, Wholesale Electronics, Organic Skincare...)"
                  value={products}
                  onChange={(e) => setProducts(e.target.value)}
                  className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition resize-none leading-relaxed"
                />
              </div>
              <p className="text-[10px] text-[var(--text-primary)]/40">Briefly detail your core commodities or specializations so customers can query your node.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>
                Shop Address
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30" />
                <input
                  required
                  type="text"
                  placeholder="Street address of your shop"
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition"
                />
              </div>
            </div>

            {/* NEW: Referral Token Input Node Block */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>
                Referral Code <span className="text-[var(--text-primary)]/30 lowercase font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Tag size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${affiliateLocked ? "text-[#1F6D4C]" : "text-[var(--text-primary)]/30"}`} />
                <input
                  type="text"
                  placeholder="e.g. GARRISON_STORE_9901"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  readOnly={affiliateLocked}
                  className={`w-full text-sm pl-10 pr-4 py-3 rounded-sm border transition tracking-wide uppercase focus:outline-none ${
                    affiliateLocked
                      ? "bg-[#E7F1EB] text-[#1F6D4C] border-[#1F6D4C]/30 font-bold cursor-default"
                      : "bg-[var(--bg-app)] text-[var(--text-primary)] border-[var(--border-subtle)]/10 focus:border-[#E55345]"
                  }`}
                />
              </div>
              <p className={`text-[10px] ${affiliateLocked ? "text-[#1F6D4C]" : "text-[var(--text-primary)]/40"}`}>
                {affiliateLocked
                  ? "Picked up automatically from your referral link."
                  : "Enter a peer invite token to participate in affiliate program allocations."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Business phone number</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/30" />
                <input required type="tel" inputMode="tel" autoComplete="tel" placeholder="+234 803 123 4567"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] pl-10 pr-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345] transition" />
              </div>
              <p className="text-[10px] text-[var(--text-primary)]/40">Include your country calling code, for example +234, +1 or +44.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Business country</label>
                <select required value={businessCountry} onChange={handleCountryChange}
                  className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] px-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345]">
                  {BUSINESS_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code} className="bg-[var(--bg-surface)]">{country.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>Business currency</label>
                <select required value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}
                  className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] px-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345]">
                  {BUSINESS_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency} className="bg-[var(--bg-surface)]">{currency}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--text-primary)]/40">Choose the currency your business uses for its sales and expenses.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>State / Region <span className="normal-case font-normal">(optional)</span></label>
                <input type="text" placeholder="State, province or region" value={businessRegion}
                  onChange={(e) => setBusinessRegion(e.target.value)}
                  className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] px-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345]" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]/70" style={{ fontFamily: "var(--font-mono)" }}>City <span className="normal-case font-normal">(optional)</span></label>
                <input type="text" placeholder="City or town" value={businessCity}
                  onChange={(e) => setBusinessCity(e.target.value)}
                  className="w-full bg-[var(--bg-app)] text-sm text-[var(--text-primary)] px-4 py-3 rounded-sm border border-[var(--border-subtle)]/10 focus:outline-none focus:border-[#E55345]" />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-[var(--bg-app)]/60 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-primary)]/50" style={{ fontFamily: "var(--font-mono)" }}>
                Communication Consent
              </p>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="notificationConsent"
                  checked={notificationConsent}
                  onChange={(e) => setNotificationConsent(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                />
                <span className="text-xs text-[var(--text-primary)]/75 leading-relaxed">
                  I consent to receive Garrison Market app notifications, including order alerts, account updates, and important service notices.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="marketingConsent"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                />
                <span className="text-xs text-[var(--text-primary)]/75 leading-relaxed">
                  I consent to receive Garrison Market marketing emails, including product updates, tips, offers, and announcements. I can unsubscribe from marketing emails at any time.
                </span>
              </label>

              <p className="text-[10px] text-[var(--text-primary)]/40 leading-relaxed">
                Both consents are required before your account can be created.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !notificationConsent || !marketingConsent}
              className="group w-full mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 py-4 font-semibold text-slate-50 dark:text-slate-950 hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <>
                  Create Owner Account
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <p className="text-xs text-[var(--text-primary)]/50">
                Already matching directory keys?{" "}
                <Link href="/login" className="text-[var(--text-primary)] underline hover:text-[#E55345] transition">Sign in here</Link>
              </p>
            </div>
          </form>

        </div>
      </main>

      <footer className="py-6 text-center text-[var(--text-primary)]/20 text-xs border-t border-[var(--border-subtle)]/5">
        &copy; {new Date().getFullYear()} Garrison Market Core // Identity Deployment Matrix
      </footer>
    </div>
  );
}