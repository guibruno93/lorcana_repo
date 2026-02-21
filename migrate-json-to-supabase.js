/**
 * migrate-json-to-supabase.js
 * Script para migrar usuários de JSON local para Supabase
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Paths
const USERS_FILE = path.join(__dirname, 'data/users.json');
const TOKENS_FILE = path.join(__dirname, 'data/verification-tokens.json');

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

async function loadJSONFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`⚠️  Arquivo não encontrado: ${filePath}`);
      return null;
    }
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════
// MIGRATION
// ══════════════════════════════════════════════════════════════

async function migrateUsers() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Migração: JSON → Supabase                         ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // 1. Carregar dados JSON
  console.log('1️⃣  Carregando dados do JSON...\n');

  const usersData = await loadJSONFile(USERS_FILE);
  const tokensData = await loadJSONFile(TOKENS_FILE);

  if (!usersData) {
    console.log('❌ Nenhum usuário encontrado para migrar.');
    return;
  }

  const users = usersData.users || [];
  const tokens = tokensData?.tokens || [];

  console.log(`   📊 Usuários encontrados: ${users.length}`);
  console.log(`   📊 Tokens encontrados: ${tokens.length}\n`);

  if (users.length === 0) {
    console.log('❌ Nenhum usuário para migrar.');
    return;
  }

  // 2. Migrar usuários
  console.log('2️⃣  Migrando usuários...\n');

  let successCount = 0;
  let errorCount = 0;
  const migratedUsers = [];

  for (const user of users) {
    try {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (existing) {
        console.log(`   ⚠️  Usuário já existe: ${user.email} (pulando)`);
        continue;
      }

      // Inserir usuário
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            username: user.username,
            email: user.email,
            password_hash: user.password,
            country: user.country || null,
            email_verified: user.emailVerified || false,
            created_at: user.createdAt || new Date().toISOString(),
            verified_at: user.verifiedAt || null,
            updated_at: user.updatedAt || null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error(`   ❌ Erro ao migrar ${user.email}:`, error.message);
        errorCount++;
        continue;
      }

      console.log(`   ✅ Migrado: ${user.email}`);
      successCount++;
      migratedUsers.push(newUser);

    } catch (err) {
      console.error(`   ❌ Erro inesperado ao migrar ${user.email}:`, err.message);
      errorCount++;
    }
  }

  console.log('');
  console.log(`   📊 Sucesso: ${successCount}`);
  console.log(`   📊 Erros: ${errorCount}\n`);

  // 3. Migrar tokens
  if (tokens.length > 0 && migratedUsers.length > 0) {
    console.log('3️⃣  Migrando tokens de verificação...\n');

    let tokenSuccessCount = 0;
    let tokenErrorCount = 0;

    for (const token of tokens) {
      try {
        // Verificar se usuário foi migrado
        const userExists = migratedUsers.some(u => u.id === token.userId);
        if (!userExists) {
          continue;
        }

        // Verificar se token ainda é válido
        const expiresAt = new Date(token.expiresAt);
        if (expiresAt < new Date()) {
          console.log(`   ⏰ Token expirado (pulando): ${token.email}`);
          continue;
        }

        // Inserir token
        const { error } = await supabase
          .from('verification_tokens')
          .insert([
            {
              user_id: token.userId,
              token: token.token,
              token_type: token.type,
              email: token.email,
              expires_at: token.expiresAt,
              created_at: token.createdAt || new Date().toISOString(),
            },
          ]);

        if (error) {
          console.error(`   ❌ Erro ao migrar token ${token.email}:`, error.message);
          tokenErrorCount++;
          continue;
        }

        console.log(`   ✅ Token migrado: ${token.email}`);
        tokenSuccessCount++;

      } catch (err) {
        console.error(`   ❌ Erro inesperado ao migrar token:`, err.message);
        tokenErrorCount++;
      }
    }

    console.log('');
    console.log(`   📊 Tokens migrados: ${tokenSuccessCount}`);
    console.log(`   📊 Erros: ${tokenErrorCount}\n`);
  }

  // 4. Resumo final
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   ✅ MIGRAÇÃO CONCLUÍDA!                             ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  console.log('📊 Resumo:');
  console.log(`   Usuários migrados: ${successCount}/${users.length}`);
  console.log(`   Erros: ${errorCount}`);
  console.log('');

  if (successCount > 0) {
    console.log('✅ Próximos passos:');
    console.log('   1. Verificar dados no Supabase Dashboard');
    console.log('   2. Substituir routes/auth.js por auth-supabase.js');
    console.log('   3. Reiniciar backend: npm start');
    console.log('   4. Testar login com usuários migrados');
    console.log('');
  }

  // 5. Opção de backup
  if (successCount > 0) {
    console.log('💾 Backup dos arquivos JSON:');
    console.log('   Os arquivos originais foram preservados.');
    console.log('   Você pode removê-los manualmente após confirmar que tudo funciona.\n');
  }
}

// ══════════════════════════════════════════════════════════════
// VERIFICAÇÃO PRÉ-MIGRAÇÃO
// ══════════════════════════════════════════════════════════════

async function checkSupabaseConnection() {
  console.log('🔍 Verificando conexão com Supabase...\n');

  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Erro ao conectar com Supabase:', error.message);
      console.log('');
      console.log('💡 Verifique:');
      console.log('   1. SUPABASE_URL está correto no .env');
      console.log('   2. SUPABASE_SERVICE_KEY está correto no .env');
      console.log('   3. Tabela "users" existe no Supabase');
      console.log('   4. Execute supabase-users-schema.sql no SQL Editor\n');
      return false;
    }

    console.log('✅ Conexão com Supabase OK!\n');
    return true;

  } catch (err) {
    console.error('❌ Erro inesperado:', err.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

async function main() {
  try {
    // Verificar conexão
    const connected = await checkSupabaseConnection();
    if (!connected) {
      process.exit(1);
    }

    // Migrar
    await migrateUsers();

  } catch (err) {
    console.error('\n❌ Erro fatal:', err);
    process.exit(1);
  }
}

// Executar
if (require.main === module) {
  main();
}

module.exports = { migrateUsers, checkSupabaseConnection };
