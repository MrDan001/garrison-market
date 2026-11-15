-- Business-local operating currency.
-- Existing businesses keep NGN; no historical amount is converted.
ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "businessCountry" TEXT NOT NULL DEFAULT 'NG',
  ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'NGN';
