/**
 * migrate-json-to-supabase-with-decrypt.js
 * Migração com DESCRIPTOGRAFIA dos dados criptografados
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Paths
const USERS_FILE = path.join(__dirname, 'data/users.json');
const TOKENS_FILE = path.join(__dirname, 'data/verification-tokens.json');

// Encryption key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

// ══════════════════════════════════════════════════════════════
// DESCRIPTOGRAFIA
// ══════════════════════════════════════════════════════════════

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    // Verificar se parece criptografado (tem ':')
    if (!encryptedText.includes(':')) {
      // Já está em texto plano
      return encryptedText;
    }
    
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(ENCRYPTION_KEY.substring(0, 64), 'hex');
    
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('   ⚠️  Erro ao descriptografar:', encryptedText.substring(0, 20) + '...');
    return null;
  }
}

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
  console.log('║   Migração: JSON → Supabase (COM DESCRIPTOGRAFIA)    ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // 1. Verificar encryption key
  console.log('🔐 Verificando encryption key...\n');
  
  if (!process.env.ENCRYPTION_KEY) {
    console.log('⚠️  ENCRYPTION_KEY não encontrada no .env');
    console.log('   Usando key padrão (pode não funcionar se dados foram criptografados com outra key)\n');
  } else {
    console.log('✅ ENCRYPTION_KEY encontrada\n');
  }

  // 2. Carregar dados JSON
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

  // 3. Migrar usuários
  console.log('2️⃣  Migrando usuários com descriptografia...\n');

  let successCount = 0;
  let errorCount = 0;
  let skipCount = 0;
  const migratedUsers = [];

  for (const user of users) {
    try {
      // Descriptografar dados
      const username = decrypt(user.username);
      const email = decrypt(user.email);
      const country = user.country ? decrypt(user.country) : null;

      console.log(`   📧 Processando: ${email || 'email inválido'}`);

      // Validar email descriptografado
      if (!email || !email.includes('@')) {
        console.log(`   ❌ Email inválido após descriptografia: ${email}`);
        errorCount++;
        continue;
      }

      // Verificar se já existe
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        console.log(`   ⚠️  Usuário já existe: ${email} (pulando)`);
        skipCount++;
        continue;
      }

      // Inserir usuário
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            username: username || email.split('@')[0], // fallback para parte do email
            email: email,
            password_hash: user.password, // senha já está em hash bcrypt (não descriptografar!)
            country: country,
            email_verified: user.emailVerified || false,
            created_at: user.createdAt || new Date().toISOString(),
            verified_at: user.verifiedAt || null,
            updated_at: user.updatedAt || null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error(`   ❌ Erro ao migrar ${email}:`, error.message);
        errorCount++;
        continue;
      }

      console.log(`   ✅ Migrado: ${email}`);
      successCount++;
      migratedUsers.push(newUser);

    } catch (err) {
      console.error(`   ❌ Erro inesperado:`, err.message);
      errorCount++;
    }
  }

  console.log('');
  console.log(`   📊 Sucesso: ${successCount}`);
  console.log(`   📊 Pulados (já existem): ${skipCount}`);
  console.log(`   📊 Erros: ${errorCount}\n`);

  // 4. Migrar tokens (se houver)
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

  // 5. Resumo final
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   ✅ MIGRAÇÃO CONCLUÍDA!                             ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  console.log('📊 Resumo:');
  console.log(`   Usuários migrados: ${successCount}/${users.length}`);
  console.log(`   Pulados (já existem): ${skipCount}`);
  console.log(`   Erros: ${errorCount}`);
  console.log('');

  if (successCount > 0) {
    console.log('✅ Próximos passos:');
    console.log('   1. Verificar dados no Supabase Dashboard');
    console.log('   2. Testar login com usuários migrados');
    console.log('   3. Backend já está usando Supabase!');
    console.log('');
  }

  if (errorCount > 0) {
    console.log('⚠️  Alguns usuários não foram migrados:');
    console.log('   - Verifique se ENCRYPTION_KEY está correta');
    console.log('   - Emails podem estar corrompidos no JSON');
    console.log('   - Você pode criar as contas novamente manualmente\n');
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
    const connected = await checkSupabaseConnection();
    if (!connected) {
      process.exit(1);
    }

    await migrateUsers();

  } catch (err) {
    console.error('\n❌ Erro fatal:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateUsers, checkSupabaseConnection };
