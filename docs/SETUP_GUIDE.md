# Loop Social Platform - Complete Setup Guide

This guide will walk you through setting up the Loop Social Platform with all its features including live streaming, reels, gifting, and earnings management.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Third-Party Services](#third-party-services)
5. [Installation](#installation)
6. [Running the Application](#running-the-application)
7. [Live Streaming Setup](#live-streaming-setup)
8. [API Keys Configuration](#api-keys-configuration)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git**
- **Supabase CLI** (optional but recommended)

## Environment Setup

1. **Clone the repository:**
\`\`\`bash
git clone <your-repo-url>
cd loop-social-platform
\`\`\`

2. **Install dependencies:**
\`\`\`bash
npm install
# or
yarn install
\`\`\`

3. **Create environment file:**
\`\`\`bash
cp .env.local.example .env.local
\`\`\`

4. **Configure environment variables in `.env.local`:**

\`\`\`env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cloudinary Configuration (for file uploads)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_UPLOAD_PRESET=your_upload_preset_name

# Stripe Configuration (for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# JWT Secret (for authentication)
JWT_SECRET=your_super_secret_jwt_key

# Live Streaming Configuration
RTMP_SERVER_URL=rtmp://your-streaming-server.com/live
HLS_SERVER_URL=https://your-streaming-server.com/hls

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron Job Secret (for weekly coin distribution)
CRON_SECRET=your_random_cron_secret
\`\`\`

## Database Setup

### 1. Create Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to be fully initialized
3. Go to Settings > API to get your keys
4. Update your `.env.local` file with the Supabase URL and keys

### 2. Run Database Migrations

1. **Using Supabase Dashboard:**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy the contents of `scripts/database-migrations.sql`
   - Paste and run the SQL commands

2. **Using Supabase CLI (Alternative):**
\`\`\`bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
\`\`\`

### 3. Verify Database Setup

After running migrations, verify these tables exist:
- `profiles` (updated with new fields)
- `live_streams`
- `stream_viewers`
- `stream_chat`
- `gifts`
- `gift_transactions`
- `earnings`
- `withdrawals`
- `reels`
- `reel_interactions`

## Third-Party Services

### 1. Cloudinary Setup (File Uploads)

1. **Create Cloudinary Account:**
   - Go to [Cloudinary](https://cloudinary.com)
   - Sign up for a free account
   - Get your Cloud Name, API Key, and API Secret

2. **Create Upload Preset:**
   - Go to Settings > Upload
   - Create a new upload preset
   - Set it to "Unsigned" for easier integration
   - Configure folder structure and transformations

3. **Update Environment Variables:**
\`\`\`env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_PRESET=your_preset_name
\`\`\`

### 2. Stripe Setup (Payments)

1. **Create Stripe Account:**
   - Go to [Stripe](https://stripe.com)
   - Create an account and verify it

2. **Get API Keys:**
   - Go to Developers > API Keys
   - Copy Publishable Key and Secret Key
   - For webhooks, go to Developers > Webhooks

3. **Configure Webhooks:**
   - Add endpoint: `https://yourdomain.com/api/payments/webhook`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`

### 3. Live Streaming Setup

For live streaming, you have several options:

#### Option A: AWS IVS (Recommended for Production)

1. **Create AWS Account and IVS Channel:**
\`\`\`bash
# Install AWS CLI
aws configure

# Create IVS channel
aws ivs create-channel --name "loop-streams" --type STANDARD
\`\`\`

2. **Update Environment Variables:**
\`\`\`env
RTMP_SERVER_URL=rtmp://your-ivs-ingest-endpoint/live
HLS_SERVER_URL=https://your-ivs-playback-url
\`\`\`

#### Option B: Simple RTMP Server (Development)

1. **Install Node Media Server:**
\`\`\`bash
npm install node-media-server
\`\`\`

2. **Create streaming server (`server/streaming.js`):**
\`\`\`javascript
const NodeMediaServer = require('node-media-server');

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*'
  }
};

const nms = new NodeMediaServer(config);
nms.run();
\`\`\`

3. **Run the streaming server:**
\`\`\`bash
node server/streaming.js
\`\`\`

#### Option C: Third-Party Services

- **Agora.io**: Real-time video streaming
- **Twilio Video**: Video communication platform
- **Mux**: Video streaming infrastructure

## Installation

1. **Install all dependencies:**
\`\`\`bash
npm install
\`\`\`

2. **Install additional streaming dependencies:**
\`\`\`bash
npm install simple-peer socket.io
\`\`\`

3. **Build the application:**
\`\`\`bash
npm run build
\`\`\`

## Running the Application

### Development Mode

\`\`\`bash
npm run dev
\`\`\`

The application will be available at `http://localhost:3000`

### Production Mode

\`\`\`bash
npm run build
npm start
\`\`\`

### With Docker (Optional)

\`\`\`bash
# Build Docker image
docker build -t loop-social-platform .

# Run container
docker run -p 3000:3000 --env-file .env.local loop-social-platform
\`\`\`

## API Keys Configuration

### Required API Keys Summary

| Service | Purpose | Required For |
|---------|---------|--------------|
| Supabase | Database & Auth | Core functionality |
| Cloudinary | File uploads | Profile pictures, banners, media |
| Stripe | Payments | Premium subscriptions, coin purchases |
| AWS IVS | Live streaming | Live streaming feature |
| JWT Secret | Authentication | User sessions |

### Optional API Keys

| Service | Purpose | Setup Guide |
|---------|---------|-------------|
| SendGrid | Email notifications | [SendGrid Setup](https://sendgrid.com) |
| Pusher | Real-time notifications | [Pusher Setup](https://pusher.com) |
| Google Analytics | Analytics | [GA4 Setup](https://analytics.google.com) |

## Live Streaming Configuration

### 1. Streaming Server Setup

Choose one of the following options:

#### AWS IVS (Production Recommended)
\`\`\`env
RTMP_SERVER_URL=rtmp://your-ivs-endpoint.global-contribute.live-video.net/live
HLS_SERVER_URL=https://your-ivs-endpoint.us-west-2.playback.live-video.net/api/video/v1/us-west-2.channel.your-channel-id.m3u8
\`\`\`

#### Local RTMP Server (Development)
\`\`\`env
RTMP_SERVER_URL=rtmp://localhost:1935/live
HLS_SERVER_URL=http://localhost:8000/live
\`\`\`

### 2. OBS Studio Configuration

For streamers using OBS Studio:

1. **Server:** Use the RTMP URL from your environment
2. **Stream Key:** Generated per stream in the application
3. **Video Settings:**
   - Resolution: 1920x1080 or 1280x720
   - FPS: 30 or 60
   - Bitrate: 2500-6000 kbps

### 3. Mobile Streaming

For mobile streaming integration:
- iOS: Use `react-native-nodemediaclient`
- Android: Use `react-native-nodemediaclient`
- Web: Use WebRTC with `simple-peer`

## Database Schema Overview

### Core Tables

1. **profiles** - User profiles with earnings and streaming capabilities
2. **live_streams** - Live streaming sessions
3. **reels** - Short-form video content
4. **gifts** - Virtual gifts for monetization
5. **earnings** - User earnings tracking
6. **withdrawals** - Withdrawal requests

### Key Relationships

\`\`\`
profiles (1) -> (many) live_streams
profiles (1) -> (many) reels
profiles (1) -> (many) earnings
live_streams (1) -> (many) stream_viewers
live_streams (1) -> (many) stream_chat
gifts (1) -> (many) gift_transactions
\`\`\`

## Troubleshooting

### Common Issues

1. **Database Connection Issues:**
\`\`\`bash
# Check Supabase connection
curl -H "apikey: YOUR_ANON_KEY" https://your-project.supabase.co/rest/v1/profiles
\`\`\`

2. **File Upload Issues:**
\`\`\`bash
# Test Cloudinary connection
curl -X POST "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload" \
  -F "upload_preset=YOUR_PRESET" \
  -F "file=@test-image.jpg"
\`\`\`

3. **Streaming Issues:**
   - Check RTMP server is running
   - Verify firewall settings (port 1935 for RTMP)
   - Test with OBS Studio or similar software

4. **Build Issues:**
\`\`\`bash
# Clear Next.js cache
rm -rf .next
npm run build
\`\`\`

### Environment Variables Checklist

- [ ] Supabase URL and keys configured
- [ ] Cloudinary credentials set
- [ ] Stripe keys configured
- [ ] JWT secret generated
- [ ] Streaming server URLs set
- [ ] App URL configured

### Performance Optimization

1. **Database Indexes:** Ensure all indexes from migration are created
2. **CDN Setup:** Configure Cloudinary for global delivery
3. **Caching:** Implement Redis for session management
4. **Monitoring:** Set up error tracking with Sentry

## Next Steps

After setup:

1. **Create Admin User:** Use Supabase dashboard to set `is_admin = true`
2. **Configure Gifts:** Add custom gifts through admin panel
3. **Test Streaming:** Create test stream and verify functionality
4. **Set Up Monitoring:** Configure logging and error tracking
5. **Deploy:** Deploy to Vercel, Netlify, or your preferred platform

## Support

For issues and questions:
- Check the [API Documentation](./API_DOCUMENTATION.md)
- Review the [Troubleshooting](#troubleshooting) section
- Create an issue in the repository

## Security Considerations

1. **Environment Variables:** Never commit `.env.local` to version control
2. **API Keys:** Use different keys for development and production
3. **Database Security:** Enable Row Level Security (RLS) policies
4. **HTTPS:** Always use HTTPS in production
5. **Rate Limiting:** Implement rate limiting for API endpoints

---

**Last Updated:** January 2024
**Version:** 1.0.0
