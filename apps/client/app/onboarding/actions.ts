'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

export async function createUser(formData: FormData) {
  const handle = ((formData.get('handle') as string | null) ?? '').trim();

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(handle)) {
    redirect('/onboarding?error=Handle+must+be+3%E2%80%9320+chars+%28letters%2C+numbers%2C+_+only%29');
  }

  let res: Response;
  try {
    res = await fetch(`${SERVER}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle }),
      cache: 'no-store',
    });
  } catch {
    redirect('/onboarding?error=Server+unavailable+%E2%80%94+is+the+backend+running%3F');
  }

  if (res.status === 409) {
    redirect(`/onboarding?error=Handle+%22${encodeURIComponent(handle)}%22+is+already+taken`);
  }
  if (!res.ok) {
    redirect('/onboarding?error=Something+went+wrong+%E2%80%94+try+again');
  }

  const user = (await res.json()) as { id: string; handle: string };
  const jar = await cookies();
  jar.set('oddstable_uid', user.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // no maxAge = session cookie; persist across tab closes would need maxAge
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect('/');
}
