import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

// Dev-only: GET /api/dev-login?handle=X — creates or looks up user, sets cookie, redirects home.
// Remove before production deployment.
export async function GET(req: Request) {
  const handle = new URL(req.url).searchParams.get('handle') ?? 'demo_user';
  const res = await fetch(`${SERVER}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle }),
  });
  const user = await res.json() as { id: string };
  const jar = await cookies();
  jar.set('oddstable_uid', user.id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600 });
  return NextResponse.redirect(new URL('/', req.url));
}
