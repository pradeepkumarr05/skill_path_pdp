import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle,
  Clock,
  Desktop,
  LockKey,
  Microphone,
  Prohibit,
  ShieldCheck,
  WarningCircle,
  WifiHigh,
} from '@phosphor-icons/react';
import { SkillPathLogo } from '../components/SkillPathLogo';
import type { ProfileSetupResult } from './ProfileSetupPage';

interface AssessmentGuidelinesPageProps {
  profile: ProfileSetupResult;
  onBack: () => void;
}

const guidelineItems = [
  {
    id: 'permissions',
    title: 'Allow camera and microphone access',
    detail: 'The assessment uses live video and audio monitoring for identity and environment checks.',
    icon: Camera,
  },
  {
    id: 'fullscreen',
    title: 'Stay in full-screen mode',
    detail: 'Tab switching, app switching, notification overlays, and full-screen exits are logged.',
    icon: Desktop,
  },
  {
    id: 'environment',
    title: 'Use a quiet, well-lit room',
    detail: 'Multiple faces, background voices, and secondary devices may be flagged for review.',
    icon: Microphone,
  },
  {
    id: 'integrity',
    title: 'Do not use external help',
    detail: 'Notes, search engines, AI assistants, phones, and communication apps are not allowed.',
    icon: Prohibit,
  },
  {
    id: 'network',
    title: 'Keep a stable internet connection',
    detail: 'If the session drops, reconnect immediately from the same device and account.',
    icon: WifiHigh,
  },
  {
    id: 'recording',
    title: 'Understand that activity is recorded',
    detail: 'Screen, audio, proctoring flags, responses, and timestamps are stored for evaluation.',
    icon: LockKey,
  },
];

export function AssessmentGuidelinesPage({ profile, onBack }: AssessmentGuidelinesPageProps) {
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  const acceptedCount = useMemo(() => Object.values(accepted).filter(Boolean).length, [accepted]);
  const allAccepted = acceptedCount === guidelineItems.length;
  const claimedSkills = profile.claimedSkills.length > 0 ? profile.claimedSkills : ['No existing skills claimed'];

  const toggleAccepted = (id: string) => {
    setAccepted((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <main className="min-h-screen bg-skillpath-night p-4 text-skillpath-cream sm:p-5 lg:p-6">
      <div className="flex min-h-[calc(100vh-32px)] w-full flex-col rounded-lg border border-white/10 bg-skillpath-night shadow-panel sm:min-h-[calc(100vh-40px)] lg:min-h-[calc(100vh-48px)]">
        <header className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <SkillPathLogo />
            <span className="rounded-full bg-skillpath-teal px-3 py-1.5 text-sm font-black text-skillpath-night lg:hidden">3/4 complete</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-[240px]">
              <div className="mb-2 flex items-center justify-between text-sm font-black text-skillpath-cream">
                <span>Assessment entry</span>
                <span>{acceptedCount}/{guidelineItems.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/14">
                <div className="h-full rounded-full bg-skillpath-teal transition-all" style={{ width: `${(acceptedCount / guidelineItems.length) * 100}%` }} />
              </div>
            </div>
            <span className="hidden rounded-full bg-skillpath-teal px-3 py-1.5 text-sm font-black text-skillpath-night lg:inline-flex">3/4 complete</span>
          </div>
        </header>

        <div className="grid flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(330px,420px)] lg:p-8">
          <section className="min-w-0">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-4xl font-black leading-tight text-skillpath-cream sm:text-5xl">Chatbot Assessment Guidelines</h1>
                <p className="mt-3 max-w-4xl text-base font-medium leading-7 text-skillpath-cream/70">
                  The assessment is a real-time proctored conversation. Questions are generated from your selected domain, interested roles, and claimed skills.
                </p>
              </div>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/14 bg-white/8 px-4 text-sm font-black text-skillpath-cream transition hover:border-skillpath-teal"
                type="button"
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" weight="bold" aria-hidden="true" />
                Back
              </button>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-lg border border-white/10 bg-skillpath-night shadow-panel xl:col-span-2">
                <div className="grid gap-4 border-b border-white/10 p-4 sm:grid-cols-3 sm:p-5">
                  <Metric icon={<Clock className="h-6 w-6" weight="bold" />} label="Duration" value="5 minutes" />
                  <Metric icon={<ShieldCheck className="h-6 w-6" weight="bold" />} label="Mode" value="Proctored" />
                  <Metric icon={<CheckCircle className="h-6 w-6" weight="bold" />} label="Format" value="AI chat" />
                </div>
                <div className="p-4 sm:p-5">
                  <h2 className="text-xl font-black text-skillpath-cream">Claimed skills to be assessed</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {claimedSkills.map((skill) => (
                      <span key={skill} className="rounded-md border border-skillpath-teal/40 bg-white/8 px-3 py-2 text-sm font-black text-skillpath-cream">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {guidelineItems.map((item) => {
                const Icon = item.icon;
                const isAccepted = Boolean(accepted[item.id]);
                return (
                  <button
                    key={item.id}
                    className={`min-h-[150px] rounded-lg border p-4 text-left shadow-soft transition ${
                      isAccepted ? 'border-skillpath-teal bg-skillpath-teal text-skillpath-night' : 'border-white/10 bg-white/8 text-skillpath-cream hover:border-skillpath-teal'
                    }`}
                    type="button"
                    onClick={() => toggleAccepted(item.id)}
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className={`grid h-11 w-11 place-items-center rounded-md ${isAccepted ? 'bg-skillpath-night text-skillpath-teal' : 'bg-skillpath-teal text-skillpath-night'}`}>
                        <Icon className="h-6 w-6" weight="bold" aria-hidden="true" />
                      </div>
                      {isAccepted ? <CheckCircle className="h-6 w-6" weight="fill" aria-hidden="true" /> : null}
                    </div>
                    <h3 className="text-lg font-black">{item.title}</h3>
                    <p className={`mt-2 text-sm font-medium leading-6 ${isAccepted ? 'text-skillpath-night/76' : 'text-skillpath-cream/66'}`}>{item.detail}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
            <section className="rounded-lg border border-skillpath-teal/40 bg-skillpath-cream p-5 text-skillpath-night shadow-panel">
              <h2 className="text-2xl font-black">Candidate brief</h2>
              <div className="mt-5 space-y-3 text-sm">
                <SummaryRow label="Candidate" value={profile.name} />
                <SummaryRow label="Domain" value={profile.domain} />
                <SummaryRow label="Roles" value={profile.interestedRoles.join(', ')} />
                <SummaryRow label="Resume" value={profile.resumeFileName ?? 'Not uploaded'} />
                <SummaryRow label="Transcript" value={profile.transcriptFileName ?? 'Not uploaded'} />
              </div>

              {!allAccepted ? (
                <div className="mt-5 flex gap-2 rounded-md border border-skillpath-danger bg-white p-3 text-sm font-bold text-skillpath-danger">
                  <WarningCircle className="mt-0.5 h-5 w-5 flex-none" weight="bold" aria-hidden="true" />
                  Accept all guidelines to continue.
                </div>
              ) : null}

              {ready ? (
                <div className="mt-5 rounded-md bg-skillpath-night p-4 text-sm font-bold leading-6 text-skillpath-cream">
                  You are cleared to enter the chatbot assessment room.
                </div>
              ) : null}

              <button
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-night px-4 text-base font-black text-skillpath-cream transition hover:bg-skillpath-forest disabled:cursor-not-allowed disabled:bg-skillpath-muted"
                type="button"
                disabled={!allAccepted}
                onClick={() => setReady(true)}
              >
                Start assessment
                <ArrowRight className="h-5 w-5" weight="bold" aria-hidden="true" />
              </button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-white/8 p-3">
      <div className="grid h-10 w-10 place-items-center rounded-md bg-skillpath-teal text-skillpath-night">{icon}</div>
      <div>
        <p className="text-sm font-bold text-skillpath-cream/60">{label}</p>
        <p className="text-base font-black text-skillpath-cream">{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-skillpath-line bg-white p-3">
      <p className="font-black text-skillpath-muted">{label}</p>
      <p className="mt-1 font-black text-skillpath-night">{value}</p>
    </div>
  );
}
