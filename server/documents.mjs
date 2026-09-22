import { PDFDocument } from 'pdf-lib';
import { query } from './db.mjs';
export async function uploadDocument(candidateId, body) {
  const fail = () => Object.assign(new Error('Upload a valid, unencrypted PDF of up to 5 MB.'), { statusCode: 400 });
  if (!['resume', 'transcript'].includes(body.kind) || typeof body.filename !== 'string' || !/\.pdf$/i.test(body.filename) || body.filename.length > 255 || typeof body.content !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.content)) throw fail();
  const bytes = Buffer.from(body.content, 'base64');
  if (bytes.length > 5 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== '%PDF-') throw fail();
  try { const pdf = await PDFDocument.load(bytes); if (!pdf.getPageCount()) throw fail(); } catch { throw fail(); }
  await query(`INSERT INTO candidate_documents (candidate_id, kind, filename, content) VALUES ($1,$2,$3,$4)
    ON CONFLICT (candidate_id, kind) DO UPDATE SET filename=EXCLUDED.filename, content=EXCLUDED.content, updated_at=NOW()`,
    [candidateId, body.kind, body.filename, bytes]);
  return { filename: body.filename, kind: body.kind };
}
