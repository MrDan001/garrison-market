// FILE: apps/frontend/app/dpa/page.tsx (NEW FILE)

import type { Metadata } from "next";
import LegalPageShell, { LegalSection } from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Data Processing Agreement",
  description: "Terms governing MifiTech's processing of personal data on behalf of Garrison Market Owners.",
};

export default function DpaPage() {
  return (
    <LegalPageShell
      title="Data Processing Agreement"
      lastUpdated="13 August 2026"
      intro="This Data Processing Agreement ('DPA') forms part of the Terms of Service between MifiTech ('Processor') and each Owner ('Controller') who uses Garrison Market to process personal data belonging to their staff and customers. It applies automatically to every Owner account — no separate signature is required to take effect, though a countersigned copy is available on request for your own compliance records."
    >
      <LegalSection title="1. Definitions">
        <p>
          "Personal Data," "Processing," "Controller," "Processor," and "Data Subject" have the meanings
          given in the Nigeria Data Protection Act 2023 (NDPA). "Personal Data" in this DPA means the staff
          and customer data an Owner enters into Garrison Market — including staff names, contact details,
          and login credentials, and customer names, phone numbers, and debtor/consignment records.
        </p>
      </LegalSection>

      <LegalSection title="2. Roles">
        <p>
          The Owner is the Controller of the Personal Data it enters into the Service and determines the
          purposes and means of its processing. MifiTech is the Processor, processing Personal Data solely
          to provide and support the Service, on the Owner's documented instructions as given through use
          of the Service's features.
        </p>
      </LegalSection>

      <LegalSection title="3. Scope and nature of processing">
        <p><strong>Subject matter:</strong> hosting and processing of Personal Data entered into Garrison Market to provide inventory, sales, staff, and consignment/debtor management functionality.</p>
        <p><strong>Duration:</strong> for as long as the Owner's account is active, plus the retention period described in our Privacy Policy.</p>
        <p><strong>Nature and purpose:</strong> storage, retrieval, display, and transmission (e.g. email notifications, push notifications) of Personal Data as directed by the Owner's use of the Service.</p>
        <p><strong>Categories of Data Subjects:</strong> the Owner's staff, and the Owner's customers/debtors where the Owner records their details.</p>
        <p><strong>Categories of Personal Data:</strong> names, phone numbers, email addresses (staff only), login credentials (staff only), and transaction/debtor records.</p>
      </LegalSection>

      <LegalSection title="4. Processor obligations">
        <p>MifiTech will:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Process Personal Data only on the Owner's documented instructions, including those given through configuring and using the Service's features;</li>
          <li>Ensure personnel authorized to process Personal Data are subject to confidentiality obligations;</li>
          <li>Implement appropriate technical and organizational measures to protect Personal Data, including encrypted connections, hashed credentials, and role-based access controls;</li>
          <li>Not engage a new sub-processor without giving the Owner reasonable notice, per Section 5;</li>
          <li>Assist the Owner, to a reasonable extent, in responding to Data Subject rights requests and in meeting the Owner's own obligations around data protection impact assessments and breach notification, where those relate to Garrison Market;</li>
          <li>Notify the Owner without undue delay after becoming aware of a Personal Data breach affecting the Owner's data;</li>
          <li>At the Owner's choice, delete or return all Personal Data at the end of the relationship, except where MifiTech is required by law to retain it;</li>
          <li>Make available the information reasonably necessary to demonstrate compliance with this DPA.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Sub-processors">
        <p>The Owner authorizes MifiTech to engage the following sub-processors, each bound by contractual obligations no less protective than this DPA:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Supabase</strong> — database hosting;</li>
          <li><strong>Vercel</strong> — application hosting and file storage;</li>
          <li><strong>Resend</strong> — transactional email delivery;</li>
          <li><strong>Paystack</strong> — payment processing (for the Owner's own subscription billing, not customer payment card data, which Garrison Market doesn't collect).</li>
        </ul>
        <p>
          We'll notify Owners by email or in-app notice of any new sub-processor before it begins
          processing Personal Data, giving a reasonable opportunity to object on data protection grounds.
        </p>
      </LegalSection>

      <LegalSection title="6. International transfers">
        <p>
          Our sub-processors may store or process data outside Nigeria. Where this happens, we require our
          sub-processors to maintain security and contractual safeguards appropriate to the sensitivity of
          the data, consistent with NDPA requirements for cross-border transfer.
        </p>
      </LegalSection>

      <LegalSection title="7. Owner obligations">
        <p>
          The Owner warrants that it has a lawful basis under applicable data protection law to collect and
          instruct MifiTech to process the Personal Data it enters into the Service, including any staff or
          customer consent or notice required under Nigerian law. The Owner is responsible for the accuracy
          of the Personal Data it enters and for responding substantively to Data Subject requests, with
          MifiTech providing technical assistance as described in Section 4.
        </p>
      </LegalSection>

      <LegalSection title="8. Audits">
        <p>
          On reasonable written request, no more than once per year absent a specific incident, MifiTech
          will provide relevant compliance documentation or, where documentation isn't sufficient, allow a
          reasonable audit of the processing described in this DPA, conducted with reasonable notice and
          without unreasonably disrupting the Service for other Owners.
        </p>
      </LegalSection>

      <LegalSection title="9. Liability and term">
        <p>
          This DPA remains in effect for as long as MifiTech processes Personal Data on the Owner's behalf
          under the Terms of Service, and liability under it is governed by the limitation of liability
          provisions in our{" "}
          <a href="/terms" className="underline underline-offset-2">
            Terms of Service
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          Data protection queries relating to this DPA: MifiTech, No. 24 School Road, Igwuruta-Ali,
          Igwuruta, Port Harcourt, Rivers State, Nigeria.
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