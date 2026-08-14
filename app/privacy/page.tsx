import Link from "next/link"

const sections = [
  {
    id: "overview",
    num: "1",
    title: "Overview",
    body: [
      "This Privacy Policy explains how Loop (\"we\", \"us\", or \"our\") collects, uses, shares, and protects your personal information when you use the Loop platform (the \"Service\"). It applies to all users of the Service, whether you are a guest browsing public content or a registered account holder.",
      "We collect the minimum personal information needed to run the Service, we do not sell your personal information, and we only share it with the service providers required to operate Loop. By using the Service, you agree to the practices described in this policy.",
    ],
  },
  {
    id: "collect",
    num: "2",
    title: "Information We Collect",
    body: ["We collect the following categories of information:"],
    list: [
      "Account information — when you register, we collect your email address, chosen username, display name, and password (stored only as a cryptographically hashed value). If you sign in with Google, we receive the name, email, and profile picture from your Google account that you authorize.",
      "Profile information — content you add to your profile, including a bio, avatar, banner image, location, website, phone number (if you choose to provide it), interests, and theme or cosmetic preferences.",
      "Content you create — loops, reels, comments, duels, circle posts, event registrations, live-stream chats, co-loop sessions, and any media you upload to the Service.",
      "Engagement data — likes, reactions, follows, branches, saves/bookmarks, views, shares, and the people and content you interact with, used to personalize your feed (including our recommendation features).",
      "Transactional data — records of Loop Coin transactions, gifts sent and received, purchases, referral rewards, and withdrawals.",
      "Device and usage data — technical information automatically collected when you use the Service, such as IP address, browser type and version, device identifiers, operating system, referring pages, and timestamps of your visits.",
      "Communication data — support tickets and messages you send to our support team.",
    ],
  },
  {
    id: "use",
    num: "3",
    title: "How We Use Your Information",
    body: ["We use your information to:"],
    list: [
      "Provide, operate, and maintain the Service, including authenticating you and keeping your account secure.",
      "Personalize your experience, including ranking your feed, suggesting users, circles, and events, and serving relevant recommendations.",
      "Enable social features, such as showing your content to other users, processing follows, likes, comments, gifts, and shares.",
      "Process purchases, subscriptions, virtual-currency transactions, referral rewards, and withdrawals.",
      "Send you service notifications (in-app, email, or push) about activity on your account, such as new followers, comments, gifts, or support replies.",
      "Detect, prevent, and respond to fraud, abuse, security incidents, and violations of our Terms of Service or Community Guidelines.",
      "Improve and develop the Service through analytics, debugging, and research.",
      "Comply with legal obligations and enforce our rights.",
    ],
  },
  {
    id: "share",
    num: "4",
    title: "When We Share Your Information",
    body: ["We do not sell your personal information. We share your information only in the following circumstances:"],
    list: [
      "With service providers — companies that help us operate the Service, such as cloud hosting and database providers, media/file-storage providers (e.g. Cloudinary), payment processors, push-notification providers, and analytics providers. These providers are contractually bound to use your information only to provide services to us.",
      "With other users — the information you make public (your username, display name, avatar, posts, and interactions) is visible to other users as part of the Service's intended functionality.",
      "For safety and legal reasons — when we reasonably believe disclosure is required by law, regulation, legal process, or governmental request, or is necessary to protect the rights, property, or safety of Loop, our users, or the public.",
      "In a business transfer — if we are involved in a merger, acquisition, reorganization, or sale of assets, your information may be transferred as part of that transaction, subject to this Privacy Policy.",
      "With your consent — we may share your information for other purposes when you direct us to do so.",
    ],
  },
  {
    id: "public",
    num: "5",
    title: "Public Information and Social Features",
    body: [
      "Most of the content you create on Loop is public by default, including your profile, loops, reels, comments, duels, and circle posts. Public content may be viewed, searched, branched, and shared by other users and, where the Service allows, by visitors who are not signed in.",
      "Your profile shows your username, display name, avatar, bio, and information such as follower counts and engagement statistics. Think carefully before posting content you would not want to be public.",
      "Direct messages, gift records, and withdrawal details are private to you and the other party, except where we are required to disclose them by law or to investigate abuse.",
    ],
  },
  {
    id: "cookies",
    num: "6",
    title: "Cookies and Similar Technologies",
    body: [
      "We use cookies and similar technologies (including local storage) to keep you signed in, remember your preferences (such as theme), and understand how the Service is used. Authentication cookies are essential to the Service's operation.",
      "We also use analytics tools that may set their own cookies. You can disable cookies in your browser settings, but some parts of the Service may not work correctly without them.",
    ],
  },
  {
    id: "retention",
    num: "7",
    title: "Data Retention",
    body: [
      "We retain your personal information for as long as your account is active or as needed to provide the Service, comply with legal obligations, resolve disputes, and enforce our agreements.",
      "When you delete your account, we delete or de-identify your profile and, where technically feasible, your public content. Copies may remain in encrypted backups for a reasonable retention period (typically up to 90 days) before being purged.",
      "Transactional and financial records may be retained longer where required by law or our payment partners' policies.",
    ],
  },
  {
    id: "security",
    num: "8",
    title: "How We Protect Your Information",
    body: [
      "We implement reasonable technical and organizational measures to protect your information, including encryption of data in transit (TLS), hashing of passwords, restricted access to production systems, and monitoring for suspicious activity.",
      "No method of transmission or storage is 100% secure. While we work to protect your information, we cannot guarantee its absolute security. You are responsible for keeping your password confidential and enabling all security features we offer.",
    ],
  },
  {
    id: "rights",
    num: "9",
    title: "Your Rights and Choices",
    body: ["Depending on your location, you may have the following rights regarding your personal information:"],
    list: [
      "Access — request a copy of the personal information we hold about you.",
      "Correction — update or correct inaccurate information (you can also edit most profile fields directly in Settings).",
      "Deletion — request that we delete your personal information (you can also delete your account from Settings).",
      "Portability — request your information in a structured, machine-readable format where technically feasible.",
      "Restriction and objection — object to or request restriction of certain processing, including direct marketing.",
      "Withdraw consent — where processing is based on consent, withdraw it at any time without affecting the lawfulness of prior processing.",
      "Opt out of marketing — follow the unsubscribe instructions in any marketing email we send.",
    ],
    body2:
      "To exercise any of these rights, contact us at privacy@loop.com or via the Support Chat. We will respond within the timeframe required by applicable law. We may need to verify your identity before acting on your request.",
  },
  {
    id: "children",
    num: "10",
    title: "Children's Privacy",
    body: [
      "The Service is not directed to children under the age of 13, and we do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us personal information, please contact us at privacy@loop.com and we will take steps to delete it.",
    ],
  },
  {
    id: "international",
    num: "11",
    title: "International Data Transfers",
    body: [
      "Your information may be processed in countries other than your own, including where our servers and service providers are located. When we transfer personal information across borders, we take steps to ensure it receives an equivalent level of protection, including through standard contractual clauses or other recognized transfer mechanisms where required.",
    ],
  },
  {
    id: "changes",
    num: "12",
    title: "Changes to This Policy",
    body: [
      "We may update this Privacy Policy from time to time. When we make material changes, we will update the \"Last updated\" date below and notify you through the Service or by email where appropriate. Your continued use of the Service after changes take effect constitutes your acceptance of the updated policy.",
    ],
  },
  {
    id: "contact",
    num: "13",
    title: "Contact Us",
    body: [
      "If you have questions about this Privacy Policy or our data practices, contact us at privacy@loop.com, through the Support Chat, or by mail at the address on our Terms of Service page.",
    ],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            This policy explains what information Loop collects, why we collect it, how we use and share it,
            and the choices you have. It works together with our{" "}
            <Link href="/terms" className="font-medium text-primary underline underline-offset-4">Terms of Service</Link>.
          </p>
        </div>

        <nav className="mb-10 rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-semibold">Table of contents</p>
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  {s.num}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s) => (
          <section key={s.id} id={s.id} className="mb-9 scroll-mt-24">
            <h2 className="mb-3 text-xl font-semibold tracking-tight sm:text-2xl">
              <span className="mr-2 text-muted-foreground">{s.num}.</span>
              {s.title}
            </h2>
            <div className="space-y-3">
              {s.body?.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="list-disc space-y-2 pl-6">
                  {s.list.map((item, i) => (
                    <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {s.body2 && <p className="text-sm leading-relaxed text-muted-foreground">{s.body2}</p>}
            </div>
          </section>
        ))}

        <div className="mt-12 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-semibold">Privacy contact</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Questions about your data? Email{" "}
            <span className="font-medium text-foreground">privacy@loop.com</span> or reach us through the{" "}
            <Link href="/support/chat" className="font-medium text-primary underline underline-offset-4">
              Support Chat
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
