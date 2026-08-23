import { motion } from 'framer-motion';
import { BarChart3, ClipboardCheck, FileUser, GraduationCap, MessageSquareText } from 'lucide-react';
import { pipelineModules } from '../data/prototypeData';
import { useAgentStore } from '../store/useAgentStore';

const icons = [FileUser, ClipboardCheck, BarChart3, GraduationCap, MessageSquareText];

const activeModuleByAgent: Record<string, string> = {
  ASSESSMENT: 'assessment',
  REASONING: 'reasoning',
  LEARNBOT: 'learnbot',
  INTERVIEWER: 'review',
  FINAL_REVIEW: 'review',
  FALLBACK: 'review',
};

export function PipelineOverview() {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const activeModuleId = activeModuleByAgent[activeAgent] ?? 'entry';

  return (
    <section className="grid gap-3 md:grid-cols-5">
      {pipelineModules.map((module, index) => {
        const Icon = icons[index] ?? FileUser;
        const isActive = module.id === activeModuleId;

        return (
          <motion.article
            key={module.id}
            className={`min-h-[150px] rounded-lg border bg-agent-surface p-4 shadow-panel ${
              isActive ? 'border-agent-accent' : 'border-agent-border'
            }`}
            animate={{
              y: isActive ? -2 : 0,
              borderColor: isActive ? '#4f46e5' : '#cbd5e1',
            }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-agent-panel text-agent-accent">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="rounded-md border border-agent-border px-2 py-1 text-xs font-semibold text-agent-muted">
                {module.status}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-agent-ink">{module.title}</h2>
            <p className="mt-2 text-sm leading-5 text-agent-muted">{module.summary}</p>
          </motion.article>
        );
      })}
    </section>
  );
}
