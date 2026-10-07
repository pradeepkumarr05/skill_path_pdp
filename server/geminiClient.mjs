import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

let envLoaded = false;

function loadLocalEnv() {
  if (envLoaded) return;
  envLoaded = true;

  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadLocalEnv();

function geminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}

export function isGeminiConfigured() {
  return Boolean(geminiApiKey());
}

export function geminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-3.6-flash';
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) {
      throw new Error('Gemini did not return parseable JSON.');
    }
    return JSON.parse(match[0]);
  }
}

// Default bounded latency for any single Gemini call. Kept tight so the
// assessment UI never stalls waiting on a slow model response — callers
// race this against a local fallback (question bank / heuristic scorer).
const DEFAULT_TIMEOUT_MS = Math.max(10000, Number(process.env.GEMINI_TIMEOUT_MS || 20000));
const MAX_RETRIES = Number(process.env.GEMINI_MAX_RETRIES || 1);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiOnce({ systemInstruction, prompt, schema, temperature, maxOutputTokens, apiKey, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: geminiModel(), contents: prompt,
      config: { systemInstruction, temperature, maxOutputTokens, responseMimeType: 'application/json',
        ...(geminiModel().startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        responseSchema: schema, abortSignal: controller.signal, httpOptions: { timeout: timeoutMs } },
    });
    if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      throw Object.assign(new Error('Gemini response reached its output limit before completing JSON.'), { retryable: true });
    }
    const text = response.text;
    if (!text) {
      const error = new Error('Gemini returned an empty response.');
      error.retryable = true;
      throw error;
    }
    return parseJsonText(text);
  } catch (error) {
    error.retryable = error.retryable || error.status === 429 || error.status >= 500;
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Gemini request timed out after ${timeoutMs}ms.`);
      timeoutError.statusCode = 504;
      timeoutError.retryable = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls Gemini with a strict timeout and a single fast retry on transient
 * failures (timeout, 429, 5xx). Throws on final failure so the caller can
 * fall back to a local deterministic source — this function never hangs
 * the request pipeline.
 */
export async function generateGeminiJson({
  systemInstruction,
  prompt,
  schema,
  temperature = 0.35,
  maxOutputTokens = 1200,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    const error = new Error('Gemini API key is not configured. Set GEMINI_API_KEY in .env.');
    error.statusCode = 503;
    error.retryable = false;
    throw error;
  }

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await callGeminiOnce({ systemInstruction, prompt, schema, temperature, maxOutputTokens: maxOutputTokens * (attempt + 1), apiKey, timeoutMs });
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && error.retryable) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      break;
    }
  }

  throw lastError;
}
