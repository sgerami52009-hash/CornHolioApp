import { describe, it, expect } from 'vitest';
import { generateBracket, applyResult, resolveAllByes } from './engine';
import type { SeededTeam } from './types';

function makeTeams(count: number): SeededTeam[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `team-${i + 1}`,
    seed: i + 1,
  }));
}

// Helper: simulate a full single-elimination tournament
function simulateSingleElim(teamCount: number) {
  const teams = makeTeams(teamCount);
  const bracket = generateBracket(teams, 'single');
  const results: Record<string, { winnerId: string; scoreA: number; scoreB: number }> = {};

  // Resolve byes first
  resolveAllByes(bracket, results);

  const teamWins: Record<string, number> = {};
  const teamScores: Record<string, number> = {};
  for (const t of teams) {
    teamWins[t.id] = 0;
    teamScores[t.id] = 0;
  }

  let champion: string | null = null;
  const eliminatedTeams = new Set<string>();

  // Play matches round by round
  const maxRound = Math.max(...bracket.matches.map(m => m.round));
  for (let round = 1; round <= maxRound; round++) {
    const roundMatches = bracket.matches
      .filter(m => m.round === round && !m.isBye && !results[m.key])
      .filter(m => m.teamA && m.teamB);

    for (const match of roundMatches) {
      const scoreA = 21;
      const scoreB = Math.floor(Math.random() * 21);

      const result = applyResult(bracket, results, match.key, scoreA, scoreB);

      // Track scoring
      const winnerId = scoreA === 21 ? match.teamA! : match.teamB!;
      teamWins[winnerId] = (teamWins[winnerId] || 0) + 1;
      teamScores[match.teamA!] = (teamScores[match.teamA!] || 0) + scoreA;
      teamScores[match.teamB!] = (teamScores[match.teamB!] || 0) + scoreB;

      for (const eid of result.eliminatedTeamIds) {
        eliminatedTeams.add(eid);
      }
      if (result.isComplete) {
        champion = result.championId;
      }
    }
  }

  return { bracket, results, champion, eliminatedTeams, teamWins, teamScores, teams };
}

// Helper: simulate a full double-elimination tournament
function simulateDoubleElim(teamCount: number) {
  const teams = makeTeams(teamCount);
  const bracket = generateBracket(teams, 'double');
  const results: Record<string, { winnerId: string; scoreA: number; scoreB: number }> = {};

  resolveAllByes(bracket, results);

  const teamWins: Record<string, number> = {};
  const teamScores: Record<string, number> = {};
  for (const t of teams) {
    teamWins[t.id] = 0;
    teamScores[t.id] = 0;
  }

  let champion: string | null = null;
  const eliminatedTeams = new Set<string>();

  // Play all available matches iteratively
  let safety = 0;
  while (!champion && safety < 100) {
    safety++;
    const playable = bracket.matches.filter(
      m => !results[m.key] && !m.isBye && m.teamA && m.teamB
    );
    if (playable.length === 0) break;

    for (const match of playable) {
      if (results[match.key]) continue;
      const scoreA = 21;
      const scoreB = Math.floor(Math.random() * 21);

      const result = applyResult(bracket, results, match.key, scoreA, scoreB);

      const winnerId = scoreA === 21 ? match.teamA! : match.teamB!;
      teamWins[winnerId] = (teamWins[winnerId] || 0) + 1;
      teamScores[match.teamA!] = (teamScores[match.teamA!] || 0) + scoreA;
      teamScores[match.teamB!] = (teamScores[match.teamB!] || 0) + scoreB;

      for (const eid of result.eliminatedTeamIds) {
        eliminatedTeams.add(eid);
      }
      if (result.isComplete) {
        champion = result.championId;
      }
    }
  }

  return { bracket, results, champion, eliminatedTeams, teamWins, teamScores, teams };
}

describe('generateBracket', () => {
  describe('single elimination', () => {
    it.each([6, 7, 8])('generates correct bracket for %d teams', (count) => {
      const teams = makeTeams(count);
      const bracket = generateBracket(teams, 'single');
      const bracketSize = 8; // next power of 2

      // Total matches = bracketSize - 1
      expect(bracket.matches.length).toBe(bracketSize - 1);

      // All matches should be winners bracket
      expect(bracket.matches.every(m => m.bracket === 'winners')).toBe(true);

      // Check byes
      const byes = bracket.matches.filter(m => m.isBye);
      expect(byes.length).toBe(bracketSize - count);

      // Byes should have teamA set and teamB null
      for (const bye of byes) {
        expect(bye.teamA).not.toBeNull();
        expect(bye.teamB).toBeNull();
      }

      // Final match should have no nextMatchKey
      const finals = bracket.matches.filter(m => !m.nextMatchKey);
      expect(finals.length).toBe(1);
    });

    it('has valid next/loser links for 8 teams', () => {
      const teams = makeTeams(8);
      const bracket = generateBracket(teams, 'single');

      for (const match of bracket.matches) {
        if (match.nextMatchKey) {
          const next = bracket.matches.find(m => m.key === match.nextMatchKey);
          expect(next).toBeDefined();
          expect(['a', 'b']).toContain(match.nextMatchSlot);
        }
        // Single elim has no loser links
        expect(match.loserNextMatchKey).toBeNull();
      }
    });
  });

  describe('double elimination', () => {
    it.each([6, 7, 8])('generates correct bracket for %d teams', (count) => {
      const teams = makeTeams(count);
      const bracket = generateBracket(teams, 'double');

      // Should have winners, losers, and grand_final matches
      const winners = bracket.matches.filter(m => m.bracket === 'winners');
      const losers = bracket.matches.filter(m => m.bracket === 'losers');
      const gf = bracket.matches.filter(m => m.bracket === 'grand_final');

      expect(winners.length).toBeGreaterThan(0);
      expect(losers.length).toBeGreaterThan(0);
      expect(gf.length).toBe(1);

      // Check byes
      const byes = bracket.matches.filter(m => m.isBye);
      expect(byes.length).toBe(8 - count);
    });

    it('has valid next/loser links for 8 teams', () => {
      const teams = makeTeams(8);
      const bracket = generateBracket(teams, 'double');

      for (const match of bracket.matches) {
        if (match.nextMatchKey) {
          const next = bracket.matches.find(m => m.key === match.nextMatchKey);
          expect(next, `nextMatchKey ${match.nextMatchKey} from ${match.key} not found`).toBeDefined();
        }
        if (match.loserNextMatchKey) {
          const loserNext = bracket.matches.find(m => m.key === match.loserNextMatchKey);
          expect(loserNext, `loserNextMatchKey ${match.loserNextMatchKey} from ${match.key} not found`).toBeDefined();
        }
      }
    });

    it('winners bracket R1 matches have loser links', () => {
      const teams = makeTeams(8);
      const bracket = generateBracket(teams, 'double');
      const wR1 = bracket.matches.filter(m => m.bracket === 'winners' && m.round === 1);
      for (const m of wR1) {
        expect(m.loserNextMatchKey).not.toBeNull();
        expect(m.loserNextSlot).not.toBeNull();
      }
    });
  });
});

describe('resolveAllByes', () => {
  it('advances bye teams with no score', () => {
    const teams = makeTeams(6); // 2 byes
    const bracket = generateBracket(teams, 'single');
    const results: Record<string, { winnerId: string; scoreA: number; scoreB: number }> = {};

    const updated = resolveAllByes(bracket, results);

    const byes = bracket.matches.filter(m => m.isBye);
    expect(byes.length).toBe(2);

    // Bye results should have score 0/0
    for (const bye of byes) {
      expect(results[bye.key]).toBeDefined();
      expect(results[bye.key].scoreA).toBe(0);
      expect(results[bye.key].scoreB).toBe(0);
    }

    // Bye teams should appear in next matches
    expect(updated.length).toBeGreaterThan(0);
  });
});

describe('applyResult', () => {
  it('rejects non-21 winners', () => {
    const teams = makeTeams(8);
    const bracket = generateBracket(teams, 'single');
    const results: Record<string, { winnerId: string; scoreA: number; scoreB: number }> = {};

    const match = bracket.matches.find(m => m.teamA && m.teamB && !m.isBye)!;
    expect(() => applyResult(bracket, results, match.key, 20, 15)).toThrow();
    expect(() => applyResult(bracket, results, match.key, 21, 21)).toThrow();
  });

  it('advances winner to next match', () => {
    const teams = makeTeams(8);
    const bracket = generateBracket(teams, 'single');
    const results: Record<string, { winnerId: string; scoreA: number; scoreB: number }> = {};

    const match = bracket.matches.find(m => m.round === 1 && m.teamA && m.teamB)!;
    const result = applyResult(bracket, results, match.key, 21, 15);

    expect(result.updatedMatches.length).toBeGreaterThan(0);
    const nextMatch = result.updatedMatches[0];
    expect(nextMatch.teamA === match.teamA || nextMatch.teamB === match.teamA).toBe(true);
  });

  it('idempotent re-apply is a no-op', () => {
    const teams = makeTeams(8);
    const bracket = generateBracket(teams, 'single');
    const results: Record<string, { winnerId: string; scoreA: number; scoreB: number }> = {};

    const match = bracket.matches.find(m => m.round === 1 && m.teamA && m.teamB)!;
    applyResult(bracket, results, match.key, 21, 15);

    // Same result again
    const result2 = applyResult(bracket, results, match.key, 21, 15);
    expect(result2.updatedMatches).toEqual([]);
    expect(result2.eliminatedTeamIds).toEqual([]);
    expect(result2.isComplete).toBe(false);
    expect(result2.championId).toBeNull();
  });

  it('rejects different result for same match', () => {
    const teams = makeTeams(8);
    const bracket = generateBracket(teams, 'single');
    const results: Record<string, { winnerId: string; scoreA: number; scoreB: number }> = {};

    const match = bracket.matches.find(m => m.round === 1 && m.teamA && m.teamB)!;
    applyResult(bracket, results, match.key, 21, 15);

    expect(() => applyResult(bracket, results, match.key, 21, 10)).toThrow();
  });

  it('eliminates loser in single elimination', () => {
    const teams = makeTeams(8);
    const bracket = generateBracket(teams, 'single');
    const results: Record<string, { winnerId: string; scoreA: number; scoreB: number }> = {};

    const match = bracket.matches.find(m => m.round === 1 && m.teamA && m.teamB)!;
    const result = applyResult(bracket, results, match.key, 21, 15);
    expect(result.eliminatedTeamIds).toContain(match.teamB);
  });

  it('drops loser to losers bracket in double elimination', () => {
    const teams = makeTeams(8);
    const bracket = generateBracket(teams, 'double');
    const results: Record<string, { winnerId: string; scoreA: number; scoreB: number }> = {};

    const match = bracket.matches.find(m => m.bracket === 'winners' && m.round === 1 && m.teamA && m.teamB)!;
    const result = applyResult(bracket, results, match.key, 21, 15);

    // Loser should NOT be eliminated (first loss in double elim)
    expect(result.eliminatedTeamIds).not.toContain(match.teamB);

    // Loser should appear in a losers bracket match
    const loserMatch = bracket.matches.find(m =>
      m.bracket === 'losers' && (m.teamA === match.teamB || m.teamB === match.teamB)
    );
    expect(loserMatch).toBeDefined();
  });
});

describe('full tournament simulation - single elimination', () => {
  it.each([6, 7, 8])('completes with %d teams — one champion, all others eliminated', (count) => {
    const { champion, eliminatedTeams, teams } = simulateSingleElim(count);

    expect(champion).not.toBeNull();
    expect(eliminatedTeams.size).toBe(count - 1);

    for (const t of teams) {
      if (t.id !== champion) {
        expect(eliminatedTeams.has(t.id)).toBe(true);
      }
    }
  });
});

describe('full tournament simulation - double elimination', () => {
  it.each([6, 7, 8])('completes with %d teams — one champion, all others eliminated', (count) => {
    const { champion, eliminatedTeams, teams } = simulateDoubleElim(count);

    expect(champion).not.toBeNull();
    expect(eliminatedTeams.size).toBe(count - 1);

    for (const t of teams) {
      if (t.id !== champion) {
        expect(eliminatedTeams.has(t.id)).toBe(true);
      }
    }
  });
});
