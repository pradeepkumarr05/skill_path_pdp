import nodemailer from 'nodemailer';
import { randomBytes, createHash } from 'node:crypto';
import { query, withTransaction } from './db.mjs';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export const digestToken = token => createHash('sha256').update(token).digest('hex');

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
}

export async function sendAccountLink(candidate, purpose) {
  if (!mailConfigured()) throw fail('Email delivery is unavailable. Please try again later.', 503);
  const token = randomBytes(32).toString('hex');
  const minutes = purpose === 'verify' ? 60 : 20;
  const hash = digestToken(token);
  await withTransaction(async () => {
    await query('SELECT id FROM candidates WHERE id=$1 FOR UPDATE', [candidate.id]);
    const recent = await query('SELECT id FROM account_tokens WHERE candidate_id=$1 AND purpose=$2 AND created_at > NOW() - INTERVAL \'60 seconds\'', [candidate.id, purpose]);
    if (recent.rows.length) throw fail('Please wait a minute before requesting another email.', 429);
    await query('INSERT INTO account_tokens (candidate_id,purpose,token_hash,expires_at) VALUES ($1,$2,$3,NOW()+$4*INTERVAL \'1 minute\')', [candidate.id, purpose, hash, minutes]);
  });
  const origin = new URL(process.env.CLIENT_ORIGIN || 'http://localhost:5173');
  origin.hash = new URLSearchParams({ auth: purpose, token }).toString();
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM, to: candidate.email,
      subject: purpose === 'verify' ? 'Verify your SkillPath email' : 'Reset your SkillPath password',
      text: `${purpose === 'verify' ? 'Verify your email address' : 'Reset your password'} using this link:\n\n${origin.href}\n\nThis link expires in ${minutes} minutes and can be used once. If you did not request it, ignore this email.`,
    });
    if (!info.accepted?.length) throw new Error('Recipient was not accepted');
  } catch {
    await query('DELETE FROM account_tokens WHERE token_hash=$1', [hash]);
    throw fail('The email could not be sent. Please try again later.', 503);
  } finally { transport.close(); }
}

export async function consumeAccountToken(token, purpose, action) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw fail('This link is invalid or has expired. Request a new one.');
  return withTransaction(async () => {
    const lookup = await query('SELECT candidate_id FROM account_tokens WHERE token_hash=$1 AND purpose=$2', [digestToken(token), purpose]);
    if (!lookup.rows.length) throw fail('This link is invalid or has expired. Request a new one.');
    // Lock the account first so concurrent resets and new sign-ins serialize.
    await query('SELECT id FROM candidates WHERE id=$1 FOR UPDATE', [lookup.rows[0].candidate_id]);
    const { rows } = await query('DELETE FROM account_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>NOW() RETURNING candidate_id', [digestToken(token), purpose]);
    if (!rows.length) throw fail('This link is invalid or has expired. Request a new one.');
    const id = rows[0].candidate_id;
    await action(id);
    await query('DELETE FROM account_tokens WHERE candidate_id=$1 AND purpose=$2', [id, purpose]);
    return { ok: true };
  });
}
