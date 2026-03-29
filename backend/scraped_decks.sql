-- Tabela usada por POST /api/meta-analysis/scrape
-- Execute no SQL Editor do Supabase se ainda não existir.

CREATE TABLE IF NOT EXISTS scraped_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_name TEXT NOT NULL,
  archetype TEXT,
  ink_colors TEXT[],
  cards JSONB NOT NULL DEFAULT '{}'::jsonb,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  source_url TEXT,
  source_deck_id TEXT,
  author TEXT,
  event_name TEXT,
  organizer TEXT,
  standing TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scraped_decks_scraped_at ON scraped_decks(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_decks_archetype ON scraped_decks(archetype);
