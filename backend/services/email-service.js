/**
 * Envio de emails: Resend (HTTP, recomendado no Render) ou SMTP (nodemailer).
 * No Render, ligações SMTP para gmail:587 costumam dar ETIMEDOUT — use RESEND_API_KEY.
 */

const nodemailer = require('nodemailer');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3002';

function smtpCredentials() {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  return { user, pass };
}

function isSmtpConfigured() {
  const { user, pass } = smtpCredentials();
  return Boolean(user && pass);
}

function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && String(process.env.RESEND_API_KEY).trim());
}

/** O Render define RENDER=true — SMTP outbound para :587 costuma dar ETIMEDOUT. */
function isRenderRuntime() {
  return String(process.env.RENDER || '').toLowerCase() === 'true';
}

/** No Render, só tentamos SMTP se o operador optar explicitamente (pode continuar a falhar). */
function smtpAllowedOnRender() {
  return !isRenderRuntime() || String(process.env.SMTP_ALLOW_ON_RENDER || '').toLowerCase() === 'true';
}

function smtpTimeoutMs() {
  return Math.min(
    120000,
    Math.max(5000, parseInt(process.env.SMTP_CONNECTION_TIMEOUT || '15000', 10) || 15000)
  );
}

function createTransporter() {
  const { user, pass } = smtpCredentials();
  const port = parseInt(process.env.SMTP_PORT, 10);
  const usePort = Number.isFinite(port) ? port : 587;
  const secure = usePort === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: usePort,
    secure,
    connectionTimeout: smtpTimeoutMs(),
    greetingTimeout: smtpTimeoutMs(),
    socketTimeout: smtpTimeoutMs(),
    auth: user && pass ? { user, pass } : undefined,
    tls: { minVersion: 'TLSv1.2' },
  });
}

function resolveResendFrom() {
  const raw =
    process.env.RESEND_FROM ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    'onboarding@resend.dev';
  let s = String(raw).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

async function sendWithResend({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  const from = resolveResendFrom();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    console.error('[email] Resend resposta:', res.status, bodyText);
    const err = new Error(bodyText || `Resend HTTP ${res.status}`);
    err.code = 'RESEND_HTTP_ERROR';
    throw err;
  }
  return { channel: 'resend' };
}

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
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🃏</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Lorcana AI</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px;">Olá, ${username}! 👋</h2>
              <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Obrigado por se cadastrar no <strong>Lorcana AI</strong>! Para completar seu cadastro, verifique seu email.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${verificationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; display: inline-block;">
                      Verificar Meu Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                Ou copie e cole este link:<br>
                <a href="${verificationLink}" style="color: #667eea; word-break: break-all;">${verificationLink}</a>
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

function getPasswordResetEmailTemplate(username, resetLink) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Recuperar Senha</title></head>
<body style="font-family: Arial, sans-serif; padding: 24px;">
  <h2>Olá, ${username}!</h2>
  <p>Redefina sua senha clicando no link:</p>
  <p><a href="${resetLink}">${resetLink}</a></p>
</body>
</html>
  `;
}

/**
 * @returns {Promise<{ sent: boolean, channel?: string, code?: string, hint?: string, debugLink?: string }>}
 */
async function sendVerificationEmail(email, username, token) {
  const verificationLink = `${API_URL}/api/auth/verify-email/${token}`;
  const subject = '✅ Verifique seu email - Lorcana AI';
  const html = getVerificationEmailTemplate(username, verificationLink);
  const text = `Olá ${username}!\n\nVerifique: ${verificationLink}\n\nLink válido por 24h.`;

  const debugLink =
    process.env.AUTH_DEBUG_VERIFICATION_LINK === 'true'
      ? verificationLink
      : undefined;

  if (process.env.AUTH_SKIP_EMAIL === 'true') {
    console.warn('[email] AUTH_SKIP_EMAIL: link de verificação (não enviado):', verificationLink);
    return {
      sent: false,
      code: 'SKIP_EMAIL',
      hint: 'AUTH_SKIP_EMAIL=true — email não enviado; use o link nos logs do servidor.',
      debugLink,
    };
  }

  if (isResendConfigured()) {
    try {
      const r = await sendWithResend({ to: email, subject, html, text });
      console.log('✅ Verification email (Resend):', email);
      return { sent: true, channel: r.channel };
    } catch (err) {
      console.error('❌ Resend verification:', err.message);
    }
  }

  if (!isSmtpConfigured()) {
    console.warn(
      '[email] SMTP não configurado (SMTP_USER/SMTP_PASS ou EMAIL_USER/EMAIL_PASS). Link:',
      verificationLink
    );
    return {
      sent: false,
      code: 'NO_MAIL_TRANSPORT',
      hint:
        'Configure RESEND_API_KEY (recomendado no Render) ou SMTP_USER + SMTP_PASS. SMTP direto no Render costuma dar timeout.',
      debugLink,
    };
  }

  if (!smtpAllowedOnRender()) {
    console.warn(
      '[email] Render: SMTP não será tentado (evita ETIMEDOUT). Usa RESEND_API_KEY ou SMTP_ALLOW_ON_RENDER=true. Link:',
      verificationLink
    );
    return {
      sent: false,
      code: 'RENDER_SMTP_SKIPPED',
      hint:
        'No Render, adiciona RESEND_API_KEY nas Environment Variables. SMTP na porta 587 costuma ser bloqueado/timeout.',
      debugLink,
    };
  }

  const mailOptions = {
    from: `"Lorcana AI" <${smtpCredentials().user}>`,
    to: email,
    subject,
    html,
    text,
  };

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email (SMTP):', info.messageId);
    return { sent: true, channel: 'smtp' };
  } catch (err) {
    console.error('❌ SMTP verification:', err.message, err.code || '');
    const hint =
      err.code === 'ETIMEDOUT' || String(err.message).includes('timeout')
        ? 'Timeout ao ligar ao SMTP. Em hospedagens como o Render use Resend (RESEND_API_KEY) em vez de porta 587.'
        : 'Falha ao enviar por SMTP. Verifique SMTP_HOST/PORT e credenciais.';

    return {
      sent: false,
      code: err.code || 'SMTP_ERROR',
      hint,
      debugLink,
    };
  }
}

/**
 * @returns {Promise<{ sent: boolean, channel?: string, code?: string, hint?: string }>}
 */
async function sendPasswordResetEmail(email, username, token) {
  const resetLink = `${APP_URL}/reset-password?token=${token}`;
  const subject = '🔐 Recuperar senha - Lorcana AI';
  const html = getPasswordResetEmailTemplate(username, resetLink);
  const text = `Recuperação de senha: ${resetLink}`;

  if (process.env.AUTH_SKIP_EMAIL === 'true') {
    console.warn('[email] AUTH_SKIP_EMAIL reset link:', resetLink);
    return { sent: false, code: 'SKIP_EMAIL', hint: 'Email desativado (AUTH_SKIP_EMAIL).' };
  }

  if (isResendConfigured()) {
    try {
      await sendWithResend({ to: email, subject, html, text });
      return { sent: true, channel: 'resend' };
    } catch (err) {
      console.error('❌ Resend reset:', err.message);
    }
  }

  if (!isSmtpConfigured()) {
    console.warn('[email] reset: sem transporte, link:', resetLink);
    return { sent: false, code: 'NO_MAIL_TRANSPORT', hint: 'Configure Resend ou SMTP.' };
  }

  if (!smtpAllowedOnRender()) {
    console.warn('[email] Render: reset por SMTP ignorado. Link:', resetLink);
    return {
      sent: false,
      code: 'RENDER_SMTP_SKIPPED',
      hint: 'Define RESEND_API_KEY no Render para enviar emails.',
    };
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Lorcana AI" <${smtpCredentials().user}>`,
      to: email,
      subject,
      html,
      text,
    });
    return { sent: true, channel: 'smtp' };
  } catch (err) {
    console.error('❌ SMTP reset:', err.message);
    return {
      sent: false,
      code: err.code || 'SMTP_ERROR',
      hint: 'Falha SMTP; em produção use RESEND_API_KEY.',
    };
  }
}

async function verifyEmailConfig() {
  if (isResendConfigured()) {
    console.log('✅ Email: Resend API key presente');
    return true;
  }
  if (!isSmtpConfigured()) {
    console.warn('⚠️ Email: nem Resend nem SMTP configurados');
    return false;
  }
  if (!smtpAllowedOnRender()) {
    console.warn('⚠️ Email: SMTP no Render desativado (usa RESEND_API_KEY)');
    return false;
  }
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email: SMTP OK');
    return true;
  } catch (err) {
    console.error('❌ Email SMTP verify:', err.message);
    return false;
  }
}

/** Uma linha no boot para perceberes o que o deploy está a usar. */
function logEmailBootstrap() {
  if (isResendConfigured()) {
    const from = resolveResendFrom();
    console.log('📧 Email: Resend ativo. Remetente (From):', from);
    if (/@gmail\.com/i.test(from) && !/@resend\.dev/i.test(from)) {
      console.warn(
        '📧 Aviso: Resend normalmente não envia como @gmail.com até verificares um domínio próprio. Usa um domínio verificado em resend.com/domains ou onboarding@resend.dev para testes.'
      );
    }
    return;
  }
  if (!isSmtpConfigured()) {
    console.warn(
      '📧 Email: sem RESEND_API_KEY nem SMTP — emails de verificação não serão enviados até configurares.'
    );
    return;
  }
  if (!smtpAllowedOnRender()) {
    console.warn(
      '📧 Email: SMTP definido mas ignorado no Render (evita timeout). Adiciona RESEND_API_KEY no dashboard.'
    );
    return;
  }
  console.log(
    '📧 Email: SMTP',
    process.env.SMTP_HOST || 'smtp.gmail.com',
    '— em Render pode falhar com ETIMEDOUT; prefere Resend.'
  );
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  verifyEmailConfig,
  logEmailBootstrap,
  isSmtpConfigured,
  isResendConfigured,
};
