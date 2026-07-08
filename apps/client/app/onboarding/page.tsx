import { createUser } from './actions';

export const metadata = { title: 'OddsPool — Pick your handle' };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-preply-pink flex items-center justify-center p-6">
      <div className="bg-soft-white border border-smoke w-full max-w-sm p-10" style={{ borderRadius: 8 }}>
        <p
          className="text-xs font-bold uppercase tracking-widest text-midnight-ink mb-8"
          style={{ fontFamily: 'var(--font-platform)' }}
        >
          OddsPool
        </p>

        <h1
          className="text-4xl font-bold text-midnight-ink mb-2 leading-tight"
          style={{ fontFamily: 'var(--font-platform)', lineHeight: 1.1 }}
        >
          Pick your<br />handle.
        </h1>
        <p className="text-graphite text-sm mb-8">
          No sign-up required — just a name and you&apos;re in.
        </p>

        <form action={createUser} className="flex flex-col gap-3">
          <input
            name="handle"
            type="text"
            placeholder="cool_handle_99"
            minLength={3}
            maxLength={20}
            required
            autoFocus
            autoComplete="off"
            className="w-full border border-smoke px-4 py-3 text-midnight-ink placeholder:text-pewter bg-soft-white outline-none focus:border-midnight-ink transition-colors text-sm"
            style={{ borderRadius: 4 }}
          />

          {error && (
            <p className="text-xs text-graphite bg-signal-yellow px-3 py-2" style={{ borderRadius: 4 }}>
              {decodeURIComponent(error)}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-midnight-ink text-soft-white font-semibold py-3 text-sm mt-1 hover:opacity-80 transition-opacity active:opacity-60"
            style={{ borderRadius: 4 }}
          >
            Let&apos;s play →
          </button>
        </form>

        <p className="text-pewter text-xs mt-6 text-center">
          3–20 chars · letters, numbers, underscore
        </p>
      </div>
    </main>
  );
}
