export const BUSINESS_COUNTRIES = [
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "GH", name: "Ghana", currency: "GHS" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "UG", name: "Uganda", currency: "UGX" },
  { code: "TZ", name: "Tanzania", currency: "TZS" },
  { code: "RW", name: "Rwanda", currency: "RWF" },
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "MA", name: "Morocco", currency: "MAD" },
  { code: "ET", name: "Ethiopia", currency: "ETB" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "CH", name: "Switzerland", currency: "CHF" },
  { code: "SE", name: "Sweden", currency: "SEK" },
  { code: "NO", name: "Norway", currency: "NOK" },
  { code: "DK", name: "Denmark", currency: "DKK" },
  { code: "PL", name: "Poland", currency: "PLN" },
  { code: "CZ", name: "Czechia", currency: "CZK" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "NZ", name: "New Zealand", currency: "NZD" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "PK", name: "Pakistan", currency: "PKR" },
  { code: "BD", name: "Bangladesh", currency: "BDT" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "MY", name: "Malaysia", currency: "MYR" },
  { code: "PH", name: "Philippines", currency: "PHP" },
  { code: "ID", name: "Indonesia", currency: "IDR" },
  { code: "TH", name: "Thailand", currency: "THB" },
  { code: "VN", name: "Vietnam", currency: "VND" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "CN", name: "China", currency: "CNY" },
  { code: "HK", name: "Hong Kong", currency: "HKD" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "QA", name: "Qatar", currency: "QAR" },
  { code: "KW", name: "Kuwait", currency: "KWD" },
  { code: "TR", name: "Türkiye", currency: "TRY" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "MX", name: "Mexico", currency: "MXN" },
  { code: "AR", name: "Argentina", currency: "ARS" },
  { code: "CL", name: "Chile", currency: "CLP" },
  { code: "CO", name: "Colombia", currency: "COP" },
] as const;

export const BUSINESS_CURRENCIES = [
  "NGN", "GHS", "KES", "ZAR", "UGX", "TZS", "RWF", "EGP", "MAD", "ETB",
  "USD", "CAD", "GBP", "EUR", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK",
  "AUD", "NZD", "INR", "PKR", "BDT", "SGD", "MYR", "PHP", "IDR", "THB",
  "VND", "JPY", "CNY", "HKD", "AED", "SAR", "QAR", "KWD", "TRY", "BRL",
  "MXN", "ARS", "CLP", "COP",
] as const;

export type BusinessCurrency = (typeof BUSINESS_CURRENCIES)[number];

export function isSupportedCurrency(value: unknown): value is BusinessCurrency {
  return typeof value === "string" && BUSINESS_CURRENCIES.includes(value.toUpperCase() as BusinessCurrency);
}

export function formatBusinessCurrency(
  amount: number | string | { toString(): string } | null | undefined,
  currencyCode = "NGN",
  locale?: string
): string {
  const numericAmount = Number(amount ?? 0);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const safeCurrency = isSupportedCurrency(currencyCode) ? currencyCode : "NGN";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: safeCurrency,
      currencyDisplay: "symbol",
      maximumFractionDigits: ["JPY", "KRW", "CLP", "VND", "UGX", "RWF"].includes(safeCurrency) ? 0 : 2,
    }).format(safeAmount);
  } catch {
    return `${safeCurrency} ${safeAmount.toLocaleString()}`;
  }
}
