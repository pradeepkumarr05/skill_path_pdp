import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Bot, CheckCircle2, CircleDot, RadioTower, ShieldAlert, Terminal } from 'lucide-react';
import { useAgentStore } from '../store/useAgentStore';
import type { AgentName, EventLogLevel } from '../types/agent';

const agentIcons: Record<AgentName, typeof CircleDot> = {
  IDLE: CircleDot,
  ASSESSMENT: ShieldAlert,
  REASONING: Activity,
  LEARNBOT: Bot,
  INTERVIEWER: RadioTower,
  FINAL_REVIEW: CheckCircle2,
  FALLBACK: AlertTriangle,
};

const levelStyles: Record<EventLogLevel, string> = {
  INFO: 'text-slate-300',
  WARN: 'text-amber-300',
  ERROR: 'text-rose-300',
  SUCCESS: 'text-emerald-300',
};

export function AgentMonitorShell({ children }: PropsWithChildren) {
  const activeAgent = useAgentStore((state) => state.activeAgent);
  const eventLog = useAgentStore((state) => state.eventLog);
  const violations = useAgentStore((state) => state.violations);
  const isFallbackActive = useAgentStore((state) => state.isFallbackActive);
  const ActiveIcon = agentIcons[activeAgent];

  return (
    <div className="min-h-screen bg-agent-canvas text-agent-ink">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="flex w-full flex-col bg-agent-bg text-white lg:sticky lg:top-0 lg:h-screen lg:w-[320px]">
          <div className="border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-white/10">
                <ActiveIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Active Agent</p>
                <p className="text-lg font-semibold">{activeAgent.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-4">
            <div className="rounded-md border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-slate-400">Violations</p>
              <p className="text-2xl font-semibold">{violations.length}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-slate-400">Fallback</p>
              <p className={isFallbackActive ? 'text-2xl font-semibold text-rose-300' : 'text-2xl font-semibold text-emerald-300'}>
                {isFallbackActive ? 'On' : 'Off'}
              </p>
            </div>
          </div>

          <div className="flex min-h-[260px] flex-1 flex-col p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Terminal className="h-4 w-4" aria-hidden="true" />
              Developer Log
            </div>
            <div className="terminal-scroll flex-1 overflow-y-auto rounded-md border border-white/10 bg-black/25 p-3 font-mono text-xs">
              {eventLog.length === 0 ? (
                <p className="text-slate-400">Waiting for agent state...</p>
              ) : (
                eventLog.map((entry) => (
                  <div key={entry.id} className="mb-3 border-b border-white/5 pb-3 last:mb-0 last:border-0 last:pb-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className={levelStyles[entry.level]}>{entry.level}</span>
                      <span className="text-slate-500">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="leading-5 text-slate-200">{entry.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <motion.main
          className="m-0 flex-1 border-agent-border bg-agent-canvas lg:border-l"
          animate={{
            borderColor: isFallbackActive ? '#e11d48' : '#cbd5e1',
          }}
          transition={{ duration: 0.25 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
