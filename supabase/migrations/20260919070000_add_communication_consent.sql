alter table "User"
  add column if not exists "notificationConsent" boolean not null default false,
  add column if not exists "notificationConsentAt" timestamp(3),
  add column if not exists "marketingConsent" boolean not null default false,
  add column if not exists "marketingConsentAt" timestamp(3),
  add column if not exists "marketingBrevoSyncedAt" timestamp(3);
