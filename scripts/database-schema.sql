-- Loop Social Media Platform Database Schema
-- Run this in your Supabase SQL editor or PostgreSQL database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    profile_theme JSONB DEFAULT '{}',
    is_verified BOOLEAN DEFAULT FALSE,
    verification_level VARCHAR(20) CHECK (verification_level IN ('root', 'influencer')),
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMP,
    loop_coins INTEGER DEFAULT 0,
    location VARCHAR(100),
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Loops table with tree structure
CREATE TABLE loops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_loop_id UUID REFERENCES loops(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL CHECK (content_type
