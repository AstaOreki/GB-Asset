import MinimalHeader from "../../components/MinimalHeader";
import MinimalFooter from "../../components/MinimalFooter";
import "./privacy-policy.css";

/**
 * "/privacy-policy" — pure static legal content, zero Firebase/window.GBA
 * dependency and no reveal-on-scroll/ripple/magnetic-hover effects. The only
 * dynamic behavior on the original page (header-shrink-on-scroll + the gold
 * scroll-progress bar) is provided internally by the client-component
 * MinimalHeader, so this page itself stays a server component.
 */
export const metadata = {
  title: "Privacy Policy | GB Asset",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <MinimalHeader />
      <main>
        <section className="policy-hero">
          <div className="wrap">
            <div className="eyebrow">Legal</div>
            <h1>Privacy Policy</h1>
            <p>
              How GB Asset collects, uses, discloses, and safeguards your
              information when you visit our Website or use our services.
            </p>
          </div>
        </section>

        <section className="policy-body">
          <div className="wrap">
            <div className="policy-content">
              <div className="intro">
                <p>
                  At GB Asset, we value your privacy. This Privacy Policy
                  explains how we collect, use, disclose, and safeguard your
                  information when you visit https://gbaasset.com
                  ("Website").
                </p>
                <p>
                  This Privacy Policy explains how GB Asset ("we", "our",
                  "us") collects, uses, and protects your personal data when
                  you interact with us through our website at
                  https://gbaasset.com ("Website"), use our digital services,
                  or communicate with us directly (including via phone,
                  email, or other channels).
                </p>
                <p>
                  Please note that this Privacy Policy does not cover how
                  third parties collect or use your personal information. We
                  encourage you to review their respective privacy policies
                  and understand your rights before engaging with them.
                </p>
                <p>
                  By using our Website or engaging our services, you consent
                  to the terms of this Privacy Policy.
                </p>
              </div>

              <div className="policy-section">
                <h2>
                  <span className="num">01</span> Information We Collect
                </h2>
                <p>We may collect:</p>
                <ul>
                  <li>
                    <b>Personal Information:</b> Name, email, phone number,
                    date of birth, National Registration Identity Card number
                    (NRIC), shipping address, billing information, and
                    identification details for compliance (if applicable).
                  </li>
                  <li>
                    <b>Transaction Data:</b> Order history, payment method,
                    and bank/payment details.
                  </li>
                  <li>
                    <b>Technical Data:</b> IP address, browser type, device,
                    and cookies.
                  </li>
                  <li>
                    <b>Usage Data:</b> Pages visited, time spent, clicks and
                    navigation flow, items viewed or searched, and
                    interactions.
                  </li>
                  <li>
                    Any other personal information provided when contacting
                    us or using our services.
                  </li>
                </ul>
              </div>

              <div className="policy-section">
                <h2>
                  <span className="num">02</span> Children&apos;s Data and
                  Personal Information
                </h2>
                <p>
                  At GB Asset, we recognize the importance of protecting
                  children&apos;s personal data. We do allow our customers to
                  register accounts on behalf of their children under the
                  age of 18, subject to parental consent and supervision.
                </p>
                <p>
                  Parents or legal guardians are responsible for the use of
                  such accounts and for providing any personal data on
                  behalf of their children.
                </p>
                <p>
                  We do not knowingly collect personal data directly from
                  children without verified parental consent. If we become
                  aware that a child&apos;s data was submitted without
                  proper authorization, we will take steps to delete it
                  promptly.
                </p>
              </div>

              <div className="policy-section">
                <h2>
                  <span className="num">03</span> How We Use Your Information
                </h2>
                <p>
                  GB Asset only processes your personal data where we have a
                  valid legal basis to do so. Depending on the context, this
                  may include obtaining your consent, fulfilling a contract
                  or transaction with you, protecting your vital interests or
                  those of another individual, or complying with legal
                  obligations. We may also process your personal data where
                  it is necessary for our legitimate interests or those of a
                  third party — provided that such processing does not
                  override your rights, interests, or reasonable
                  expectations as a data subject.
                </p>
                <p>We use the information to:</p>

                <h3>3.1 Order Processing</h3>
                <ul>
                  <li>Confirm and deliver orders</li>
                  <li>Generate invoices and receipts</li>
                  <li>Coordinate with shipping providers</li>
                  <li>Process returns and refunds</li>
                </ul>

                <h3>3.2 Account Management</h3>
                <ul>
                  <li>Create and secure your user or reseller account</li>
                  <li>Authenticate access and detect suspicious activity</li>
                  <li>Allow password resets and updates</li>
                </ul>

                <h3>3.3 Customer Service</h3>
                <ul>
                  <li>Respond to enquiries or feedback</li>
                  <li>Provide status updates or resolve complaints</li>
                  <li>Notify you of service or policy changes</li>
                </ul>

                <h3>3.4 Website Optimization</h3>
                <ul>
                  <li>Improve usability and layout</li>
                  <li>Personalize user experience</li>
                  <li>Monitor technical performance</li>
                </ul>

                <h3>3.5 Marketing Activities</h3>
                <ul>
                  <li>
                    Send product updates, promotions, and offers (only if
                    consented)
                  </li>
                  <li>Analyze marketing campaign performance</li>
                  <li>Manage email communication preferences</li>
                </ul>

                <h3>3.6 Legal Compliance &amp; Security</h3>
                <ul>
                  <li>
                    Conduct identity verification and comply with AML laws
                  </li>
                  <li>Respond to requests from authorities or regulators</li>
                  <li>Prevent fraud, abuse, and unauthorized access</li>
                </ul>

                <h3>3.7 Internal Analytics &amp; Development</h3>
                <ul>
                  <li>Perform data analysis and insights reporting</li>
                  <li>Improve existing features or develop new offerings</li>
                  <li>Conduct testing and system backups</li>
                </ul>
              </div>

              <div className="policy-section">
                <h2>
                  <span className="num">04</span> Cookies and Third-Party
                  Service Providers
                </h2>
                <p>
                  GB Asset uses cookies and similar tracking technologies to
                  enhance your browsing experience, personalize content, and
                  analyze Website traffic. Cookies are small data files
                  stored on your device that allow us to remember your
                  preferences, manage session activity, and understand how
                  our Website is used.
                </p>
                <p>We use:</p>
                <ul>
                  <li>
                    Essential cookies to enable secure logins, shopping cart
                    functionality, and other core features;
                  </li>
                  <li>
                    Analytics cookies to evaluate user activity and improve
                    site performance;
                  </li>
                  <li>
                    Functional cookies to retain your settings and
                    preferences for future visits.
                  </li>
                </ul>
                <p>
                  By using our Website, you consent to our use of cookies as
                  described in this Policy. You may manage or disable
                  cookies through your browser settings, but doing so may
                  affect the functionality of certain features.
                </p>
                <p>
                  We also engage trusted third-party service providers to
                  support the operation of our Website and the delivery of
                  our services. These include:
                </p>
                <ul>
                  <li>
                    <b>Payment processors</b> (e.g. FPX, Wise): To process
                    payments securely;
                  </li>
                  <li>
                    <b>Delivery and logistics partners:</b> To ship your
                    orders efficiently;
                  </li>
                  <li>
                    <b>Compliance and legal consultants:</b> Where required
                    by law or for regulatory obligations;
                  </li>
                  <li>
                    <b>Marketing and communication platforms:</b> To send
                    you updates and promotions, only if you have opted in.
                  </li>
                </ul>
                <p>
                  These providers are authorized to use your data solely to
                  perform services on our behalf and are contractually bound
                  to protect the confidentiality and security of your
                  personal data.
                </p>
              </div>

              <div className="policy-section">
                <h2>
                  <span className="num">05</span> Data Storage &amp; Security
                </h2>
                <p>
                  Your personal data is stored securely. We implement
                  appropriate technical and organizational security measures
                  to protect against unauthorized access, alteration, or
                  disclosure.
                </p>
              </div>

              <div className="policy-section">
                <h2>
                  <span className="num">06</span> Your Rights
                </h2>
                <p>Under Malaysian data protection laws, you may:</p>
                <ul>
                  <li>Request access to your personal data;</li>
                  <li>Request correction of inaccurate or outdated data;</li>
                  <li>Withdraw your consent (where applicable);</li>
                  <li>
                    Request deletion of your data (subject to legal
                    limitations).
                  </li>
                </ul>
                <p>
                  However, there may be circumstances in which we are unable
                  to fulfil your request — for example, if you request the
                  deletion of your transaction data but we are legally
                  required to retain those records to comply with regulatory
                  obligations. We may also decline to act on a request if
                  doing so would compromise our legitimate use of the data
                  for fraud prevention or security purposes, such as when an
                  account is under investigation for potential misuse or
                  threats. Other reasons your privacy request may be denied
                  include where it would infringe on the rights or privacy
                  of others, if the request is frivolous, excessive, or
                  manifestly unfounded, or if it would be extremely
                  impractical or unreasonable to comply.
                </p>
                <p>To exercise your rights, contact us using the details provided below.</p>
              </div>

              <div className="policy-section">
                <h2>
                  <span className="num">07</span> Retention of Data
                </h2>
                <p>
                  We retain your information for as long as needed to
                  fulfill purposes outlined in this policy or as required by
                  law.
                </p>
              </div>

              <div className="policy-section">
                <h2>
                  <span className="num">08</span> Updates to This Policy
                </h2>
                <p>
                  We may update this Privacy Policy from time to time. Any
                  changes will be posted on this page with the updated date.
                  We encourage you to review it periodically.
                </p>
                <p>
                  Your continued use of the Website constitutes acceptance
                  of any changes made.
                </p>
              </div>

              <div className="policy-contact">
                <div className="eyebrow">Get in Touch</div>
                <h3>Questions or Concerns?</h3>
                <p>If you have any questions or concerns, contact:</p>
                <p>
                  GB Asset
                  <br />
                  No. 7, Binjai 8 Premium Soho,
                  <br />
                  Unit 8, Lorong Binjai,
                  <br />
                  KLCC, Kuala Lumpur.
                  <br />
                  Tel: +60 12-240 0600 (WhatsApp &amp; Telefon)
                </p>
              </div>

              <p className="policy-updated">Last updated: July 2026</p>
            </div>
          </div>
        </section>
      </main>
      <MinimalFooter />
    </>
  );
}
