-- ═══════════════════════════════════════════════════════════
-- SUPABASE SCHEMA - Lorcana AI
-- ═══════════════════════════════════════════════════════════

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────────────────────────────────────────
-- TABLE: users
-- Usuários do sistema com dados criptografados
-- ───────────────────────────────────────────────────────────

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  country TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  
  -- Metadados
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false
);

-- Index para busca rápida por email
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- ───────────────────────────────────────────────────────────
-- TABLE: cards
-- Database de cartas do Lorcana
-- ───────────────────────────────────────────────────────────

CREATE TABLE cards (
  id TEXT PRIMARY KEY, -- Card ID oficial
  code TEXT,
  
  -- Nomes
  name TEXT NOT NULL,
  full_name TEXT,
  simple_name TEXT,
  
  -- Atributos
  ink TEXT,
  type TEXT,
  cost INTEGER,
  inkable BOOLEAN DEFAULT false,
  
  -- Stats de personagem
  lore INTEGER DEFAULT 0,
  strength INTEGER,
  willpower INTEGER,
  
  -- Set
  set_code TEXT,
  set_name TEXT,
  
  -- Raridade
  rarity TEXT,
  
  -- Habilidades e imagem
  abilities JSONB,
  image_url TEXT,
  
  -- Metadados
  source TEXT DEFAULT 'dreamborn',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cards_name ON cards(name);
CREATE INDEX idx_cards_ink ON cards(ink);
CREATE INDEX idx_cards_type ON cards(type);
CREATE INDEX idx_cards_cost ON cards(cost);
CREATE INDEX idx_cards_set_code ON cards(set_code);

-- Full-text search
CREATE INDEX idx_cards_search ON cards USING GIN (to_tsvector('english', name || ' ' || COALESCE(full_name, '')));

-- ───────────────────────────────────────────────────────────
-- TABLE: tournaments
-- Torneios scraped
-- ───────────────────────────────────────────────────────────

CREATE TABLE tournaments (
  id TEXT PRIMARY KEY, -- ID do torneio
  name TEXT NOT NULL,
  url TEXT,
  
  format TEXT DEFAULT 'core',
  date DATE,
  location TEXT,
  
  -- Metadados
  source TEXT DEFAULT 'inkdecks',
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tournaments_date ON tournaments(date DESC);
CREATE INDEX idx_tournaments_format ON tournaments(format);

-- ───────────────────────────────────────────────────────────
-- TABLE: decks
-- Decks scraped de torneios
-- ───────────────────────────────────────────────────────────

CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  tournament_id TEXT REFERENCES tournaments(id),
  
  -- Deck info
  name TEXT,
  author TEXT,
  placement INTEGER,
  
  -- Cards (JSONB array)
  cards JSONB NOT NULL, -- [{name, quantity, cost, type, ink, inkable}]
  
  -- Inks
  inks TEXT[], -- ['Amethyst', 'Sapphire']
  
  -- Fingerprint para deduplicação
  fingerprint TEXT UNIQUE,
  
  -- URLs
  url TEXT,
  tournament_url TEXT,
  
  -- Metadados
  source TEXT DEFAULT 'inkdecks',
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_decks_tournament ON decks(tournament_id);
CREATE INDEX idx_decks_placement ON decks(placement);
CREATE INDEX idx_decks_inks ON decks USING GIN(inks);
CREATE INDEX idx_decks_fingerprint ON decks(fingerprint);
CREATE INDEX idx_decks_scraped_at ON decks(scraped_at DESC);

-- ───────────────────────────────────────────────────────────
-- TABLE: user_decks
-- Decks salvos pelos usuários
-- ───────────────────────────────────────────────────────────

CREATE TABLE user_decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Deck info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Cards
  cards JSONB NOT NULL,
  inks TEXT[],
  
  -- Fingerprint
  fingerprint TEXT,
  
  -- Score vs meta (cached)
  meta_score DECIMAL(3,1), -- 0.0 - 10.0
  meta_filter TEXT, -- 'top32', 'top16', etc
  last_comparison TIMESTAMPTZ,
  
  -- Metadados
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_decks_user ON user_decks(user_id);
CREATE INDEX idx_user_decks_created ON user_decks(created_at DESC);
CREATE INDEX idx_user_decks_public ON user_decks(is_public) WHERE is_public = true;

-- ───────────────────────────────────────────────────────────
-- FUNCTIONS: Triggers
-- ───────────────────────────────────────────────────────────

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_decks_updated_at BEFORE UPDATE ON user_decks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ───────────────────────────────────────────────────────────
-- FUNCTIONS: Useful queries
-- ───────────────────────────────────────────────────────────

-- Function: Get deck total cards
CREATE OR REPLACE FUNCTION get_deck_total_cards(deck_cards JSONB)
RETURNS INTEGER AS $$
  SELECT SUM((card->>'quantity')::INTEGER)::INTEGER
  FROM jsonb_array_elements(deck_cards) AS card;
$$ LANGUAGE SQL IMMUTABLE;

-- Function: Calculate deck similarity
CREATE OR REPLACE FUNCTION calculate_deck_similarity(cards1 JSONB, cards2 JSONB)
RETURNS DECIMAL AS $$
DECLARE
  matches INTEGER := 0;
  total INTEGER := 0;
  card1 JSONB;
  card2 JSONB;
  name1 TEXT;
  name2 TEXT;
  qty1 INTEGER;
  qty2 INTEGER;
BEGIN
  -- Simplified Jaccard similarity
  -- (This is a basic version, can be optimized)
  
  FOR card1 IN SELECT * FROM jsonb_array_elements(cards1)
  LOOP
    name1 := card1->>'name';
    qty1 := (card1->>'quantity')::INTEGER;
    
    -- Find matching card in cards2
    SELECT card->>'quantity' INTO qty2
    FROM jsonb_array_elements(cards2) AS card
    WHERE card->>'name' = name1;
    
    IF qty2 IS NOT NULL THEN
      matches := matches + LEAST(qty1, qty2);
      total := total + GREATEST(qty1, qty2);
    ELSE
      total := total + qty1;
    END IF;
  END LOOP;
  
  -- Add cards only in cards2
  FOR card2 IN SELECT * FROM jsonb_array_elements(cards2)
  LOOP
    name2 := card2->>'name';
    
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(cards1) AS card
      WHERE card->>'name' = name2
    ) THEN
      total := total + (card2->>'quantity')::INTEGER;
    END IF;
  END LOOP;
  
  IF total = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND(matches::DECIMAL / total::DECIMAL, 3);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ───────────────────────────────────────────────────────────
-- VIEWS: Useful aggregations
-- ───────────────────────────────────────────────────────────

-- View: Top ink combinations
CREATE VIEW v_top_ink_combos AS
SELECT 
  inks,
  COUNT(*) as deck_count,
  AVG(placement) as avg_placement
FROM decks
WHERE 
  placement IS NOT NULL 
  AND get_deck_total_cards(cards) = 60
GROUP BY inks
ORDER BY deck_count DESC;

-- View: Meta statistics
CREATE VIEW v_meta_stats AS
SELECT
  COUNT(*) as total_decks,
  COUNT(DISTINCT tournament_id) as total_tournaments,
  COUNT(*) FILTER (WHERE placement <= 4) as top4_decks,
  COUNT(*) FILTER (WHERE placement <= 8) as top8_decks,
  COUNT(*) FILTER (WHERE placement <= 16) as top16_decks,
  COUNT(*) FILTER (WHERE placement <= 32) as top32_decks,
  MAX(scraped_at) as last_scrape
FROM decks
WHERE get_deck_total_cards(cards) = 60;

-- ───────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ───────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_decks ENABLE ROW LEVEL SECURITY;

-- Users: só pode ver/editar próprios dados
CREATE POLICY users_select_own ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- User decks: usuário vê próprios decks + decks públicos
CREATE POLICY user_decks_select ON user_decks
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR is_public = true
  );

CREATE POLICY user_decks_insert ON user_decks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_decks_update ON user_decks
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY user_decks_delete ON user_decks
  FOR DELETE
  USING (auth.uid() = user_id);

-- Cards, tournaments, decks: público (read-only)
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY cards_select_all ON cards
  FOR SELECT
  USING (true);

CREATE POLICY tournaments_select_all ON tournaments
  FOR SELECT
  USING (true);

CREATE POLICY decks_select_all ON decks
  FOR SELECT
  USING (true);

-- ═══════════════════════════════════════════════════════════
-- SEED DATA (optional - for testing)
-- ═══════════════════════════════════════════════════════════

-- Example tournament
INSERT INTO tournaments (id, name, url, format, date) VALUES
('363187', 'Desafio Guayacan - Whispers in the Well', 'https://inkdecks.com/lorcana-tournaments/desafio-guayacan-whispers-in-the-well-tournament-decks-363187', 'core', '2026-02-15');

-- Note: Cards and decks will be imported via migration script
