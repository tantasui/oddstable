import { describe, it, expect } from 'bun:test';
import {
  resolveMatch,
  winningCount,
  oddscoreRaw,
  oddscoreDisplay,
  rankEntries,
  ODDS_SCALE,
} from '../src/index.js';
import type { ContestMatch, Entry } from '../src/index.js';

// §6.3 shared fixture: 4 matches, results M1='1' M2='1' M3='X' M4='1'
// oddsBp on the winning side: 150, 200, 300, 330
const matches: ContestMatch[] = [
  { fixtureId: 'm1', market: '1X2', oddsBp: { '1': 150, 'X': 210, '2': 380 }, result: '1' },
  { fixtureId: 'm2', market: '1X2', oddsBp: { '1': 200, 'X': 250, '2': 350 }, result: '1' },
  { fixtureId: 'm3', market: '1X2', oddsBp: { '1': 180, 'X': 300, '2': 220 }, result: 'X' },
  { fixtureId: 'm4', market: '1X2', oddsBp: { '1': 330, 'X': 240, '2': 190 }, result: '1' },
];

// Entry A: picks 1,1,X,X — M4 wrong (3 correct)
const entryA: Entry = {
  userId: 'user-a',
  picks: [
    { fixtureId: 'm1', selection: '1' },
    { fixtureId: 'm2', selection: '1' },
    { fixtureId: 'm3', selection: 'X' },
    { fixtureId: 'm4', selection: 'X' }, // wrong: result is '1'
  ],
  submittedAt: 1000,
};

// Entry B: all 4 correct
const entryB: Entry = {
  userId: 'user-b',
  picks: [
    { fixtureId: 'm1', selection: '1' },
    { fixtureId: 'm2', selection: '1' },
    { fixtureId: 'm3', selection: 'X' },
    { fixtureId: 'm4', selection: '1' },
  ],
  submittedAt: 2000,
};

// Entry C: 0 correct
const entryC: Entry = {
  userId: 'user-c',
  picks: [
    { fixtureId: 'm1', selection: '2' },
    { fixtureId: 'm2', selection: 'X' },
    { fixtureId: 'm3', selection: '2' },
    { fixtureId: 'm4', selection: '2' },
  ],
  submittedAt: 500, // earliest, but ranks last
};

describe('resolveMatch', () => {
  it('home win -> 1', () => expect(resolveMatch(2, 1)).toBe('1'));
  it('away win -> 2', () => expect(resolveMatch(0, 3)).toBe('2'));
  it('draw -> X', () => expect(resolveMatch(1, 1)).toBe('X'));
  it('0-0 -> X', () => expect(resolveMatch(0, 0)).toBe('X'));
});

describe('winningCount', () => {
  it('3-correct entry: winningCount = 3', () => {
    expect(winningCount(entryA, matches)).toBe(3);
  });
  it('4-correct entry: winningCount = 4', () => {
    expect(winningCount(entryB, matches)).toBe(4);
  });
  it('0-correct entry: winningCount = 0', () => {
    expect(winningCount(entryC, matches)).toBe(0);
  });
});

describe('oddscoreDisplay', () => {
  it('§6.3 vector: 3 correct -> 1.50×2.00×3.00 = 9.00', () => {
    expect(oddscoreDisplay(entryA, matches)).toBe(9.00);
  });
  it('§6.3 vector: all 4 correct -> 1.50×2.00×3.00×3.30 = 29.70', () => {
    expect(oddscoreDisplay(entryB, matches)).toBe(29.70);
  });
  it('§6.3 vector: 0 correct -> 0.00', () => {
    expect(oddscoreDisplay(entryC, matches)).toBe(0.00);
  });
});

describe('oddscoreRaw', () => {
  it('§6.3 vector: 3 correct -> 150×200×300×100 = 900_000_000', () => {
    expect(oddscoreRaw(entryA, matches)).toBe(900_000_000n);
  });
  it('§6.3 vector: all 4 correct -> 150×200×300×330 = 2_970_000_000', () => {
    expect(oddscoreRaw(entryB, matches)).toBe(2_970_000_000n);
  });
  it('§6.3 vector: 0 correct -> 100^4 = 100_000_000 (floor)', () => {
    expect(oddscoreRaw(entryC, matches)).toBe(BigInt(ODDS_SCALE) ** 4n);
    expect(oddscoreRaw(entryC, matches)).toBe(100_000_000n);
  });
});

describe('rankEntries', () => {
  it('§6.3 rank order: B (all correct) > A (3 correct) > C (0 correct)', () => {
    const ranked = rankEntries([entryA, entryC, entryB], matches);
    expect(ranked.map(e => e.userId)).toEqual(['user-b', 'user-a', 'user-c']);
  });

  it('0-correct entry ranks last even with earliest submittedAt', () => {
    // entryC.submittedAt=500 is earliest but raw=100_000_000 ranks it last
    const ranked = rankEntries([entryC, entryB, entryA], matches);
    expect(ranked[2].userId).toBe('user-c');
  });

  it('tie on raw: earlier submittedAt ranks higher', () => {
    // Both pick only m1 correct (150), all others wrong: raw = 150*100*100*100 = 150_000_000
    const tie1: Entry = {
      userId: 'tie-early',
      picks: [
        { fixtureId: 'm1', selection: '1' }, // correct
        { fixtureId: 'm2', selection: 'X' }, // wrong
        { fixtureId: 'm3', selection: '2' }, // wrong
        { fixtureId: 'm4', selection: '2' }, // wrong
      ],
      submittedAt: 1000,
    };
    const tie2: Entry = {
      userId: 'tie-late',
      picks: [
        { fixtureId: 'm1', selection: '1' }, // correct
        { fixtureId: 'm2', selection: 'X' }, // wrong
        { fixtureId: 'm3', selection: '2' }, // wrong
        { fixtureId: 'm4', selection: '2' }, // wrong
      ],
      submittedAt: 2000,
    };

    expect(oddscoreRaw(tie1, matches)).toBe(oddscoreRaw(tie2, matches)); // confirm tie
    const ranked = rankEntries([tie2, tie1], matches);
    expect(ranked[0].userId).toBe('tie-early');
    expect(ranked[1].userId).toBe('tie-late');
  });

  it('rankEntries does not mutate the input array', () => {
    const input = [entryA, entryC, entryB];
    rankEntries(input, matches);
    expect(input.map(e => e.userId)).toEqual(['user-a', 'user-c', 'user-b']);
  });
});
