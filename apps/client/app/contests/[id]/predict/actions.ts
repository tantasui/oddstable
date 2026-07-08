'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

export async function submitPicks(contestId: string, formData: FormData) {
  const jar = await cookies();
  const userId = jar.get('oddstable_uid')?.value;
  if (!userId) redirect('/onboarding');

  // Extract picks: form keys "pick_{contestMatchId}" → selection value
  const picks: Array<{ contestMatchId: string; selection: string }> = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('pick_')) {
      picks.push({ contestMatchId: key.slice(5), selection: value as string });
    }
  }
  const anonymous = formData.get('anonymous') === 'on';

  if (picks.length === 0) {
    redirect(`/contests/${contestId}/predict?error=Select+a+pick+for+every+match`);
  }

  let res: Response;
  try {
    res = await fetch(`${SERVER}/api/contests/${contestId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, picks, anonymous }),
      cache: 'no-store',
    });
  } catch {
    redirect(`/contests/${contestId}/predict?error=Server+unavailable`);
  }

  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    redirect(
      `/contests/${contestId}/predict?error=${encodeURIComponent(body.error ?? 'Something went wrong')}`,
    );
  }

  redirect(`/contests/${contestId}/my-picks`);
}
