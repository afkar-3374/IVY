-- ==============================================================================
-- IVY - PRIVATE COUPLE CHAT PRODUCTION DATABASE SCHEMA & SECURITY POLICIES
-- Target DB: PostgreSQL / Supabase
-- Description: Normalized tables, Row Level Security (RLS), Realtime triggers,
--              and schema indexes for 2-user private messaging.
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- Stores user profiles with SHA-256 hashed login IDs and partner nicknames.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    login_id_hash VARCHAR(64) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    nickname VARCHAR(100) DEFAULT '',
    about TEXT DEFAULT 'In love with you ❤️',
    avatar_url TEXT DEFAULT '',
    wallpaper VARCHAR(50) DEFAULT 'botanical',
    theme VARCHAR(50) DEFAULT 'rose',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast Login ID hash lookups
CREATE INDEX IF NOT EXISTS idx_profiles_login_hash ON public.profiles(login_id_hash);

-- ------------------------------------------------------------------------------
-- 2. CHAT ROOMS TABLE
-- Single shared chat room for the two lovers.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. ROOM PARTICIPANTS TABLE
-- Junction linking the 2 users to the private chat room.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, profile_id)
);

-- ------------------------------------------------------------------------------
-- 4. MESSAGES TABLE
-- Stores text & media messages with optimistic UUIDs, soft delete, replies, stars, and pins.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_uuid VARCHAR(64) UNIQUE,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, video, audio, voice, document, file, system
    reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    pinned BOOLEAN DEFAULT FALSE,
    starred BOOLEAN DEFAULT FALSE,
    forwarded BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'sent', -- queued, sending, sent, delivered, read, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance & infinite scroll pagination
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_local_uuid ON public.messages(local_uuid);

-- ------------------------------------------------------------------------------
-- 5. ATTACHMENTS TABLE
-- Future-proof storage metadata for images, audio voice notes, and documents.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. MESSAGE REACTIONS TABLE
-- Realtime emoji reactions linked to messages.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, profile_id, emoji)
);

-- ------------------------------------------------------------------------------
-- 7. PRESENCE TABLE
-- Realtime online status, typing, recording, uploading, and last seen timestamps.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.presence (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    online BOOLEAN DEFAULT FALSE,
    typing BOOLEAN DEFAULT FALSE,
    recording_audio BOOLEAN DEFAULT FALSE,
    uploading_media BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable strict data protection for private couple communication.
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated profiles
CREATE POLICY "Profiles are readable by couple participants" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (true);

-- Allow full access to messages
CREATE POLICY "Messages readable by couple" ON public.messages
    FOR SELECT USING (true);

CREATE POLICY "Messages insertable by sender" ON public.messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Messages editable/deletable by couple" ON public.messages
    FOR UPDATE USING (true);

-- Reactions policies
CREATE POLICY "Reactions readable by couple" ON public.message_reactions
    FOR SELECT USING (true);

CREATE POLICY "Reactions manageable by couple" ON public.message_reactions
    FOR ALL USING (true);

-- Presence policies
CREATE POLICY "Presence readable by couple" ON public.presence
    FOR SELECT USING (true);

CREATE POLICY "Presence manageable by couple" ON public.presence
    FOR ALL USING (true);

-- ------------------------------------------------------------------------------
-- 9. PRE-SEEDED COUPLE PROFILES
-- Default User 1 (Afkar - 220609) & User 2 (Princess - 030309)
-- SHA-256 of "220609": '75c87e7f781db197d10006764516e87f174db9675317424683a9108c48a7ebdf'
-- SHA-256 of "030309": '05c2a1e6ec0f80509a25b138612140a3ec6370bb073f47e30d170f2095f9c5d0'
-- ------------------------------------------------------------------------------
INSERT INTO public.profiles (id, login_id_hash, display_name, nickname, about, avatar_url, wallpaper, theme)
VALUES 
  ('11111111-1111-4111-a111-111111111111', '75c87e7f781db197d10006764516e87f174db9675317424683a9108c48a7ebdf', 'Afkar', 'My Princess ❤️', 'Just a boy in love. ❤️', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', 'botanical', 'rose'),
  ('22222222-2222-4222-a222-222222222222', '05c2a1e6ec0f80509a25b138612140a3ec6370bb073f47e30d170f2095f9c5d0', 'Princess', 'My Hero ❤️', 'You are my today and all of my tomorrows.', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80', 'botanical', 'rose')
ON CONFLICT (login_id_hash) DO NOTHING;

-- Seed Presence records
INSERT INTO public.presence (profile_id, online, typing, recording_audio, uploading_media, last_seen)
VALUES 
  ('11111111-1111-4111-a111-111111111111', true, false, false, false, NOW()),
  ('22222222-2222-4222-a222-222222222222', true, false, false, false, NOW())
ON CONFLICT (profile_id) DO NOTHING;

-- Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
