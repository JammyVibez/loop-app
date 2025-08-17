# Gamification System Implementation Plan

## Overview
This document outlines the implementation of a comprehensive gamification system featuring XP points, user levels, achievements, skill trees, and reward mechanisms to enhance user engagement and retention.

## Core Components

### 1. XP (Experience Points) System

#### XP Sources and Values
\`\`\`typescript
const XP_REWARDS = {
  // Content Creation
  CREATE_LOOP: 10,
  CREATE_BRANCH: 15,
  UPLOAD_MEDIA: 20,
  ADD_HASHTAGS: 5,
  
  // Social Interactions
  RECEIVE_LIKE: 2,
  RECEIVE_COMMENT: 5,
  RECEIVE_BRANCH: 8,
  GIVE_LIKE: 1,
  GIVE_COMMENT: 3,
  
  // Community Engagement
  JOIN_CIRCLE: 25,
  CREATE_CIRCLE: 50,
  MODERATE_CIRCLE: 10,
  HOST_EVENT: 100,
  
  // Platform Milestones
  FIRST_LOOP: 50,
  FIRST_FOLLOWER: 25,
  REACH_100_FOLLOWERS: 200,
  REACH_1000_FOLLOWERS: 1000,
  
  // Daily Activities
  DAILY_LOGIN: 5,
  DAILY_STREAK_BONUS: 10, // Multiplier based on streak
  COMPLETE_PROFILE: 100,
  
  // Premium Actions
  PURCHASE_THEME: 30,
  GIFT_ITEM: 20,
  SUPPORT_CREATOR: 15,
  
  // Special Events
  PARTICIPATE_IN_CHALLENGE: 75,
  WIN_CHALLENGE: 300,
  FEATURED_CONTENT: 500,
};
\`\`\`

#### Level Calculation System
\`\`\`typescript
interface UserLevel {
  level: number;
  current_xp: number;
  xp_for_next_level: number;
  total_xp_required: number;
  level_benefits: LevelBenefit[];
}

// Exponential XP curve: XP = 100 * (level^1.5)
function calculateXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function calculateUserLevel(totalXP: number): UserLevel {
  let level = 1;
  let xpRequired = 0;
  
  while (xpRequired <= totalXP) {
    level++;
    xpRequired += calculateXPForLevel(level);
  }
  
  level--; // Adjust for overshoot
  const currentLevelXP = totalXP - (xpRequired - calculateXPForLevel(level + 1));
  const xpForNext = calculateXPForLevel(level + 1) - currentLevelXP;
  
  return {
    level,
    current_xp: currentLevelXP,
    xp_for_next_level: xpForNext,
    total_xp_required: xpRequired,
    level_benefits: getLevelBenefits(level)
  };
}
\`\`\`

### 2. Achievement System

#### Achievement Categories
\`\`\`typescript
enum AchievementCategory {
  SOCIAL = 'social',
  CONTENT = 'content',
  ENGAGEMENT = 'engagement',
  COMMUNITY = 'community',
  SPECIAL = 'special',
  MILESTONE = 'milestone'
}

enum AchievementRarity {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}
\`\`\`

#### Core Achievements
\`\`\`typescript
const ACHIEVEMENTS = [
  // Social Achievements
  {
    id: 'first_follower',
    name: 'Breaking the Ice',
    description: 'Get your first follower',
    category: AchievementCategory.SOCIAL,
    rarity: AchievementRarity.COMMON,
    xp_reward: 50,
    icon: '👋',
    requirements: { followers_count: 1 }
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Follow 100 users',
    category: AchievementCategory.SOCIAL,
    rarity: AchievementRarity.RARE,
    xp_reward: 200,
    icon: '🦋',
    requirements: { following_count: 100 }
  },
  
  // Content Achievements
  {
    id: 'first_loop',
    name: 'Loop Pioneer',
    description: 'Create your first loop',
    category: AchievementCategory.CONTENT,
    rarity: AchievementRarity.COMMON,
    xp_reward: 100,
    icon: '🌱',
    requirements: { loops_created: 1 }
  },
  {
    id: 'viral_loop',
    name: 'Viral Sensation',
    description: 'Create a loop with 1000+ likes',
    category: AchievementCategory.CONTENT,
    rarity: AchievementRarity.EPIC,
    xp_reward: 1000,
    icon: '🔥',
    requirements: { single_loop_likes: 1000 }
  },
  
  // Engagement Achievements
  {
    id: 'conversation_starter',
    name: 'Conversation Starter',
    description: 'Receive 100 comments on your loops',
    category: AchievementCategory.ENGAGEMENT,
    rarity: AchievementRarity.RARE,
    xp_reward: 300,
    icon: '💬',
    requirements: { total_comments_received: 100 }
  },
  
  // Community Achievements
  {
    id: 'circle_creator',
    name: 'Community Builder',
    description: 'Create your first circle',
    category: AchievementCategory.COMMUNITY,
    rarity: AchievementRarity.RARE,
    xp_reward: 250,
    icon: '🏗️',
    requirements: { circles_created: 1 }
  },
  
  // Special Achievements
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Join during beta period',
    category: AchievementCategory.SPECIAL,
    rarity: AchievementRarity.LEGENDARY,
    xp_reward: 2000,
    icon: '🚀',
    requirements: { joined_before: '2024-12-31' }
  },
  
  // Milestone Achievements
  {
    id: 'level_10',
    name: 'Rising Star',
    description: 'Reach level 10',
    category: AchievementCategory.MILESTONE,
    rarity: AchievementRarity.RARE,
    xp_reward: 500,
    icon: '⭐',
    requirements: { level: 10 }
  }
];
\`\`\`

### 3. Skill Trees System

#### Skill Tree Categories
\`\`\`typescript
enum SkillTreeCategory {
  CREATOR = 'creator',
  SOCIAL = 'social',
  TECHNICAL = 'technical',
  COMMUNITY = 'community'
}

interface SkillNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number; // Skill points required
  prerequisites: string[]; // Required node IDs
  benefits: SkillBenefit[];
  position: { x: number; y: number }; // For 3D visualization
}

interface SkillBenefit {
  type: 'xp_multiplier' | 'coin_bonus' | 'feature_unlock' | 'cosmetic';
  value: number | string;
  description: string;
}
\`\`\`

#### Creator Skill Tree
\`\`\`typescript
const CREATOR_SKILL_TREE: SkillNode[] = [
  {
    id: 'content_basics',
    name: 'Content Basics',
    description: 'Learn the fundamentals of content creation',
    icon: '📝',
    cost: 1,
    prerequisites: [],
    benefits: [
      { type: 'xp_multiplier', value: 1.1, description: '+10% XP from content creation' }
    ],
    position: { x: 0, y: 0 }
  },
  {
    id: 'visual_storytelling',
    name: 'Visual Storytelling',
    description: 'Master the art of visual content',
    icon: '🎨',
    cost: 2,
    prerequisites: ['content_basics'],
    benefits: [
      { type: 'feature_unlock', value: 'advanced_media_tools', description: 'Unlock advanced media editing tools' },
      { type: 'xp_multiplier', value: 1.2, description: '+20% XP from media posts' }
    ],
    position: { x: -1, y: 1 }
  },
  {
    id: 'viral_mechanics',
    name: 'Viral Mechanics',
    description: 'Understand what makes content go viral',
    icon: '🚀',
    cost: 3,
    prerequisites: ['content_basics'],
    benefits: [
      { type: 'feature_unlock', value: 'trending_insights', description: 'Access trending topic insights' },
      { type: 'coin_bonus', value: 50, description: '+50 coins for viral content' }
    ],
    position: { x: 1, y: 1 }
  }
];
\`\`\`

### 4. Level Benefits System

#### Level-Based Rewards
\`\`\`typescript
interface LevelBenefit {
  level: number;
  benefits: Benefit[];
}

interface Benefit {
  type: 'coins' | 'feature' | 'cosmetic' | 'multiplier' | 'storage';
  value: number | string;
  description: string;
  icon: string;
}

const LEVEL_BENEFITS: LevelBenefit[] = [
  {
    level: 5,
    benefits: [
      { type: 'coins', value: 100, description: 'Bonus coins reward', icon: '🪙' },
      { type: 'feature', value: 'custom_themes', description: 'Unlock custom themes', icon: '🎨' }
    ]
  },
  {
    level: 10,
    benefits: [
      { type: 'coins', value: 250, description: 'Level 10 bonus', icon: '🪙' },
      { type: 'feature', value: 'priority_support', description: 'Priority customer support', icon: '🎧' },
      { type: 'cosmetic', value: 'level_10_badge', description: 'Exclusive level 10 badge', icon: '🏆' }
    ]
  },
  {
    level: 25,
    benefits: [
      { type: 'coins', value: 500, description: 'Quarter-century bonus', icon: '🪙' },
      { type: 'feature', value: 'advanced_analytics', description: 'Advanced content analytics', icon: '📊' },
      { type: 'multiplier', value: 1.5, description: '50% XP bonus multiplier', icon: '⚡' }
    ]
  },
  {
    level: 50,
    benefits: [
      { type: 'coins', value: 1000, description: 'Half-century milestone', icon: '🪙' },
      { type: 'feature', value: 'beta_features', description: 'Early access to beta features', icon: '🧪' },
      { type: 'cosmetic', value: 'golden_profile', description: 'Golden profile frame', icon: '👑' }
    ]
  }
];
\`\`\`

### 5. Daily Challenges and Streaks

#### Challenge Types
\`\`\`typescript
interface DailyChallenge {
  id: string;
  name: string;
  description: string;
  type: 'create' | 'engage' | 'social' | 'explore';
  target: number;
  xp_reward: number;
  coin_reward: number;
  expires_at: Date;
}

const DAILY_CHALLENGES = [
  {
    id: 'daily_creator',
    name: 'Daily Creator',
    description: 'Create 3 loops today',
    type: 'create',
    target: 3,
    xp_reward: 50,
    coin_reward: 25
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Like 10 loops from other users',
    type: 'engage',
    target: 10,
    xp_reward: 30,
    coin_reward: 15
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Visit 5 different user profiles',
    type: 'explore',
    target: 5,
    xp_reward: 25,
    coin_reward: 10
  }
];
\`\`\`

#### Streak System
\`\`\`typescript
interface UserStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: Date;
  streak_multiplier: number;
}

function calculateStreakBonus(streak: number): number {
  if (streak < 7) return 1.0;
  if (streak < 30) return 1.2;
  if (streak < 90) return 1.5;
  return 2.0; // 100% bonus for 90+ day streaks
}
\`\`\`

### 6. Leaderboards and Rankings

#### Leaderboard Categories
\`\`\`typescript
enum LeaderboardType {
  GLOBAL_XP = 'global_xp',
  WEEKLY_XP = 'weekly_xp',
  CONTENT_CREATORS = 'content_creators',
  SOCIAL_INFLUENCERS = 'social_influencers',
  COMMUNITY_BUILDERS = 'community_builders'
}

interface LeaderboardEntry {
  rank: number;
  user: UserProfile;
  score: number;
  change_from_previous: number; // Position change
  badge?: string; // Special recognition
}
\`\`\`

### 7. Reward Distribution System

#### XP Distribution Logic
\`\`\`typescript
async function awardXP(userId: string, action: string, metadata?: any): Promise<void> {
  const baseXP = XP_REWARDS[action] || 0;
  if (baseXP === 0) return;
  
  // Apply multipliers
  const user = await getUserProfile(userId);
  const levelMultiplier = getLevelMultiplier(user.level);
  const streakMultiplier = getStreakMultiplier(user.streak);
  const premiumMultiplier = user.is_premium ? 1.2 : 1.0;
  
  const finalXP = Math.floor(baseXP * levelMultiplier * streakMultiplier * premiumMultiplier);
  
  // Update user XP
  await updateUserXP(userId, finalXP);
  
  // Check for level up
  await checkLevelUp(userId);
  
  // Check for achievements
  await checkAchievements(userId, action, metadata);
  
  // Log XP transaction
  await logXPTransaction(userId, action, finalXP, metadata);
}
\`\`\`

### 8. Database Schema Extensions

#### Gamification Tables
\`\`\`sql
-- User XP and level tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp_points INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skill_points INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_activity_date DATE DEFAULT CURRENT_DATE;

-- XP transaction log
CREATE TABLE xp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    xp_amount INTEGER NOT NULL,
    multipliers JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily challenges
CREATE TABLE daily_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    challenge_type VARCHAR(50) NOT NULL,
    target_value INTEGER NOT NULL,
    current_progress INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    xp_reward INTEGER NOT NULL,
    coin_reward INTEGER NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, challenge_type, DATE(created_at))
);

-- Leaderboards cache
CREATE TABLE leaderboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    leaderboard_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    previous_rank INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(leaderboard_type, user_id)
);
\`\`\`

### 9. API Endpoints

#### Gamification API Routes
\`\`\`typescript
// GET /api/gamification/profile/:userId
// Returns user's gamification profile (XP, level, achievements, etc.)

// POST /api/gamification/award-xp
// Awards XP for specific actions

// GET /api/gamification/achievements/:userId
// Returns user's achievements and progress

// POST /api/gamification/unlock-achievement
// Unlocks an achievement for a user

// GET /api/gamification/leaderboards/:type
// Returns leaderboard data

// GET /api/gamification/daily-challenges/:userId
// Returns user's daily challenges

// POST /api/gamification/complete-challenge
// Marks a daily challenge as completed

// GET /api/gamification/skill-trees/:userId
// Returns user's skill tree progress

// POST /api/gamification/unlock-skill
// Unlocks a skill node
\`\`\`

### 10. 3D Visualization Components

#### 3D Level Display
\`\`\`typescript
// components/gamification/3d-level-display.tsx
// Animated 3D level indicator with XP progress ring
// Particle effects for level-up animations
// Floating achievement badges
\`\`\`

#### 3D Skill Tree Viewer
\`\`\`typescript
// components/gamification/3d-skill-tree.tsx
// Interactive 3D skill tree with node connections
// Hover effects and skill preview tooltips
// Unlock animations and visual feedback
\`\`\`

#### 3D Achievement Gallery
\`\`\`typescript
// components/gamification/3d-achievement-gallery.tsx
// 3D showcase of unlocked achievements
// Rarity-based visual effects (glow, particles)
// Achievement unlock celebration animations
\`\`\`

### 11. Implementation Priority

#### Phase 1: Core XP System
1. Database schema setup
2. XP award system implementation
3. Level calculation and benefits
4. Basic achievement tracking

#### Phase 2: Advanced Features
1. Skill trees implementation
2. Daily challenges system
3. Streak tracking and bonuses
4. Leaderboards and rankings

#### Phase 3: 3D Integration
1. 3D level display components
2. 3D skill tree visualization
3. Achievement gallery with effects
4. Gamification dashboard

#### Phase 4: Analytics and Optimization
1. Gamification analytics tracking
2. A/B testing for XP values
3. Performance optimization
4. User engagement analysis

### 12. Success Metrics

#### Engagement Metrics
- Daily active users increase
- Session duration improvement
- Content creation rate boost
- User retention enhancement

#### Gamification Metrics
- Achievement unlock rates
- Level progression speed
- Skill tree completion rates
- Daily challenge participation

This comprehensive gamification system will significantly enhance user engagement and create a compelling progression experience that encourages long-term platform usage and community building.
