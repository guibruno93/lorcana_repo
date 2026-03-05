-- ═══════════════════════════════════════════════════════════
-- META ANALYSIS - Database Schema
-- Execute no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── 1. TOURNAMENTS TABLE ──────────────────────────────────

CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  format TEXT, -- 'core', 'premier', etc
  location TEXT,
  player_count INTEGER,
  source_url TEXT UNIQUE,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tournaments_date ON tournaments(date DESC);
CREATE INDEX idx_tournaments_format ON tournaments(format);
CREATE INDEX idx_tournaments_scraped_at ON tournaments(scraped_at DESC);

-- ── 2. DECKS TABLE (Enhanced) ─────────────────────────────

CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  
  -- Deck Info
  archetype TEXT NOT NULL,
  inks TEXT[], -- ['Amber', 'Steel']
  
  -- Player Info
  player_name TEXT,
  placement INTEGER NOT NULL, -- 1st, 2nd, 3rd, etc
  
  -- Deck List
  decklist JSONB, -- Full card list
  card_count INTEGER DEFAULT 60,
  
  -- Performance Metrics
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  win_rate NUMERIC(5,2), -- Calculated
  
  -- Meta
  source_url TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_decks_tournament ON decks(tournament_id);
CREATE INDEX idx_decks_archetype ON decks(archetype);
CREATE INDEX idx_decks_placement ON decks(placement);
CREATE INDEX idx_decks_win_rate ON decks(win_rate DESC);
CREATE INDEX idx_decks_scraped_at ON decks(scraped_at DESC);

-- Gin index for JSONB queries
CREATE INDEX idx_decks_decklist ON decks USING GIN (decklist);

-- ── 3. CARDS META TABLE ──────────────────────────────────

CREATE TABLE IF NOT EXISTS cards_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Card Info
  card_name TEXT NOT NULL UNIQUE,
  
  -- Meta Stats (last 30 days)
  total_decks INTEGER DEFAULT 0,
  total_copies INTEGER DEFAULT 0,
  avg_copies NUMERIC(3,1),
  
  -- Win Rate
  decks_with_wins INTEGER DEFAULT 0,
  decks_with_losses INTEGER DEFAULT 0,
  win_rate NUMERIC(5,2),
  
  -- Popularity
  meta_share NUMERIC(5,2), -- % of meta
  
  -- Trends
  trend TEXT, -- 'rising', 'falling', 'stable'
  trend_delta NUMERIC(5,2), -- +/- %
  
  -- Timestamps
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cards_meta_share ON cards_meta(meta_share DESC);
CREATE INDEX idx_cards_meta_win_rate ON cards_meta(win_rate DESC);
CREATE INDEX idx_cards_meta_trend ON cards_meta(trend);

-- ── 4. ARCHETYPE META TABLE ──────────────────────────────

CREATE TABLE IF NOT EXISTS archetype_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Archetype Info
  archetype TEXT NOT NULL UNIQUE,
  inks TEXT[],
  
  -- Performance (last 30 days)
  total_decks INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  win_rate NUMERIC(5,2),
  
  -- Placements
  top4_count INTEGER DEFAULT 0,
  top8_count INTEGER DEFAULT 0,
  top16_count INTEGER DEFAULT 0,
  avg_placement NUMERIC(5,2),
  
  -- Meta Position
  meta_share NUMERIC(5,2),
  tier TEXT, -- 'S', 'A', 'B', 'C', 'D'
  power_level INTEGER, -- 1-100
  
  -- Trends
  trend TEXT, -- 'rising', 'falling', 'stable'
  trend_delta NUMERIC(5,2),
  
  -- Matchups (JSONB for flexibility)
  matchups JSONB, -- { "vs Amber/Steel": { "wr": 55.5, "games": 120 } }
  
  -- Timestamps
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_archetype_meta_tier ON archetype_meta(tier);
CREATE INDEX idx_archetype_meta_share ON archetype_meta(meta_share DESC);
CREATE INDEX idx_archetype_meta_win_rate ON archetype_meta(win_rate DESC);
CREATE INDEX idx_archetype_meta_power ON archetype_meta(power_level DESC);

-- ── 5. TIER LIST HISTORY ────────────────────────────────

CREATE TABLE IF NOT EXISTS tier_list_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  archetype TEXT NOT NULL,
  tier TEXT NOT NULL,
  power_level INTEGER,
  meta_share NUMERIC(5,2),
  win_rate NUMERIC(5,2),
  
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tier_history_date ON tier_list_history(snapshot_date DESC);
CREATE INDEX idx_tier_history_archetype ON tier_list_history(archetype);

-- ── 6. SCRAPING JOBS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  source TEXT NOT NULL, -- 'inkdecks', 'melee', etc
  status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  
  tournaments_found INTEGER DEFAULT 0,
  decks_scraped INTEGER DEFAULT 0,
  
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_created ON scraping_jobs(created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════

-- ── Auto-update timestamps ────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tournaments_updated_at BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER decks_updated_at BEFORE UPDATE ON decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER cards_meta_updated_at BEFORE UPDATE ON cards_meta
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER archetype_meta_updated_at BEFORE UPDATE ON archetype_meta
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Calculate win rate ────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_win_rate(wins INT, losses INT, draws INT)
RETURNS NUMERIC AS $$
BEGIN
  IF (wins + losses + draws) = 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND(
    (wins + (draws * 0.5)) * 100.0 / (wins + losses + draws),
    2
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- INITIAL DATA
-- ═══════════════════════════════════════════════════════════

-- Insert sample tournament (for testing)
INSERT INTO tournaments (id, name, date, format, location, player_count, url)
VALUES (
  '260222', 'Example Tournament',
  CURRENT_DATE - INTERVAL '7 days',
  'premier',
  'São Paulo, BR',
  64,
  'https://example.com/tournament'
) ON CONFLICT (source_url) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════

-- Verify tables created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'tournaments',
    'decks',
    'cards_meta',
    'archetype_meta',
    'tier_list_history',
    'scraping_jobs'
  )
ORDER BY table_name;
