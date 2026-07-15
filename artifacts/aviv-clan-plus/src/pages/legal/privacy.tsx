import { LegalPageLayout } from '@/components/legal-page-layout';
import { SUPPORT_EMAIL } from '@/components/site-footer';

export default function Privacy() {
  return (
    <LegalPageLayout title="Privacy Policy" effectiveDate="July 15, 2026">
      <p>
        This Privacy Policy explains what personal data AVIV Clan+ (the "Service")
        collects, why, and the choices and rights you have. It is written to reflect
        the requirements of the EU/UK General Data Protection Regulation (GDPR) and
        the US California Consumer Privacy Act (CCPA/CPRA), as well as other
        applicable privacy laws.
      </p>

      <h2>1. Who we are</h2>
      <p>
        AVIV Clan+ is operated as an independent project. For any privacy request or
        question, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>2. What data we collect</h2>
      <ul>
        <li>
          <strong>Discord account data</strong> — when you sign in with Discord, we
          receive your Discord user ID, username, and avatar via Discord's OAuth flow.
          We do not receive your Discord password.
        </li>
        <li>
          <strong>Clan data</strong> — clan name, image, roster/membership, join
          requests, and the raid-alert configuration (e.g. KAOS+ raid key) that a
          clan leader chooses to connect.
        </li>
        <li>
          <strong>Raid alert content</strong> — alert titles/bodies relayed from
          KAOS+ sensors, stored so members can see recent activity in the dashboard.
        </li>
        <li>
          <strong>Push notification data</strong> — if you subscribe to browser/PWA
          push notifications, we store the push subscription endpoint and keys
          needed to deliver notifications to your device. No location or device
          identifiers beyond what the push subscription itself contains are collected.
        </li>
        <li>
          <strong>Session &amp; technical data</strong> — a session cookie to keep you
          signed in, and standard server logs (IP address, request timestamps,
          user agent) used for security and troubleshooting.
        </li>
      </ul>
      <p>We do not sell your personal data, and we do not use it for third-party advertising.</p>

      <h2>3. Why we process this data (legal basis)</h2>
      <ul>
        <li><strong>To provide the Service</strong> — performance of a contract with you (GDPR Art. 6(1)(b)).</li>
        <li><strong>Security and abuse prevention</strong> — our legitimate interest (GDPR Art. 6(1)(f)).</li>
        <li><strong>Push notifications</strong> — your explicit action of subscribing, which you can withdraw at any time (consent).</li>
      </ul>

      <h2>4. Cookies</h2>
      <p>
        We use a single essential session cookie required to keep you signed in.
        This cookie is strictly necessary for the Service to function and is not
        used for advertising or cross-site tracking, so it does not require a
        cookie-consent banner under EU ePrivacy rules.
      </p>

      <h2>5. Sharing your data</h2>
      <p>
        We share data only with the service providers necessary to run AVIV Clan+
        (e.g. hosting infrastructure and Discord, for authentication and posting
        alerts), and only to the extent needed to provide the Service. We do not
        sell or rent personal data to third parties.
      </p>

      <h2>6. International data transfers</h2>
      <p>
        If you access the Service from the EU/EEA or UK, your data may be processed
        on servers located outside your region. Where this occurs, we rely on
        appropriate safeguards required by GDPR (such as standard contractual
        clauses with our infrastructure providers).
      </p>

      <h2>7. Data retention</h2>
      <p>
        We retain account, clan, and alert data for as long as your account or clan
        remains active, and delete or anonymize it within a reasonable period after
        you request deletion or your account is removed.
      </p>

      <h2>8. Your rights</h2>
      <p>Depending on where you live, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you;</li>
        <li>Correct inaccurate data;</li>
        <li>Delete your data ("right to be forgotten" / CCPA "right to delete");</li>
        <li>Export your data in a portable format (GDPR data portability);</li>
        <li>Object to or restrict certain processing;</li>
        <li>
          Know what categories of personal data are collected and not have your data
          sold (CCPA/CPRA — note: we do not sell personal data);
        </li>
        <li>Withdraw consent for push notifications at any time by unsubscribing in the app.</li>
      </ul>
      <p>
        To exercise any of these rights, email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We will respond
        within the time required by applicable law (generally within 30 days under
        GDPR and 45 days under CCPA).
      </p>

      <h2>9. Children's privacy</h2>
      <p>
        The Service is not directed at children under 13 (or under 16 in the EU/EEA
        where local law sets a higher age of digital consent), and we do not
        knowingly collect personal data from children below that age. If you believe
        a child has provided us personal data, contact us so we can delete it.
      </p>

      <h2>10. Accessibility</h2>
      <p>
        We aim to make AVIV Clan+ usable by people with disabilities, including
        screen-reader users, in line with the Web Content Accessibility Guidelines
        (WCAG) 2.1 Level AA. If you encounter an accessibility barrier, please
        report it to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> so we
        can fix it.
      </p>

      <h2>11. Security</h2>
      <p>
        We use reasonable technical and organizational measures (such as encrypted
        connections and access controls) to protect your data. No system is
        perfectly secure, and we cannot guarantee absolute security.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will
        be reflected by updating the "Effective date" above.
      </p>

      <h2>13. Contact</h2>
      <p>
        For any privacy question, request, or complaint, email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. EU/EEA residents
        also have the right to lodge a complaint with their local data protection
        authority.
      </p>
    </LegalPageLayout>
  );
}
