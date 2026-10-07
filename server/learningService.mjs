import { query, withTransaction } from './db.mjs';
import { skillEvidence, validatePlan, publicPlan, completionAllowed, fail } from './learningPolicy.mjs';

export async function learningOverview(candidateId) {
  const { rows } = await query('SELECT * FROM learning_plans WHERE candidate_id=$1 ORDER BY created_at DESC LIMIT 1', [candidateId]);
  const completed = rows[0] ? (await query("SELECT lesson_id, completed_at FROM learning_sessions WHERE candidate_id=$1 AND plan_id=$2 AND status='completed' ORDER BY completed_at", [candidateId, rows[0].id])).rows : [];
  const latest = (await query('SELECT r.assessment_id FROM skill_assessment_results r JOIN skill_assessments a ON a.id=r.assessment_id WHERE a.candidate_id=$1 ORDER BY r.created_at DESC LIMIT 1', [candidateId])).rows[0];
  return { plan: publicPlan(rows[0], completed), configured: Boolean(process.env.HF_TOKEN), needsRefresh: Boolean(rows[0] && latest && rows[0].assessment_id !== latest.assessment_id) };
}

export async function generateLearningPlan(candidate) {
  // Serialize generation for this candidate; never accept scores supplied by the browser.
  return withTransaction(async () => {
    await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`learning:${candidate.id}`]);
    const result = (await query(`SELECT r.* FROM skill_assessment_results r JOIN skill_assessments a ON a.id=r.assessment_id WHERE a.candidate_id=$1 AND a.status='submitted' ORDER BY r.created_at DESC LIMIT 1`, [candidate.id])).rows[0];
    if (!result) throw fail('Complete the knowledge assessment before creating your learning plan.', 409);
    const existing = (await query('SELECT id FROM learning_plans WHERE candidate_id=$1 AND assessment_id=$2', [candidate.id,result.assessment_id])).rows[0];
    if(existing) return learningOverview(candidate.id);
    const chat = (await query("SELECT id FROM chat_sessions WHERE candidate_id=$1 AND status='completed' AND completed_at <= $2 ORDER BY completed_at DESC LIMIT 1", [candidate.id, result.created_at])).rows[0];
    if (candidate.claimed_skills.length && !chat) throw fail('Complete the technical interview before creating your learning plan.', 409);
    const states = chat ? (await query('SELECT skill,final_score FROM chat_skill_states WHERE session_id=$1', [chat.id])).rows : [];
    const evidence = skillEvidence(result.results, states);
    const needed = evidence.filter(item => !item.skippable);
    let plan;
    const model = process.env.HF_ROADMAP_MODEL || 'openai/gpt-oss-120b:cerebras';
    if (!needed.length) plan = validatePlan({ topics: [] }, evidence);
    else {
      if (!process.env.HF_TOKEN) throw fail('Learning plan generation is not configured. Add the Hugging Face token on the server.', 503);
      const topics = [];
      // Bound each response so learners with gaps in all skills do not hit output limits.
      for (let offset = 0; offset < needed.length; offset += 4) {
      const batches = [needed.slice(offset, offset + 2), needed.slice(offset + 2, offset + 4)].filter(batch => batch.length);
      const generated = await Promise.all(batches.map(async batch => {
      let response;
      try {
        response = await fetch('https://router.huggingface.co/v1/chat/completions', {
          method: 'POST', signal: AbortSignal.timeout(120000),
          headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, temperature: .2, max_tokens: 8192, response_format: { type: 'json_object' }, messages: [
            { role: 'system', content: 'You are a full stack engineering tutor. Return JSON only: {"topics":[{"skill":"exact skill name","reason":"personalized reason using assessment evidence","sessions":[{"title":"...","objective":"...","content":"at least 300 characters of accurate teaching with a concrete code example; use plain text and newline characters","exercise":"a practical exercise","question":"a checkpoint MCQ","choices":["...","...","...","..."],"correctChoice":0,"explanation":"why the correct answer is correct"}]}]}. Include every supplied skill exactly once. Order prerequisites first. Include exactly 2 distinct ten-minute sessions per skill: six minutes study, three minutes exercise, one minute checkpoint. Four distinct choices per question; vary correct answer position. Exercises must be completed by writing code or reasoning in an in-page text workspace; do not require other apps, websites, a terminal, or saving local files. Check technical statements and checkpoint answers for accuracy, including exceptions such as void HTML elements. Do not invent learner facts or guarantees. Scores are preliminary evidence, not proof of mastery. No external URLs, names, email, or personal data. Use plain-text formatting; HTML code examples are allowed.' },
            { role: 'user', content: JSON.stringify({ domain: 'Full Stack Engineering', evidence: batch }) },
          ] }),
        });
      } catch { throw fail('The learning provider could not be reached. Please retry.', 503); }
      if (!response.ok) {
        const messages = {
          401: 'The Hugging Face token is invalid. Update the server token and restart the API.',
          403: 'The Hugging Face token needs Make calls to Inference Providers permission. Update the server token and restart the API.',
          402: 'Hugging Face inference credits are exhausted. Check the account billing settings.',
          429: 'The learning provider is rate limited. Please wait before trying again.',
        };
        throw fail(messages[response.status] || 'The learning provider rejected the request. Check model access and provider availability.', 503);
      }
      try { const payload = await response.json(); return validatePlan(JSON.parse(payload.choices[0].message.content), batch).topics; }
      catch (error) { if (error.statusCode) throw error; throw fail('The learning provider returned unreadable content. Please retry.', 502); }
      }));
      topics.push(...generated.flat());
      }
      plan = validatePlan({ topics }, evidence);
    }
    const saved = (await query('INSERT INTO learning_plans(candidate_id,assessment_id,model,plan) VALUES($1,$2,$3,$4) RETURNING *', [candidate.id, result.assessment_id, needed.length ? model : 'assessment-policy', JSON.stringify(plan)])).rows[0];
    return { plan: publicPlan(saved), configured: Boolean(process.env.HF_TOKEN) };
  });
}

export async function mutateLearning(candidateId, action, body) {
  return withTransaction(async () => {
    await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`learning:${candidateId}`]);
    if (action === 'start') {
      const plan = (await query('SELECT * FROM learning_plans WHERE id=$1 AND candidate_id=$2', [body.planId, candidateId])).rows[0];
      const lesson = plan?.plan.topics.flatMap(t => t.sessions).find(s => s.id === body.lessonId);
      if (!lesson) throw fail('Lesson not found.', 404);
      const done = await query("SELECT id FROM learning_sessions WHERE candidate_id=$1 AND plan_id=$2 AND lesson_id=$3 AND status='completed'", [candidateId, plan.id, lesson.id]);
      if (done.rows.length) throw fail('This session is already complete.', 409);
      await query("UPDATE learning_sessions SET status='abandoned' WHERE candidate_id=$1 AND status='active'", [candidateId]);
      const session = (await query('INSERT INTO learning_sessions(candidate_id,plan_id,lesson_id) VALUES($1,$2,$3) RETURNING *', [candidateId, plan.id, lesson.id])).rows[0];
      return { id: session.id, startedAt: session.started_at, requiredSeconds: 600 };
    }
    const session = (await query('SELECT * FROM learning_sessions WHERE id=$1 AND candidate_id=$2 FOR UPDATE', [body.sessionId, candidateId])).rows[0];
    if (!session) throw fail('Learning session not found.', 404);
    if (action === 'abandon') {
      await query("UPDATE learning_sessions SET status='abandoned' WHERE id=$1 AND status='active'", [session.id]);
      return { status: session.status === 'completed' ? 'completed' : 'abandoned' };
    }
    if (session.status === 'completed' && action === 'complete') return { status: 'completed' };
    if (session.status !== 'active') return { status: session.status };
    if (Date.now() - new Date(session.last_seen_at).getTime() > 25000) {
      await query("UPDATE learning_sessions SET status='abandoned' WHERE id=$1", [session.id]);
      return { status: 'abandoned' };
    }
    if (action === 'heartbeat') {
      await query('UPDATE learning_sessions SET last_seen_at=NOW() WHERE id=$1', [session.id]);
      return { status: 'active' };
    }
    if (action !== 'complete') throw fail('Unknown learning action.', 404);
    if (!completionAllowed(session)) throw fail('Complete the full ten-minute session before submitting.', 409);
    const plan = (await query('SELECT plan FROM learning_plans WHERE id=$1', [session.plan_id])).rows[0].plan;
    const lesson = plan.topics.flatMap(t => t.sessions).find(s => s.id === session.lesson_id);
    if (!Number.isInteger(body.answer) || body.answer < 0 || body.answer > 3) throw fail('Select a checkpoint answer.');
    if (body.answer !== lesson.correctChoice) return { status: 'active', correct: false, feedback: 'Not quite. Review the lesson and try again.' };
    await query("UPDATE learning_sessions SET status='completed',completed_at=NOW() WHERE id=$1", [session.id]);
    return { status: 'completed', correct: true, feedback: lesson.explanation };
  });
}
