# Loop Social Platform - API Documentation

## Overview

The Loop Social Platform API provides endpoints for managing users, content (loops), social interactions, messaging, and e-commerce features. All endpoints use JSON for request/response bodies and follow RESTful conventions.

## Base URL
\`\`\`
https://your-domain.com/api
\`\`\`

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Response Format

All API responses follow this structure:

\`\`\`json
{
  "success": true,
  "data": {},
  "error": null,
  "message": "Success message"
}
\`\`\`

Error responses:
\`\`\`json
{
  "success": false,
  "data": null,
  "error": "Error code",
  "message": "Error description"
}
\`\`\`

## Authentication Endpoints

### POST /api/auth/login
Login with email and password.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "password123"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "display_name": "John Doe",
      "avatar_url": "https://...",
      "loop_coins": 500,
      "is_premium": false,
      "is_verified": false
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": "2024-01-01T00:00:00Z"
    }
  }
}
\`\`\`

### POST /api/auth/signup
Create a new user account.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "johndoe",
  "display_name": "John Doe"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "message": "Account created successfully. Please check your email for verification."
  }
}
\`\`\`

## User Management Endpoints

### GET /api/users/profile
Get current user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "johndoe",
    "display_name": "John Doe",
    "email": "user@example.com",
    "avatar_url": "https://...",
    "banner_url": "https://...",
    "bio": "Software developer",
    "loop_coins": 500,
    "is_premium": false,
    "is_verified": false,
    "followers_count": 150,
    "following_count": 200,
    "loops_count": 45
  }
}
\`\`\`

### PUT /api/users/profile
Update current user's profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "display_name": "John Smith",
  "bio": "Updated bio",
  "avatar_url": "https://new-avatar-url.com"
}
\`\`\`

### POST /api/users/follow
Follow or unfollow a user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "user_id": "uuid",
  "action": "follow" // or "unfollow"
}
\`\`\`

### GET /api/users/[id]/followers
Get user's followers list.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "followers": [
      {
        "id": "uuid",
        "username": "follower1",
        "display_name": "Follower One",
        "avatar_url": "https://...",
        "is_verified": false,
        "followed_at": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20,
    "has_more": true
  }
}
\`\`\`

### GET /api/users/[id]/following
Get user's following list (same format as followers).

## Loop (Content) Endpoints

### GET /api/loops
Get the loop feed. Works for guests (public loops only); pass a Bearer
token to also get `user_interactions` (liked/saved) for the requesting user.

**Headers:** `Authorization: Bearer <token>` (optional)

**Query Parameters:**
- `limit` (optional): Items per page (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `user_id` (optional): Only loops by this author
- `category` (optional): Filter by category

For ranked/trending discovery instead of chronological, use
`GET /api/explore/trending?type=loops&sort=creative|deepest|recent`.

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "loops": [
      {
        "id": "uuid",
        "author": {
          "id": "uuid",
          "username": "author",
          "display_name": "Author Name",
          "avatar_url": "https://...",
          "is_verified": false
        },
        "content_type": "text",
        "content_text": "This is a loop post",
        "content_media_url": null,
        "parent_loop_id": null,
        "tree_depth": 0,
        "hashtags": ["#coding", "#tech"],
        "stats": {
          "likes_count": 25,
          "comments_count": 5,
          "branches_count": 3,
          "shares_count": 2,
          "views_count": 150
        },
        "user_interactions": {
          "is_liked": false,
          "is_saved": false
        },
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 500,
    "page": 1,
    "limit": 20,
    "has_more": true
  }
}
\`\`\`

### POST /api/loops
Create a new loop.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "content_type": "text",
  "content_text": "This is my new loop post",
  "content_media_url": null,
  "visibility": "public",
  "hashtags": ["#coding", "#tech"],
  "parent_loop_id": null
}
\`\`\`

### POST /api/loops/branch
Create a branch from an existing loop.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "parent_loop_id": "uuid",
  "content_type": "text",
  "content_text": "This is a branch response",
  "content_media_url": null
}
\`\`\`

### GET /api/loops/[id]
Get a specific loop with its branches.

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "loop": {
      "id": "uuid",
      "author": {...},
      "content_type": "text",
      "content_text": "Original loop",
      "branches": [
        {
          "id": "uuid",
          "author": {...},
          "content_text": "Branch response",
          "tree_depth": 1,
          "created_at": "2024-01-01T00:00:00Z"
        }
      ],
      "stats": {...},
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
\`\`\`

### POST /api/loops/[id]/interactions
Like, save, or share a loop.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "type": "like", // "like", "save", "share", "view"
  "action": "add" // "add" or "remove"
}
\`\`\`

### GET /api/loops/[id]/comments
Get comments for a loop.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "uuid",
        "author": {
          "id": "uuid",
          "username": "commenter",
          "display_name": "Commenter Name",
          "avatar_url": "https://..."
        },
        "content": "Great post!",
        "parent_comment_id": null,
        "replies": [],
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 20
  }
}
\`\`\`

### POST /api/loops/[id]/comments
Add a comment to a loop.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "content": "This is my comment",
  "parent_comment_id": null // optional, for replies
}
\`\`\`

## Search Endpoints

### GET /api/search
Search for users, loops, and hashtags.

**Query Parameters:**
- `q`: Search query (required)
- `type`: Search type ('users', 'loops', 'hashtags', 'all')
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "users": [...],
    "loops": [...],
    "hashtags": [
      {
        "tag": "coding",
        "count": 1250,
        "trending": true
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
\`\`\`

## Messaging Endpoints

### GET /api/messages
Get user's messages/conversations.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `conversation_id` (optional): Specific conversation ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "uuid",
        "participant": {
          "id": "uuid",
          "username": "friend",
          "display_name": "Friend Name",
          "avatar_url": "https://..."
        },
        "last_message": {
          "content": "Hey, how are you?",
          "sender_id": "uuid",
          "created_at": "2024-01-01T00:00:00Z"
        },
        "unread_count": 2
      }
    ],
    "messages": [...] // if conversation_id provided
  }
}
\`\`\`

### POST /api/messages
Send a message.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "recipient_id": "uuid", // for direct messages
  "circle_id": "uuid", // for circle messages (optional)
  "content": "Hello there!",
  "message_type": "text",
  "reply_to_id": null // optional
}
\`\`\`

## Notifications Endpoints

### GET /api/notifications
Get user's notifications.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `unread_only` (optional): Show only unread notifications

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "like",
        "title": "New Like",
        "message": "John Doe liked your loop",
        "data": {
          "loop_id": "uuid",
          "user_id": "uuid"
        },
        "is_read": false,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "unread_count": 5,
    "total": 50
  }
}
\`\`\`

### PUT /api/notifications
Mark notifications as read.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "notification_ids": ["uuid1", "uuid2"], // optional, if not provided marks all as read
  "mark_as_read": true
}
\`\`\`

## Circles (Communities) Endpoints

### GET /api/circles
Get circles/communities.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `user_circles` (optional): Show only user's circles

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "circles": [
      {
        "id": "uuid",
        "name": "Web Developers",
        "description": "A community for web developers",
        "avatar_url": "https://...",
        "member_count": 1250,
        "is_private": false,
        "is_member": true,
        "owner": {
          "id": "uuid",
          "username": "owner",
          "display_name": "Circle Owner"
        },
        "created_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
\`\`\`

### POST /api/circles
Create a new circle.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "name": "My New Circle",
  "description": "A circle for discussing topics",
  "is_private": false,
  "avatar_url": "https://..."
}
\`\`\`

### POST /api/circles/[id]/join
Join a circle (no request body). Private circles create a `pending`
membership instead of `active`.

**Headers:** `Authorization: Bearer <token>`

### DELETE /api/circles/[id]/join
Leave a circle you're a member of (no request body).

**Headers:** `Authorization: Bearer <token>`

## Shop & Inventory Endpoints

### GET /api/shop/items
Get shop items.

**Query Parameters:**
- `category` (optional): Filter by category ('theme', 'animation', 'effect', 'premium')
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Dark Theme",
        "description": "Sleek dark theme for your profile",
        "price_coins": 100,
        "price_usd": null,
        "category": "theme",
        "item_data": {
          "colors": {
            "primary": "#1a1a1a",
            "secondary": "#333333"
          }
        },
        "is_owned": false
      }
    ]
  }
}
\`\`\`

### POST /api/shop/purchase
Purchase an item.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "item_id": "uuid",
  "payment_method": "coins" // or "stripe"
}
\`\`\`

### GET /api/inventory
Get user's inventory.

**Headers:** `Authorization: Bearer <token>`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "item": {
          "name": "Dark Theme",
          "category": "theme",
          "item_data": {...}
        },
        "is_active": true,
        "purchased_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
\`\`\`

### POST /api/inventory/apply
Apply an inventory item.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "inventory_id": "uuid"
}
\`\`\`

## File Upload Endpoints

### POST /api/upload
Upload files (images, videos, documents).

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Request Body:**
\`\`\`
file: <binary-data>
type: "avatar" | "banner" | "loop_media" | "message_file"
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "url": "https://cloudinary-url.com/image.jpg",
    "public_id": "cloudinary-public-id",
    "file_type": "image/jpeg",
    "file_size": 1024000
  }
}
\`\`\`

## Admin Endpoints

### GET /api/admin/users
Get all users (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

### POST /api/admin/users/coins
Add coins to user account (admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request Body:**
\`\`\`json
{
  "user_id": "uuid",
  "amount": 500,
  "reason": "Weekly bonus"
}
\`\`\`

### GET /api/admin/shop-items
Manage shop items (admin only).

### POST /api/users/coins/weekly
Weekly coin distribution (cron job).

**Headers:** `Authorization: Bearer <cron-secret>`

## Gifting Endpoints

### POST /api/gifts/send
Send a shop-catalog gift item (coins, theme, premium, badge, effect) to
another user, optionally attached to a loop/reel/comment/stream. This is
the source of truth for gifts — it atomically deducts the sender's coins,
delivers the gift, and (for non-coin gifts) credits the recipient's
withdrawable creator earnings.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "recipient_id": "uuid",
  "gift_item_id": "uuid",
  "message": "optional message",
  "is_anonymous": false,
  "context": { "type": "post", "id": "loop-uuid" }
}
\`\`\`

## Live Streaming Endpoints

Live is real **browser WebRTC** (camera + screen share) signaled over
Supabase Realtime — there is no RTMP/HLS ingest today, so don't expect an
OBS-style workflow. It's a peer-to-peer mesh, so it's best suited to
roughly ~25 concurrent viewers before quality degrades; large audiences
need a dedicated SFU (LiveKit/Agora/IVS), which is not wired up yet.

### GET /api/streams
List streams. Query params: `status` (`live`|`popular`|`recent`), `category`, `page`, `limit`.

### POST /api/streams
Create a stream (status starts `preparing`).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{ "title": "My stream", "description": "...", "category": "gaming", "tags": ["chill"] }
\`\`\`

### PUT /api/streams/[id]
Update a stream you own, including transitioning `status` to `live` or
`ended`. Going live notifies your followers via web push.

## Error Handling

Endpoints do **not** use a fixed error-code enum. Failures return an HTTP
error status (401/403/404/400/500) with a body shaped like:

\`\`\`json
{ "error": "Human-readable message" }
\`\`\`

Always check the HTTP status and read `error` for the message — don't
match on a code string.

## Real-time Updates

There is no Socket.io server in this app. Real-time updates (new
messages, live viewer presence, circle chat, wallet/gift notifications)
use **Supabase Realtime** (Postgres change feeds and broadcast channels)
directly from the client via `@supabase/supabase-js`, plus browser Web
Push for notifications when the tab isn't focused. See
`hooks/use-auth.tsx`, `providers/realtime-provider.tsx`, and
`lib/web-push.ts` for the actual client-side wiring.

## No Official SDK / Public Developer Platform

There is currently no published client SDK and no public third-party
OAuth developer platform — call the REST endpoints above directly with a
Supabase-issued Bearer token. (A public developer/OAuth platform is
intentionally not part of the current roadmap.)

This documentation is generated against the routes under `app/api/**` —
if you find a documented endpoint that no longer matches the code, treat
the code as the source of truth and update this file in the same PR.
