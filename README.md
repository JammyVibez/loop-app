# Loop - Social Storytelling Platform

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
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for components
- **Framer Motion** for animations

### Backend Architecture
- **PostgreSQL** database with tree structures
- **Supabase** for authentication and real-time
- **Socket.io** server for live collaboration
- **Stripe** for premium subscriptions
- **UploadThing/Supabase Storage** for media

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
# Copy the contents of scripts/complete-database-schema.sql
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
\`\`\`

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
POST /api/auth/logout         // User logout

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
