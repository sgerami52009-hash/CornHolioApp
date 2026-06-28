import type { Format, BracketKind, SeededTeam, EngineMatch, Bracket } from './types';

function makeKey(bracket: BracketKind, round: number, slot: number): string {
  const prefix = bracket === 'winners' ? 'W' : bracket === 'losers' ? 'L' : 'GF';
  return `${prefix}-${round}-${slot}`;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard seeding order for a bracket of size `size`.
 * For size=8: [1,8,5,4,3,6,7,2] — ensures highest seeds get byes
 * and standard bracket matchups (1v8, 4v5, 3v6, 2v7).
 */
function standardSeedOrder(size: number): number[] {
  if (size === 1) return [1];
  const half = standardSeedOrder(size / 2);
  const result: number[] = [];
  for (const seed of half) {
    result.push(seed, size + 1 - seed);
  }
  return result;
}

function generateWinnersBracket(
  teams: SeededTeam[],
  bracketSize: number,
  _format: Format,
): EngineMatch[] {
  const matches: EngineMatch[] = [];
  const totalRounds = Math.log2(bracketSize);
  const seedOrder = standardSeedOrder(bracketSize);

  // Map seed number -> team id (null for byes)
  const seedMap = new Map<number, string>();
  for (const t of teams) {
    seedMap.set(t.seed, t.id);
  }

  // Generate all rounds
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let slot = 0; slot < matchesInRound; slot++) {
      const key = makeKey('winners', round, slot);
      const match: EngineMatch = {
        key,
        bracket: 'winners',
        round,
        slot,
        teamA: null,
        teamB: null,
        isBye: false,
        nextMatchKey: round < totalRounds ? makeKey('winners', round + 1, Math.floor(slot / 2)) : null,
        nextMatchSlot: round < totalRounds ? (slot % 2 === 0 ? 'a' : 'b') : null,
        loserNextMatchKey: null,
        loserNextSlot: null,
      };
      matches.push(match);
    }
  }

  // Fill round 1 with seeded teams
  const round1Matches = matches.filter(m => m.round === 1);
  for (let i = 0; i < round1Matches.length; i++) {
    const seedA = seedOrder[i * 2];
    const seedB = seedOrder[i * 2 + 1];
    const m = round1Matches[i];
    m.teamA = seedMap.get(seedA) ?? null;
    m.teamB = seedMap.get(seedB) ?? null;

    // Mark byes
    if (m.teamA !== null && m.teamB === null) {
      m.isBye = true;
    } else if (m.teamA === null && m.teamB !== null) {
      m.isBye = true;
      // Swap so teamA is always the real team in a bye
      m.teamA = m.teamB;
      m.teamB = null;
    }
  }

  return matches;
}

function generateLosersBracket(
  bracketSize: number,
  winnersMatches: EngineMatch[],
): EngineMatch[] {
  const matches: EngineMatch[] = [];
  const winnersRounds = Math.log2(bracketSize);

  // For an 8-team bracket (3 winners rounds), losers bracket has:
  // Round 1 (minor): 4 slots — receives losers from W-R1 (4 matches)
  //   But actually standard double-elim for 8 teams:
  //   L-R1: 2 matches (losers from W-R1, paired)
  //   L-R2: 2 matches (L-R1 winners vs losers from W-R2)
  //   L-R3: 1 match (L-R2 winners paired)
  //   L-R4: 1 match (L-R3 winner vs loser from W-R3/semifinal)
  //
  // General pattern for bracket size N (N = bracketSize):
  //   Winners has log2(N) rounds, with N/2 R1 matches
  //   Losers bracket alternates:
  //     Odd rounds (minor): consolidate within losers bracket
  //     Even rounds (major): receive drop-downs from winners bracket
  //   Actually, the standard pattern is:
  //     L-R1: N/4 matches (losers from W-R1 paired up)
  //     L-R2: N/4 matches (L-R1 winners vs losers from W-R2)
  //     L-R3: N/8 matches (L-R2 winners paired)
  //     L-R4: N/8 matches (L-R3 winners vs losers from W-R3)
  //     ... continuing until 1 match remains

  // For bracketSize=8: W has 4+2+1=7 matches across 3 rounds
  // Losers: R1(2), R2(2), R3(1), R4(1) = 6 matches

  let losersRound = 1;
  let currentSlots = bracketSize / 4; // Start with half the W-R1 matches

  for (let wr = 1; wr < winnersRounds; wr++) {
    // Minor round: pair up losers from within losers bracket (or initial drop from winners R1)
    for (let slot = 0; slot < currentSlots; slot++) {
      matches.push({
        key: makeKey('losers', losersRound, slot),
        bracket: 'losers',
        round: losersRound,
        slot,
        teamA: null,
        teamB: null,
        isBye: false,
        nextMatchKey: makeKey('losers', losersRound + 1, slot),
        nextMatchSlot: 'a',
        loserNextMatchKey: null,
        loserNextSlot: null,
      });
    }
    losersRound++;

    // Major round: losers bracket survivors vs drop-downs from winners
    for (let slot = 0; slot < currentSlots; slot++) {
      const isLastLosersRound = wr === winnersRounds - 1;
      matches.push({
        key: makeKey('losers', losersRound, slot),
        bracket: 'losers',
        round: losersRound,
        slot,
        teamA: null,
        teamB: null,
        isBye: false,
        nextMatchKey: isLastLosersRound ? null : makeKey('losers', losersRound + 1, Math.floor(slot / 2)),
        nextMatchSlot: isLastLosersRound ? null : (slot % 2 === 0 ? 'a' : 'b'),
        loserNextMatchKey: null,
        loserNextSlot: null,
      });
    }
    losersRound++;
    currentSlots = Math.max(1, currentSlots / 2);
  }

  // Wire up losers from winners bracket into losers bracket
  // W-R1 losers -> L-R1 (the minor round)
  const wR1 = winnersMatches.filter(m => m.round === 1).sort((a, b) => a.slot - b.slot);
  const lR1 = matches.filter(m => m.round === 1).sort((a, b) => a.slot - b.slot);

  // W-R1 has bracketSize/2 matches, L-R1 has bracketSize/4 matches
  // Pair them: W-R1 slot 0&1 -> L-R1 slot 0, etc.
  // But we need to cross-fold for proper seeding (high seed vs low seed in losers)
  for (let i = 0; i < wR1.length; i++) {
    const lSlot = Math.floor(i / 2);
    const lMatch = lR1[lSlot];
    // Reverse order within each pair for cross-bracket seeding
    const feedSlot: 'a' | 'b' = i % 2 === 0 ? 'a' : 'b';
    wR1[i].loserNextMatchKey = lMatch.key;
    wR1[i].loserNextSlot = feedSlot;
  }

  // W-R2+ losers -> L major rounds
  // W-R2 losers -> L-R2 (slot 'b' — the drop-in side)
  // W-R3 losers -> L-R4 (slot 'b')
  // General: W-R(k) losers -> L-R(2*(k-1)) slot 'b'
  for (let wr = 2; wr <= winnersRounds; wr++) {
    const losersTargetRound = 2 * (wr - 1);
    const wMatches = winnersMatches.filter(m => m.round === wr).sort((a, b) => a.slot - b.slot);
    const lMatches = matches.filter(m => m.round === losersTargetRound).sort((a, b) => a.slot - b.slot);

    // Reverse the order of drop-downs for better bracket balance
    for (let i = 0; i < wMatches.length; i++) {
      const targetSlot = lMatches.length - 1 - i;
      wMatches[i].loserNextMatchKey = lMatches[targetSlot].key;
      wMatches[i].loserNextSlot = 'b';
    }
  }

  // Set the last losers match to feed into grand final
  const lastLosersRound = losersRound - 1;
  const lastLosersMatch = matches.find(m => m.round === lastLosersRound && m.slot === 0);
  if (lastLosersMatch) {
    lastLosersMatch.nextMatchKey = makeKey('grand_final', 1, 0);
    lastLosersMatch.nextMatchSlot = 'b';
  }

  return matches;
}

export function generateBracket(teams: SeededTeam[], format: Format): Bracket {
  if (teams.length < 2) throw new Error('Need at least 2 teams');

  const bracketSize = nextPowerOfTwo(teams.length);
  const winnersMatches = generateWinnersBracket(teams, bracketSize, format);

  if (format === 'single') {
    return { matches: winnersMatches };
  }

  // Double elimination
  const losersMatches = generateLosersBracket(bracketSize, winnersMatches);

  // Grand final: winners bracket champion vs losers bracket champion
  const winnersRounds = Math.log2(bracketSize);
  const winnersFinal = winnersMatches.find(m => m.round === winnersRounds);
  if (winnersFinal) {
    winnersFinal.nextMatchKey = makeKey('grand_final', 1, 0);
    winnersFinal.nextMatchSlot = 'a';
  }

  const grandFinal: EngineMatch = {
    key: makeKey('grand_final', 1, 0),
    bracket: 'grand_final',
    round: 1,
    slot: 0,
    teamA: null,
    teamB: null,
    isBye: false,
    nextMatchKey: null,
    nextMatchSlot: null,
    loserNextMatchKey: null,
    loserNextSlot: null,
  };

  return { matches: [...winnersMatches, ...losersMatches, grandFinal] };
}

/**
 * Auto-resolve a single bye match and cascade into downstream byes.
 */
function autoResolveBye(
  bracket: Bracket,
  results: Record<string, { winnerId: string; scoreA: number; scoreB: number }>,
  bye: EngineMatch,
): EngineMatch[] {
  const updated: EngineMatch[] = [];
  if (results[bye.key] || !bye.teamA) return updated;

  results[bye.key] = { winnerId: bye.teamA, scoreA: 0, scoreB: 0 };

  if (bye.nextMatchKey) {
    const nextMatch = bracket.matches.find(m => m.key === bye.nextMatchKey);
    if (nextMatch) {
      if (bye.nextMatchSlot === 'a') {
        nextMatch.teamA = bye.teamA;
      } else {
        nextMatch.teamB = bye.teamA;
      }
      updated.push(nextMatch);

      // If the next match is also a bye with a team, auto-resolve recursively
      if (nextMatch.isBye && !results[nextMatch.key]) {
        if (!nextMatch.teamA && nextMatch.teamB) {
          nextMatch.teamA = nextMatch.teamB;
          nextMatch.teamB = null;
        }
        if (nextMatch.teamA) {
          updated.push(...autoResolveBye(bracket, results, nextMatch));
        }
      }
    }
  }

  return updated;
}

export function applyResult(
  bracket: Bracket,
  results: Record<string, { winnerId: string; scoreA: number; scoreB: number }>,
  matchKey: string,
  scoreA: number,
  scoreB: number,
): {
  updatedMatches: EngineMatch[];
  eliminatedTeamIds: string[];
  isComplete: boolean;
  championId: string | null;
} {
  const match = bracket.matches.find(m => m.key === matchKey);
  if (!match) throw new Error(`Match ${matchKey} not found`);

  // Check if already applied (idempotency)
  const existing = results[matchKey];
  if (existing) {
    if (existing.scoreA === scoreA && existing.scoreB === scoreB) {
      return { updatedMatches: [], eliminatedTeamIds: [], isComplete: false, championId: null };
    }
    throw new Error(`Match ${matchKey} already has a different result`);
  }

  // Validate scores
  if (match.isBye) throw new Error('Cannot score a bye match');
  if (!match.teamA || !match.teamB) throw new Error('Match does not have both teams');
  if (scoreA < 0 || scoreB < 0) throw new Error('Scores must be non-negative');
  if (scoreA === scoreB) throw new Error('Scores cannot be tied — one team must win');

  const winnerId = scoreA > scoreB ? match.teamA : match.teamB;
  const loserId = scoreA > scoreB ? match.teamB : match.teamA;

  // Record the result
  results[matchKey] = { winnerId, scoreA, scoreB };

  const updatedMatches: EngineMatch[] = [];
  const eliminatedTeamIds: string[] = [];

  // Advance winner
  if (match.nextMatchKey) {
    const nextMatch = bracket.matches.find(m => m.key === match.nextMatchKey);
    if (nextMatch) {
      if (match.nextMatchSlot === 'a') {
        nextMatch.teamA = winnerId;
      } else {
        nextMatch.teamB = winnerId;
      }
      updatedMatches.push(nextMatch);
    }
  }

  // Handle loser
  if (match.loserNextMatchKey) {
    // Double elim: loser drops to losers bracket
    const loserMatch = bracket.matches.find(m => m.key === match.loserNextMatchKey);
    if (loserMatch) {
      if (match.loserNextSlot === 'a') {
        loserMatch.teamA = loserId;
      } else {
        loserMatch.teamB = loserId;
      }
      updatedMatches.push(loserMatch);

      // If this losers match is a bye (other slot empty due to winners bye),
      // auto-resolve it immediately
      if (loserMatch.isBye && !results[loserMatch.key]) {
        // Ensure the real team is in teamA
        if (!loserMatch.teamA && loserMatch.teamB) {
          loserMatch.teamA = loserMatch.teamB;
          loserMatch.teamB = null;
        }
        if (loserMatch.teamA) {
          const byeResults = autoResolveBye(bracket, results, loserMatch);
          updatedMatches.push(...byeResults);
        }
      }
    }
  } else {
    // No loser destination = eliminated
    eliminatedTeamIds.push(loserId);
  }

  // Check if tournament is complete
  let isComplete = false;
  let championId: string | null = null;

  if (!match.nextMatchKey) {
    // This is the final match
    isComplete = true;
    championId = winnerId;
    // The loser of the final is also eliminated
    if (!eliminatedTeamIds.includes(loserId)) {
      eliminatedTeamIds.push(loserId);
    }
  }

  return { updatedMatches, eliminatedTeamIds, isComplete, championId };
}

/**
 * Auto-resolve bye matches. Returns matches that were resolved and any
 * downstream matches that were updated.
 *
 * When a winners-bracket bye is resolved, the losers-bracket match that
 * expected the "loser" will only ever receive one team. We mark it as a
 * bye too and resolve it recursively.
 */
export function resolveAllByes(
  bracket: Bracket,
  results: Record<string, { winnerId: string; scoreA: number; scoreB: number }>,
): EngineMatch[] {
  const updatedMatches: EngineMatch[] = [];

  // First: mark losers bracket matches that receive from winners-bracket byes as byes
  const winnersByes = bracket.matches.filter(m => m.isBye && m.bracket === 'winners' && m.teamA && !results[m.key]);
  for (const bye of winnersByes) {
    if (bye.loserNextMatchKey) {
      const loserMatch = bracket.matches.find(m => m.key === bye.loserNextMatchKey);
      if (loserMatch) {
        loserMatch.isBye = true;
        updatedMatches.push(loserMatch);
      }
    }
  }

  // Resolve all byes (winners bracket byes have teamA set)
  for (const bye of winnersByes) {
    updatedMatches.push(...autoResolveBye(bracket, results, bye));
  }

  return updatedMatches;
}
