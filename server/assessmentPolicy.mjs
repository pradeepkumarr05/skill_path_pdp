export const reviewEvents = new Set(['camera_motion', 'camera_obscured']);
export const criticalEvents = new Set(['camera_track_ended', 'screen_track_ended', 'fullscreen_exit']);
const allowedEvents = new Set([...reviewEvents, ...criticalEvents, 'tab_hidden', 'window_blur', 'copy', 'paste', 'cut', 'contextmenu', 'microphone_track_ended', 'answer_timeout']);
export function validateProctorEvent(payload) {
  if (!allowedEvents.has(payload?.type) || typeof (payload.detail ?? '') !== 'string' || (payload.detail || '').length > 1000)
    throw Object.assign(new Error('Invalid proctoring event.'), { statusCode: 400 });
}
export function selectedAnswer(value, choiceCount) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < choiceCount ? value : null;
}

export function interviewDecision(value, difficulty, timedOut = false) {
  if (!timedOut && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Invalid interview score.');
  const score = timedOut ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  const pass = score >= (difficulty === 'hard' ? 70 : 65);
  return { score, pass, level: score >= 85 ? 'strong' : score >= 70 ? 'job_ready' : score >= 45 ? 'developing' : 'novice', nextAction: difficulty === 'medium' && pass ? 'ask_hard' : 'complete_skill' };
}
