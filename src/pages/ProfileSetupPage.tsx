import { FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Briefcase, CheckCircle, GraduationCap, MapPin, UserCircle } from '@phosphor-icons/react';
import { SkillPathLogo } from '../components/SkillPathLogo';
import type { LoginMethod } from './LoginPage';

interface ProfileSetupPageProps {
  lastLoginMethod: LoginMethod | null;
  onBack: () => void;
}

type Status = 'Student' | 'Fresher' | 'Professional';

const statusOptions: Status[] = ['Student', 'Fresher', 'Professional'];
const educationOptions = ['High School', 'Diploma', 'Bachelor Degree', 'Master Degree', 'Doctorate', 'Self Taught'];
const genderOptions = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

export function ProfileSetupPage({ lastLoginMethod, onBack }: ProfileSetupPageProps) {
  const [fullName, setFullName] = useState('Aarav Mehta');
  const [age, setAge] = useState('22');
  const [gender, setGender] = useState('Prefer not to say');
  const [education, setEducation] = useState('Bachelor Degree');
  const [status, setStatus] = useState<Status>('Fresher');
  const [role, setRole] = useState('Junior Software Engineer');
  const [city, setCity] = useState('Bengaluru');
  const [experience, setExperience] = useState('0-1 years');
  const [goal, setGoal] = useState('Prepare for backend and full-stack software engineering interviews with a structured readiness plan.');
  const [saved, setSaved] = useState(false);

  const completion = useMemo(() => {
    const fields = [fullName, age, gender, education, status, role, city, experience, goal];
    const completed = fields.filter((value) => value.trim().length > 0).length;
    return Math.round((completed / fields.length) * 100);
  }, [age, city, education, experience, fullName, gender, goal, role, status]);

  const canSubmit = fullName.trim().length > 1 && Number(age) >= 13 && education.length > 0 && status.length > 0 && role.trim().length > 1;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(true);
  };

  return (
    <main className="min-h-screen bg-skillpath-night p-4 text-skillpath-ink sm:p-5 lg:p-6">
      <div className="flex min-h-[calc(100vh-32px)] w-full flex-col rounded-lg bg-skillpath-paper shadow-panel sm:min-h-[calc(100vh-40px)] lg:min-h-[calc(100vh-48px)]">
        <header className="flex flex-col gap-4 border-b border-skillpath-line px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <SkillPathLogo tone="dark" />
            <span className="rounded-full bg-skillpath-night px-3 py-1.5 text-sm font-black text-skillpath-citron lg:hidden">2/4 complete</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-[220px]">
              <div className="mb-2 flex items-center justify-between text-sm font-black text-skillpath-night">
                <span>Profile setup</span>
                <span>{completion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-skillpath-line">
                <div className="h-full rounded-full bg-skillpath-teal transition-all" style={{ width: `${completion}%` }} />
              </div>
            </div>
            <span className="hidden rounded-full bg-skillpath-night px-3 py-1.5 text-sm font-black text-skillpath-citron lg:inline-flex">2/4 complete</span>
          </div>
        </header>

        <form className="grid flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-8 xl:grid-cols-[minmax(0,1fr)_420px]" onSubmit={handleSubmit}>
          <section className="min-w-0">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-4xl font-black leading-tight text-skillpath-night sm:text-5xl">Profile Setup</h1>
                <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-skillpath-muted">
                  Add the basic context SkillPath needs before domain and skill selection.
                </p>
              </div>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-skillpath-line bg-white px-4 text-sm font-black text-skillpath-night transition hover:border-skillpath-night"
                type="button"
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" weight="bold" aria-hidden="true" />
                Back
              </button>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-lg border border-skillpath-line bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-skillpath-night text-skillpath-citron">
                    <UserCircle className="h-6 w-6" weight="bold" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-black text-skillpath-night">Basic details</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-black text-skillpath-night">Full name</span>
                    <input
                      className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft focus:border-skillpath-focus"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      autoComplete="name"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-skillpath-night">Age</span>
                    <input
                      className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft focus:border-skillpath-focus"
                      type="number"
                      min="13"
                      max="80"
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-skillpath-night">Gender</span>
                    <select
                      className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft focus:border-skillpath-focus"
                      value={gender}
                      onChange={(event) => setGender(event.target.value)}
                    >
                      {genderOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-skillpath-line bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-skillpath-forest text-skillpath-cream">
                    <GraduationCap className="h-6 w-6" weight="bold" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-black text-skillpath-night">Education</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-skillpath-night">Qualification</span>
                    <select
                      className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft focus:border-skillpath-focus"
                      value={education}
                      onChange={(event) => setEducation(event.target.value)}
                    >
                      {educationOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-skillpath-night">Current status</span>
                    <select
                      className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft focus:border-skillpath-focus"
                      value={status}
                      onChange={(event) => setStatus(event.target.value as Status)}
                    >
                      {statusOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-skillpath-line bg-white p-4 shadow-soft sm:p-5 xl:col-span-2">
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-skillpath-vermilion text-white">
                    <Briefcase className="h-6 w-6" weight="bold" aria-hidden="true" />
                  </div>
                  <h2 className="text-xl font-black text-skillpath-night">Role context</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-skillpath-night">Target or current role</span>
                    <input
                      className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft focus:border-skillpath-focus"
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-skillpath-night">Experience</span>
                    <input
                      className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-4 text-base font-bold text-skillpath-night shadow-soft focus:border-skillpath-focus"
                      value={experience}
                      onChange={(event) => setExperience(event.target.value)}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-black text-skillpath-night">City</span>
                    <span className="relative block">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-skillpath-muted" weight="bold" aria-hidden="true" />
                      <input
                        className="h-12 w-full rounded-md border border-skillpath-line bg-skillpath-cream px-11 text-base font-bold text-skillpath-night shadow-soft focus:border-skillpath-focus"
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                      />
                    </span>
                  </label>

                  <label className="block md:col-span-3">
                    <span className="mb-2 block text-sm font-black text-skillpath-night">Primary goal</span>
                    <textarea
                      className="min-h-[118px] w-full resize-none rounded-md border border-skillpath-line bg-skillpath-cream px-4 py-3 text-base font-bold leading-6 text-skillpath-night shadow-soft focus:border-skillpath-focus"
                      value={goal}
                      onChange={(event) => setGoal(event.target.value)}
                    />
                  </label>
                </div>
              </section>
            </div>
          </section>

          <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
            <section className="rounded-lg bg-skillpath-night p-5 text-skillpath-cream shadow-panel">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-black">Summary</h2>
                <CheckCircle className="h-7 w-7 text-skillpath-citron" weight={saved ? 'fill' : 'bold'} aria-hidden="true" />
              </div>

              <div className="space-y-4 text-sm">
                <div className="rounded-md bg-white/8 p-3">
                  <p className="font-black text-skillpath-citron">{fullName || 'Name required'}</p>
                  <p className="mt-1 font-medium text-skillpath-cream/72">{role || 'Role required'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white/8 p-3">
                    <p className="text-skillpath-cream/60">Status</p>
                    <p className="mt-1 font-black">{status}</p>
                  </div>
                  <div className="rounded-md bg-white/8 p-3">
                    <p className="text-skillpath-cream/60">Education</p>
                    <p className="mt-1 font-black">{education}</p>
                  </div>
                </div>
                <div className="rounded-md bg-white/8 p-3">
                  <p className="text-skillpath-cream/60">Signed in with</p>
                  <p className="mt-1 font-black capitalize">{lastLoginMethod ?? 'Email'}</p>
                </div>
              </div>

              {saved ? (
                <div className="mt-5 rounded-md bg-skillpath-citron p-3 text-sm font-black text-skillpath-night">
                  Profile saved. Domain Selection is next.
                </div>
              ) : null}

              <button
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-skillpath-citron px-4 text-base font-black text-skillpath-night transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/24 disabled:text-white/50"
                type="submit"
                disabled={!canSubmit}
              >
                Save profile
                <ArrowRight className="h-5 w-5" weight="bold" aria-hidden="true" />
              </button>
            </section>
          </aside>
        </form>
      </div>
    </main>
  );
}
