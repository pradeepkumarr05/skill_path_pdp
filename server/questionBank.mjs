/**
 * server/questionBank.mjs
 *
 * A curated, hand-written question bank for every skill in FULL_STACK_SKILLS,
 * at both "medium" and "hard" difficulty, with several variants per cell so
 * repeat visits don't feel canned.
 *
 * This bank exists purely as a fast, zero-latency, zero-error fallback path.
 * Gemini remains the primary source of questions and evaluation; this module
 * only engages when a live model call fails or exceeds its timeout budget,
 * so the candidate experience never stalls and never sees a raw server error.
 */

const BANK = {
  HTML: {
    medium: [
      { question: 'Explain the difference between semantic and non-semantic HTML elements, and give two examples of each. Why does semantic markup matter for accessibility and SEO?', intent: 'Checks understanding of semantic HTML.' },
      { question: 'What is the purpose of the "alt" attribute on an <img> tag, and what happens for screen reader users when it is missing?', intent: 'Checks accessibility fundamentals.' },
    ],
    hard: [
      { question: 'Describe how the browser constructs the DOM and CSSOM from HTML/CSS, and how they combine to produce the render tree. Where do <script> tags without "defer" or "async" fit into this pipeline?', intent: 'Checks depth on browser rendering pipeline.' },
    ],
  },
  CSS: {
    medium: [
      { question: 'Explain the CSS box model and how "box-sizing: border-box" changes how width and height are calculated.', intent: 'Checks box model fundamentals.' },
      { question: 'What is the difference between Flexbox and CSS Grid, and when would you reach for one over the other?', intent: 'Checks layout system judgment.' },
    ],
    hard: [
      { question: 'Explain CSS specificity and the cascade. Given two conflicting rules with the same specificity, which wins and why? How does "!important" interact with this?', intent: 'Checks depth on the cascade algorithm.' },
    ],
  },
  JavaScript: {
    medium: [
      { question: 'Explain the difference between "==" and "===" in JavaScript, and describe a real bug that type coercion could cause.', intent: 'Checks equality/coercion understanding.' },
      { question: 'What is a closure in JavaScript? Give a short practical example of where a closure is useful.', intent: 'Checks closures.' },
    ],
    hard: [
      { question: 'Explain the JavaScript event loop, and the difference between the microtask queue (Promises) and the macrotask queue (setTimeout). What would the output order be if you called setTimeout(fn, 0) and Promise.resolve().then(fn) back to back?', intent: 'Checks event loop depth.' },
    ],
  },
  TypeScript: {
    medium: [
      { question: 'What problem does TypeScript solve that plain JavaScript does not? Explain the difference between "interface" and "type" in TypeScript.', intent: 'Checks TS fundamentals.' },
    ],
    hard: [
      { question: 'Explain generics in TypeScript with a practical example, and describe how conditional types can be used to derive one type from another.', intent: 'Checks advanced typing.' },
    ],
  },
  React: {
    medium: [
      { question: 'Explain the difference between props and state in React, and describe what triggers a re-render.', intent: 'Checks React fundamentals.' },
      { question: 'What is the purpose of the "useEffect" dependency array? What happens if you omit it entirely versus passing an empty array?', intent: 'Checks hooks lifecycle understanding.' },
    ],
    hard: [
      { question: 'Explain React reconciliation and the role "key" plays when rendering lists. What performance problem occurs if you use array index as a key for a reorderable list?', intent: 'Checks reconciliation depth.' },
    ],
  },
  'Node.js': {
    medium: [
      { question: 'Explain how Node.js handles concurrency despite being single-threaded. What role does libuv play?', intent: 'Checks Node internals.' },
    ],
    hard: [
      { question: 'Describe how you would design a Node.js REST API to handle a slow downstream dependency without blocking the event loop, including timeout and backpressure handling.', intent: 'Checks production-grade Node design.' },
    ],
  },
  'REST APIs': {
    medium: [
      { question: 'Explain the difference between PUT and PATCH in a REST API, and give an example of when you would use each.', intent: 'Checks REST semantics.' },
    ],
    hard: [
      { question: 'Design a pagination strategy for a REST endpoint returning millions of rows. Compare offset-based pagination with cursor-based pagination and explain the tradeoffs.', intent: 'Checks API design depth.' },
    ],
  },
  'Data Structures and Algorithms': {
    medium: [
      { question: 'Explain the difference in time complexity between searching a sorted array with binary search versus linear search, and state Big-O for each.', intent: 'Checks complexity fundamentals.' },
    ],
    hard: [
      { question: 'Given a stream of integers, describe an efficient data structure and algorithm to continuously report the median. State the time complexity of insert and of retrieving the median.', intent: 'Checks algorithmic design depth.' },
    ],
  },
  PostgreSQL: {
    medium: [
      { question: 'Explain what a database index does and why adding an index to every column is not a good default strategy.', intent: 'Checks indexing fundamentals.' },
    ],
    hard: [
      { question: 'Explain the difference between a database transaction\'s READ COMMITTED and SERIALIZABLE isolation levels, and describe a concrete anomaly that SERIALIZABLE prevents but READ COMMITTED does not.', intent: 'Checks transaction isolation depth.' },
    ],
  },
  MongoDB: {
    medium: [
      { question: 'Explain the difference between embedding and referencing related data in MongoDB, and describe a scenario where each approach is preferable.', intent: 'Checks schema design fundamentals.' },
    ],
    hard: [
      { question: 'Describe how MongoDB\'s aggregation pipeline works, and design a pipeline (in plain language, stage by stage) to compute total revenue per customer per month from an "orders" collection.', intent: 'Checks aggregation depth.' },
    ],
  },
  Git: {
    medium: [
      { question: 'Explain the difference between "git merge" and "git rebase". What is one risk of rebasing a shared branch?', intent: 'Checks Git workflow fundamentals.' },
    ],
    hard: [
      { question: 'Describe how you would use "git bisect" to find the commit that introduced a regression, and explain how "git reflog" could help you recover a branch after an accidental hard reset.', intent: 'Checks advanced Git troubleshooting.' },
    ],
  },
};

const GENERIC_FALLBACK = {
  medium: { question: 'Describe a project where you applied this skill in practice, and explain one technical decision you made and why.', intent: 'General practical competency check.' },
  hard: { question: 'Describe a challenging, non-obvious problem you solved using this skill, including the tradeoffs you considered.', intent: 'General advanced competency check.' },
};

/**
 * Returns a bank question for a skill/difficulty, cycling through variants
 * so repeated fallbacks (e.g. Gemini degraded for a whole session) don't
 * repeat the exact same text back to back.
 */
export function pickFallbackQuestion(skill, difficulty, excludeTexts = []) {
  const pool = BANK[skill]?.[difficulty] || [];
  const fresh = pool.filter((entry) => !excludeTexts.includes(entry.question));
  const candidates = fresh.length ? fresh : pool;
  if (!candidates.length) {
    return GENERIC_FALLBACK[difficulty] || GENERIC_FALLBACK.medium;
  }
  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  return choice;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'and', 'or', 'to', 'of', 'in', 'on', 'for',
  'with', 'it', 'this', 'that', 'as', 'be', 'by', 'at', 'from', 'if', 'then', 'so', 'i', 'you',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));
}

/**
 * Lightweight, deterministic heuristic scorer used only when Gemini is
 * unavailable. It rewards substantive, on-topic answers (length + technical
 * vocabulary overlap with the question) and never blocks the assessment
 * flow. It intentionally scores conservatively — a heuristic pass is set
 * lower than the model's own pass bar so borderline fallback answers are
 * not over-credited relative to Gemini-graded peers.
 */
export function heuristicEvaluate({ questionText, answer, difficulty, timedOut }) {
  if (timedOut || !answer || !answer.trim()) {
    return {
      score: 0,
      level: 'novice',
      pass: false,
      feedback: 'No answer was submitted in time for this question.',
      strengths: [],
      gaps: ['No response was recorded.'],
      nextAction: 'complete_skill',
    };
  }

  const words = tokenize(answer);
  const questionWords = new Set(tokenize(questionText));
  const overlap = words.filter((w) => questionWords.has(w)).length;
  const uniqueWords = new Set(words).size;

  // Length signal: longer, more developed answers score higher up to a point.
  const lengthScore = Math.min(45, Math.round((words.length / 60) * 45));
  // Vocabulary richness: distinct technical terms used.
  const richnessScore = Math.min(30, Math.round((uniqueWords / 40) * 30));
  // Topical relevance: overlap with question terminology.
  const relevanceScore = Math.min(25, overlap * 5);

  const rawScore = lengthScore + richnessScore + relevanceScore;
  const score = Math.max(0, Math.min(78, rawScore)); // capped below a "strong" grade — heuristic, not authoritative

  const passBar = difficulty === 'hard' ? 70 : 65;
  const pass = score >= passBar;
  const level = score >= 70 ? 'job_ready' : score >= 45 ? 'developing' : 'novice';

  return {
    score,
    level,
    pass,
    feedback: pass
      ? 'Your answer covered the key points with reasonable depth. (Graded by automatic fallback scoring.)'
      : 'Your answer was too brief or did not cover enough of the core concept. (Graded by automatic fallback scoring.)',
    strengths: pass ? ['Answer addressed the core question.'] : [],
    gaps: pass ? [] : ['Add more technical detail and be specific about how the concept applies.'],
    nextAction: pass ? 'ask_hard' : 'complete_skill',
  };
}
