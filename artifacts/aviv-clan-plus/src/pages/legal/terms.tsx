import { LegalPageLayout } from '@/components/legal-page-layout';
import { SUPPORT_EMAIL } from '@/components/site-footer';

export default function Terms() {
  return (
    <LegalPageLayout title="Terms of Service" effectiveDate="July 15, 2026">
      <p>
        These Terms of Service ("Terms") govern your access to and use of AVIV Clan+
        (the "Service"), operated as an independent, community-built tool for Rust
        clans. By creating an account, signing in with Discord, or otherwise using
        the Service, you agree to these Terms. If you do not agree, do not use the
        Service.
      </p>

      <h2>1. Who can use the Service</h2>
      <p>
        You must be at least 13 years old (or the minimum age of digital consent in
        your country, e.g. 16 in some EU member states, unless your parent or
        guardian consents) to use the Service. You must also comply with Discord's
        own Terms of Service and minimum age requirements, since sign-in is provided
        through Discord OAuth.
      </p>

      <h2>2. What the Service does</h2>
      <p>
        AVIV Clan+ lets clan leaders and members connect KAOS+ raid-alert sensors to
        Discord and to a companion web/PWA app, so that raid notifications can be
        relayed to a Discord channel and to subscribed members' devices. The Service
        is provided independently and is not affiliated with, endorsed by, or
        sponsored by Facepunch Studios, Rust, KAOS+, or Discord Inc.
      </p>

      <h2>3. Your account and content</h2>
      <p>
        You are responsible for the accuracy of the information you provide (such as
        your clan name and raid key) and for maintaining the security of any device
        used to access the Service. You are responsible for how you use raid keys
        and API keys belonging to you or your clan, and you confirm you have the
        right to use any key you configure.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service to harass, spam, or send unwanted notifications to others;</li>
        <li>Attempt to access another clan's data, raid keys, or subscriber list without authorization;</li>
        <li>Interfere with or disrupt the Service, its infrastructure, or other users' access to it;</li>
        <li>Use the Service for any unlawful purpose or in violation of Discord's or Rust's terms of service.</li>
      </ul>

      <h2>5. Service availability</h2>
      <p>
        The Service is provided on an "as is" and "as available" basis. Raid alerts
        depend on third-party infrastructure (KAOS+, Discord, push notification
        providers) that we do not control, and delivery is not guaranteed. Do not
        rely on the Service as your sole means of raid defense.
      </p>

      <h2>6. Termination</h2>
      <p>
        You may stop using the Service and revoke access at any time by disconnecting
        your Discord account, unsubscribing from push notifications, or contacting us.
        We may suspend or terminate access to the Service for violations of these
        Terms or to protect the security or integrity of the Service.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable law, the Service is provided
        without warranties of any kind, and we are not liable for any indirect,
        incidental, or consequential damages — including losses resulting from a
        missed or delayed raid alert — arising from your use of the Service. Nothing
        in these Terms limits liability that cannot be limited under applicable law
        (including consumer protection laws in the EU/EEA, UK, and US).
      </p>

      <h2>8. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        reflected by updating the "Effective date" above. Continued use of the
        Service after changes take effect constitutes acceptance of the updated
        Terms.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These Terms do not limit any statutory consumer rights you have under the
        mandatory laws of your country of residence, including EU/EEA consumer
        protection law where applicable.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms can be sent to{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPageLayout>
  );
}
