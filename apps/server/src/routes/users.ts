import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

export const usersRouter = new Hono();

const HANDLE_RE = /^[a-zA-Z0-9_]{3,20}$/;

usersRouter.post('/', async (c) => {
  const body = await c.req.json<{ handle?: unknown }>();
  const handle = typeof body.handle === 'string' ? body.handle.trim() : '';

  if (!HANDLE_RE.test(handle)) {
    return c.json({ error: 'Handle must be 3–20 chars: letters, numbers, underscore' }, 400);
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ error: 'Handle already taken' }, 409);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date();
  await db.insert(users).values({ id, handle, createdAt });

  return c.json({ id, handle, createdAt: createdAt.toISOString() }, 201);
});

usersRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [user] = await db
    .select({ id: users.id, handle: users.handle })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return c.json({ error: 'Not found' }, 404);
  return c.json(user);
});
