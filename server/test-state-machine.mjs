/**
 * server/test-state-machine.mjs
 * Unit test for the session state machine logic (no Gemini required).
 * Tests the scoring math, level thresholds, and termination logic directly.
 */

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(name, condition, actual) {
  if (condition) {
    console.log(`  ${GREEN('✓')} ${name}`);
    passed++;
  } else {
    console.log(`  ${RED('✗')} ${name}`);
    if (actual !== undefined) console.log(`    actual: ${JSON.stringify(actual)}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${BOLD(title)}`);
}

// Inline the scoring logic (matches agentRuntimeDb.mjs exactly)
function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function levelFromScore(score) {
  if (score >= 85) return 'strong';
  if (score >= 70) return 'job_ready';
  if (score >= 45) return 'developing';
  return 'novice';
}

function calcFinalScore(mediumScore, hardScore) {
  return clampScore(mediumScore * 0.45 + hardScore * 0.55);
}

function calcAggregate(skillScores) {
  if (!skillScores.length) return 0;
  return clampScore(skillScores.reduce((sum, s) => sum + s, 0) / skillScores.length);
}

section('1. Score clamping');
assert('clamp 0 stays 0', clampScore(0) === 0);
assert('clamp 100 stays 100', clampScore(100) === 100);
assert('clamp -5 becomes 0', clampScore(-5) === 0);
assert('clamp 105 becomes 100', clampScore(105) === 100);
assert('clamp NaN becomes 0', clampScore(NaN) === 0);
assert('clamp 72.6 rounds to 73', clampScore(72.6) === 73);
assert('clamp 72.4 rounds to 72', clampScore(72.4) === 72);

section('2. Level thresholds');
assert('score 85 → strong', levelFromScore(85) === 'strong');
assert('score 100 → strong', levelFromScore(100) === 'strong');
assert('score 84 → job_ready', levelFromScore(84) === 'job_ready');
assert('score 70 → job_ready', levelFromScore(70) === 'job_ready');
assert('score 69 → developing', levelFromScore(69) === 'developing');
assert('score 45 → developing', levelFromScore(45) === 'developing');
assert('score 44 → novice', levelFromScore(44) === 'novice');
assert('score 0 → novice', levelFromScore(0) === 'novice');

section('3. Final skill score (45% medium + 55% hard)');
// Both pass: medium=80, hard=90 → 80*0.45 + 90*0.55 = 36 + 49.5 = 85.5 → rounds to 86
const bothPass = calcFinalScore(80, 90);
assert('medium=80, hard=90 → 86', bothPass === 86, bothPass);

// Medium pass, hard fail: medium=75, hard=50
const medPassHardFail = calcFinalScore(75, 50);
assert('medium=75, hard=50 → 61', medPassHardFail === 61, medPassHardFail);

// Medium fail only: medium=50, hard=0
const medFail = calcFinalScore(50, 0);
assert('medium=50, hard=0 → 23', medFail === 23, medFail);

// Perfect: medium=100, hard=100
const perfect = calcFinalScore(100, 100);
assert('medium=100, hard=100 → 100', perfect === 100, perfect);

// Zero: medium=0, hard=0
const zero = calcFinalScore(0, 0);
assert('medium=0, hard=0 → 0', zero === 0, zero);

section('4. Aggregate score (average of skill finalScores)');
assert('1 skill at 80 → 80', calcAggregate([80]) === 80);
assert('2 skills: 80+60 → 70', calcAggregate([80, 60]) === 70);
assert('3 skills: 90+70+50 → 70', calcAggregate([90, 70, 50]) === 70);
assert('empty array → 0', calcAggregate([]) === 0);

section('5. Proctor warning limit logic');
const LIMIT = 3;
function simulateProctor(events) {
  let count = 0;
  for (const _ of events) {
    count++;
    if (count >= LIMIT) return { terminated: true, warningCount: count };
  }
  return { terminated: false, warningCount: count };
}

const oneWarning = simulateProctor(['tab_hidden']);
assert('1 warning: not terminated', !oneWarning.terminated && oneWarning.warningCount === 1);

const twoWarnings = simulateProctor(['tab_hidden', 'window_blur']);
assert('2 warnings: not terminated', !twoWarnings.terminated && twoWarnings.warningCount === 2);

const threeWarnings = simulateProctor(['tab_hidden', 'window_blur', 'copy']);
assert('3 warnings: terminated', threeWarnings.terminated && threeWarnings.warningCount === 3);

section('6. MCQ grading logic');
const totalItems = 22;
function gradeAnswers(correctCount) {
  const score = clampScore((correctCount / totalItems) * 100);
  return { score, level: levelFromScore(score), correctCount };
}

const perfect22 = gradeAnswers(22);
assert('22/22 correct → 100 strong', perfect22.score === 100 && perfect22.level === 'strong');

const zero22 = gradeAnswers(0);
assert('0/22 correct → 0 novice', zero22.score === 0 && zero22.level === 'novice');

// 16/22 ≈ 72.7 → 73 → job_ready
const good22 = gradeAnswers(16);
assert('16/22 correct → 73 job_ready', good22.score === 73 && good22.level === 'job_ready', good22);

// 10/22 ≈ 45.4 → 45 → developing
const mid22 = gradeAnswers(10);
assert('10/22 correct → 45 developing', mid22.score === 45 && mid22.level === 'developing', mid22);

section('7. Answer timeout detection');
function isTimedOut(dueAtIso) {
  return Date.now() > new Date(dueAtIso).getTime();
}

const pastDate = new Date(Date.now() - 10000).toISOString();
const futureDate = new Date(Date.now() + 10000).toISOString();
assert('past dueAt → timed out', isTimedOut(pastDate));
assert('future dueAt → not timed out', !isTimedOut(futureDate));

// Summary
console.log(`\n${'─'.repeat(55)}`);
console.log(BOLD(`Results: ${GREEN(`${passed} passed`)}  ${failed > 0 ? RED(`${failed} failed`) : '0 failed'}`));

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`\n${GREEN('All unit tests passed! ✓')}`);
  process.exit(0);
}
