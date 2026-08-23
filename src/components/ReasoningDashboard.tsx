import { motion } from 'framer-motion';
import { AlertTriangle, BarChart3 } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { useAgentStore } from '../store/useAgentStore';

export function ReasoningDashboard() {
  const skills = useAgentStore((state) => state.skills);
  const isFallbackActive = useAgentStore((state) => state.isFallbackActive);
  const skillProfiles = Object.values(skills);
  const chartData =
    skillProfiles.length > 0
      ? skillProfiles.map((skill) => ({
          skill: skill.name.replace(' and ', ' + '),
          claimed: skill.claimed,
          measured: skill.measured,
          delta: Math.abs(skill.delta),
        }))
      : [
          { skill: 'Design', claimed: 4, measured: 0, delta: 0 },
          { skill: 'State', claimed: 5, measured: 0, delta: 0 },
          { skill: 'Events', claimed: 4, measured: 0, delta: 0 },
        ];

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
          <p className="text-xs font-semibold uppercase text-agent-reasoning">Analysis and Gap Detection</p>
          <h2 className="text-xl font-semibold text-agent-ink">Reasoning visualizer</h2>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-md bg-violet-50 text-agent-reasoning">
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      {isFallbackActive ? (
        <div className="mb-4 flex gap-2 rounded-md border border-agent-fallback bg-rose-50 p-3 text-sm font-medium text-agent-fallback">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          Remediation active. Final submission is blocked until weak topics are relearned and mocks are reattempted.
        </div>
      ) : null}

      <div className="h-[280px] rounded-lg border border-agent-border bg-white p-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} outerRadius="70%">
            <PolarGrid stroke="#dbe3ec" />
            <PolarAngleAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#64748b', fontSize: 11 }} />
            <Radar name="Claimed" dataKey="claimed" stroke="#2563eb" fill="#2563eb" fillOpacity={0.16} />
            <Radar name="Measured" dataKey="measured" stroke="#059669" fill="#059669" fillOpacity={0.22} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 space-y-3">
        {skillProfiles.length === 0 ? (
          <div className="rounded-md border border-agent-border bg-agent-panel p-3 text-sm text-agent-muted">
            Awaiting assessment submission.
          </div>
        ) : (
          skillProfiles.map((skill) => (
            <div key={skill.skillId} className="rounded-md border border-agent-border p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-agent-ink">{skill.name}</h3>
                <span className={skill.isReady ? 'text-sm font-semibold text-agent-success' : 'text-sm font-semibold text-agent-fallback'}>
                  Delta {skill.delta > 0 ? '+' : ''}
                  {skill.delta}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-agent-muted">
                <span>Claimed: {skill.claimed}/5</span>
                <span>Measured: {skill.measured}/5</span>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.section>
  );
}
