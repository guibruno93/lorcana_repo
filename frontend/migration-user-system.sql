-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Adicionar sistema de usuários completo
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Criar tabela de usuários (se não existir)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Adicionar coluna user_id nas tabelas existentes
-- ⚠️ IMPORTANTE: Isso vai falhar se as tabelas já tiverem dados sem user_id
-- Se tiver dados, primeiro adicione como NULL, depois preencha, depois NOT NULL

-- Opção A: Se tabelas estão vazias
ALTER TABLE decks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL;
ALTER TABLE deck_cards ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Opção B: Se tabelas TÊM dados (fazer em 3 passos)
/*
-- Passo 1: Adicionar coluna como NULL
ALTER TABLE decks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Passo 2: Popular com um user_id padrão (criar um user fake primeiro)
INSERT INTO users (id, email, name, password_hash)
VALUES ('00000000-0000-0000-0000-000000000000', 'default@example.com', 'System', 'fake')
ON CONFLICT DO NOTHING;

UPDATE decks SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;

-- Passo 3: Tornar NOT NULL
ALTER TABLE decks ALTER COLUMN user_id SET NOT NULL;
*/

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id);
CREATE INDEX IF NOT EXISTS idx_deck_cards_deck_id ON deck_cards(deck_id);

-- 4. Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_cards ENABLE ROW LEVEL SECURITY;

-- 5. Criar policies (RLS)

-- Users: Cada usuário vê apenas seu próprio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (id = current_setting('app.user_id')::uuid);

-- Decks: Usuários podem CRUD seus próprios decks
DROP POLICY IF EXISTS "Users can view own decks" ON decks;
CREATE POLICY "Users can view own decks"
  ON decks FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS "Users can insert own decks" ON decks;
CREATE POLICY "Users can insert own decks"
  ON decks FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS "Users can update own decks" ON decks;
CREATE POLICY "Users can update own decks"
  ON decks FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS "Users can delete own decks" ON decks;
CREATE POLICY "Users can delete own decks"
  ON decks FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- Deck Cards: Automaticamente segue o deck
DROP POLICY IF EXISTS "Users can view own deck cards" ON deck_cards;
CREATE POLICY "Users can view own deck cards"
  ON deck_cards FOR SELECT
  USING (
    deck_id IN (
      SELECT id FROM decks WHERE user_id = current_setting('app.user_id')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can insert own deck cards" ON deck_cards;
CREATE POLICY "Users can insert own deck cards"
  ON deck_cards FOR INSERT
  WITH CHECK (
    deck_id IN (
      SELECT id FROM decks WHERE user_id = current_setting('app.user_id')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can update own deck cards" ON deck_cards;
CREATE POLICY "Users can update own deck cards"
  ON deck_cards FOR UPDATE
  USING (
    deck_id IN (
      SELECT id FROM decks WHERE user_id = current_setting('app.user_id')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can delete own deck cards" ON deck_cards;
CREATE POLICY "Users can delete own deck cards"
  ON deck_cards FOR DELETE
  USING (
    deck_id IN (
      SELECT id FROM decks WHERE user_id = current_setting('app.user_id')::uuid
    )
  );

-- 6. Adicionar função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Criar triggers para updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_decks_updated_at ON decks;
CREATE TRIGGER update_decks_updated_at
  BEFORE UPDATE ON decks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO: Executar após migration
-- ═══════════════════════════════════════════════════════════════════════════

-- Verificar estrutura das tabelas
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('users', 'decks', 'deck_cards')
ORDER BY table_name, ordinal_position;

-- Verificar policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('users', 'decks', 'deck_cards')
ORDER BY tablename, policyname;

-- Contar registros
SELECT 
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM decks) as decks_count,
  (SELECT COUNT(*) FROM deck_cards) as deck_cards_count;
