// types.ts

export interface Couple {
    manName: string;
    womanName: string;
  }
  
  export interface Match {
    id: string;
    globalId: string;
    round: number;
    teamA: { man: number; woman: number };
    teamB: { man: number; woman: number } | null;
    court?: number;
  }
  
  export interface Round {
    round: number;
    matches: Match[];
  }
  
  export interface MatchResult {
    scoreA: string | number;
    scoreB: string | number;
  }
  
  export interface CourtColor {
    bg: string;
    border: string;
    text: string;
  }
  
  export interface SemifinalMatch {
    id: string;
    coupleA: number;
    coupleB: number;
    scoreA: string | number;
    scoreB: string | number;
  }
  
  export interface FinalMatch {
    coupleA: number;
    coupleB: number;
    scoreA: string | number;
    scoreB: string | number;
  }