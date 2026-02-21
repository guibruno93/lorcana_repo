/**
 * test-email.js
 * Script para testar configuração e envio de emails
 */

require('dotenv').config();
const { 
  sendVerificationEmail, 
  sendPasswordResetEmail,
  verifyEmailConfig 
} = require('./services/email-service');

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Email Service Test                                ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Verificar variáveis de ambiente
  console.log('1️⃣  Verificando variáveis de ambiente...\n');
  
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  let allVarsSet = true;
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: ${process.env[varName].substring(0, 20)}...`);
    } else {
      console.log(`   ❌ ${varName}: NOT SET`);
      allVarsSet = false;
    }
  }
  
  console.log('');
  
  if (!allVarsSet) {
    console.log('❌ Variáveis de ambiente faltando!');
    console.log('\n📝 Configure o .env com:');
    console.log('   SMTP_HOST=smtp.gmail.com');
    console.log('   SMTP_PORT=587');
    console.log('   SMTP_USER=guilhermebcardoso12@gmail.com');
    console.log('   SMTP_PASS=kjoy oxvl uycv rveb\n');
    return;
  }

  // Verificar configuração do transporter
  console.log('2️⃣  Verificando configuração do SMTP...\n');
  
  const isConfigured = await verifyEmailConfig();
  
  if (!isConfigured) {
    console.log('❌ Erro na configuração do SMTP!');
    console.log('\n💡 Possíveis causas:');
    console.log('   - SMTP_USER ou SMTP_PASS incorretos');
    console.log('   - Gmail: Use senha de app, não senha normal');
    console.log('   - Firewall bloqueando porta 587');
    console.log('   - Verificação em 2 etapas não ativada (Gmail)\n');
    return;
  }
  
  console.log('   ✅ Configuração SMTP OK!\n');

  // Perguntar se quer enviar email de teste
  console.log('3️⃣  Email de teste\n');
  console.log('   ⚠️  Isso vai enviar um email REAL!\n');
  
  // Para testes automáticos, configure este email
  const testEmail = process.env.TEST_EMAIL || 'guilhermebcardoso12@gmail.com';
  
  console.log(`   📧 Email de destino: ${testEmail}\n`);
  
  if (testEmail === 'seu.email@gmail.com') {
    console.log('❌ Configure TEST_EMAIL no .env ou edite este script!\n');
    console.log('   Exemplo: TEST_EMAIL=seu.email@gmail.com\n');
    return;
  }

  // Enviar email de verificação
  console.log('   📤 Enviando email de verificação...');
  
  try {
    await sendVerificationEmail(
      testEmail,
      'Teste de Usuário',
      'test-token-' + Date.now()
    );
    console.log('   ✅ Email de verificação enviado!\n');
  } catch (err) {
    console.error('   ❌ Erro ao enviar:', err.message, '\n');
    return;
  }

  // Enviar email de reset
  console.log('   📤 Enviando email de reset de senha...');
  
  try {
    await sendPasswordResetEmail(
      testEmail,
      'Teste de Usuário',
      'reset-token-' + Date.now()
    );
    console.log('   ✅ Email de reset enviado!\n');
  } catch (err) {
    console.error('   ❌ Erro ao enviar:', err.message, '\n');
    return;
  }

  // Sucesso
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   ✅ TODOS OS TESTES PASSARAM!                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  console.log('📧 Verifique sua caixa de entrada em:', testEmail);
  console.log('   Você deve ter recebido 2 emails:\n');
  console.log('   1. Email de verificação');
  console.log('   2. Email de reset de senha\n');
  
  console.log('💡 Se não recebeu:');
  console.log('   - Verifique spam/lixo eletrônico');
  console.log('   - Aguarde alguns minutos');
  console.log('   - Verifique se o email está correto\n');
}

// Executar
main().catch(err => {
  console.error('\n❌ Erro não tratado:', err);
  process.exit(1);
});
