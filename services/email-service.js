/**
 * backend/services/email-service.js
 * Serviço de envio de emails (compatível com nodemailer v8)
 */

const nodemailer = require('nodemailer');

// Função para criar transporter (lazy initialization)
function createTransporter() {
  // Configuração do transporter
  // Use variáveis de ambiente para configurar seu provedor de email
  return nodemailer.createTransport({
    // OPÇÃO 1: Gmail (para desenvolvimento)
    // service: 'gmail',
    // auth: {
    //   user: process.env.EMAIL_USER,
    //   pass: process.env.EMAIL_PASS, // Use App Password se tiver 2FA
    // },

    // OPÇÃO 2: SMTP Customizado (recomendado para produção)
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // true para 465, false para outras portas
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },

    // OPÇÃO 3: SendGrid (produção)
    // host: 'smtp.sendgrid.net',
    // port: 587,
    // auth: {
    //   user: 'apikey',
    //   pass: process.env.SENDGRID_API_KEY,
    // },
  });
}

// URL base da aplicação
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3002';

/**
 * Template HTML para email de verificação
 */
function getVerificationEmailTemplate(username, verificationLink) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificar Email - Lorcana AI</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header com Gradiente -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🃏</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Lorcana AI</h1>
            </td>
          </tr>

          <!-- Conteúdo -->
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px;">Olá, ${username}! 👋</h2>
              <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Obrigado por se cadastrar no <strong>Lorcana AI</strong>! Para completar seu cadastro e começar a usar nossa plataforma, precisamos verificar seu email.
              </p>
              
              <!-- Botão -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${verificationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                      Verificar Meu Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                Ou copie e cole este link no seu navegador:<br>
                <a href="${verificationLink}" style="color: #667eea; word-break: break-all;">${verificationLink}</a>
              </p>
            </td>
          </tr>

          <!-- Informações Adicionais -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-top: 20px;">
                <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                  <strong>⚠️ Importante:</strong> Este link expira em 24 horas. Se você não solicitou este cadastro, ignore este email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">
                Precisa de ajuda? <a href="mailto:support@lorcana-ai.com" style="color: #667eea; text-decoration: none;">Entre em contato</a>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 Lorcana AI. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Template HTML para email de recuperação de senha
 */
function getPasswordResetEmailTemplate(username, resetLink) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperar Senha - Lorcana AI</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🔐</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Recuperar Senha</h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 40px 20px;">
              <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px;">Olá, ${username}!</h2>
              <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Lorcana AI</strong>. Clique no botão abaixo para criar uma nova senha.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                      Redefinir Minha Senha
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                Ou copie e cole este link no seu navegador:<br>
                <a href="${resetLink}" style="color: #667eea; word-break: break-all;">${resetLink}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin-top: 20px;">
                <p style="color: #991b1b; font-size: 14px; margin: 0; line-height: 1.5;">
                  <strong>🔒 Segurança:</strong> Este link expira em 1 hora. Se você não solicitou esta alteração, ignore este email e sua senha permanecerá inalterada.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">
                Precisa de ajuda? <a href="mailto:support@lorcana-ai.com" style="color: #667eea; text-decoration: none;">Entre em contato</a>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 Lorcana AI. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Enviar email de verificação
 */
async function sendVerificationEmail(email, username, token) {
  const verificationLink = `${API_URL}/api/auth/verify-email/${token}`;
  
  const mailOptions = {
    from: `"Lorcana AI" <${process.env.SMTP_USER || 'noreply@lorcana-ai.com'}>`,
    to: email,
    subject: '✅ Verifique seu email - Lorcana AI',
    html: getVerificationEmailTemplate(username, verificationLink),
    text: `
Olá, ${username}!

Obrigado por se cadastrar no Lorcana AI!

Para completar seu cadastro, clique no link abaixo:
${verificationLink}

Este link expira em 24 horas.

Se você não solicitou este cadastro, ignore este email.

---
Lorcana AI
    `.trim(),
  };

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('❌ Error sending verification email:', err);
    throw err;
  }
}

/**
 * Enviar email de recuperação de senha
 */
async function sendPasswordResetEmail(email, username, token) {
  const resetLink = `${APP_URL}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: `"Lorcana AI" <${process.env.SMTP_USER || 'noreply@lorcana-ai.com'}>`,
    to: email,
    subject: '🔐 Recuperar senha - Lorcana AI',
    html: getPasswordResetEmailTemplate(username, resetLink),
    text: `
Olá, ${username}!

Recebemos uma solicitação para redefinir a senha da sua conta.

Para criar uma nova senha, clique no link abaixo:
${resetLink}

Este link expira em 1 hora.

Se você não solicitou esta alteração, ignore este email.

---
Lorcana AI
    `.trim(),
  };

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('❌ Error sending password reset email:', err);
    throw err;
  }
}

/**
 * Verificar configuração do email (útil para debug)
 */
async function verifyEmailConfig() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email service is ready');
    return true;
  } catch (err) {
    console.error('❌ Email service error:', err);
    return false;
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  verifyEmailConfig,
};
