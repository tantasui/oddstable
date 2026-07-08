import { notFound } from 'next/navigation';
import { LeaderboardClient, type LeaderboardRow } from './LeaderboardClient';

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

type ContestSummary = {
  id: string;
  name: string;
  status: string;
};

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [lbRes, contestRes] = await Promise.all([
    fetch(`${SERVER}/api/contests/${id}/leaderboard`, { cache: 'no-store' }),
    fetch(`${SERVER}/api/contests/${id}`, { cache: 'no-store' }),
  ]);

  if (!contestRes.ok) notFound();

  const contest = await contestRes.json() as ContestSummary;
  const initialRows: LeaderboardRow[] = lbRes.ok
    ? (await lbRes.json() as LeaderboardRow[])
    : [];

  return (
    <LeaderboardClient
      contestId={id}
      contestName={contest.name}
      contestStatus={contest.status}
      initialRows={initialRows}
    />
  );
}
