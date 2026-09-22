import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedAnswer, validateProctorEvent, reviewEvents, criticalEvents } from './assessmentPolicy.mjs';
import { buildDeterministicSkillAssessment, publicSkillAssessmentItems } from './deterministicSkillAssessment.mjs';

test('grading rejects missing, coerced, fractional and out-of-range choices', () => {
  for (const value of [null, undefined, '', '0', false, NaN, Infinity, -1, 4, 0.5, {}]) assert.equal(selectedAnswer(value, 4), null);
  assert.equal(selectedAnswer(0, 4), 0);
  assert.equal(selectedAnswer(3, 4), 3);
});
test('public assessment never exposes answer keys or explanations', () => {
  const items = publicSkillAssessmentItems(buildDeterministicSkillAssessment());
  assert.ok(items.length > 0);
  for (const item of items) { assert.equal(item.correctChoice, undefined); assert.equal(item.explanation, undefined); }
});
test('deterministic bank has unique IDs, valid choices and repeatable content', () => {
  const items = buildDeterministicSkillAssessment();
  assert.deepEqual(items, buildDeterministicSkillAssessment());
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  for (const item of items) assert.notEqual(selectedAnswer(item.correctChoice, item.choices.length), null);
});
test('proctor policy separates review signals from access loss', () => {
  for (const type of reviewEvents) { assert.ok(!criticalEvents.has(type)); validateProctorEvent({ type }); }
  for (const type of criticalEvents) validateProctorEvent({ type });
  assert.throws(() => validateProctorEvent({ type: 'invented' }), /Invalid/);
  assert.throws(() => validateProctorEvent({ type: 'copy', detail: 'x'.repeat(1001) }), /Invalid/);
});
