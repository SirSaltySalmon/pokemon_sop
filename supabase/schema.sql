-- Supabase Database Schema for Pokemon Smash or Pass
-- Run this in Supabase SQL Editor

-- Characters table
CREATE TABLE IF NOT EXISTS characters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Character tags junction table
CREATE TABLE IF NOT EXISTS character_tags (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(character_id, tag_id)
);

-- User interactions table
CREATE TABLE IF NOT EXISTS user_interactions (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(10) NOT NULL CHECK (action_type IN ('vote', 'skip')),
    vote_type BOOLEAN, -- true for yes, false for no, NULL for skip
    was_majority BOOLEAN, -- NULL for skips
    majority_percentage DECIMAL(5,2), -- for point calculations
    points_earned INTEGER DEFAULT 0,
    interacted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_character_tags_character_id ON character_tags(character_id);
CREATE INDEX IF NOT EXISTS idx_character_tags_tag_id ON character_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_character_id ON user_interactions(character_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_session_id ON user_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_vote_type ON user_interactions(vote_type) WHERE vote_type IS NOT NULL;

-- Enable RLS
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- Allow everyone (anon + authenticated) to read characters, tags, and associations
CREATE POLICY "Read characters"
ON characters
FOR SELECT
TO public
USING (true);

CREATE POLICY "Read tags"
ON tags
FOR SELECT
TO public
USING (true);

CREATE POLICY "Read character_tags"
ON character_tags
FOR SELECT
TO public
USING (true);

-- Allow all clients to read interactions (optional – restrict if you want)
CREATE POLICY "Read interactions"
ON user_interactions
FOR SELECT
TO public
USING (true);

-- Allow authenticated users to insert new interactions (votes)
CREATE POLICY "Insert interactions"
ON user_interactions
FOR INSERT
TO public
WITH CHECK (true);

-- (Optional) prevent updates and deletes by not defining policies:
-- no UPDATE/DELETE policy => users cannot modify or delete interactions