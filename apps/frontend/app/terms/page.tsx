// FILE: apps/frontend/app/terms/page.tsx (NEW FILE)

import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern use of Garrison Market.",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      lastUpdated="13 August 2026"
      intro="These Terms of Service ('Terms') govern access to and use of Garrison Market, an inventory and sales management application for shop and market owners, provided by MifiTech ('MifiTech', 'we', 'us', 'our') at gmstock.co (the 'Service'). By creating an account, starting a free trial, or otherwise using the Service, you agree to these Terms."
    >
      <LegalSection title="1. Who these Terms apply to">
        <p>
          Garrison Market has three kinds of accounts: <strong>Owner</strong> accounts, held by the business
          or individual that subscribes to the Service and is billed for it; <strong>Staff</strong> accounts,
          created by an Owner for their employees, with access limited to what that Owner grants; and{" "}
          <strong>Admin</strong> accounts, held by MifiTech personnel who operate the platform.
        </p>
        <p>
          If you hold a Staff account, these Terms apply to you as well, but the Owner who created your
          account is responsible for the subscription, for deciding what you can access, and for your
          conduct on the Service in relation to their business.
        </p>
        <p>
          You must be at least 18 years old, or the age of legal majority in your jurisdiction, to hold an
          Owner account. Garrison Market is a business tool and is not directed at children.
        </p>
      </LegalSection>

      <LegalSection title="2. The Service">
        <p>
          Garrison Market provides inventory tracking, staff accounts and permissions, point-of-sale and
          order recording, consignment sign-out and settlement, debtor and part-payment tracking, daily
          reporting, and related features, accessible as a web application and installable as a
          Progressive Web App. Available features depend on your subscription plan and the settings your
          Owner or MifiTech has enabled for your store.
        </p>
        <p>
          We may add, change, or remove features, and may modify or discontinue the Service in whole or in
          part, at any time. Where a change materially reduces functionality you're actively paying for, we'll
          make reasonable efforts to tell you in advance.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts and access">
        <p>
          You're responsible for keeping your login credentials confidential and for all activity that
          happens under your account. Tell us immediately at{" "}
          <a href="mailto:officialsafebase@gmail.com" className="underline underline-offset-2">
            officialsafebase@gmail.com
          </a>{" "}
          if you suspect unauthorized access.
        </p>
        <p>
          Owners are responsible for the Staff accounts they create: for providing staff with accurate
          login details, for suspending or deleting a Staff account when that person leaves, and for the
          accuracy of the sales, inventory, and consignment data staff enter under that account.
        </p>
        <p>
          Each store record and its data belongs to the Owner who created it. Staff access exists only at
          the Owner's discretion and can be revoked by the Owner at any time.
        </p>
      </LegalSection>

      <LegalSection title="4. Free trial, plans, and billing">
        <p>
          New Owner accounts get a 14-day free trial with full access to Pro-tier features. No card is
          charged to start a trial. At the end of the trial, continued use of paid features requires an
          active subscription.
        </p>
        <p>
          Paid plans (Basic, Pro, and negotiated Max plans) are billed in advance for a quarterly,
          biannual, or annual cycle you select at checkout, in Nigerian Naira, processed by Paystack. Plan
          limits (stores, staff seats, products, and feature access) are shown at checkout and in-app before
          you subscribe.
        </p>
        <p>
          Subscriptions renew automatically at the end of each billing cycle unless cancelled before the
          renewal date. You can cancel any time from your account settings or by writing to us; cancellation
          stops future renewals but doesn't itself refund the current cycle — see our{" "}
          <a href="/refund-policy" className="underline underline-offset-2">
            Refund Policy
          </a>{" "}
          for how refunds work.
        </p>
        <p>
          If a payment fails or a subscription lapses, we may restrict access to paid features until the
          account is brought current. We'll try to warn you before that happens where practical.
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use the Service for any unlawful purpose, or to store or process data you don't have the right to hold;</li>
          <li>Attempt to gain unauthorized access to another Owner's store, data, or account;</li>
          <li>Interfere with or disrupt the Service, attempt to bypass plan limits, or reverse-engineer the application beyond what applicable law expressly permits;</li>
          <li>Use the Service to send unsolicited communications, or misuse the admin broadcast, push notification, or messaging features for anything other than genuine business use;</li>
          <li>Resell or provide the Service to third parties as your own product without our written agreement.</li>
        </ul>
        <p>We may suspend or terminate accounts that violate this section.</p>
      </LegalSection>

      <LegalSection title="6. Your data and content">
        <p>
          You retain ownership of the inventory, sales, staff, customer, and other business data you enter
          into the Service ("Your Data"). You're responsible for its accuracy and for having the right to
          store it, including any staff or customer personal data — see our{" "}
          <a href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href="/dpa" className="underline underline-offset-2">
            Data Processing Agreement
          </a>{" "}
          for how we handle it on your behalf.
        </p>
        <p>
          You grant MifiTech a license to host, store, process, and display Your Data solely to provide and
          support the Service to you. We don't sell Your Data or use it to train models or products outside
          your account.
        </p>
      </LegalSection>

      <LegalSection title="7. Service availability">
        <p>
          We aim to keep the Service available and reliable but don't guarantee uninterrupted access.
          Scheduled maintenance, third-party outages (hosting, database, payment, or email providers), and
          factors outside our reasonable control can affect availability. We recommend keeping your own
          periodic exports of critical business records.
        </p>
      </LegalSection>

      <LegalSection title="8. Termination">
        <p>
          You may stop using the Service and delete your account at any time. We may suspend or terminate
          an account for breach of these Terms, non-payment, or suspected fraudulent or harmful activity,
          with notice where reasonably possible.
        </p>
        <p>
          On termination, your right to access the Service ends. We retain Your Data for a limited period
          as described in our Privacy Policy in case you wish to reactivate, after which it's deleted or
          anonymized, except where we must retain records for legal or accounting purposes.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimers and limitation of liability">
        <p>
          The Service is provided "as is." To the fullest extent permitted by Nigerian law, we disclaim
          implied warranties of merchantability, fitness for a particular purpose, and non-infringement, and
          we don't warrant that the Service will be error-free or uninterrupted.
        </p>
        <p>
          To the fullest extent permitted by law, MifiTech's total liability arising out of or relating to
          the Service is limited to the amount you paid us in the twelve months before the claim arose. We
          aren't liable for indirect, incidental, or consequential damages, including lost profits or lost
          data, except where such limitation isn't permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these Terms">
        <p>
          We may update these Terms from time to time. For material changes, we'll give reasonable notice —
          by email, in-app notification, or a notice on this page — before they take effect. Continued use
          of the Service after changes take effect means you accept the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law">
        <p>
          These Terms are governed by the laws of the Federal Republic of Nigeria. Any dispute arising out
          of or relating to these Terms or the Service is subject to the exclusive jurisdiction of the
          courts of Rivers State, Nigeria.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          MifiTech, No. 24 School Road, Igwuruta-Ali, Igwuruta, Port Harcourt, Rivers State, Nigeria.
          <br />
          Email:{" "}
          <a href="mailto:officialsafebase@gmail.com" className="underline underline-offset-2">
            officialsafebase@gmail.com
          </a>
          <br />
          WhatsApp:{" "}
          <a href="https://wa.me/2347034336627" className="underline underline-offset-2">
            +234 703 433 6627
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}