'use server';

import { redirect } from 'next/navigation';

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

export async function triggerReplay(contestId: string) {
  await fetch(`${SERVER}/api/dev/replay/${contestId}`, { method: 'POST' });
  redirect(`/contests/${contestId}/leaderboard`);
}
