export type Format = 'single' | 'double';
export type BracketKind = 'winners' | 'losers' | 'grand_final';

export interface SeededTeam {
  id: string;
  seed: number;
}

export interface EngineMatch {
  key: string;
  bracket: BracketKind;
  round: number;
  slot: number;
  teamA: string | null;
  teamB: string | null;
  isBye: boolean;
  nextMatchKey: string | null;
  nextMatchSlot: 'a' | 'b' | null;
  loserNextMatchKey: string | null;
  loserNextSlot: 'a' | 'b' | null;
}

export interface Bracket {
  matches: EngineMatch[];
}
