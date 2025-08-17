# Complete Implementation Guide - Loop Social Platform

## 📋 Table of Contents
1. [Database Setup](#database-setup)
2. [Asset Management](#asset-management)
3. [Environment Configuration](#environment-configuration)
4. [API Endpoints](#api-endpoints)
5. [File Structure](#file-structure)
6. [Step-by-Step Implementation](#step-by-step-implementation)
7. [Testing Guide](#testing-guide)
8. [Deployment Checklist](#deployment-checklist)

## 🗄️ Database Setup

### Step 1: Run Database Schema Scripts

Execute these SQL scripts in your Supabase SQL editor in this exact order:

#### 1. Enhanced Database Schema (Part 1)
\`\`\`sql
-- Run this first: scripts/enhanced-database-schema-part2.sql
-- This creates the basic tables for gifts, shop items, and themes
\`\`\`

#### 2. Enhanced Database Schema (Part 2)
\`\`\`sql
-- Run this second: scripts/enhanced-database-schema-part3.sql
-- This adds additional tables for calls, notifications, and analytics
\`\`\`

#### 3. RLS Policies
\`\`\`sql
-- Run this third: scripts/rls-policies.sql
-- This sets up Row Level Security for all tables
\`\`\`

#### 4. Database Functions
\`\`\`sql
-- Run this last: scripts/enhanced-database-functions.sql
-- This creates stored procedures and triggers
\`\`\`

### Step 2: Additional Required Tables

Run this SQL to create the missing tables for the new features:

\`\`\`sql
-- Shop Items Table
CREATE TABLE IF NOT EXISTS shop_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price INTEGER DEFAULT 0,
    price_coins INTEGER,
    price_usd DECIMAL(10,2),
    category VARCHAR(50) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common',
    premium_only BOOLEAN DEFAULT false,
    item_data JSONB DEFAULT '{}',
    preview_data JSONB DEFAULT '{}',
    image_url TEXT,
    animation_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Inventory Table
CREATE TABLE IF NOT EXISTS user_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES shop_items(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    is_equipped BOOLEAN DEFAULT false,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- Gift Transactions Table
CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    gift_id UUID REFERENCES shop_items(id) ON DELETE CASCADE,
    message TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    context VARCHAR(50),
    context_id UUID,
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video Calls Table
CREATE TABLE IF NOT EXISTS video_calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    caller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    callee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    call_type VARCHAR(10) NOT NULL CHECK (call_type IN ('video', 'audio')),
    status VARCHAR(20) DEFAULT 'initiated',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER DEFAULT 0,
    call_data JSONB DEFAULT '{}'
);

-- User Themes Table
CREATE TABLE IF NOT EXISTS user_themes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    theme_id VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, theme_id)
);

-- Admin Settings Table
CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Shop items are viewable by everyone" ON shop_items FOR SELECT USING (is_active = true);
CREATE POLICY "Users can view their own inventory" ON user_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view gifts they sent or received" ON gift_transactions FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users can view their own calls" ON video_calls FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = callee_id);
CREATE POLICY "Users can view their own themes" ON user_themes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Only admins can view settings" ON admin_settings FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
\`\`\`

### Step 3: Insert Default Shop Items

\`\`\`sql
-- Insert Dragon Theme Items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, premium_only, item_data, preview_data, animation_url) VALUES
('Baby Dragon', 'A cute baby dragon companion', 300, 'animation', 'companion', 'rare', false, '{"effects": ["follows_cursor", "breathing_animation"]}', '{"preview": "🐉"}', '/assets/gifts/dragons/baby-dragon.gif'),
('Dragon Egg', 'Mysterious dragon egg that hatches over time', 150, 'animation', 'interactive', 'common', false, '{"effects": ["glowing", "hatching_timer"]}', '{"preview": "🥚"}', '/assets/gifts/dragons/dragon-egg.gif'),
('Fire Breath', 'Breathe fire across your profile', 500, 'animation', 'effect', 'epic', true, '{"effects": ["screen_fire", "burn_effect"]}', '{"preview": "🔥"}', '/assets/gifts/dragons/fire-breath.gif'),
('Dragon Wings', 'Majestic dragon wings for your avatar', 400, 'animation', 'avatar', 'epic', true, '{"effects": ["wing_flap", "wind_particles"]}', '{"preview": "🪶"}', '/assets/gifts/dragons/dragon-wings.gif'),
('Ancient Dragon', 'Legendary ancient dragon guardian', 1000, 'animation', 'legendary', 'legendary', true, '{"effects": ["screen_takeover", "roar_sound", "treasure_rain"]}', '{"preview": "🐲"}', '/assets/gifts/dragons/ancient-dragon.gif');

-- Insert Forest Theme Items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, premium_only, item_data, preview_data, animation_url) VALUES
('Growing Tree', 'A magical tree that grows on your profile', 250, 'animation', 'decoration', 'rare', false, '{"effects": ["growth_animation", "seasonal_changes"]}', '{"preview": "🌳"}', '/assets/gifts/forest/growing-tree.gif'),
('Forest Sprite', 'A playful forest sprite companion', 200, 'animation', 'companion', 'rare', false, '{"effects": ["flying_animation", "sparkle_trail"]}', '{"preview": "🧚"}', '/assets/gifts/forest/forest-sprite.gif'),
('Flower Bloom', 'Beautiful flowers that bloom across your profile', 150, 'animation', 'effect', 'common', false, '{"effects": ["blooming_animation", "petal_fall"]}', '{"preview": "🌸"}', '/assets/gifts/forest/flower-bloom.gif'),
('Ancient Oak', 'Majestic ancient oak tree guardian', 500, 'animation', 'guardian', 'epic', true, '{"effects": ["wisdom_aura", "bird_nests", "seasonal_foliage"]}', '{"preview": "🌲"}', '/assets/gifts/forest/ancient-oak.gif'),
('Nature Crown', 'Crown of leaves and flowers for your avatar', 300, 'animation', 'avatar', 'epic', true, '{"effects": ["leaf_crown", "flower_petals", "nature_blessing"]}', '{"preview": "👑"}', '/assets/gifts/forest/nature-crown.gif'),
('World Tree', 'Legendary world tree that connects all life', 800, 'animation', 'legendary', 'legendary', true, '{"effects": ["screen_takeover", "life_energy", "cosmic_connection"]}', '{"preview": "🌍"}', '/assets/gifts/forest/world-tree.gif');

-- Insert Special Items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, premium_only, item_data, preview_data, animation_url) VALUES
('100 Loop Coins', 'Gift 100 Loop Coins', 50, 'coins', 'currency', 'common', false, '{"coin_amount": 100}', '{"preview": "💰"}', NULL),
('500 Loop Coins', 'Gift 500 Loop Coins', 200, 'coins', 'currency', 'rare', false, '{"coin_amount": 500}', '{"preview": "💰"}', NULL),
('Birthday Cake', 'Special birthday celebration gift', 100, 'special', 'celebration', 'common', false, '{"occasion": "birthday"}', '{"preview": "🎂"}', '/assets/gifts/special/birthday-cake.gif'),
('Diamond Ring', 'Luxury diamond ring gift', 1000, 'special', 'luxury', 'legendary', true, '{"luxury_tier": "diamond"}', '{"preview": "💎"}', '/assets/gifts/special/diamond-ring.gif');

-- Insert Premium Items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, premium_only, item_data, preview_data) VALUES
('Premium Month', 'Gift 1 month of Loop Premium', 500, 'premium', 'subscription', 'epic', false, '{"duration": "1 month"}', '{"preview": "👑"}'),
('Premium Year', 'Gift 1 year of Loop Premium', 5000, 'premium', 'subscription', 'legendary', false, '{"duration": "1 year"}', '{"preview": "👑"}');
\`\`\`

## 🖼️ Asset Management

### Step 1: Create Asset Directory Structure

Create these folders in your `public` directory:

\`\`\`
public/
├── assets/
│   └── gifts/
│       ├── dragons/
│       ├── forest/
│       ├── special/
│       └── premium/
├── icons/
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png
│   ├── icon-384x384.png
│   └── icon-512x512.png
└── sounds/
    ├── dragon/
    └── forest/
\`\`\`

### Step 2: Required GIF Assets

You need to create or source these animated GIFs:

#### Dragon Theme GIFs (128x128px recommended):
1. **baby-dragon.gif** - Small cute dragon with breathing animation
2. **dragon-egg.gif** - Glowing egg with crack animations
3. **fire-breath.gif** - Fire breathing effect (256x128px)
4. **dragon-wings.gif** - Animated wings (192x192px)
5. **ancient-dragon.gif** - Large majestic dragon (512x512px)

#### Forest Theme GIFs:
1. **growing-tree.gif** - Tree growing from seed to full size (128x192px)
2. **forest-sprite.gif** - Small fairy-like creature flying (96x96px)
3. **flower-bloom.gif** - Flowers blooming animation (128x128px)
4. **ancient-oak.gif** - Large oak tree with swaying branches (256x384px)
5. **nature-crown.gif** - Crown with leaves and flowers (128x64px)
6. **world-tree.gif** - Cosmic tree with energy effects (512x768px)

#### Special GIFs:
1. **birthday-cake.gif** - Cake with candles and sparkles (128x128px)
2. **diamond-ring.gif** - Sparkling diamond ring (96x96px)
3. **floating-heart.gif** - Heart floating upward (64x64px)

### Step 3: PWA Icons

Create app icons in these sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

Use your Loop logo with proper padding and background.

### Step 4: Sound Assets (Optional)

Create these sound files:
- `/sounds/dragon/roar-short.mp3` - Short dragon roar
- `/sounds/dragon/wing-flap.mp3` - Wing flapping sound
- `/sounds/forest/leaf-rustle.mp3` - Leaves rustling
- `/sounds/forest/bird-chirp.mp3` - Bird chirping

## 🔧 Environment Configuration

### Step 1: Update `.env.local`

\`\`\`env
# Existing variables
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# New variables for enhanced features
NEXT_PUBLIC_CDN_URL=https://your-domain.com/assets/gifts
NEXT_PUBLIC_APP_URL=https://your-domain.com
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
\`\`\`

### Step 2: Update `package.json`

Add these dependencies:

\`\`\`json
{
  "dependencies": {
    "simple-peer": "^9.11.1",
    "peer": "^1.0.2",
    "cloudinary": "^1.41.3",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/multer": "^1.4.11",
    "@types/uuid": "^9.0.7"
  }
}
\`\`\`

## 🔌 API Endpoints

### Step 1: Create Missing API Routes

#### `/api/gifts/send/route.ts`
\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { recipient_id, gift_id, message, is_anonymous, context, context_id } = await request.json()
    const supabase = createClient()
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    // Get gift item details
    const { data: giftItem, error: giftError } = await supabase
      .from('shop_items')
      .select('*')
      .eq('id', gift_id)
      .single()

    if (giftError || !giftItem) {
      return NextResponse.json({ success: false, error: 'Gift not found' }, { status: 404 })
    }

    // Check user's coin balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('loop_coins')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    if (profile.loop_coins < giftItem.price_coins) {
      return NextResponse.json({ success: false, error: 'Insufficient coins' }, { status: 400 })
    }

    // Deduct coins from sender
    const { error: deductError } = await supabase
      .from('profiles')
      .update({ loop_coins: profile.loop_coins - giftItem.price_coins })
      .eq('id', user.id)

    if (deductError) {
      return NextResponse.json({ success: false, error: 'Failed to deduct coins' }, { status: 500 })
    }

    // Add gift to recipient's inventory
    const { error: inventoryError } = await supabase
      .from('user_inventory')
      .upsert({
        user_id: recipient_id,
        item_id: gift_id,
        quantity: 1
      })

    if (inventoryError) {
      return NextResponse.json({ success: false, error: 'Failed to add to inventory' }, { status: 500 })
    }

    // Record gift transaction
    const { error: transactionError } = await supabase
      .from('gift_transactions')
      .insert({
        sender_id: user.id,
        recipient_id,
        gift_id,
        message,
        is_anonymous,
        context,
        context_id
      })

    if (transactionError) {
      return NextResponse.json({ success: false, error: 'Failed to record transaction' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Gift send error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
\`\`\`

#### `/api/shop/items/route.ts`
\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { data: items, error } = await supabase
      .from('shop_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('Shop items error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
\`\`\`

#### `/api/shop/purchase/route.ts`
\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { item_id, payment_method } = await request.json()
    const supabase = createClient()
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    // Get item details
    const { data: item, error: itemError } = await supabase
      .from('shop_items')
      .select('*')
      .eq('id', item_id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 })
    }

    if (payment_method === 'coins') {
      // Handle coin payment
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('loop_coins')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
      }

      if (profile.loop_coins < item.price_coins) {
        return NextResponse.json({ success: false, error: 'Insufficient coins' }, { status: 400 })
      }

      // Deduct coins
      const { error: deductError } = await supabase
        .from('profiles')
        .update({ loop_coins: profile.loop_coins - item.price_coins })
        .eq('id', user.id)

      if (deductError) {
        return NextResponse.json({ success: false, error: 'Failed to deduct coins' }, { status: 500 })
      }

      // Add to inventory
      const { error: inventoryError } = await supabase
        .from('user_inventory')
        .upsert({
          user_id: user.id,
          item_id: item_id,
          quantity: 1
        })

      if (inventoryError) {
        return NextResponse.json({ success: false, error: 'Failed to add to inventory' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    } else {
      // Handle Stripe payment (implement as needed)
      return NextResponse.json({ success: false, error: 'Stripe payment not implemented' }, { status: 501 })
    }
  } catch (error) {
    console.error('Purchase error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
\`\`\`

#### `/api/admin/shop-items/route.ts`
\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check admin permissions
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const { data: items, error } = await supabase
      .from('shop_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('Admin shop items error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const itemData = await request.json()
    const supabase = createClient()
    
    // Check admin permissions (same as GET)
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const { data: item, error } = await supabase
      .from('shop_items')
      .insert(itemData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error('Create shop item error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
\`\`\`

## 📁 File Structure

Your project should have this structure:

\`\`\`
loop-social-platform/
├── app/
│   ├── page.tsx (✅ Updated with PWA prompt)
│   ├── layout.tsx (✅ Already has PWA meta tags)
│   └── api/
│       ├── gifts/
│       │   └── send/
│       │       └── route.ts (❌ Create this)
│       ├── shop/
│       │   ├── items/
│       │   │   └── route.ts (❌ Create this)
│       │   └── purchase/
│       │       └── route.ts (❌ Create this)
│       └── admin/
│           └── shop-items/
│               └── route.ts (❌ Create this)
├── components/
│   ├── pwa/
│   │   └── pwa-install-prompt.tsx (✅ Created)
│   ├── calls/
│   │   └── video-call-modal.tsx (✅ Created)
│   ├── gifting/
│   │   └── enhanced-gift-system.tsx (✅ Created)
│   ├── admin/
│   │   └── enhanced-admin-dashboard.tsx (✅ Created)
│   └── messages/
│       └── enhanced-chat-window.tsx (✅ Updated responsive)
├── lib/
│   ├── cdn/
│   │   └── gift-assets-manager.ts (✅ Created)
│   └── theming/
│       └── themes/
│           ├── dragon-lord-theme.ts (✅ Created)
│           └── forest-guardian-theme.ts (✅ Created)
├── public/
│   ├── manifest.json (✅ Created)
│   ├── sw.js (✅ Created)
│   ├── assets/
│   │   └── gifts/ (❌ Create and add GIFs)
│   └── icons/ (❌ Create and add PWA icons)
└── next.config.js (✅ Created)
\`\`\`

## 🚀 Step-by-Step Implementation

### Step 1: Database Setup (30 minutes)
1. Open your Supabase SQL editor
2. Run the database schema scripts in order
3. Run the additional tables SQL from this guide
4. Insert the default shop items
5. Verify all tables are created with `SELECT * FROM shop_items;`

### Step 2: Environment Setup (10 minutes)
1. Update your `.env.local` file
2. Install new dependencies: `npm install simple-peer peer cloudinary multer uuid`
3. Install dev dependencies: `npm install -D @types/multer @types/uuid`

### Step 3: API Routes (45 minutes)
1. Create the missing API route files
2. Copy the provided code for each route
3. Test each endpoint with a tool like Postman

### Step 4: Asset Preparation (60 minutes)
1. Create the folder structure in `public/`
2. Generate or source the required GIF files
3. Create PWA icons in all required sizes
4. Upload assets to your CDN or place in public folder

### Step 5: Component Integration (30 minutes)
1. Import and use the new components in your pages
2. Update existing components to use the new features
3. Test the PWA install prompt

### Step 6: Testing (45 minutes)
1. Test PWA functionality
2. Test gift purchasing and sending
3. Test video call interface
4. Test admin dashboard
5. Test responsive design on mobile

## 🧪 Testing Guide

### PWA Testing
1. Open your app in Chrome
2. Check for install prompt after 3 seconds
3. Install the app and verify it works offline
4. Test push notifications

### Gift System Testing
1. Add coins to a test user account
2. Purchase a gift from the shop
3. Send the gift to another user
4. Verify the gift appears in recipient's inventory

### Video Call Testing
1. Open two browser windows with different users
2. Initiate a video call
3. Test mute, video toggle, and chat features
4. End the call and verify duration tracking

### Admin Testing
1. Set a user as admin in the database: `UPDATE profiles SET is_admin = true WHERE id = 'user-id';`
2. Access the admin dashboard
3. Create a new shop item
4. Manage users and view analytics

## 📦 Deployment Checklist

### Pre-deployment
- [ ] All database scripts executed
- [ ] All API routes created and tested
- [ ] All assets uploaded to CDN
- [ ] Environment variables configured
- [ ] PWA icons generated
- [ ] Service worker tested

### Play Store Preparation
- [ ] App icons in all sizes (72px to 512px)
- [ ] App screenshots for store listing
- [ ] PWA install flow tested
- [ ] Offline functionality verified
- [ ] Performance optimized

### Final Steps
- [ ] Deploy to production
- [ ] Test PWA installation on mobile
- [ ] Verify all features work in production
- [ ] Submit to Play Store (if desired)

## 🎯 Quick Start Commands

\`\`\`bash
# Install dependencies
npm install simple-peer peer cloudinary multer uuid
npm install -D @types/multer @types/uuid

# Create required directories
mkdir -p public/assets/gifts/{dragons,forest,special,premium}
mkdir -p public/icons
mkdir -p public/sounds/{dragon,forest}

# Start development server
npm run dev
\`\`\`

## 🆘 Troubl
