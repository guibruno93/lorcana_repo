-- Tier lists personalizadas (Supabase). Executar no SQL Editor se usar persistência remota.
-- O backend também grava em backend/data/tier-lists.json se a tabela não existir.

CREATE TABLE IF NOT EXISTS tier_lists (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  tiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  tier_labels JSONB,
  likes INTEGER NOT NULL DEFAULT 0,
  agree INTEGER NOT NULL DEFAULT 0,
  disagree INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tier_lists_user ON tier_lists (user_id);
CREATE INDEX IF NOT EXISTS idx_tier_lists_likes ON tier_lists (likes DESC);
CREATE INDEX IF NOT EXISTS idx_tier_lists_created ON tier_lists (created_at DESC);
