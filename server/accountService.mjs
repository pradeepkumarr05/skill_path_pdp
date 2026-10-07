import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { query, withTransaction } from './db.mjs';
import { signToken } from './auth.mjs';
import { consumeAccountToken, sendAccountLink } from './authMail.mjs';
import { skillEvidence } from './learningPolicy.mjs';

const google = new OAuth2Client();
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

export async function publicCandidate(c) {
  // This function also runs inside auth transactions, where queries share one client.
  const latest = await query(`SELECT r.score, r.level, r.total, r.correct_count, r.timed_out, r.created_at, r.results FROM skill_assessment_results r
      JOIN skill_assessments a ON a.id=r.assessment_id WHERE a.candidate_id=$1 ORDER BY r.created_at DESC LIMIT 1`, [c.id]);
  const deterministicHistory = await query(`SELECT a.id, a.status, a.started_at, a.submitted_at, a.terminated_at, r.score, r.level, r.total, r.correct_count, r.timed_out
      FROM skill_assessments a LEFT JOIN skill_assessment_results r ON r.assessment_id=a.id
      WHERE a.candidate_id=$1 ORDER BY a.created_at DESC LIMIT 25`, [c.id]);
  const chatbotHistory = await query(`SELECT id, status, reason, aggregate, model, gemini_configured, created_at, completed_at, terminated_at, warning_count
      FROM chat_sessions WHERE candidate_id=$1 ORDER BY created_at DESC LIMIT 25`, [c.id]);
  const assessmentHistory = [
    ...chatbotHistory.rows.map(item => ({ type: 'chatbot', id: item.id, status: item.status, reason: item.reason,
      aggregate: item.aggregate, model: item.model, geminiConfigured: item.gemini_configured, warningCount: item.warning_count,
      createdAt: item.created_at, completedAt: item.completed_at, terminatedAt: item.terminated_at })),
    ...deterministicHistory.rows.map(item => ({ type: 'deterministic', id: item.id, status: item.status, score: item.score === null ? null : Number(item.score),
      level: item.level, total: item.total, correctCount: item.correct_count, timedOut: item.timed_out,
      createdAt: item.started_at, completedAt: item.submitted_at, terminatedAt: item.terminated_at })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const completedChat = chatbotHistory.rows.find(item => item.status === 'completed' && (!latest.rows[0] || new Date(item.completed_at) <= new Date(latest.rows[0].created_at)));
  const chatStates = completedChat ? (await query('SELECT skill,final_score FROM chat_skill_states WHERE session_id=$1', [completedChat.id])).rows : [];
  return { id: c.id, name: c.name, email: c.email, qualification: c.qualification,
    skillEvidence: skillEvidence(latest.rows[0]?.results || [], chatStates),
    selectedDomain: c.selected_domain, assessmentDomain: c.assessment_domain,
    interestedRoles: c.interested_roles, claimedSkills: c.claimed_skills,
    emailVerified: Boolean(c.email_verified_at), profileComplete: c.profile_complete, setup: c.setup || {}, latestResult: latest.rows[0] ? {
      ...latest.rows[0], score: Number(latest.rows[0].score), total: Number(latest.rows[0].total), correct_count: Number(latest.rows[0].correct_count),
    } : null,
    assessmentHistory };
}

export async function authenticate(body, mode) {
  const response = await withTransaction(() => authenticateLocked(body, mode));
  if (mode === 'register') {
    try { await sendAccountLink(response.candidate, 'verify'); response.verificationSent = true; }
    catch { response.verificationSent = false; }
  }
  return response;
}

async function authenticateLocked(body, mode) {
  let candidate;
  if (mode === 'google') {
    if (!process.env.GOOGLE_CLIENT_ID) throw fail('Google sign-in is not configured.', 503);
    let identity;
    try {
      const ticket = await google.verifyIdToken({ idToken: String(body.credential || ''), audience: process.env.GOOGLE_CLIENT_ID });
      identity = ticket.getPayload();
    } catch { throw fail('Google sign-in could not be verified. Please try again.', 401); }
    if (!identity?.sub || !identity.email_verified || !identity.email) throw fail('A verified Google email is required.', 401);
    // Bind to the immutable Google subject. Verified email may link an existing account.
    const existing = await query('UPDATE candidates SET email_verified_at=COALESCE(email_verified_at,NOW()) WHERE google_sub=$1 RETURNING *', [identity.sub]);
    const result = existing.rows.length ? existing : await query(`INSERT INTO candidates (name, email, google_sub, email_verified_at)
      VALUES ($1, $2, $3, NOW()) ON CONFLICT (email) DO UPDATE SET google_sub = EXCLUDED.google_sub, email_verified_at=COALESCE(candidates.email_verified_at,NOW())
      WHERE (candidates.google_sub IS NULL OR candidates.google_sub = EXCLUDED.google_sub)
        AND (candidates.email_verified_at IS NOT NULL OR candidates.password_hash IS NULL) RETURNING *`,
    [identity.name || identity.email.split('@')[0], identity.email.toLowerCase(), identity.sub]);
    candidate = result.rows[0];
    if (!candidate) throw fail('Sign in with your password and verify your email before linking Google.', 409);
  } else if (mode === 'register') {
    if (typeof body.email !== 'string' || typeof body.username !== 'string' || typeof body.password !== 'string')
      throw fail('Email, username, and password must be text.');
    const email = String(body.email || '').trim().toLowerCase();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[\w.-]{3,50}$/.test(username) || password.length < 10 || Buffer.byteLength(password) > 72)
      throw fail('Use a valid email, a 3-50 character username, and a password of 10-72 bytes.');
    try {
      const result = await query('INSERT INTO candidates (name, email, username, password_hash) VALUES ($1,$2,$3,$4) RETURNING *',
        [username, email, username, await bcrypt.hash(password, 12)]);
      candidate = result.rows[0];
    } catch (error) { if (error.code === '23505') throw fail('An account with these details already exists. Please sign in.', 409); throw error; }
  } else {
    if (typeof body.username !== 'string' || typeof body.password !== 'string') throw fail('Invalid username or password.', 401);
    const identifier = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!identifier || !password || Buffer.byteLength(password) > 72) throw fail('Invalid username or password.', 401);
    const { rows } = await query('SELECT * FROM candidates WHERE username = $1 OR email = lower($1) FOR UPDATE', [identifier]);
    candidate = rows[0];
    if (!candidate?.password_hash || !await bcrypt.compare(password, candidate.password_hash)) throw fail('Invalid username or password.', 401);
  }
  return { token: await signToken(candidate.id), candidate: await publicCandidate(candidate) };
}

export function verifyEmail(token) {
  return consumeAccountToken(token, 'verify', id => query('UPDATE candidates SET email_verified_at=NOW(),updated_at=NOW() WHERE id=$1', [id]));
}

export function resetPassword(token, password) {
  if (typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password) > 72) throw fail('Use at least 10 characters and no more than 72 bytes.');
  return consumeAccountToken(token, 'reset', async id => {
    await query('UPDATE candidates SET password_hash=$2,email_verified_at=COALESCE(email_verified_at,NOW()),updated_at=NOW() WHERE id=$1', [id, await bcrypt.hash(password, 12)]);
    await query('DELETE FROM auth_sessions WHERE candidate_id=$1', [id]);
    await query('DELETE FROM account_tokens WHERE candidate_id=$1', [id]);
  });
}

export async function saveProfile(id, body) {
  const name = String(body.name || '').trim();
  if (!name || name.length > 150 || !body.qualification || !body.domain || !Array.isArray(body.interestedRoles) || !body.interestedRoles.length || !Array.isArray(body.claimedSkills))
    throw fail('Complete your name, education, domain, roles, and skills.');
  for (const values of [body.interestedRoles, body.claimedSkills]) {
    if (values.length > 30 || values.some(v => typeof v !== 'string' || !v.trim() || v.length > 100)) throw fail('Invalid roles or skills.');
  }
  for (const key of ['resumeFileName', 'transcriptFileName']) {
    if (body[key] && (typeof body[key] !== 'string' || !/\.pdf$/i.test(body[key]) || body[key].length > 255)) throw fail('Documents must be PDF files.');
  }
  const setup = body.setup && typeof body.setup === 'object' && !Array.isArray(body.setup) ? body.setup : {};
  if (Object.keys(setup).length > 30 || Object.values(setup).some(value => typeof value !== 'string' || value.length > 255)) throw fail('Invalid profile details.');
  const between = (value, min, max) => value !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
  if (!between(setup.age, 13, 100)) throw fail('Enter an age between 13 and 100.');
  if (!['High School', 'Diploma', 'Bachelor Degree', 'Master Degree', 'Doctorate'].includes(body.qualification)) throw fail('Select a valid qualification.');
  if (!['Full Stack Engineering', 'Data Science and AI', 'DevOps and Cloud', 'Cybersecurity', 'Mobile Engineering', 'Networks and IoT'].includes(body.domain)) throw fail('Select a valid domain.');
  if (body.qualification === 'High School') {
    if (!between(setup.tenthPercentage, 1, 100) || !between(setup.twelfthPercentage, 1, 100) || !setup.board) throw fail('Complete your school results.');
  } else if (!setup.collegeName || !setup.collegeCity || !setup.degree || !setup.branch || !between(setup.cgpa, 0.1, 10) || !between(setup.startYear, 1950, 2100) || !between(setup.endYear, Number(setup.startYear) + 1, 2100)) {
    throw fail('Complete valid education details before saving.');
  }
  for (const [key, kind] of [['resumeFileName', 'resume'], ['transcriptFileName', 'transcript']]) {
    if (!body[key]) continue;
    const document = await query('SELECT filename FROM candidate_documents WHERE candidate_id=$1 AND kind=$2 AND filename=$3', [id, kind, body[key]]);
    if (!document.rows.length) throw fail('Upload and verify the PDF before saving your profile.');
  }
  const { rows } = await query(`UPDATE candidates SET name=$2, qualification=$3, selected_domain=$4,
    interested_roles=$5, claimed_skills=$6, profile_complete=TRUE, setup=$7, updated_at=NOW()
    WHERE id=$1 RETURNING *`, [id, name, body.qualification, body.domain, body.interestedRoles, body.claimedSkills,
    JSON.stringify({ ...setup, resumeFileName: body.resumeFileName, transcriptFileName: body.transcriptFileName })]);
  if (!rows[0]) throw fail('Account not found.', 401);
  await query("UPDATE chat_sessions SET status='terminated', terminated_at=NOW(), reason='Profile updated' WHERE candidate_id=$1 AND status='active'", [id]);
  await query("UPDATE skill_assessments SET status='terminated', terminated_at=NOW() WHERE candidate_id=$1 AND status='active'", [id]);
  return { candidate: await publicCandidate(rows[0]) };
}
