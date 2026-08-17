# loopapp.me - Social Media REIMAGINED Platform

A full-stack social media platform focused on collaborative storytelling and creative content sharing. Built with Next.js, Supabase, and modern web technologies.

## 🌟 Features

### Core Features
- **Loop Trees**: Create content that others can branch and extend
- **Tree Reels**: TikTok-style browsing of short loop trees
- **Real-time Collaboration**: Chat and work together on projects
- **Communities (Circles)**: Join interest-based communities
- **Premium System**: Advanced features with Loop Coins currency

### 🎬 **Reels & Branching System**
- Create reels with video, image, text, audio, or file content
- Branch system allowing up to 10 levels of collaborative content
- Real-time comments and reactions on reels
- Remix and extend content from other creators

### 🏘️ **Circles (Communities)**
- Discord-like server functionality with multiple chat rooms
- Public and private circles with role-based permissions
- Voice and video chat capabilities
- Admin dashboard for managing members, events, and contests
- Real-time messaging and file sharing

### 👤 **Profile Customization**
- Upload custom banners and avatars
- Theme system with custom colors and animations
- Shareable profile links
- Premium features and verification badges

### 💬 **Enhanced Messaging**
- One-on-one and group messaging
- Reply to messages with thread-style conversations
- Gift premium subscriptions and Loop Coins
- File sharing including ZIP, PDF, DOCX, and code files
- Message reactions and typing indicators

### 🛍️ **Shop & Inventory System**
- Purchase themes, animations, and effects with Loop Coins or real money
- Weekly 500 coin bonus for all active users
- Inventory management with item activation
- Stripe integration for premium purchases

### 🎨 **3D Design & Themes**
- Subtle 3D effects and glow animations throughout the UI
- Custom theme system with Discord CDN support
- Glass morphism and gradient effects
- Responsive design with mobile optimization

## 🛠 Technical Stack

### Frontend
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for components
- **Framer Motion** for animations

### Backend Architecture
- **PostgreSQL** database with tree structures
- **Supabase** for authentication and real-time
- **Socket.io** server for live collaboration
- **Stripe** for premium subscriptions
- **Cloudinary** for media uploads

## 📊 Database Schema

### Core Tables
- `users` - User accounts and profiles
- `loops` - Content with tree structure (parent_loop_id)
- `loop_stats` - Engagement statistics
- `loop_interactions` - Likes, saves, views
- `circles` - Communities
- `messages` - Real-time chat
- `notifications` - User notifications

### Additional Tables
- `profiles` - User profiles and settings
- `loop_stats` - Engagement metrics
- `circles` - Communities/servers
- `circle_members` - Community membership
- `circle_rooms` - Chat rooms within communities
- `comments` - Comments on loops
- `messages` - Direct and group messages
- `shop_items` - Purchasable items
- `user_inventory` - User-owned items
- `follows` - User relationships
- `likes`, `saves` - User interactions

### Key Relationships
\`\`\`sql
loops.parent_loop_id -> loops.id  -- Tree structure
loops.author_id -> users.id       -- Content ownership
circle_members.user_id -> users.id -- Community membership
\`\`\`

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Cloudinary account (for file uploads)
- Stripe account (for payments)

### Installation
\`\`\`bash
# Clone the repository
git clone https://github.com/your-username/loop-social-platform.git
cd loop-social-platform

# Install dependencies
npm install
# or
yarn install

# Set up environment variables
cp .env.example .env.local

# Set up the database
# Run scripts/complete-database-setup.sql and scripts/launch-schema-alignment.sql
# and run it in your Supabase SQL editor

# Configure Cloudinary
# Create an upload preset in your Cloudinary dashboard
# Set the upload preset to "unsigned" for easier integration
# Configure folder structure for organized file storage

# Set up Stripe
# Create products for Loop Coin packages
# Set up webhook endpoints for payment processing
# Configure webhook events: payment_intent.succeeded

# Run the development server
npm run dev
# or
yarn dev
\`\`\`

### Environment Variables
\`\`\`env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Cloudinary Configuration (for file uploads)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_UPLOAD_PRESET=your_upload_preset_name

# Stripe Configuration (for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Cron Job Secret (for weekly coin distribution)
CRON_SECRET=your_random_cron_secret

# Auth secret (REQUIRED in production — generate with: openssl rand -base64 48)
BETTER_AUTH_SECRET=your_random_auth_secret

# 100ms Realtime Media (livestream, voice & video calls)
# Get these at https://dashboard.100ms.live → Developer → App Access Key / App Secret
HMS_ACCESS_KEY=your_hms_app_access_key
HMS_SECRET=your_hms_app_secret
# Optional tuning:
HMS_HOST_ROLE=host       # role minted for call/livestream creators
HMS_GUEST_ROLE=guest     # role minted for participants/viewers
HMS_REGION=auto          # eu | in | us | auto

# ---- OR: LiveKit (free fallback — same SFU/WebRTC model, open source) ----
# Get these at https://livekit.io → Cloud → create a project → Settings → Keys
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=wss://your-project.livekit.cloud

# Optional: force a provider instead of auto-detecting
# (auto: 100ms if HMS keys are set, else LiveKit if LIVEKIT keys are set)
REALTIME_PROVIDER=auto   # auto | 100ms | livekit
\`\`\`

### 🎥 100ms Realtime Media (livestream + voice/video calls)

Livestreaming and all voice/video calls (DMs, group chats, Circles) run on **100ms** (SFU-based WebRTC) instead of the old peer-to-peer mesh. Room creation and per-user app tokens are minted **server-side only** — the client never sees your 100ms secret.

**Setup:**
1. Create a free account at [100ms Live](https://dashboard.100ms.live) and a new app.
2. Open **Developer** in the left menu → copy **App Access Key** and **App Secret**.
3. Add them as `HMS_ACCESS_KEY` / `HMS_SECRET` in your deployment's environment variables (Vercel/Render → Settings → Environment Variables).
4. Optional: set `HMS_HOST_ROLE` / `HMS_GUEST_ROLE` if you create custom roles in the 100ms dashboard, and `HMS_REGION` to pin room regions.

Until these keys are set, call/livestream endpoints return a clear 503 message — the rest of the app is unaffected.

**Database:** run `scripts/100ms-calls-schema.sql` (idempotent) or `npm run db:apply:pending` to create the `call_sessions` table (RLS-protected) and the `live_streams.hms_room_id` / `hms_room_name` columns. `scripts/livekit-fallback-schema.sql` adds the `provider` column (`100ms` / `livekit`) so every session joins through the SFU it was created on.

### 🎥 LiveKit fallback (free alternative to 100ms)

If you can't get a 100ms account (or want a free, open-source fallback), Loop automatically switches to **LiveKit** — the same SFU-based WebRTC model (rooms, host/viewer roles, server-side JWT tokens) but with a generous free tier (10k participant-minutes/month, no credit card) and the option to self-host entirely free.

**How the switch works (no code changes needed):**
1. Create a free project at [livekit.io](https://livekit.io) → Cloud → create a project.
2. Open **Settings → Keys**, copy **API Key**, **API Secret**, and the **WebSocket URL** (`wss://…`).
3. Set `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` in your deployment env vars (Vercel/Render → Settings → Environment Variables).
4. Provider auto-detection: 100ms wins if `HMS_*` keys are set, otherwise LiveKit is used. To force one explicitly, set `REALTIME_PROVIDER=100ms` or `REALTIME_PROVIDER=livekit`.

Livestreaming, DM voice/video calls, and Circle calls all work identically on either provider — hosts publish, viewers subscribe, screen share and camera flip are supported on both.

### Admin System Health monitoring (optional)

The Admin Dashboard → **System Health** tab pulls live usage from external services entirely server-side. Each source is optional and only appears once its keys are configured:

\`\`\`env
# Supabase Management API personal access token (Settings → Access Tokens).
# Needs analytics_usage_read permission. Enables DB size, egress, Realtime
# connections, and edge function invocation monitoring against free-tier limits.
SUPABASE_ACCESS_TOKEN=your_supabase_pat

# Vercel deployment status (optional) — create a token at vercel.com/account/tokens
VERCEL_TOKEN=your_vercel_token
VERCEL_PROJECT_ID=your_vercel_project_id
VERCEL_TEAM_ID=your_vercel_team_id

# Render deployment status (optional)
RENDER_API_KEY=your_render_api_key
RENDER_SERVICE_ID=your_render_service_id
\`\`\`

Cloudinary usage monitoring reuses the existing `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` keys. The panel is read-only — it never modifies providers. A warning banner appears when any metric reaches 80% of its limit.

## 🏗 Architecture

### Tree Structure Implementation
Loops use a parent-child relationship to create trees:
\`\`\`typescript
interface Loop {
  id: string
  parent_loop_id?: string  // null for root loops
  author_id: string
  content: LoopContent
  tree_depth: number       // 0 for root, 1 for first branch, etc.
  branches: Loop[]         // Populated via joins
}
\`\`\`

### Real-time Features
- **Socket.io** for live messaging
- **Supabase Realtime** for loop updates
- **Optimistic updates** for better UX

### Premium System
- **Loop Coins** virtual currency
- **Stripe** integration for purchases
- **Feature gating** based on subscription status

## 🎨 UI/UX Features

### Responsive Design
- Mobile-first approach
- Tablet and desktop optimized
- Touch-friendly interactions

### Animations
- CSS animations for tree growth
- Smooth transitions
- Loading states

### Accessibility
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- High contrast mode

## 🔧 API Design

### REST Endpoints
\`\`\`typescript
// Authentication
POST /api/auth/login          // User login
POST /api/auth/signup         // User registration

// Loops (Content)
GET  /api/loops              // Fetch loops feed
POST /api/loops              // Create new loop
POST /api/loops/branch       // Create branch from existing loop
GET  /api/loops/[id]/comments // Get loop comments
POST /api/loops/[id]/comments // Add comment to loop

// Circles (Communities)
GET  /api/circles            // Fetch circles
POST /api/circles            // Create new circle
POST /api/circles/[id]/join   // Join/leave circle
GET  /api/circles/[id]/members // Get circle members

// Shop & Inventory
GET  /api/shop/items          // Fetch shop items
POST /api/shop/purchase        // Purchase item
GET  /api/inventory           // Get user inventory
POST /api/inventory/apply      // Apply inventory item
POST /api/inventory/remove     // Remove inventory item

// Messages
GET  /api/messages            // Fetch messages
POST /api/messages            // Send message
GET  /api/conversations       // Get conversations
\`\`\`

### Real-time Events
\`\`\`typescript
// Socket.io events
socket.on('loop:created', (loop) => {})
socket.on('loop:branched', (branch) => {})
socket.on('message:received', (message) => {})
socket.on('user:typing', (data) => {})
\`\`\`

## 🧪 Testing

### Test Coverage
- Unit tests for utilities
- Component tests with React Testing Library
- Integration tests for API routes
- E2E tests with Playwright

### Running Tests
\`\`\`bash
npm run test           # Unit tests
npm run test:e2e       # End-to-end tests
npm run test:coverage  # Coverage report
\`\`\`

## 🚀 Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy with automatic CI/CD

### Database Setup
1. Create a new Supabase project
2. Run the database schema
3. Configure RLS policies
4. Set up authentication providers

### Cron Jobs
Set up a cron job to run weekly coin distribution:
\`\`\`bash
# Add to your cron service (Vercel Cron, GitHub Actions, etc.)
curl -X POST https://your-domain.com/api/users/coins/weekly \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
\`\`\`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [Supabase](https://supabase.com/) for the backend infrastructure
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Cloudinary](https://cloudinary.com/) for media management
- [Stripe](https://stripe.com/) for payment processing

## 📞 Support

For support, email support@loop-platform.com or join our Discord community.

---

**Built with ❤️ by the Loop Team**

