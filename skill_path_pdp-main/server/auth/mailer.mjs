import nodemailer from 'nodemailer';

let transporter = null;

function isMailerConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      // Port 465 is implicit TLS; everything else (587, 25, ...) uses
      // STARTTLS, which nodemailer negotiates automatically when
      // `secure: false`.
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Emails a password-reset OTP to the user.
 *
 * If SMTP isn't configured (e.g. local development without mail
 * credentials set up yet), this falls back to logging the code to the
 * server console instead of throwing - so the reset flow is still
 * fully testable end-to-end without a real mail provider. In
 * production, set the SMTP_* variables in .env so real emails go out.
 */
export async function sendPasswordResetOtpEmail(toEmail, otp) {
  if (!isMailerConfigured()) {
    console.warn(
      '[mailer] SMTP is not configured (see SMTP_* in .env.example) - printing the code instead of emailing it.',
    );
    console.warn(`[mailer] Password reset code for ${toEmail}: ${otp}`);
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await getTransporter().sendMail({
    from,
    to: toEmail,
    subject: 'Your SkillPath password reset code',
    text: `Your SkillPath password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, you can safely ignore this email - your password will not be changed.`,
    html: `
      <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 8px;">Reset your SkillPath password</h2>
        <p>Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
        <p style="font-size: 32px; font-weight: 800; letter-spacing: 6px; margin: 24px 0;">${otp}</p>
        <p style="color: #666; font-size: 13px;">
          If you didn't request this, you can safely ignore this email - your password will not be changed.
        </p>
      </div>
    `,
  });
}

export { isMailerConfigured };
