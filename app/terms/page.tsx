import Link from "next/link"

const sections = [
  {
    id: "acceptance",
    num: "1",
    title: "Acceptance of These Terms",
    body: [
      "Welcome to Loop (\"Loop\", \"we\", \"us\", or \"our\"). These Terms of Service (\"Terms\") form a binding legal agreement between you (\"you\" or \"your\") and Loop governing your access to and use of the Loop platform, including our website, mobile applications, and all related services, features, tools, and content (collectively, the \"Service\").",
      "By creating an account, accessing, browsing, or using the Service in any way, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree with any part of these Terms, you must not use the Service.",
      "If you are using the Service on behalf of an organization (including as an Organization account under Section 10), you represent and warrant that you have the authority to bind that organization to these Terms.",
    ],
  },
  {
    id: "eligibility",
    num: "2",
    title: "Eligibility and Accounts",
    body: [
      "You must be at least 13 years old to use the Service (or the minimum age required to consent to online services in your country, if higher). By using the Service you represent and warrant that you meet this requirement.",
      "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to notify us immediately of any unauthorized use of your account by emailing support@loop.com or opening a support ticket from the Help Center.",
      "You may not create multiple accounts to circumvent restrictions, restrictions we impose, or to artificially inflate engagement, rewards, or referral bonuses. We may suspend or terminate accounts that we reasonably believe were created or used in violation of this Section.",
    ],
  },
  {
    id: "service",
    num: "3",
    title: "Description of the Service",
    body: [
      "Loop is a collaborative social platform that lets you create, share, and build on content. The Service includes, without limitation:",
    ],
    list: [
      "Loops — original posts (text, image, video, or code) that other users can \"branch\" from to build connected, tree-like structures of content.",
      "Co-Loops — real-time collaborative writing sessions where a Primary Creator and invited Co-Authors write and publish a post together from a live studio.",
      "Duels — public side-by-side debates or polls where the community votes on an outcome.",
      "Circles — community spaces where members join, post, host events, and collaborate on shared topics.",
      "Reels — short-form video content with comments, likes, and branching.",
      "Live Streams — real-time broadcast rooms with chat and viewer interaction.",
      "Loop Coins — an in-app virtual currency earned through engagement and usable in the Loop Shop, for gifts, boosts, and other virtual items.",
      "Premium (\"Pro\") — paid subscription tiers unlocking exclusive badges, cosmetics, perks, and features.",
      "Marketplace — a space to discover and install community-built apps, tools, and integrations.",
      "Events, Games, GIFs, Gifts, Referrals, Organization accounts, and other features we may add from time to time.",
    ],
    body2:
      "We may add, change, suspend, or remove features at any time with or without notice, and we do not guarantee that any feature will remain available.",
  },
  {
    id: "content",
    num: "4",
    title: "User Content and Your License to Us",
    body: [
      "You retain full ownership of the content you create, upload, post, or otherwise make available on the Service (\"User Content\"). By posting User Content, you grant Loop a non-exclusive, worldwide, royalty-free, sub-licensable, and transferable license to host, store, reproduce, distribute, display, perform, modify (for formatting and display purposes), and create derivative works of your User Content solely to operate, provide, promote, and improve the Service, and to allow other users to interact with it in accordance with the Service's intended functionality (for example, branching from your loop).",
      "You represent and warrant that: (a) you own or have the necessary rights, licenses, and permissions to your User Content; (b) your User Content does not infringe the intellectual property, privacy, publicity, or other rights of any third party; and (c) your User Content complies with these Terms, our Community Guidelines, and all applicable laws.",
      "If you believe that content on the Service infringes your copyright, you may submit a takedown notice to legal@loop.com including a description of the infringing content, your contact information, and a statement of good-faith belief that the use is not authorized.",
    ],
  },
  {
    id: "conduct",
    num: "5",
    title: "Prohibited Conduct",
    body: ["You agree not to use the Service to:"],
    list: [
      "Post content that is unlawful, defamatory, harassing, hateful, threatening, obscene, or that exploits or harms minors.",
      "Impersonate any person or entity, or misrepresent your affiliation, identity, or credentials.",
      "Engage in spam, phishing, fraud, deceptive practices, or the manipulation of engagement metrics, votes, duels, or rewards.",
      "Distribute malware, viruses, or any code intended to disrupt, damage, or gain unauthorized access to the Service or other users' devices.",
      "Attempt to access, scrape, or collect data from the Service using automated tools, except as expressly permitted by our public APIs and developer policies.",
      "Interfere with or disrupt the Service, its servers, or networks, including denial-of-service attacks or excessive automated requests.",
      "Buy, sell, or otherwise transfer accounts, usernames, or virtual currency outside of the Service's sanctioned mechanics.",
      "Use the Service to send unsolicited commercial messages to other users.",
      "Encourage, facilitate, or assist any of the foregoing.",
    ],
    body2:
      "We may remove content, restrict access, or suspend accounts that violate this Section, at our sole discretion, and we are not obligated to provide prior notice.",
  },
  {
    id: "virtual-currency",
    num: "6",
    title: "Loop Coins, Virtual Items, and Purchases",
    body: [
      "Loop Coins are virtual points with no monetary value and cannot be redeemed for cash or any real-world currency (unless a specific, separately published redemption program says otherwise). Coins may be earned through platform activity or acquired through in-app purchases processed by third-party payment providers.",
      "Virtual items purchased with Loop Coins (including gifts, boosts, cosmetics, themes, and catalog effects) are licensed to you for personal, non-commercial use within the Service and may not be transferred, sold, or exchanged outside the Service.",
      "All purchases are final. Unless required by applicable consumer law or a separately published refund policy, we do not offer refunds for virtual currency, virtual items, or subscription fees already paid.",
      "We may adjust, expire, or revoke Loop Coins or virtual items if we determine they were obtained through fraud, abuse, or violation of these Terms.",
    ],
  },
  {
    id: "subscriptions",
    num: "7",
    title: "Premium (Pro) Subscriptions",
    body: [
      "Premium subscriptions grant access to exclusive features, badges, cosmetics, and perks described on the Premium page. Subscription fees and billing cycles are displayed before purchase.",
      "Subscriptions renew automatically at the end of each billing period until cancelled. You can cancel at any time through your account settings; cancellation takes effect at the end of the current billing period, and you will retain access to paid features until then.",
      "We reserve the right to change subscription pricing for future billing cycles. We will provide reasonable notice of price changes before they take effect.",
      "If you are granted Premium through an admin action, a promotion, or a reward (such as an organization perk), those grants are at our discretion and may be revoked at any time without refund.",
    ],
  },
  {
    id: "referrals",
    num: "8",
    title: "Referral Program",
    body: [
      "The Referral Program rewards you with Loop Coins when a new user signs up using your unique invite link and completes the qualifying actions described in the Settings → Referrals page (for example, completing onboarding and making a first post).",
      "Rewards are credited to your account only when the referred user is not a previously existing account and does not use the same device, payment method, or IP address cluster we reasonably associate with abuse.",
      "We may withhold or claw back referral rewards if we determine that the program is being abused, including self-referrals, duplicate accounts, or incentivized fake signups.",
    ],
  },
  {
    id: "gifts",
    num: "9",
    title: "Gifts, Donations, and Withdrawals",
    body: [
      "Users may send virtual gifts to other users using Loop Coins. Gifts are virtual items and do not create a monetary obligation to the recipient unless a separately published creator-payout program applies.",
      "If you participate in a creator-payout or withdrawal program (such as withdrawing available earnings), you represent that you are legally able to receive the funds, that all information you provide is accurate, and that you will comply with all applicable tax laws. Withdrawals are subject to minimum thresholds, verification, and anti-fraud review.",
      "We may delay, withhold, or reverse payouts where we suspect fraud, chargebacks, or violations of these Terms.",
    ],
  },
  {
    id: "organizations",
    num: "10",
    title: "Organization Accounts",
    body: [
      "Organization accounts are user accounts that have enabled Organization Mode (where eligible) and may represent a brand, community, or business. Organization owners are responsible for all activity under the organization account, including posts, events, perks, and member interactions.",
      "Organization perks, boost discounts, coin-rate multipliers, and exclusive rewards are configurable by the organization owner and may be modified, limited, or revoked by us at any time.",
      "Events hosted by organizations are community events; we are not a party to, and are not responsible for, the fulfillment of any promises made by organizations to their members.",
    ],
  },
  {
    id: "ip",
    num: "11",
    title: "Intellectual Property",
    body: [
      "The Service, including its software, design, graphics, logos, trademarks, and all non-User Content, is owned by or licensed to Loop and is protected by intellectual property laws. Unless expressly permitted, you may not copy, modify, distribute, sell, lease, or create derivative works of any part of the Service.",
      "We welcome feedback and suggestions, but by submitting ideas you grant us a perpetual, irrevocable, royalty-free license to use them without any obligation to you.",
    ],
  },
  {
    id: "third-party",
    num: "12",
    title: "Third-Party Services",
    body: [
      "The Service may integrate with third-party services (for example, payment processors, GIF providers, or the Google sign-in provider). Your use of those services may be subject to the third party's own terms and privacy policy, and we are not responsible for third-party services.",
      "The Marketplace may list community-built apps and tools. Those items are provided by their respective developers \"as is\"; we do not warrant their functionality and are not liable for their operation.",
    ],
  },
  {
    id: "termination",
    num: "13",
    title: "Termination and Account Deletion",
    body: [
      "You may delete your account at any time from Settings. Deleting your account will remove your profile and, where technically feasible, your content from public display; copies may remain in backups for a reasonable retention period.",
      "We may suspend or terminate your account, or restrict your access, with or without notice, if we believe you have violated these Terms, the Community Guidelines, or applicable law, or if your conduct creates risk or harm to the Service or other users.",
      "Upon termination, your right to use the Service ceases immediately. Virtual currency and virtual items have no cash value and will not be refunded.",
    ],
  },
  {
    id: "disclaimers",
    num: "14",
    title: "Disclaimer of Warranties",
    body: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, OR UNINTERRUPTED OR ERROR-FREE OPERATION.",
      "WE DO NOT WARRANT THAT THE SERVICE WILL MEET YOUR REQUIREMENTS, THAT CONTENT WILL BE ACCURATE OR RELIABLE, OR THAT DEFECTS WILL BE CORRECTED. ANY CONTENT DOWNLOADED OR OTHERWISE OBTAINED THROUGH THE SERVICE IS ACCESSED AT YOUR OWN RISK, AND YOU ARE SOLELY RESPONSIBLE FOR ANY DAMAGE TO YOUR DEVICE OR DATA.",
    ],
  },
  {
    id: "liability",
    num: "15",
    title: "Limitation of Liability",
    body: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER LOOP NOR ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO YOUR USE OF (OR INABILITY TO USE) THE SERVICE.",
      "OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE SIX (6) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED US DOLLARS ($100). SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES, SO SOME OF THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU.",
    ],
  },
  {
    id: "indemnity",
    num: "16",
    title: "Indemnification",
    body: [
      "You agree to indemnify, defend, and hold harmless Loop and its affiliates, officers, directors, employees, and agents from and against any and all claims, damages, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) your User Content; (b) your use of the Service; (c) your violation of these Terms; or (d) your violation of any rights of a third party.",
    ],
  },
  {
    id: "disputes",
    num: "17",
    title: "Governing Law and Dispute Resolution",
    body: [
      "These Terms are governed by the laws of the jurisdiction in which Loop's principal place of business is located, without regard to its conflict-of-law provisions, except where mandatory local law applies to you.",
      "We encourage you to resolve disputes informally first by contacting support@loop.com. If a dispute cannot be resolved informally, you agree that it shall be resolved exclusively in the competent courts of that jurisdiction, and you consent to the personal jurisdiction of those courts.",
      "If any provision of these Terms is held to be invalid or unenforceable, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.",
    ],
  },
  {
    id: "changes",
    num: "18",
    title: "Changes to These Terms",
    body: [
      "We may revise these Terms from time to time. When we make material changes, we will update the \"Last updated\" date below and, where appropriate, notify you through the Service or by email. Your continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.",
      "If you do not agree to the revised Terms, you must stop using the Service before the changes take effect.",
    ],
  },
  {
    id: "contact",
    num: "19",
    title: "Contact Us",
    body: [
      "If you have questions about these Terms, our Privacy Policy, or the Service, you can reach us through the Help Center (Help → Contact Support, or the live Support Chat) or by email at support@loop.com.",
    ],
  },
]

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
            Please read these Terms carefully before using Loop. They cover your rights and responsibilities,
            our content and conduct rules, and the legal limits of our liability. By using Loop, you agree to
            these Terms and to our <Link href="/privacy" className="font-medium text-primary underline underline-offset-4">Privacy Policy</Link>.
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
          <p className="text-sm font-semibold">Contact</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Questions about these Terms? Reach us via the{" "}
            <Link href="/support/chat" className="font-medium text-primary underline underline-offset-4">
              Support Chat
            </Link>{" "}
            or email <span className="font-medium text-foreground">support@loop.com</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
