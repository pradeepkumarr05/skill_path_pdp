import { motion } from 'framer-motion';
import { BookOpenCheck, CheckCircle2, Lock, PlayCircle, RefreshCcw } from 'lucide-react';
import { useAgentStore } from '../store/useAgentStore';
import type { RoadmapNodeStatus } from '../types/agent';

interface LearnBotWorkspaceProps {
  userId: string;
}

const statusStyles: Record<RoadmapNodeStatus, string> = {
  LOCKED: 'border-slate-200 bg-slate-50 text-slate-500',
  AVAILABLE: 'border-teal-200 bg-teal-50 text-agent-learnbot',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-agent-success',
  REMEDIATION: 'border-rose-200 bg-rose-50 text-agent-fallback',
};

export function LearnBotWorkspace({ userId }: LearnBotWorkspaceProps) {
  const roadmap = useAgentStore((state) => state.roadmap);
  const notebook = useAgentStore((state) => state.notebook);
  const isFallbackActive = useAgentStore((state) => state.isFallbackActive);
  const completeRoadmapNode = useAgentStore((state) => state.completeRoadmapNode);

  return (
    <motion.section
      className="rounded-lg border bg-agent-surface p-4 shadow-panel"
      animate={{
        borderColor: isFallbackActive ? '#e11d48' : '#cbd5e1',
      }}
      transition={{ duration: 0.25 }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-agent-learnbot">Learning Path Generation</p>
          <h2 className="text-xl font-semibold text-agent-ink">LearnBot session loop</h2>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-teal-50 text-agent-learnbot">
          <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      {isFallbackActive ? (
        <div className="mb-4 rounded-md border border-agent-fallback bg-rose-50 p-3 text-sm font-medium text-agent-fallback">
          Remediation path is active. Complete weak topic sessions before retaking randomized mocks.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          {roadmap.length === 0 ? (
            <div className="rounded-md border border-agent-border bg-agent-panel p-4 text-sm text-agent-muted">
              Roadmap nodes appear after the Reasoning Agent completes scoring.
            </div>
          ) : (
            roadmap.map((node, index) => {
              const isDisabled = node.status === 'LOCKED';
              const Icon = node.status === 'COMPLETED' ? CheckCircle2 : node.status === 'LOCKED' ? Lock : node.status === 'REMEDIATION' ? RefreshCcw : PlayCircle;

              return (
                <motion.article
                  key={node.id}
                  className={`rounded-lg border p-4 ${statusStyles[node.status]}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-3">
                      <div className="mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-md bg-white/80">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-agent-ink">{node.topic}</h3>
                        <p className="mt-1 text-sm text-agent-muted">{node.duration} minutes</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {node.subtopics.map((subtopic) => (
                            <span key={subtopic} className="rounded-md border border-current/20 bg-white/70 px-2 py-1 text-xs font-semibold">
                              {subtopic}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-agent-learnbot px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      type="button"
                      disabled={isDisabled || node.status === 'COMPLETED'}
                      onClick={() => completeRoadmapNode(userId, node.id)}
                    >
                      <PlayCircle className="h-4 w-4" aria-hidden="true" />
                      Complete
                    </button>
                  </div>
                  {node.status === 'REMEDIATION' && node.remediationInstructions ? (
                    <p className="mt-3 rounded-md border border-agent-fallback/30 bg-white p-3 text-sm text-agent-fallback">
                      {node.remediationInstructions}
                    </p>
                  ) : null}
                </motion.article>
              );
            })
          )}
        </div>

        <div className="rounded-lg border border-agent-border bg-agent-panel p-4">
          <h3 className="text-sm font-semibold text-agent-ink">Session notebook</h3>
          <div className="mt-3 space-y-3">
            {notebook.length === 0 ? (
              <p className="text-sm leading-5 text-agent-muted">Completed LearnBot sessions are stored here for revision.</p>
            ) : (
              notebook.slice(0, 4).map((entry) => (
                <article key={entry.id} className="rounded-md border border-agent-border bg-white p-3">
                  <p className="text-sm font-semibold text-agent-ink">{entry.title}</p>
                  <p className="mt-2 text-xs leading-5 text-agent-muted">{entry.markdown.replaceAll('#', '').slice(0, 150)}...</p>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
