import { useState } from 'react';
import { Award, Gauge, RefreshCcw, SendHorizontal } from 'lucide-react';
import { useAgentStore } from '../store/useAgentStore';

interface FinalReviewProps {
  userId: string;
}

export function FinalReview({ userId }: FinalReviewProps) {
  const [mockScore, setMockScore] = useState(72);
  const [interviewScore, setInterviewScore] = useState(68);
  const performance = useAgentStore((state) => state.performance);
  const isFallbackActive = useAgentStore((state) => state.isFallbackActive);
  const submitMockInterview = useAgentStore((state) => state.submitMockInterview);
  const triggerFallbackManual = useAgentStore((state) => state.triggerFallbackManual);
  const certificateDisabled = isFallbackActive || !performance?.certificateAvailable;

  return (
    <section className="rounded-lg border border-agent-border bg-agent-surface p-4 shadow-panel">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-agent-warning">Mock and Interview</p>
          <h2 className="text-xl font-semibold text-agent-ink">Performance review</h2>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-amber-50 text-agent-warning">
          <Gauge className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-agent-ink">Mock score</span>
          <input
            className="w-full rounded-md border border-agent-border px-3 py-2 text-sm outline-none transition focus:border-agent-warning focus:ring-2 focus:ring-amber-100"
            type="number"
            min={0}
            max={100}
            value={mockScore}
            onChange={(event) => setMockScore(Number(event.target.value))}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-agent-ink">Interview score</span>
          <input
            className="w-full rounded-md border border-agent-border px-3 py-2 text-sm outline-none transition focus:border-agent-warning focus:ring-2 focus:ring-amber-100"
            type="number"
            min={0}
            max={100}
            value={interviewScore}
            onChange={(event) => setInterviewScore(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-md bg-agent-warning px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
          type="button"
          onClick={() => submitMockInterview({ userId, mockScore, interviewScore })}
        >
          <SendHorizontal className="h-4 w-4" aria-hidden="true" />
          Submit scores
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-agent-fallback px-3 py-2 text-sm font-semibold text-agent-fallback transition hover:bg-rose-50"
          type="button"
          onClick={() => triggerFallbackManual(userId)}
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Trigger fallback
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-agent-border bg-agent-panel p-4">
        {performance ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-agent-border bg-white p-3">
                <p className="text-xs text-agent-muted">Readiness</p>
                <p className="text-2xl font-semibold text-agent-ink">{performance.readinessScore}</p>
              </div>
              <div className="rounded-md border border-agent-border bg-white p-3">
                <p className="text-xs text-agent-muted">Aggregate</p>
                <p className="text-2xl font-semibold text-agent-ink">{performance.aggregateScore}</p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-agent-ink">Strengths</h3>
              <p className="mt-1 text-sm leading-5 text-agent-muted">{performance.strengths.join(', ')}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-agent-ink">Weak areas</h3>
              <p className="mt-1 text-sm leading-5 text-agent-muted">{performance.weakAreas.join(', ')}</p>
            </div>
            <p className="rounded-md border border-agent-border bg-white p-3 text-sm leading-5 text-agent-muted">{performance.finalAdvice}</p>
          </div>
        ) : (
          <p className="text-sm leading-5 text-agent-muted">Submit mock and interview scores to calculate final readiness.</p>
        )}
      </div>

      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-agent-success px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        type="button"
        disabled={certificateDisabled}
      >
        <Award className="h-4 w-4" aria-hidden="true" />
        Certificate of completion
      </button>
    </section>
  );
}
