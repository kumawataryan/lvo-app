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

export default function TermsAndConditionsPage() {
  const { subscribed } = useAppShell();

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white text-black">
      <TemplateTopBar activeCategory="" onCategoryChange={() => undefined} subscribed={subscribed} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-5 pb-16 pt-2">
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Terms &amp; Conditions</h1>
          <p className="mt-2 text-sm text-black/50">Effective date: September 15, 2026</p>

          <p className="mt-6 text-base leading-7 text-black/70">
            These Terms &amp; Conditions ("Terms") govern your access to and use of lovely.diy, including its website (the "Service"), operated by Anchal Kharbanda, an individual proprietor doing business as "Lovely Vibes Only," based in Jaipur, Rajasthan, India ("we," "us," or "our"). By creating an account, browsing templates, or purchasing a subscription, you agree to these Terms. If you do not agree, please do not use the Service.
          </p>

          <Section title="1. Eligibility and Accounts">
            <p>You must be at least 18 years old, or the age of majority in your jurisdiction, to create an account and purchase a subscription. The Service is intended to be used by adults on behalf of themselves and their children — children do not create their own accounts, do not sign in, and do not directly access the Service.</p>
            <p>You must provide accurate information when creating your account and keep your login credentials confidential. You are responsible for all activity that occurs under your account, whether through email/password sign-in or Google sign-in. Notify us immediately at{" "}<a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a> if you suspect unauthorized access to your account.</p>
          </Section>

          <Section title="2. Kids Profiles">
            <p>Your account may include up to 5 "Kids Profiles," which you create to organize templates for your children. Each Kids Profile consists only of a first name, birth year, gender (boy or girl), and a chosen cartoon avatar that you enter yourself; Kids Profiles are not separate accounts and do not allow your child to sign in or access the Service independently.</p>
            <p>By creating a Kids Profile, you represent and warrant that you are the child's parent or lawful guardian, and you authorize us to process the limited information you provide about the child solely for the purpose of organizing templates and related account features for that child. You are solely responsible for the accuracy of the information you enter, for having the legal authority to provide it, and for managing (adding, editing, or removing) Kids Profiles on your account. See our Privacy Policy, Section 4, for how this information is handled, including provisions specific to India's Digital Personal Data Protection Act, 2023.</p>
          </Section>

          <Section title="3. Subscription Plans and Billing">
            <p>We offer Monthly and Yearly subscription plans that renew automatically, and a one-time Lifetime plan that does not renew. Prices are shown in the currency applicable to your chosen payment method (for example, INR through Razorpay, or USD through PayPal or Stripe) and may vary based on your location and the payment method available to you.</p>
            <p>By subscribing to a Monthly or Yearly plan, you authorize us and our payment processor to automatically charge your chosen payment method at the then-current price at the start of each renewal period, until you cancel. Recurring payments may be subject to additional authorization, authentication, notification, mandate, or other requirements imposed by your payment provider, payment network, issuing bank, or applicable law (including, for payments processed in India, the Reserve Bank of India's framework governing recurring transactions) — you may need to complete such steps to keep your subscription active.</p>
            <p>If the price of your subscription plan increases, we will provide notice of the new price before the renewal at which it takes effect, where required by applicable law or the rules of the applicable payment provider.</p>
            <p>Some templates are marked as free and can be downloaded without an active subscription.</p>
          </Section>

          <Section title="4. Cancellation">
            <p>You may cancel your subscription at any time from the "Manage Subscription" screen in your account. Cancelling:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>prevents future renewal charges;</li>
              <li>does not automatically refund any subscription fees you have already paid, which remain governed by Section 5 (No Refunds); and</li>
              <li>affects your access to subscriber-only templates differently depending on your payment method — access either continues until the end of your current paid period or ends immediately, as shown to you at the time you cancel.</li>
            </ul>
            <p>Cancelling your subscription does not delete your account. See Section 16 (Account Deletion) if you want your account and associated data removed entirely.</p>
          </Section>

          <Section title="5. No Refunds">
            <p>All purchases made through the Service — including Monthly and Yearly subscription charges and the one-time Lifetime plan — are final and non-refundable, except where a refund is required by a mandatory law that cannot be waived by agreement, including applicable Indian consumer-protection law. Please review the plan details carefully before purchasing. If you have a complaint about a charge, contact{" "}<a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a> and we will review it.</p>
          </Section>

          <Section title="6. Digital Content Access and Delivery">
            <p>Templates are digital content. Your access to a given template depends on having an active subscription or a valid purchase covering it (or the template being marked free), and templates are delivered through temporary or signed download links that expire after a short period for security reasons. If a link expires before you finish downloading, request it again from the Service.</p>
            <p>Files you have already downloaded may remain on your device after your subscription ends or your account is cancelled or deleted, but your license to use them continues to be governed by Section 7 (License to Use Templates) and does not expand or survive independently of these Terms.</p>
          </Section>

          <Section title="7. License to Use Templates">
            <p>Subject to your compliance with these Terms and, where applicable, an active subscription or valid purchase, we grant you a limited, non-exclusive, non-transferable, revocable license to download and print craft templates solely for your own personal, non-commercial use within your Household. "Household" means the people who ordinarily reside with you at your primary residence, including your own children (whether or not they have a Kids Profile).</p>
            <p>You may not, and may not permit anyone else to: resell, redistribute, sublicense, or share downloaded template files (digitally or physically) with anyone outside your Household; upload templates to other websites, marketplaces, or file-sharing services; use templates in any commercial product, service, or offering; claim authorship of a template; or remove or alter any branding, watermark, or attribution included with a template.</p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>All templates, designs, text, graphics, software, and the "Lovely Vibes Only" name and logo are owned by us or our contributors and licensors, and are protected by copyright, trademark, and other intellectual property laws. Except for the limited license granted in Section 7, nothing in these Terms transfers any ownership or intellectual property rights to you.</p>
          </Section>

          <Section title="9. Contributor Content">
            <p>Some templates are created and uploaded by authorized contributors under a separate arrangement with us (a "Contributor Agreement") that governs matters such as ownership, the license granted to us, originality, the use of third-party or AI-generated assets, indemnification, and any payment or royalty terms. These Terms do not themselves grant contributor rights or set contributor compensation.</p>
            <p>By submitting a template as a contributor, you represent and warrant that you own or have the necessary rights to the content you submit and that it does not infringe any third party's rights. We reserve the right to remove, edit, or decline to publish any content that we determine, in our discretion, infringes a third party's rights or violates these Terms or a Contributor Agreement.</p>
          </Section>

          <Section title="10. Copyright Infringement and Takedown Notices">
            <p>If you believe content available through the Service infringes your copyright or other intellectual property rights, contact us at{" "}<a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a> with enough information for us to identify the content and investigate, including a description of the work you believe is infringed, the location of the allegedly infringing content within the Service, and your contact information. We will investigate and, where appropriate, remove or disable access to the content.</p>
          </Section>

          <Section title="11. Acceptable Use">
            <p>When using the Service, you agree not to: scrape, bulk-download, or use automated tools to access templates or data; share your account credentials with anyone outside your Household; attempt to circumvent subscription checks, download limits, or the time-limited links used to deliver template files; reverse-engineer or interfere with the Service's security or infrastructure; upload or transmit malicious code; abuse the search, likes, or collections features; or impersonate any person or entity.</p>
          </Section>

          <Section title="12. Craft Activity and Safety">
            <p>Templates available through the Service are intended to be printed and used for craft activities such as cutting, folding, gluing, and coloring. These activities may involve scissors, small parts, or other materials that can pose a choking or injury hazard, particularly to young children. Craft activities involving printed templates should be carried out by, or under the direct supervision of, a responsible adult, and are not suitable for children under 3 years old unless a template specifically indicates otherwise.</p>
            <p>To the maximum extent permitted by applicable law, we are not responsible for injury, loss, or damage arising from your use of templates or materials obtained through the Service, except to the extent caused by our negligence, willful misconduct, or other liability that cannot legally be excluded or limited. Use age-appropriate judgment and supervision at all times.</p>
          </Section>

          <Section title="13. Service Availability and Modifications">
            <p>We may modify, suspend, or discontinue any part of the Service — including individual templates, features, categories, or payment methods — at any time, subject to applicable law, and we may impose reasonable limits on downloads or usage to protect the Service from abuse. We will make reasonable efforts to avoid disrupting active subscriptions when we do this, but we do not guarantee that any specific template or feature will remain available indefinitely.</p>
          </Section>

          <Section title="14. Third-Party Services">
            <p>The Service relies on third-party providers, including Supabase (authentication, database, and storage), Razorpay, PayPal, and Stripe (payment processing), Dropbox (file storage and delivery), Google (optional sign-in), and YouTube (embedded craft-class videos). Your use of features involving these providers is also subject to their own terms and policies. We are not responsible for the acts, omissions, availability, or performance of these third-party providers.</p>
          </Section>

          <Section title="15. Termination">
            <p>We may suspend or terminate your account, without refund of any amount already paid, if we determine that you have violated these Terms, engaged in fraud or chargeback abuse, or misused the Service. You may stop using the Service and cancel your subscription at any time as described in Section 4.</p>
          </Section>

          <Section title="16. Account Deletion">
            <p>You may request deletion of your account at any time by emailing{" "}<a href="mailto:hi@lovely.diy" className="underline">hi@lovely.diy</a>, as described in our Privacy Policy. If your account is deleted — whether at your request or because we terminate it under Section 15 — you will lose access to your account, collections, Kids Profiles, and any subscription benefits tied to that account. Deletion does not entitle you to a refund of amounts already paid, and we may retain certain records after deletion where required by law or as described in our Privacy Policy.</p>
          </Section>

          <Section title="17. Disclaimer of Warranties">
            <p>The Service and all templates are provided "as is" and "as available," without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or available at all times.</p>
          </Section>

          <Section title="18. Limitation of Liability">
            <p>To the maximum extent permitted by applicable law, we will not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service. Our total aggregate liability for any claim arising out of or relating to these Terms or the Service will not exceed the total amount you paid us in the 12 months preceding the event giving rise to the claim.</p>
            <p>Nothing in these Terms limits or excludes liability to the extent such limitation or exclusion is prohibited by applicable law, including liability for fraud, willful misconduct, death or personal injury caused by our negligence where that liability cannot legally be excluded, or other statutory rights that cannot be waived.</p>
          </Section>

          <Section title="19. Indemnification">
            <p>You agree to indemnify and hold us harmless from any claims, damages, losses, and expenses (including reasonable legal fees) arising from your violation of these Terms, your misuse of the Service, or your violation of any rights of a third party.</p>
          </Section>

          <Section title="20. Electronic Communications">
            <p>You consent to receive electronic communications from us relating to your account, purchases, subscriptions, security, and the Service. These communications may be sent by email or displayed within the Service, and satisfy any legal requirement that such communications be in writing, to the extent permitted by applicable law.</p>
          </Section>

          <Section title="21. Force Majeure">
            <p>We will not be responsible for delays or failures in performance caused by circumstances beyond our reasonable control, including internet or telecommunications failures, infrastructure or hosting outages, payment-provider failures, natural disasters, or government actions.</p>
          </Section>

          <Section title="22. Assignment">
            <p>You may not assign or transfer your rights or obligations under these Terms without our prior written consent. We may assign or transfer these Terms, in whole or in part, in connection with a sale, merger, restructuring, or transfer of the Service or substantially all of its assets, consistent with the business-transfer provision of our Privacy Policy.</p>
          </Section>

          <Section title="23. Governing Law and Disputes">
            <p>These Terms are governed by the laws of India, without regard to conflict-of-law principles. Subject to any mandatory consumer-protection rights available to you under the law of your place of residence, you agree that the courts located in Jaipur, Rajasthan, India will have exclusive jurisdiction over any dispute arising out of or relating to these Terms or the Service.</p>
          </Section>

          <Section title="24. Changes to These Terms">
            <p>We may update these Terms from time to time. We will post the revised Terms on this page with an updated effective date. Your continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.</p>
          </Section>

          <Section title="25. General">
            <p>If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect. These Terms, together with our Privacy Policy, constitute the entire agreement between you and us regarding the Service.</p>
          </Section>

          <Section title="26. Contact Us">
            <p>Questions about these Terms can be sent to:</p>
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
