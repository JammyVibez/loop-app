export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

          <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing and using Loop, you accept and agree to be bound by the terms and provision of this
              agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground">
              Loop is a social platform that allows users to create, share, and collaborate on content through a unique
              tree-branching system. Users can create "loops" of content that others can branch from, creating
              collaborative knowledge trees.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                To use certain features of Loop, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. User Content</h2>
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Content Ownership</h3>
              <p className="text-muted-foreground">
                You retain ownership of content you create and share on Loop. By posting content, you grant Loop a
                non-exclusive, worldwide, royalty-free license to use, display, and distribute your content on the
                platform.
              </p>

              <h3 className="text-lg font-medium">Content Guidelines</h3>
              <p className="text-muted-foreground">You agree not to post content that:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Violates any laws or regulations</li>
                <li>Infringes on intellectual property rights</li>
                <li>Contains hate speech or harassment</li>
                <li>Includes spam or misleading information</li>
                <li>Contains malicious code or viruses</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Prohibited Uses</h2>
            <p className="text-muted-foreground mb-4">
              You may not use Loop for any unlawful purposes or to conduct any unlawful activity, including but not
              limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Impersonating others or providing false information</li>
              <li>Attempting to gain unauthorized access to our systems</li>
              <li>Interfering with or disrupting our services</li>
              <li>Using automated tools to access our platform</li>
              <li>Collecting user information without consent</li>
              <li>Engaging in any form of harassment or abuse</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Premium Services</h2>
            <p className="text-muted-foreground">
              Loop offers premium features through paid subscriptions. Premium services are subject to additional terms
              and conditions. Payments are processed securely through third-party payment processors. Refunds are
              handled according to our refund policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
            <p className="text-muted-foreground">
              Loop and its original content, features, and functionality are owned by Loop Inc. and are protected by
              international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Termination</h2>
            <p className="text-muted-foreground">
              We may terminate or suspend your account and access to Loop immediately, without prior notice, for conduct
              that we believe violates these Terms of Service or is harmful to other users, us, or third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground">
              Loop is provided on an "as is" and "as available" basis. We make no representations or warranties of any
              kind, express or implied, regarding the use or results of the service in terms of correctness, accuracy,
              reliability, or otherwise.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              In no event shall Loop Inc. be liable for any indirect, incidental, special, consequential, or punitive
              damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these terms at any time. We will notify users of any material changes. Your
              continued use of Loop after such modifications constitutes acceptance of the updated terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Contact Information</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="font-medium">Loop Legal Team</p>
              <p className="text-muted-foreground">Email: legal@loop.com</p>
              <p className="text-muted-foreground">Address: 123 Loop Street, Tech City, TC 12345</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
