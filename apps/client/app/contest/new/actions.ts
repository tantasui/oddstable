'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

export async function createContest(formData: FormData) {
  const jar = await cookies();
  const creatorId = jar.get('oddstable_uid')?.value;
  if (!creatorId) redirect('/onboarding');

  const name = ((formData.get('name') as string | null) ?? '').trim();
  const maxEntries = Number(formData.get('maxEntries') ?? 100);
  const fixtureIds = formData.getAll('fixtureIds') as string[];

  if (fixtureIds.length === 0) {
    redirect('/contest/new?error=Pick+at+least+one+match');
  }

  let res: Response;
  try {
    res = await fetch(`${SERVER}/api/contests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, creatorId, fixtureIds, maxEntries }),
      cache: 'no-store',
    });
  } catch {
    redirect('/contest/new?error=Server+unavailable');
  }

  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    redirect(
      `/contest/new?error=${encodeURIComponent(body.error ?? 'Something went wrong')}`,
    );
  }

  const { id } = (await res.json()) as { id: string };
  redirect(`/contests/${id}`);
}
