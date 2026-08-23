import { ArrowLeft, UserRound } from 'lucide-react';
import type { LoginMethod } from './LoginPage';

interface ProfileSetupPlaceholderProps {
  lastLoginMethod: LoginMethod | null;
  onBack: () => void;
}

export function ProfileSetupPlaceholder({ lastLoginMethod, onBack }: ProfileSetupPlaceholderProps) {
  return (
    <main className="min-h-screen bg-skillpath-mist px-4 py-5 text-skillpath-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-5xl items-center justify-center">
        <section className="w-full rounded-lg border border-skillpath-line bg-skillpath-paper p-6 shadow-panel sm:p-8">
          <button
            className="mb-8 inline-flex items-center gap-2 rounded-md border border-skillpath-line bg-white px-3 py-2 text-sm font-semibold text-skillpath-ink transition hover:border-skillpath-jade hover:text-skillpath-jade"
            type="button"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to login
          </button>

          <div className="grid gap-6 md:grid-cols-[72px_minmax(0,1fr)] md:items-start">
            <div className="grid h-[72px] w-[72px] place-items-center rounded-lg bg-skillpath-pine text-white">
              <UserRound className="h-8 w-8" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase text-skillpath-jade">Page 2</p>
              <h1 className="mt-2 text-3xl font-semibold text-skillpath-pine">Profile Setup</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-skillpath-muted">
                Login succeeded through {lastLoginMethod ?? 'mock auth'}. The Profile Setup page will be designed and built only after you approve Page 1.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
