-- ==============================================================================
-- IVY PRIVATE COUPLE CHAT - COMPLETE SUPABASE DATABASE SETUP (REPLACE ALL)
-- Copy and paste this ENTIRE script into your Supabase SQL Editor and click "Run".
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Clean Drop Existing Tables (Fresh Start)
DROP TABLE IF EXISTS public.message_reactions CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.presence CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Create Profiles Table
CREATE TABLE public.profiles (
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

-- 4. Create Messages Table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_uuid VARCHAR(64) UNIQUE NOT NULL,
    room_id UUID,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    reply_to VARCHAR(64),
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    pinned BOOLEAN DEFAULT FALSE,
    starred BOOLEAN DEFAULT FALSE,
    forwarded BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'sent',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Message Reactions Table
CREATE TABLE public.message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(64) NOT NULL,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Presence Table
CREATE TABLE public.presence (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    online BOOLEAN DEFAULT FALSE,
    typing BOOLEAN DEFAULT FALSE,
    recording_audio BOOLEAN DEFAULT FALSE,
    uploading_media BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- 7. High-Performance Indexes
CREATE INDEX idx_messages_created_at ON public.messages(created_at ASC);
CREATE INDEX idx_messages_local_uuid ON public.messages(local_uuid);
CREATE INDEX idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX idx_reactions_message_id ON public.message_reactions(message_id);

-- 8. Insert Preseeded Couple Profiles (Afkar: 220609, Princess: 030309)
INSERT INTO public.profiles (id, login_id_hash, display_name, nickname, about, avatar_url, wallpaper, theme)
VALUES 
  ('11111111-1111-4111-a111-111111111111', '75c87e7f781db197d10006764516e87f174db9675317424683a9108c48a7ebdf', 'Afkar', 'My Princess ❤️', 'Just a boy in love. ❤️', '', 'botanical', 'rose'),
  ('22222222-2222-4222-a222-222222222222', '05c2a1e6ec0f80509a25b138612140a3ec6370bb073f47e30d170f2095f9c5d0', 'Princess', 'My Hero ❤️', 'You are my today and all of my tomorrows.', '', 'botanical', 'rose')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- 9. Disable RLS & Grant Full Access for Public Anon Key
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.messages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.message_reactions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.presence TO anon, authenticated, service_role;

-- 10. Enable Supabase Realtime Replication
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.messages, public.profiles, public.presence, public.message_reactions;
