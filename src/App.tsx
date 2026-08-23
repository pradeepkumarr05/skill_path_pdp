import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { AgentMonitorShell } from './components/AgentMonitorShell';
import { AssessmentWorkspace } from './components/AssessmentWorkspace';
import { FinalReview } from './components/FinalReview';
import { LearnBotWorkspace } from './components/LearnBotWorkspace';
import { PipelineOverview } from './components/PipelineOverview';
import { ReasoningDashboard } from './components/ReasoningDashboard';
import { prototypeUser } from './data/prototypeData';
import { useAgentStore } from './store/useAgentStore';

const USER_ID = 'prototype-user-001';

export default function App() {
  const initializeSession = useAgentStore((state) => state.initializeSession);
  const connectSystem = useAgentStore((state) => state.connectSystem);
  const disconnectSystem = useAgentStore((state) => state.disconnectSystem);
  const resetSession = useAgentStore((state) => state.resetSession);
  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const error = useAgentStore((state) => state.error);

  useEffect(() => {
    void initializeSession(USER_ID, prototypeUser).then(() => {
      connectSystem(USER_ID);
    });

    return () => {
      disconnectSystem();
    };
  }, [connectSystem, disconnectSystem, initializeSession]);

  return (
    <AgentMonitorShell>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 border-b border-agent-border bg-agent-surface px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-agent-muted">SkillPath Prototype</p>
            <h1 className="text-2xl font-semibold text-agent-ink">Agent readiness console</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-agent-border px-3 py-2 text-sm font-medium text-agent-ink">
              Runtime: {connectionStatus}
            </span>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-agent-border bg-white px-3 py-2 text-sm font-semibold text-agent-ink transition hover:border-agent-accent hover:text-agent-accent"
              type="button"
              onClick={() => resetSession(USER_ID)}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset
            </button>
          </div>
        </div>

        {error ? (
          <div className="mx-4 rounded-md border border-agent-fallback bg-rose-50 px-4 py-3 text-sm font-medium text-agent-fallback">
            {error}
          </div>
        ) : null}

        <div className="px-4 pb-6">
          <PipelineOverview />
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
            <AssessmentWorkspace userId={USER_ID} />
            <ReasoningDashboard />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
            <LearnBotWorkspace userId={USER_ID} />
            <FinalReview userId={USER_ID} />
          </div>
        </div>
      </div>
    </AgentMonitorShell>
  );
}
