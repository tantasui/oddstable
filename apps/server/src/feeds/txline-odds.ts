import type { OddsSource, Outcome } from '@oddstable/rules';
import { txlineFetch } from './txline-client.js';

// TxLINE OddsPayload (one per market per fixture).
// PriceNames: ['part1','draw','part2'] for 1X2; Prices: milli-decimal (×1000).
type OddsPayload = {
  SuperOddsType?: string;
  MarketPeriod?: string | null;
  PriceNames?: string[];
  priceNames?: string[];
  Prices?: number[];
  prices?: number[];
  InRunning?: boolean;
  MarketParameters?: unknown;
};

// Fixture IDs from TxLINE use the prefix 'txl-' in our DB (e.g. 'txl-12345').
// Strip the prefix to get the raw TxLINE integer ID for API calls.
function toTxlineId(fixtureId: string): string | null {
  return fixtureId.startsWith('txl-') ? fixtureId.slice(4) : null;
}

// Map PriceNames to our '1'|'X'|'2' keys.
// TxLINE uses 'part1'/'draw'/'part2'. Handle other variants defensively.
function normaliseName(name: string): Outcome | null {
  const n = name.trim().toUpperCase();
  if (n === '1' || n === 'PART1' || n === 'HOME' || n === 'W1' || n === 'H') return '1';
  if (n === 'X' || n === 'DRAW' || n === 'D') return 'X';
  if (n === '2' || n === 'PART2' || n === 'AWAY' || n === 'W2' || n === 'A') return '2';
  return null;
}

export class TxLineOdds implements OddsSource {
  async getOdds(
    fixtureIds: string[],
  ): Promise<Record<string, Record<Outcome, number>>> {
    const result: Record<string, Record<Outcome, number>> = {};

    await Promise.all(
      fixtureIds.map(async (id) => {
        const txId = toTxlineId(id);
        if (!txId) return; // mock fixture — skip

        try {
          const res = await txlineFetch(`/api/odds/snapshot/${txId}`);
          const payloads = await res.json() as OddsPayload[];

          // Find the 1X2 market: prefer full-time (MarketPeriod=null), fall back to any 1X2.
          // TxLINE Prices are milli-decimal (decimal × 1000).
          // Convert to basis points (decimal × 100) by dividing by 10.
          const is1X2 = (p: OddsPayload) =>
            p.SuperOddsType?.includes('1X2') || (p.PriceNames ?? p.priceNames ?? []).some((n) => normaliseName(n) !== null);

          const fullTime1X2 = payloads.find((p) => is1X2(p) && p.MarketPeriod == null);
          const candidates = fullTime1X2 ? [fullTime1X2] : payloads.filter(is1X2);

          for (const p of candidates) {
            const names = p.PriceNames ?? p.priceNames ?? [];
            const prices = p.Prices ?? p.prices ?? [];
            if (names.length < 3 || prices.length < 3) continue;

            const mapped: Partial<Record<Outcome, number>> = {};
            let valid = true;
            for (let i = 0; i < 3; i++) {
              const outcome = normaliseName(names[i]!);
              if (!outcome) { valid = false; break; }
              mapped[outcome] = Math.round((prices[i]! ?? 1000) / 10);
            }
            if (valid && mapped['1'] && mapped['X'] && mapped['2']) {
              result[id] = mapped as Record<Outcome, number>;
              console.log(`[txline-odds] ${id} → 1:${mapped['1']} X:${mapped['X']} 2:${mapped['2']}`);
              break;
            }
          }

          if (!result[id]) {
            if (payloads.length > 0) {
              console.warn(`[txline-odds] no 1X2 market found for ${id}, raw:`, JSON.stringify(payloads).slice(0, 300));
            }
            // No market open yet — use neutral placeholder odds so the contest can still be created.
            // These will be overwritten if real odds arrive before kick-off.
            result[id] = { '1': 275, 'X': 310, '2': 275 };
            console.log(`[txline-odds] ${id} → using placeholder odds (market not yet open)`);
          }
        } catch (err) {
          console.error(`[txline-odds] failed for ${id}:`, (err as Error).message);
        }
      }),
    );

    return result;
  }
}
