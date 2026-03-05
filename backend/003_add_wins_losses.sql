-- Migration 003: Add Win/Loss Tracking
-- Execute no Supabase SQL Editor

-- ════════════════════════════════════════════════════════════
-- 1. Adicionar colunas na tabela decks
-- ════════════════════════════════════════════════════════════

ALTER TABLE decks 
ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS draws INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS record TEXT;

-- Comentários
COMMENT ON COLUMN decks.wins IS 'Number of wins (extracted from record)';
COMMENT ON COLUMN decks.losses IS 'Number of losses (extracted from record)';
COMMENT ON COLUMN decks.draws IS 'Number of draws (extracted from record)';
COMMENT ON COLUMN decks.record IS 'Record string (e.g., "5-2", "4-1-1")';

-- ════════════════════════════════════════════════════════════
-- 2. Atualizar tabela archetypes_meta
-- ════════════════════════════════════════════════════════════

ALTER TABLE archetypes_meta
ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_losses INTEGER DEFAULT 0;

COMMENT ON COLUMN archetypes_meta.total_wins IS 'Sum of all wins for this archetype';
COMMENT ON COLUMN archetypes_meta.total_losses IS 'Sum of all losses for this archetype';

-- ════════════════════════════════════════════════════════════
-- 3. Verificar resultado
-- ════════════════════════════════════════════════════════════

-- Ver schema de decks
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'decks'
  AND column_name IN ('wins', 'losses', 'draws', 'record')
ORDER BY ordinal_position;

-- Ver schema de archetypes_meta
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'archetypes_meta'
  AND column_name IN ('total_wins', 'total_losses')
ORDER BY ordinal_position;

-- ════════════════════════════════════════════════════════════
-- 4. Teste: Inserir um deck com record
-- ════════════════════════════════════════════════════════════

-- Exemplo de insert com record
/*
INSERT INTO decks (
  name, archetype, inks, wins, losses, draws, record,
  cards, placement, scraped_at
) VALUES (
  'Test Deck',
  'Amethyst/Sapphire',
  ARRAY['Amethyst', 'Sapphire'],
  5,  -- wins
  2,  -- losses
  0,  -- draws
  '5-2',  -- record
  '[]'::jsonb,
  1,
  NOW()
);
*/

-- ════════════════════════════════════════════════════════════
-- 5. Calcular win rate
-- ════════════════════════════════════════════════════════════

-- Ver decks com win rate calculado
SELECT 
  name,
  archetype,
  wins,
  losses,
  record,
  placement,
  CASE 
    WHEN (wins + losses) > 0 
    THEN ROUND((wins::numeric / (wins + losses)) * 100, 2)
    ELSE NULL
  END as win_rate_pct
FROM decks
WHERE wins > 0 OR losses > 0
ORDER BY win_rate_pct DESC NULLS LAST
LIMIT 10;

-- ════════════════════════════════════════════════════════════
-- Resultado esperado:
-- ════════════════════════════════════════════════════════════
-- 
-- columns:
--   wins       | integer | 0
--   losses     | integer | 0
--   draws      | integer | 0
--   record     | text    | NULL
--
-- archetypes_meta columns:
--   total_wins   | integer | 0
--   total_losses | integer | 0
--
-- ✅ Migration complete!
