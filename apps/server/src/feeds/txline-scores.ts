import type { ScoreSource, ScoreUpdate } from '@oddstable/rules';
import { txlineOrigin, txlineHeaders } from './txline-client.js';

// TxLINE score event structure (confirmed from API inspection).
// Score is nested: Score.Participant1.Total.Goals, Score.Participant2.Total.Goals.
// Clock.Seconds is elapsed time in seconds. StatusId 4 = in-progress.
// Full-time is signalled via Action keyword or Clock.Running=false after 50+ min.
type TxScorePart  = { Total?: { Goals?: number }; [key: string]: unknown };
type TxScoreEvent = {
  Score?: { Participant1?: TxScorePart; Participant2?: TxScorePart };
  Clock?: { Running?: boolean; Seconds?: number };
  StatusId?: number;
  GameState?: string;
  Action?: string;
  [key: string]: unknown;
};

function toTxlineId(fixtureId: string): string | null {
  return fixtureId.startsWith('txl-') ? fixtureId.slice(4) : null;
}

// Full-time action keywords seen in TxLINE event stream.
const FT_ACTIONS = new Set(['ft_whistle', 'final_whistle', 'match_end', 'aet_ft_whistle']);

function parseScoreEvent(raw: TxScoreEvent, internalFixtureId: string): ScoreUpdate | null {
  const p1 = raw.Score?.Participant1;
  const p2 = raw.Score?.Participant2;

  // Skip events with no score or clock data (e.g. pure possession updates)
  if (!p1 && !p2 && !raw.Clock) return null;

  const homeGoals = p1?.Total?.Goals ?? 0;
  const awayGoals = p2?.Total?.Goals ?? 0;
  const seconds   = raw.Clock?.Seconds ?? 0;
  const minute    = Math.floor(seconds / 60);

  const action = (raw.Action ?? '').toLowerCase();
  const isFt   =
    FT_ACTIONS.has(action) ||
    (raw.Clock?.Running === false && seconds > 50 * 60) ||
    (action === 'disconnected' && seconds > 80 * 60);

  return { fixtureId: internalFixtureId, homeGoals, awayGoals, minute, status: isFt ? 'ft' : 'live' };
}

// Minimal SSE parser: splits a text chunk into data payloads.
// Handles the standard `data: {...}\n\n` format.
function* parseSseChunk(buffer: string): Generator<string> {
  const blocks = buffer.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim();
        if (payload && payload !== '[DONE]') yield payload;
      }
    }
  }
}

async function subscribeFixture(
  txlineId: string,
  internalId: string,
  onUpdate: (u: ScoreUpdate) => void,
  signal: AbortSignal,
): Promise<void> {
  const url = `${txlineOrigin()}/api/scores/stream?fixtureId=${txlineId}`;
  let loggedRaw = false;

  while (!signal.aborted) {
    try {
      const res = await fetch(url, {
        headers: { ...txlineHeaders(), Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
        signal,
      });

      if (!res.ok) {
        console.error(`[txline-scores] stream ${internalId} → HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      console.log(`[txline-scores] connected to fixture ${internalId} (txline ${txlineId})`);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done || signal.aborted) break;
        buf += decoder.decode(value, { stream: true });

        for (const payload of parseSseChunk(buf)) {
          buf = buf.slice(buf.lastIndexOf(payload) + payload.length);

          try {
            const raw = JSON.parse(payload) as TxScoreEvent;
            if (!loggedRaw) {
              console.log(`[txline-scores] first raw event for ${internalId}:`, JSON.stringify(raw).slice(0, 300));
              loggedRaw = true;
            }
            const update = parseScoreEvent(raw, internalId);
            if (update) onUpdate(update);
          } catch {
            // Non-JSON heartbeat or SSE comment — ignore
          }
        }
      }
    } catch (err) {
      if (signal.aborted) break;
      console.error(`[txline-scores] ${internalId} stream error, reconnecting in 5s:`, (err as Error).message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

export class TxLineScores implements ScoreSource {
  subscribe(fixtureIds: string[], onUpdate: (u: ScoreUpdate) => void): () => void {
    const controller = new AbortController();

    for (const id of fixtureIds) {
      const txId = toTxlineId(id);
      if (!txId) {
        console.warn(`[txline-scores] skipping non-txl fixture: ${id}`);
        continue;
      }
      subscribeFixture(txId, id, onUpdate, controller.signal).catch((err) =>
        console.error(`[txline-scores] fatal for ${id}:`, err),
      );
    }

    return () => controller.abort();
  }
}
