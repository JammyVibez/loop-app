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

### GET /api/loops/feed
Get personalized feed for authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `type` (optional): Feed type ('following', 'trending', 'all')

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
Join or leave a circle.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
\`\`\`json
{
  "action": "join" // or "leave"
}
\`\`\`

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

## Error Codes

- `AUTH_REQUIRED`: Authentication required
- `AUTH_INVALID`: Invalid authentication token
- `USER_NOT_FOUND`: User not found
- `LOOP_NOT_FOUND`: Loop not found
- `INSUFFICIENT_COINS`: Not enough Loop Coins
- `VALIDATION_ERROR`: Request validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVER_ERROR`: Internal server error

## Rate Limiting

API endpoints are rate limited:
- Authentication: 5 requests per minute
- General endpoints: 100 requests per minute
- Upload endpoints: 10 requests per minute

Rate limit headers are included in responses:
\`\`\`
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
\`\`\`

## Webhooks

### Stripe Webhook
**POST /api/payments/webhook**

Handles Stripe payment events for Loop Coin purchases.

## Real-time Events (Socket.io)

Connect to `/socket.io` for real-time updates:

### Events to Listen For:
- `loop:created` - New loop posted
- `loop:liked` - Loop received a like
- `message:received` - New message received
- `notification:new` - New notification
- `user:typing` - User is typing in chat

### Events to Emit:
- `join:room` - Join a specific room (user ID, circle ID)
- `leave:room` - Leave a room
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator

## SDK Examples

### JavaScript/TypeScript
\`\`\`typescript
// Initialize client
const client = new LoopClient({
  baseUrl: 'https://your-domain.com/api',
  token: 'your-jwt-token'
});

// Get user feed
const feed = await client.loops.getFeed({ page: 1, limit: 20 });

// Create a loop
const newLoop = await client.loops.create({
  content_type: 'text',
  content_text: 'Hello Loop!',
  hashtags: ['#hello']
});

// Like a loop
await client.loops.interact(loopId, { type: 'like', action: 'add' });
\`\`\`

This documentation covers all major API endpoints and provides examples for common use cases. For additional support or questions, please refer to the GitHub repository or contact the development team.
