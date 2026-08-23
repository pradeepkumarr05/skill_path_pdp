import { ArrowLeft, UserCircle } from '@phosphor-icons/react';
import type { LoginMethod } from './LoginPage';

interface ProfileSetupPlaceholderProps {
  lastLoginMethod: LoginMethod | null;
  onBack: () => void;
}

export function ProfileSetupPlaceholder({ lastLoginMethod, onBack }: ProfileSetupPlaceholderProps) {
  return (
    <main className="min-h-screen bg-skillpath-night px-4 py-5 text-skillpath-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-5xl items-center justify-center">
        <section className="w-full rounded-lg border border-skillpath-line bg-skillpath-paper p-6 shadow-panel sm:p-8">
          <button
            className="mb-8 inline-flex items-center gap-2 rounded-md border border-skillpath-line bg-white px-3 py-2 text-sm font-bold text-skillpath-ink transition hover:border-skillpath-teal hover:text-skillpath-teal"
            type="button"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to login
          </button>

          <div className="grid gap-6 md:grid-cols-[72px_minmax(0,1fr)] md:items-start">
            <div className="grid h-[72px] w-[72px] place-items-center rounded-lg bg-skillpath-forest text-white">
              <UserCircle className="h-8 w-8" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-black uppercase text-skillpath-teal">Page 2</p>
              <h1 className="mt-2 text-3xl font-black text-skillpath-night">Profile Setup</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-skillpath-muted">
                Login succeeded through {lastLoginMethod ?? 'auth'}. Next step: complete basic details, education, experience, and role context.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
