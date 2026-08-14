// FILE: apps/frontend/app/privacy/page.tsx (NEW FILE)

import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How MifiTech collects, uses, and protects personal data on Garrison Market.",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      lastUpdated="13 August 2026"
      intro="This Privacy Policy explains what personal data MifiTech collects through Garrison Market, why, and the rights you have over it. It applies to Owners, Staff, and the customers/debtors an Owner may record in the app."
    >
      <LegalSection title="1. Who this applies to and our role">
        <p>
          When you use Garrison Market as an Owner, MifiTech acts as a <strong>data processor</strong> for
          the personal data of your staff and customers that you enter into the app — you're the{" "}
          <strong>data controller</strong> for that data, and you're responsible for having a lawful basis
          to collect it. Our{" "}
          <a href="/dpa" className="underline underline-offset-2">
            Data Processing Agreement
          </a>{" "}
          sets out the terms of that processing in detail.
        </p>
        <p>
          For your own account data — your name, email, phone number, business details, and how you use
          the Service — MifiTech is the <strong>data controller</strong>, and the rest of this policy
          describes that relationship.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <p>
          <strong>Account and business data:</strong> full name, email, phone number, password (stored
          hashed, never in plain text), business/store name and address, and subscription and billing
          status.
        </p>
        <p>
          <strong>Data you enter to run your store:</strong> inventory records, sales and order records,
          staff names and login credentials, consignment and debtor records, customer names and phone
          numbers if you use the customer profile feature, and daily reports you submit.
        </p>
        <p>
          <strong>Payment data:</strong> we don't store your card details. Subscription payments are
          processed by Paystack, who collect and store payment card information under their own security
          standards and privacy policy.
        </p>
        <p>
          <strong>Device and usage data:</strong> IP address, browser/device type, and basic usage logs, for
          security and to keep the Service working. If you enable notifications, we store a push
          subscription token tied to your browser/device so we can deliver alerts — no location or contact
          list access is requested.
        </p>
      </LegalSection>

      <LegalSection title="3. Why we process it">
        <ul className="list-disc pl-5 space-y-1">
          <li>To provide the Service — accounts, inventory tracking, sales recording, reporting, staff management;</li>
          <li>To process subscription payments and manage billing;</li>
          <li>To send transactional communications: welcome emails, status changes, staff invites, settlement notices, and — if enabled — push notifications;</li>
          <li>To maintain security, prevent fraud, and enforce our Terms of Service;</li>
          <li>To respond to support requests and, where you've contacted us, to communicate with you.</li>
        </ul>
        <p>We don't sell personal data, and we don't use your business data to train external AI models.</p>
      </LegalSection>

      <LegalSection title="4. Who we share it with">
        <p>We share personal data only with the service providers that help us run Garrison Market, under agreements that limit their use of it to providing their service to us:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Supabase</strong> — hosts our production database;</li>
          <li><strong>Vercel</strong> — hosts the application and file storage for uploaded images;</li>
          <li><strong>Resend</strong> — delivers transactional emails;</li>
          <li><strong>Paystack</strong> — processes subscription payments;</li>
          <li>Browser push infrastructure (e.g. Google, Mozilla, Apple) — delivers push notifications you've opted into, standard to how web push works on any site.</li>
        </ul>
        <p>
          We don't share personal data with advertisers. We may disclose data if required by law, court
          order, or to protect the rights, safety, or property of MifiTech, our users, or the public.
        </p>
      </LegalSection>

      <LegalSection title="5. Where data is stored">
        <p>
          Your data is hosted with infrastructure providers that may process and store data outside
          Nigeria. Where personal data is transferred outside Nigeria, we rely on our providers' standard
          contractual and security safeguards to protect it in transit and at rest.
        </p>
      </LegalSection>

      <LegalSection title="6. How long we keep it">
        <p>
          We keep account and business data for as long as your account is active, plus a limited period
          after closure in case you reactivate or for legal/accounting record-keeping. Deleted records
          (e.g. a removed staff account or a deleted product) are removed from active use immediately and
          purged from backups on our normal backup rotation cycle.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>
          Under the Nigeria Data Protection Act 2023 (NDPA) and, where applicable, other data protection
          law, you have the right to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the personal data we hold about you;</li>
          <li>Correct inaccurate or incomplete data;</li>
          <li>Request deletion of your personal data, subject to legal retention requirements;</li>
          <li>Object to or restrict certain processing;</li>
          <li>Request a portable copy of your data in a common format;</li>
          <li>Withdraw consent, where processing is based on consent (e.g. push notifications), at any time.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. How to request deletion or exercise your rights">
        <p>
          Email{" "}
          <a href="mailto:support.gmstock@gmail.com" className="underline underline-offset-2">
            support.gmstock@gmail.com
          </a>{" "}
          with the subject line "Data request," tell us which right you're exercising, and confirm the
          email/account the request relates to. We may ask for identity verification before acting on the
          request, to make sure we're not deleting or handing over someone else's data.
        </p>
        <p>
          We'll respond within 30 days. Deleting an Owner account deletes that store's business data,
          including staff and customer records tied to it, subject to what we must legally retain (e.g.
          financial records for tax purposes). A Staff member who wants their personal data removed should
          contact their Owner directly, or write to us and we'll coordinate with the Owner where the data
          is part of their business records.
        </p>
        <p>
          You also have the right to lodge a complaint with the Nigeria Data Protection Commission (NDPC)
          if you believe your data has been mishandled.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We use industry-standard measures to protect your data, including encrypted connections,
          hashed passwords, and role-based access controls so staff only see what their Owner grants. No
          system is perfectly secure; if we become aware of a breach affecting your personal data, we'll
          notify affected users and the NDPC as required by law.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          Garrison Market is a business tool not directed at children, and we don't knowingly collect
          personal data from anyone under 18 as an account holder.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be announced by email or
          in-app notification before they take effect.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          MifiTech, No. 24 School Road, Igwuruta-Ali, Igwuruta, Port Harcourt, Rivers State, Nigeria.
          <br />
          Email:{" "}
          <a href="mailto:support.gmstock@gmail.com" className="underline underline-offset-2">
            support.gmstock@gmail.com
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