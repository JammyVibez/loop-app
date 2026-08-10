export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

          <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Personal Information</h3>
                <p className="text-muted-foreground">
                  When you create an account, we collect information such as your username, email address, display name,
                  and profile information you choose to provide.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Content Information</h3>
                <p className="text-muted-foreground">
                  We collect the content you create, share, and interact with on Loop, including loops, comments,
                  branches, and media files.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Usage Information</h3>
                <p className="text-muted-foreground">
                  We collect information about how you use our service, including your interactions, preferences, and
                  technical information about your device and connection.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Provide, maintain, and improve our services</li>
              <li>Personalize your experience and content recommendations</li>
              <li>Communicate with you about our services</li>
              <li>Ensure security and prevent fraud</li>
              <li>Comply with legal obligations</li>
              <li>Analyze usage patterns to improve our platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Information Sharing</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                We do not sell your personal information. We may share your information in the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>With your consent</li>
                <li>To comply with legal requirements</li>
                <li>To protect our rights and safety</li>
                <li>With service providers who assist us in operating our platform</li>
                <li>In connection with a business transaction</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
            <p className="text-muted-foreground">
              We implement appropriate technical and organizational measures to protect your personal information
              against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission
              over the internet is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
            <p className="text-muted-foreground mb-4">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Delete your personal information</li>
              <li>Restrict processing of your information</li>
              <li>Data portability</li>
              <li>Object to processing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Cookies and Tracking</h2>
            <p className="text-muted-foreground">
              We use cookies and similar technologies to enhance your experience, analyze usage, and provide
              personalized content. You can control cookie settings through your browser.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Children's Privacy</h2>
            <p className="text-muted-foreground">
              Our service is not intended for children under 13. We do not knowingly collect personal information from
              children under 13. If we become aware of such collection, we will delete the information promptly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers</h2>
            <p className="text-muted-foreground">
              Your information may be transferred to and processed in countries other than your own. We ensure
              appropriate safeguards are in place for such transfers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this privacy policy from time to time. We will notify you of any material changes by posting
              the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about this privacy policy or our practices, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="font-medium">Loop Privacy Team</p>
              <p className="text-muted-foreground">Email: privacy@loop.com</p>
              <p className="text-muted-foreground">Address: 123 Loop Street, Tech City, TC 12345</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
