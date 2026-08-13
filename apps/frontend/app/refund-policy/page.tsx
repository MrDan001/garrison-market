// FILE: apps/frontend/app/refund-policy/page.tsx (NEW FILE)

import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "How refunds work for Garrison Market subscriptions.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPageShell
      title="Refund Policy"
      lastUpdated="13 August 2026"
      intro="This policy covers refunds for paid Garrison Market subscriptions, billed through Paystack in Nigerian Naira."
    >
      <LegalSection title="1. Free trial">
        <p>
          Every new Owner account gets a 14-day free trial with full Pro-tier access. No card is charged to
          start a trial, so there's nothing to refund during it — if Garrison Market isn't a fit, simply
          don't subscribe when the trial ends.
        </p>
      </LegalSection>

      <LegalSection title="2. Subscription billing cycles">
        <p>
          Paid plans are billed upfront for the cycle you choose at checkout — quarterly, biannual, or
          annual — via Paystack. There's no monthly plan, so a refund request is always relative to
          whichever of these cycles you paid for.
        </p>
      </LegalSection>

      <LegalSection title="3. When you're eligible for a refund">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Within 7 days of a first-time subscription payment:</strong> if you subscribe and decide
            within 7 days that Garrison Market isn't right for you, email us for a full refund of that
            payment, no questions asked.
          </li>
          <li>
            <strong>Duplicate or erroneous charges:</strong> if Paystack charged you twice for the same
            cycle, or charged the wrong plan/amount due to a fault on our end, we'll refund the difference
            in full.
          </li>
          <li>
            <strong>Extended service outage:</strong> if Garrison Market is unavailable for a continuous
            period of more than 48 hours due to a fault on our end during a billing cycle you've paid for,
            you can request a prorated credit or refund for the affected period.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Renewals and mid-cycle cancellation">
        <p>
          Subscriptions renew automatically at the end of each cycle. Cancelling stops future renewals but
          doesn't refund the cycle already in progress — you keep access through the end of the period
          you've paid for. If you cancel before a renewal date, no further charge is made.
        </p>
        <p>
          If you forget to cancel and are charged for a renewal you didn't intend, contact us within 7 days
          of that renewal charge and we'll refund it in full.
        </p>
      </LegalSection>

      <LegalSection title="5. What isn't covered">
        <p>
          Refunds generally aren't provided for: partial use of a billing cycle outside the windows above,
          dissatisfaction after more than 7 days of a first payment, or account suspension due to a breach
          of our{" "}
          <a href="/terms" className="underline underline-offset-2">
            Terms of Service
          </a>
          . We'll always look at the specific situation if you write in — this list isn't a reason to
          refuse a request that's genuinely reasonable.
        </p>
      </LegalSection>

      <LegalSection title="6. How to request a refund">
        <p>
          Email{" "}
          <a href="mailto:officialsafebase@gmail.com" className="underline underline-offset-2">
            officialsafebase@gmail.com
          </a>{" "}
          with your account email and the reason for the request. We aim to respond within 3 business days.
        </p>
      </LegalSection>

      <LegalSection title="7. How refunds are processed">
        <p>
          Approved refunds are issued back through Paystack to the original card or bank account used for
          payment — we can't send refunds to a different card, bank account, or by any other method.
          Paystack typically settles refunds within 5–10 business days, though your bank's own processing
          time can add to that.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}