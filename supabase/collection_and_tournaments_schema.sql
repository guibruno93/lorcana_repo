-- Opcional: schema Supabase alinhado ao prompt (a app usa também ficheiro JSON local).
-- Executar manualmente no SQL Editor se quiseres persistência na cloud.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_collection (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 0 CHECK (quantity >= 0 AND quantity <= 4),
  physical BOOLEAN DEFAULT true,
  digital BOOLEAN DEFAULT false,
  condition TEXT DEFAULT 'Mint',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT,
  format TEXT NOT NULL,
  rounds INTEGER,
  top_cut INTEGER,
  max_players INTEGER,
  registration_type TEXT,
  status TEXT DEFAULT 'registration',
  current_round INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_id TEXT,
  deck_name TEXT,
  points INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  table_number INTEGER,
  player1_id UUID REFERENCES tournament_players(id),
  player2_id UUID REFERENCES tournament_players(id),
  winner_id UUID REFERENCES tournament_players(id),
  result TEXT,
  reported_at TIMESTAMPTZ
);
