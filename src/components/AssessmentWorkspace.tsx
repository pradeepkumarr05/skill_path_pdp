import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Clock3, Send, ShieldAlert } from 'lucide-react';
import { assessmentQuestions, prototypeSkills, prototypeUser } from '../data/prototypeData';
import { useAgentStore } from '../store/useAgentStore';

interface AssessmentWorkspaceProps {
  userId: string;
}

export function AssessmentWorkspace({ userId }: AssessmentWorkspaceProps) {
  const emitProctorViolation = useAgentStore((state) => state.emitProctorViolation);
  const submitAssessment = useAgentStore((state) => state.submitAssessment);
  const violations = useAgentStore((state) => state.violations);
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const [descriptiveAnswer, setDescriptiveAnswer] = useState(
    'I would isolate the React UI into focused views, keep synchronized runtime state in Zustand, and let the Express Socket.io backend own authoritative assessment events, scoring transitions, and fallback mutations.',
  );
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(prototypeUser.selectedSkillIds);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({
    'mcq-1': 'EVENT:PROCTOR_ALERT',
    'mcq-2': 'A learning roadmap',
    'mcq-3': 'Fallback remediation activates',
  });
  const lastViolationAt = useRef(0);

  useEffect(() => {
    const emitThrottled = (type: 'TAB_SWITCH' | 'CLIPBOARD_PASTE', source: 'visibilitychange' | 'clipboard') => {
      const now = Date.now();
      if (now - lastViolationAt.current < 1200) {
        return;
      }

      lastViolationAt.current = now;
      emitProctorViolation(userId, type, source);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        emitThrottled('TAB_SWITCH', 'visibilitychange');
      }
    };

    const onWindowBlur = () => {
      emitThrottled('TAB_SWITCH', 'visibilitychange');
    };

    const onClipboard = () => {
      emitThrottled('CLIPBOARD_PASTE', 'clipboard');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('copy', onClipboard);
    window.addEventListener('paste', onClipboard);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('copy', onClipboard);
      window.removeEventListener('paste', onClipboard);
    };
  }, [emitProctorViolation, userId]);

  const onSkillToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const skillId = event.target.value;
    setSelectedSkillIds((current) =>
      event.target.checked ? [...new Set([...current, skillId])] : current.filter((currentSkillId) => currentSkillId !== skillId),
    );
  };

  const onSubmit = () => {
    submitAssessment({
      userId,
      descriptiveAnswer,
      mcqAnswers,
      claimedSkillIds: selectedSkillIds,
    });
  };

  return (
    <motion.section
      className="rounded-lg border border-agent-border bg-agent-surface p-4 shadow-panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-agent-assessment">Assessment Phase</p>
          <h2 className="text-xl font-semibold text-agent-ink">Proctored execution canvas</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-md border border-agent-border px-3 py-2 text-sm text-agent-muted">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            05:00 descriptive
          </span>
          <span className="inline-flex items-center gap-2 rounded-md border border-agent-border px-3 py-2 text-sm text-agent-muted">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            {violations.length} logs
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="rounded-lg border border-agent-border bg-agent-panel p-4">
          <h3 className="text-sm font-semibold text-agent-ink">Claimed skills</h3>
          <div className="mt-3 space-y-3">
            {prototypeSkills.map((skill) => (
              <label key={skill.id} className="flex items-start gap-3 rounded-md border border-agent-border bg-white p-3">
                <input
                  className="mt-1 h-4 w-4 accent-agent-assessment"
                  type="checkbox"
                  value={skill.id}
                  checked={selectedSkillIds.includes(skill.id)}
                  onChange={onSkillToggle}
                />
                <span>
                  <span className="block text-sm font-semibold text-agent-ink">{skill.name}</span>
                  <span className="mt-1 block text-sm leading-5 text-agent-muted">{skill.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-agent-ink" htmlFor="descriptive-answer">
              Chatbot descriptive response
            </label>
            <textarea
              id="descriptive-answer"
              className="min-h-[156px] w-full resize-none rounded-md border border-agent-border bg-white p-3 text-sm leading-6 text-agent-ink outline-none transition focus:border-agent-assessment focus:ring-2 focus:ring-blue-100"
              value={descriptiveAnswer}
              onChange={(event) => setDescriptiveAnswer(event.target.value)}
            />
          </div>

          <div className="grid gap-3">
            {assessmentQuestions
              .filter((question) => question.id.startsWith('mcq'))
              .map((question) => (
                <div key={question.id} className="rounded-md border border-agent-border p-3">
                  <p className="mb-3 text-sm font-semibold text-agent-ink">{question.prompt}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {question.options.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm text-agent-muted">
                        <input
                          className="h-4 w-4 accent-agent-assessment"
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={mcqAnswers[question.id] === option}
                          onChange={() => setMcqAnswers((current) => ({ ...current, [question.id]: option }))}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-agent-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2 text-sm text-agent-muted">
          <ClipboardCheck className="h-4 w-4 text-agent-assessment" aria-hidden="true" />
          Agent state: {activeAgent}
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-agent-assessment px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          type="button"
          onClick={onSubmit}
          disabled={activeAgent === 'REASONING'}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Submit assessment
        </button>
      </div>
    </motion.section>
  );
}
