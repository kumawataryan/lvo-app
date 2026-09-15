"use client";

import type { ReactNode } from "react";

import { TemplateTopBar, useAppShell } from "@/components/craft-app";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-4 text-base leading-7 text-black/70">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  const { subscribed } = useAppShell();

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white text-black">
      <TemplateTopBar activeCategory="" onCategoryChange={() => undefined} subscribed={subscribed} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-5 pb-16 pt-2">
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-black/50">Effective date: September 15, 2026</p>

          <p className="mt-6 text-base leading-7 text-black/70">
            Lovely Vibes Only, operating the website lovely.diy (the "Service," "we," "us," or "our"), is owned and operated by Anchal Kharbanda, an individual proprietor based in Jaipur, Rajasthan, India. This Privacy Policy explains how we collect, use, disclose, retain, and protect personal information when you use the Service. It applies to everyone who uses lovely.diy, including information a parent or guardian provides about a child through a Kids Profile.
          </p>
          <p className="mt-3 text-base leading-7 text-black/70">
            This Policy is a notice describing our practices — using the Service does not, by itself, mean you have agreed to every processing activity described here. Where our processing of your information relies on your consent (for example, information you choose to provide about a Kids Profile, described in Section 4), we treat that consent as specific to that purpose and you may withdraw it at any time by contacting us. If you have any questions about this Policy, contact us at{" "}
            <a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a>.
          </p>

          <Section title="1. Information We Collect">
            <p><span className="font-medium text-black">a. Account information.</span> When you create an account, we collect your email address and password. Passwords are hashed by our authentication provider, Supabase, using its standard password-hashing methods before being stored; we do not have access to your plain-text password. If you choose to sign up or sign in with Google, we receive the account information Google makes available to us through that sign-in process, which may include your name, email address, and profile picture.</p>
            <p><span className="font-medium text-black">b. Parent profile information.</span> During onboarding, you may optionally enter a display name for yourself (up to 60 characters). This field is optional and can be skipped.</p>
            <p><span className="font-medium text-black">c. Kids Profiles.</span> You may create up to 5 child profiles on your account to organize templates for your children. For each Kids Profile, we store only: a first name you provide (up to 40 characters), a birth year (not a full date of birth), a gender (boy or girl), and a cartoon avatar you select from a fixed set of illustrated characters (for example, a fox, bear, bunny, lion, panda, or owl). We do not collect a child's last name, exact birthdate, photograph, school, address, or any other identifying detail. This information is entered solely by you, the adult account holder — children never interact with our sign-up flow, log in, or submit information directly. You can view, edit, or delete any Kids Profile at any time from your account. See Section 4 ("Children's Privacy") for more detail, including the representation you make to us when you create a Kids Profile.</p>
            <p><span className="font-medium text-black">d. Activity and content data.</span> We store the templates you or a Kids Profile "like" or save, the collections/folders you create (including collections automatically created for each Kids Profile), and records of which templates you have downloaded, tied to your subscription entitlement.</p>
            <p><span className="font-medium text-black">e. Payment information.</span> When you subscribe or make a purchase, payment is processed directly by our payment processors — Razorpay, PayPal, or Stripe. We never see, collect, or store your full card number, CVV, expiry date, or bank account details. We receive and store only: the plan and billing type you purchased, the amount and currency charged, the status of your subscription, renewal/cancellation dates, and the order, subscription, customer, and payment identifiers issued to us by the processor so we can verify and manage your entitlement.</p>
            <p><span className="font-medium text-black">f. Technical and log data.</span> Like most online services, our hosting and authentication infrastructure automatically records standard technical information such as your IP address, browser and device type, and access timestamps, for the purposes of operating, securing, and troubleshooting the Service.</p>
            <p><span className="font-medium text-black">g. Cookies and session data.</span> We use strictly necessary cookies set by our authentication provider, Supabase, solely to keep you signed in and maintain your session while you use the Service.</p>
          </Section>

          <Section title="2. Information We Do Not Collect">
            <p>As of the effective date of this Policy, we do not use Google Analytics, Meta/Facebook Pixel, or any similar third-party analytics or advertising-tracking tool in our own code, and we do not collect precise geolocation, biometric data, health information, government ID numbers, or photographs of you or your children. We do not knowingly collect any personal information directly from a child. Some pages embed third-party content, such as YouTube videos (see Section 12); that embedded content operates under the third party's own practices, independent of anything described in this section. If we add an analytics, advertising, or tracking tool in the future, we will update this Policy before doing so.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>To create and maintain your account and authenticate you when you sign in.</li>
              <li>To let you organize saved and printable templates for yourself and each of your children through Kids Profiles.</li>
              <li>To process payments, activate and manage your subscription, and grant or restrict access to templates accordingly.</li>
              <li>To send essential transactional emails, such as sign-up confirmation and password-reset emails, sent through Supabase's built-in email system.</li>
              <li>To respond to support requests you send to hi@lovely.diy.</li>
              <li>To maintain the security of the Service, prevent fraud and abuse, and enforce our Terms &amp; Conditions.</li>
              <li>To comply with applicable legal, tax, and accounting obligations.</li>
            </ul>
          </Section>

          <Section title="4. Children's Privacy">
            <p><span className="font-medium text-black">a. No direct use by children.</span> The Service is intended for adult account holders. Children do not create their own accounts, do not have login credentials, and cannot independently access or use the Service. We do not knowingly collect any personal information directly from a child.</p>
            <p><span className="font-medium text-black">b. Kids Profiles are entered by a parent or guardian.</span> A parent or lawful guardian may create up to 5 Kids Profiles on their account, containing only a first name, a birth year, a gender (boy or girl), and a chosen cartoon avatar, so they can organize templates by child. This information is voluntarily entered by the adult account holder — never by the child — and no other information about a child is collected.</p>
            <p><span className="font-medium text-black">c. Parental representation and authorization.</span> By creating a Kids Profile, you represent that you are the child's parent or lawful guardian, and you authorize us to process the limited information you provide about the child solely for the purpose of organizing templates and related account features for that child. You are responsible for ensuring you have the legal authority to provide this information about the child.</p>
            <p><span className="font-medium text-black">d. India — Digital Personal Data Protection Act, 2023.</span> Where the DPDP Act applies, we process a child's personal data only on the basis of the verifiable consent of the child's parent or lawful guardian, as represented under paragraph (c), and we do not carry out tracking, behavioural monitoring of children, or targeted advertising directed at children. India's DPDP Rules, notified in November 2025, establish specific mechanisms for verifiable parental consent that come into force on a phased timeline; as those requirements take effect, we will update our account-creation and Kids Profile flows, and this Policy, to implement them.</p>
            <p><span className="font-medium text-black">e. Other jurisdictions.</span> Where other children's privacy laws apply — for example, COPPA in the United States for children under 13, or GDPR/UK GDPR provisions on children's data — we apply the same principle: personal information about a child is provided only by, and processed only with the authorization of, the child's parent or guardian, and we do not knowingly collect information directly from a child.</p>
            <p><span className="font-medium text-black">f. If a child contacts us directly.</span> If we become aware that we have received information directly from a child without the involvement of a parent or guardian as described above, we will delete that information promptly. Contact{" "}<a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a> if you believe this has occurred.</p>
            <p><span className="font-medium text-black">g. Managing or deleting Kids Profile data.</span> You can review, edit, or remove any Kids Profile at any time from within the Service. Removing a Kids Profile deletes that child's name, birth year, gender, and avatar but preserves the associated saved-template collection so you don't lose saved crafts; you may also request that we permanently delete that collection by emailing{" "}<a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a>.</p>
          </Section>

          <Section title="5. Our Legal Basis for Processing Your Information">
            <p>Because we operate from India and serve users in different countries, the framework that applies to our processing of your information depends on where you are.</p>
            <p><span className="font-medium text-black">If you are in India (Digital Personal Data Protection Act, 2023):</span> we process your personal data on the basis of your consent — for example, when you create an account or a Kids Profile — and, where applicable, other legitimate uses recognized under the DPDP Act, such as processing necessary to respond to a request you have made or to comply with a legal obligation. Where our processing relies on your consent, you may withdraw it at any time by contacting{" "}<a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a>, without affecting processing already carried out.</p>
            <p><span className="font-medium text-black">If you are in the European Economic Area, United Kingdom, or a similar jurisdiction (GDPR/UK GDPR):</span> we rely on performance of a contract (to create your account, run your subscription, and deliver templates you've purchased), consent (for the information you choose to provide about a Kids Profile), legitimate interests (to secure the Service and prevent fraud or abuse), and legal obligation (to keep records required for tax and accounting purposes).</p>
          </Section>

          <Section title="6. How We Share Your Information">
            <p>We do not sell your personal information, and we do not share it with data brokers or advertisers. We share information only with the following categories of service providers, solely to operate the Service:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><span className="font-medium text-black">Supabase</span> — authentication, database, and file-storage infrastructure that underlies our account, Kids Profile, and template-storage systems.</li>
              <li><span className="font-medium text-black">Razorpay, PayPal, and Stripe</span> — payment processing for subscriptions and purchases.</li>
              <li><span className="font-medium text-black">Dropbox</span> — storage and delivery of certain template files.</li>
              <li><span className="font-medium text-black">Google</span> — if you choose to sign in with Google.</li>
            </ul>
            <p>Each of these providers processes information under its own privacy policy and only to the extent necessary to provide their service to us. We may also disclose information if required to do so by law, subpoena, or governmental request, or to protect the rights, property, or safety of lovely.diy, our users, or the public. If our business is ever sold, merged, or transferred, your information may be transferred as part of that transaction, subject to the commitments described in this Privacy Policy.</p>
          </Section>

          <Section title="7. International Data Transfers">
            <p>We and our service providers listed above operate infrastructure in multiple countries (including India, the United States, and the European Union). This means your information may be processed or stored in a country other than the one you live in. Wherever this occurs, we require our service providers to protect your information consistently with this Privacy Policy and applicable law.</p>
          </Section>

          <Section title="8. Data Retention">
            <p>Different categories of information are retained for different reasons and periods; cancelling a subscription, deleting your account, and inactivity are not the same thing:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><span className="font-medium text-black">Active accounts.</span> We retain your account information, Kids Profiles, collections, and purchase records for as long as your account remains active.</li>
              <li><span className="font-medium text-black">Subscription cancellation.</span> Cancelling a subscription does not delete your account. Your account, Kids Profiles, and collections remain intact; only your subscription entitlement changes, as described in our Terms &amp; Conditions.</li>
              <li><span className="font-medium text-black">Account deletion request.</span> If you ask us to delete your account (see Section 9), we begin deletion once we've verified your request and aim to complete it within 30 days, subject to the categories below.</li>
              <li><span className="font-medium text-black">Transaction and tax records.</span> Purchase and payment records we are legally required to retain for tax, accounting, or audit purposes are kept for the period required by applicable law, even after an account deletion request is completed.</li>
              <li><span className="font-medium text-black">Backups.</span> Information may persist in encrypted backups for a limited period after it is deleted from our live systems, until those backups are cycled out in the ordinary course.</li>
              <li><span className="font-medium text-black">Fraud and security records.</span> We may retain limited records for as long as reasonably necessary to investigate or prevent fraud, abuse, or security incidents.</li>
            </ul>
          </Section>

          <Section title="9. Account Deletion">
            <p>We do not yet offer an automated "delete my account" control on the website. To request deletion of your account, Kids Profiles, collections, and associated personal data, email{" "}<a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a> from your registered email address. We will verify your request and handle it as described in Section 8.</p>
            <p>If your account is deleted, you will lose access to your account, collections, Kids Profiles, and any subscription benefits tied to it. Deletion does not entitle you to a refund of amounts already paid, and does not affect records we are legally required to retain.</p>
          </Section>

          <Section title="10. Your Privacy Rights">
            <p>Depending on where you live, you may have the following rights over your personal information. To exercise any of them, email{" "}<a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a>; we will respond within any deadline required by applicable law, or, where no specific statutory deadline applies, we aim to respond within 30 days.</p>
            <p><span className="font-medium text-black">If you are in India (DPDP Act, 2023):</span> you have the right to access a summary of your personal data and the processing activities we carry out, to request correction, completion, updating, or erasure of your personal data, to withdraw consent where our processing is based on consent, to have your grievances addressed, and — in the event of your death or incapacity — to nominate another individual to exercise these rights on your behalf.</p>
            <p><span className="font-medium text-black">If you are in the European Economic Area or United Kingdom (GDPR/UK GDPR):</span> you have the right to access, correct, or erase your personal data; restrict or object to our processing of it; receive a copy of it in a portable format; withdraw consent at any time (without affecting processing carried out before withdrawal); and lodge a complaint with your local data protection authority. Statutory response deadlines under GDPR/UK GDPR apply to these requests where relevant.</p>
            <p><span className="font-medium text-black">If you are a California resident:</span> to the extent the CCPA/CPRA applies to our processing of your information, you may have the right to know what personal information we collect and how it is used, to request deletion or correction of it, and to non-discriminatory treatment for exercising these rights. We do not sell or share personal information for cross-context behavioral advertising, so there is no "opt-out of sale" to exercise.</p>
          </Section>

          <Section title="11. Data Security">
            <p>We rely on our infrastructure providers' security measures to protect your information, including encrypted connections (HTTPS) between your device and our servers, password hashing performed by Supabase, and time-limited signed URLs to control access to downloadable template files. No method of transmission or storage is completely secure, and we cannot guarantee absolute security, but we take reasonable, industry-standard steps to protect your information.</p>
          </Section>

          <Section title="12. Third-Party Links and Embedded Content">
            <p>Some pages, such as our craft-class tutorials, include embedded YouTube videos. Loading or interacting with an embedded video can cause your browser to connect directly to YouTube's and Google's own servers, which may set their own cookies or collect information about that interaction under Google's privacy policy — independent of this Policy and outside our control. If you would prefer not to interact with an embedded video, avoid playing it.</p>
          </Section>

          <Section title="13. Marketing Communications">
            <p>We do not currently send marketing newsletters or promotional emails. The only emails you will receive from us are transactional emails necessary to operate your account — such as sign-up confirmation and password-reset emails — sent automatically through our authentication provider, Supabase. If we introduce marketing communications in the future, we will update this Privacy Policy and provide you with a clear way to opt out.</p>
          </Section>

          <Section title="14. Changes to This Privacy Policy">
            <p>We may update this Privacy Policy from time to time to reflect changes in our practices or for legal reasons. We will post the updated policy on this page with a revised effective date, and where changes are material, we will make reasonable efforts to notify you, such as by email or a notice on the website.</p>
          </Section>

          <Section title="15. Contact Us">
            <p>If you have questions, concerns, or requests regarding this Privacy Policy or your personal information, contact:</p>
            <p>
              Anchal Kharbanda<br />
              Lovely Vibes Only (lovely.diy)<br />
              Jaipur, Rajasthan, India<br />
              Email: <a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a>
            </p>
          </Section>
        </div>
      </div>
    </section>
  );
}
