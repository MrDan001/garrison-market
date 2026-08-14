// FILE: apps/frontend/app/msa/page.tsx (NEW FILE)

import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Master Service Agreement",
  description: "The commercial agreement between MifiTech and Garrison Market subscribers.",
};

export default function MsaPage() {
  return (
    <LegalPageShell
      title="Master Service Agreement"
      lastUpdated="13 August 2026"
      intro="This Master Service Agreement ('MSA') is entered into between MifiTech ('MifiTech,' 'we') and the business or individual subscribing to Garrison Market ('Customer,' 'you'). It governs the commercial relationship alongside our Terms of Service, Privacy Policy, and Data Processing Agreement, which are incorporated into this MSA by reference. Where this MSA and the Terms of Service conflict on a commercial point (pricing, invoicing, or contract term), this MSA controls; on product use and conduct, the Terms of Service control."
    >
      <LegalSection title="1. Structure of the agreement">
        <p>This MSA is the umbrella commercial agreement. It works together with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            The{" "}
            <a href="/terms" className="underline underline-offset-2">
              Terms of Service
            </a>{" "}
            — acceptable use, account responsibilities, and product terms;
          </li>
          <li>
            The{" "}
            <a href="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </a>{" "}
            — how MifiTech handles Customer's own account data;
          </li>
          <li>
            The{" "}
            <a href="/dpa" className="underline underline-offset-2">
              Data Processing Agreement
            </a>{" "}
            — terms for staff/customer data Customer processes through the Service;
          </li>
          <li>
            The{" "}
            <a href="/refund-policy" className="underline underline-offset-2">
              Refund Policy
            </a>{" "}
            — refund eligibility and process.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Services provided">
        <p>
          MifiTech will provide Customer access to Garrison Market according to the plan (Basic, Pro, or a
          negotiated Max plan) Customer subscribes to, subject to the limits — number of stores, staff
          seats, and products — attached to that plan. Plan details and current limits are shown in-app and
          at checkout.
        </p>
      </LegalSection>

      <LegalSection title="3. Fees and payment terms">
        <p>
          Fees are as shown at checkout for the billing cycle selected (quarterly, biannual, or annual),
          payable in advance in Nigerian Naira via Paystack. Max plan pricing is individually negotiated
          between Customer and MifiTech and takes effect once confirmed in writing (including by email).
        </p>
        <p>
          Subscriptions renew automatically at the end of each cycle at the then-current rate for that
          plan, unless cancelled beforehand or a different rate has been agreed in writing. We'll give
          reasonable notice by email before any price change takes effect for an existing subscription.
        </p>
      </LegalSection>

      <LegalSection title="4. Term and termination">
        <p>
          This MSA takes effect when Customer creates an account and continues for as long as Customer
          maintains an active subscription or trial. Either party may terminate as described in the Terms
          of Service. Termination doesn't relieve Customer of payment obligations for fees already accrued.
        </p>
      </LegalSection>

      <LegalSection title="5. Confidentiality">
        <p>
          Each party will keep confidential any non-public business, technical, or financial information
          disclosed by the other in connection with this MSA, and use it only to perform under this
          agreement. This doesn't cover information that's independently developed, becomes public through
          no fault of the receiving party, or must be disclosed by law.
        </p>
      </LegalSection>

      <LegalSection title="6. Intellectual property">
        <p>
          MifiTech owns all rights in Garrison Market, including its software, design, and branding.
          Nothing in this MSA transfers that ownership to Customer. Customer retains ownership of its own
          business data, as described in the Terms of Service.
        </p>
      </LegalSection>

      <LegalSection title="7. Warranties">
        <p>
          Each party warrants it has the authority to enter this MSA. Beyond that, the Service is provided
          subject to the disclaimers and limitation of liability set out in the Terms of Service, which
          apply equally under this MSA.
        </p>
      </LegalSection>

      <LegalSection title="8. Indemnification">
        <p>
          Customer will indemnify MifiTech against third-party claims arising from Customer's misuse of the
          Service, violation of the Terms of Service, or Customer's lack of a lawful basis to process
          personal data it enters into the Service. MifiTech will indemnify Customer against third-party
          claims that the Service, as provided by MifiTech and used in accordance with these agreements,
          infringes a third party's intellectual property rights.
        </p>
      </LegalSection>

      <LegalSection title="9. Assignment">
        <p>
          Neither party may assign this MSA without the other's written consent, except that MifiTech may
          assign it in connection with a merger, acquisition, or sale of substantially all its assets,
          with notice to Customer.
        </p>
      </LegalSection>

      <LegalSection title="10. Governing law and disputes">
        <p>
          This MSA is governed by the laws of the Federal Republic of Nigeria, with disputes subject to the
          exclusive jurisdiction of the courts of Rivers State, Nigeria, consistent with the Terms of
          Service. Before either party files a claim, we'll each make a good-faith effort to resolve the
          dispute directly.
        </p>
      </LegalSection>

      <LegalSection title="11. Entire agreement">
        <p>
          This MSA, together with the documents it incorporates by reference, is the entire agreement
          between the parties on its subject matter and supersedes prior discussions on the same subject,
          except for a separately signed Max plan pricing agreement, which controls on pricing specifically.
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
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}