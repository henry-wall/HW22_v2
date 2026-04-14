import { useTournamentState } from "../../hooks/useTournamentState";
import { useStorage } from "../../services/storage/StorageContext";
import SyncStatusBadge from "../SyncStatusBadge";
import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Player { name: string; }

interface Match {
  id: string;
  globalId: string;
  round: number;
  teamA: { player1: number; player2: number };
  teamB: { player1: number; player2: number } | null;
  court?: number;
}

interface Round { round: number; matches: Match[]; }
interface MatchResult { scoreA: string | number; scoreB: string | number; }
interface CourtColor { bg: string; border: string; text: string; }

// ─── Persisted State ─────────────────────────────────────────────────────────
interface KingQueenTournamentData {
  n: number;
  players: Player[];
  /** groupRounds[g] = 3 rounds for group g (each group = 4 players) */
  groupRounds: Round[][];
  /**
   * seriesRounds[s] = 3 rounds for finals-series s.
   * Series 0 = Ouro (Gold), 1 = Prata (Silver), 2 = Bronze, etc.
   * seriesPlayerOrder[s] = absolute player indices in series s (sorted by group-phase standing).
   */
  seriesRounds: Round[][];
  seriesPlayerOrder: number[][];
  matchResults: Record<string, MatchResult>;
  tournamentName: string;
  durationType: "set6" | "shortset" | "supertie";
  numCourts: number;
}

const DEFAULT_KQ_DATA: KingQueenTournamentData = {
  n: 8,
  players: Array.from({ length: 8 }, (_, i) => ({ name: `Jogador ${i + 1}` })),
  groupRounds: [],
  seriesRounds: [],
  seriesPlayerOrder: [],
  matchResults: {},
  tournamentName: "Rei da Quadra",
  durationType: "set6",
  numCourts: 2,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function KingQueenScheduler({ storagePrefix = "wallbt_kq" }: { storagePrefix?: string }) {
  const { mode, setMode, isConnected } = useStorage();

  const { data: tournamentData, updateField, updateData, syncStatus, lastSavedAt, isLoaded } =
    useTournamentState<KingQueenTournamentData>(`${storagePrefix}_data`, DEFAULT_KQ_DATA);

  // ── Aliases ────────────────────────────────────────────────────────────────
  const n = tournamentData.n;
  const setN = useCallback((v: number) => updateField("n", v), [updateField]);
  const players = tournamentData.players;
  const setPlayers = useCallback((v: Player[]) => updateField("players", v), [updateField]);
  const groupRounds = tournamentData.groupRounds ?? [];
  const seriesRounds = tournamentData.seriesRounds ?? [];
  const seriesPlayerOrder = tournamentData.seriesPlayerOrder ?? [];
  const matchResults = tournamentData.matchResults;
  const setMatchResults = useCallback((v: Record<string, MatchResult>) => updateField("matchResults", v), [updateField]);
  const tournamentName = tournamentData.tournamentName;
  const setTournamentName = useCallback((v: string) => updateField("tournamentName", v), [updateField]);
  const durationType = tournamentData.durationType;
  const setDurationType = useCallback((v: "set6" | "shortset" | "supertie") => updateField("durationType", v), [updateField]);
  const numCourts = tournamentData.numCourts;
  const setNumCourts = useCallback((v: number) => updateField("numCourts", v), [updateField]);

  // ── Derived (non-persisted) ────────────────────────────────────────────────
  const [groupPoints, setGroupPoints] = useState<number[]>([]);
  const [groupWins, setGroupWins] = useState<number[]>([]);
  const [groupLosses, setGroupLosses] = useState<number[]>([]);
  const [groupDiff, setGroupDiff] = useState<number[]>([]);
  const [seriesPoints, setSeriesPoints] = useState<number[]>([]);
  const [seriesWins, setSeriesWins] = useState<number[]>([]);
  const [seriesLosses, setSeriesLosses] = useState<number[]>([]);
  const [seriesDiff, setSeriesDiff] = useState<number[]>([]);
  const [shuffleBeforeGenerating, setShuffleBeforeGenerating] = useState(false);

  // ── Constants ─────────────────────────────────────────────────────────────
  const VALID_N = [4, 8, 12, 16, 20, 24];
  const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const SERIES_NAMES = [
    "Diamante 💎",
    "Ouro 🥇",
    "Prata 🥈",
    "Bronze 🥉",
    "Cobre 🥉",
    "Ferro ⚙️",
    "Cristal 🔮",
    "Elite 🏆",
    "Desafio 🎾",
    "Acesso 🚀"
  ];
  const SERIES_COLORS = [
    { bg: "#E0F2FE", border: "#0EA5E9", text: "#0369A1" }, // Diamante
    { bg: "#FFF3C4", border: "#F59E0B", text: "#92400E" }, // Ouro
    { bg: "#E5E7EB", border: "#9CA3AF", text: "#374151" }, // Prata
    { bg: "#FFEDD5", border: "#EA580C", text: "#7C2D12" }, // Bronze
    { bg: "#FDF4FF", border: "#D946EF", text: "#701A75" }, // Cobre/Rosa/Fallback
    { bg: "#F1F5F9", border: "#64748B", text: "#1E293B" }, // Ferro
    { bg: "#ECFDF5", border: "#10B981", text: "#064E3B" }, // Cristal
    { bg: "#EEF2FF", border: "#6366F1", text: "#312E81" }, // Elite
    { bg: "#FFF7ED", border: "#F97316", text: "#7C2D12" }, // Desafio
    { bg: "#F0FDF4", border: "#22C55E", text: "#14532D" }, // Acesso
  ];

  const courtColors: CourtColor[] = [
    { bg: "#A0F0FF", border: "#70D0E0", text: "#000" },
    { bg: "#F8A0D0", border: "#E070B0", text: "#000" },
    { bg: "#FFD9A0", border: "#E0B070", text: "#000" },
    { bg: "#D1C0FF", border: "#A080E0", text: "#000" },
    { bg: "#A0F0C0", border: "#70D0A0", text: "#000" },
    { bg: "#FFCBA0", border: "#E0A070", text: "#000" },
  ];

  const numGroups = Math.max(1, Math.floor(n / 4));

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (players.length === n) return;
    const base = Array.from({ length: n }, (_, i) => ({ name: `Jogador ${i + 1}` }));
    for (let i = 0; i < Math.min(players.length, base.length); i++)
      base[i].name = players[i].name || base[i].name;
    setPlayers(base);
  }, [n]);

  useEffect(() => { recomputePoints(); }, [matchResults, groupRounds, seriesRounds, seriesPlayerOrder]);

  // ── Schedule Generation ───────────────────────────────────────────────────
  function shuffleArray<T>(array: T[]): T[] {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  }

  /**
   * Generates the 3 King/Queen rounds for any list of 4 player indices.
   * @param playerIndices - exactly 4 absolute player indices  
   * @param prefix - used for unique globalIds (e.g. "g0", "s1")
   * @param courtBase - base court number for assignment
   */
  function generateKingRounds(playerIndices: number[], prefix: string, courtBase: number): Round[] {
    const [p0, p1, p2, p3] = playerIndices;
    const pairings = [
      { teamA: { player1: p0, player2: p1 }, teamB: { player1: p2, player2: p3 } },
      { teamA: { player1: p0, player2: p2 }, teamB: { player1: p1, player2: p3 } },
      { teamA: { player1: p0, player2: p3 }, teamB: { player1: p1, player2: p2 } },
    ];

    return pairings.map((pairing, r) => ({
      round: r + 1,
      matches: [{
        id: `${prefix}R${r + 1}M1`,
        globalId: `${prefix}_r${r + 1}_m1`,
        round: r + 1,
        teamA: pairing.teamA,
        teamB: pairing.teamB,
        court: (courtBase % Math.max(1, numCourts)) + 1,
      }],
    }));
  }

  function handleGenerate() {
    if (shuffleBeforeGenerating) {
      setPlayers(shuffleArray(players));
    }

    const newGroupRounds: Round[][] = [];
    for (let g = 0; g < numGroups; g++) {
      const players4 = [g * 4, g * 4 + 1, g * 4 + 2, g * 4 + 3];
      newGroupRounds.push(generateKingRounds(players4, `g${g}`, g));
    }
    updateData({
      groupRounds: newGroupRounds,
      seriesRounds: [],
      seriesPlayerOrder: [],
      matchResults: {},
    });
  }

  // ── Scoring ───────────────────────────────────────────────────────────────
  function computeScoresForRounds(
    rounds2d: Round[][],
    keyPrefix: (seriesIdx: number) => string
  ): { pts: number[]; w: number[]; l: number[]; diff: number[] } {
    const pts = Array(n).fill(0);
    const w = Array(n).fill(0);
    const l = Array(n).fill(0);
    const diff = Array(n).fill(0);

    rounds2d.forEach((rounds, s) => {
      const prefix = keyPrefix(s);
      for (const rnd of rounds) {
        for (const m of rnd.matches) {
          const res = matchResults[`${prefix}${m.globalId}`];
          if (!res || !m.teamB) continue;
          const sA = Number(res.scoreA), sB = Number(res.scoreB);
          if (isNaN(sA) || isNaN(sB) || res.scoreA === "" || res.scoreB === "") continue;

          const pA = [m.teamA.player1, m.teamA.player2];
          const pB = [m.teamB.player1, m.teamB.player2];

          pA.forEach(p => { diff[p] += sA - sB; });
          pB.forEach(p => { diff[p] += sB - sA; });
          if (sA > sB) { pA.forEach(p => { pts[p] += 3; w[p]++; }); pB.forEach(p => l[p]++); }
          else if (sB > sA) { pB.forEach(p => { pts[p] += 3; w[p]++; }); pA.forEach(p => l[p]++); }
        }
      }
    });

    return { pts, w, l, diff };
  }

  function recomputePoints() {
    const group = computeScoresForRounds(groupRounds, (g) => `G${g}_`);
    setGroupPoints(group.pts);
    setGroupWins(group.w);
    setGroupLosses(group.l);
    setGroupDiff(group.diff);

    const series = computeScoresForRounds(seriesRounds, (s) => `S${s}_`);
    setSeriesPoints(series.pts);
    setSeriesWins(series.w);
    setSeriesLosses(series.l);
    setSeriesDiff(series.diff);
  }

  // ── Group Phase Standings ─────────────────────────────────────────────────
  function getGroupStandings(g: number) {
    const indices = [g * 4, g * 4 + 1, g * 4 + 2, g * 4 + 3];
    return indices
      .map(i => ({ index: i, pts: groupPoints[i] || 0, diff: groupDiff[i] || 0, wins: groupWins[i] || 0 }))
      .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.wins - a.wins);
  }

  function getGlobalStandings(): { index: number; pts: number; diff: number; wins: number }[] {
    return Array.from({ length: n }, (_, i) => ({
      index: i,
      pts: groupPoints[i] || 0,
      diff: groupDiff[i] || 0,
      wins: groupWins[i] || 0,
    })).sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.wins - a.wins);
  }

  // ── Generate Series (Finals Phase) ────────────────────────────────────────
  function generateSeries() {
    if (groupRounds.length === 0) { alert("Gere o cronograma da fase de grupos primeiro."); return; }
    if (numGroups < 2) { alert("Com apenas 1 grupo, o campeão é determinado na fase de grupos."); return; }

    const ranked = getGlobalStandings().map(s => s.index);

    // Split into groups of 4 for each series
    const newSeriesRounds: Round[][] = [];
    const newSeriesPlayerOrder: number[][] = [];

    for (let s = 0; s < numGroups; s++) {
      const seriesPlayers = ranked.slice(s * 4, s * 4 + 4);
      if (seriesPlayers.length < 4) break;
      newSeriesPlayerOrder.push(seriesPlayers);
      newSeriesRounds.push(generateKingRounds(seriesPlayers, `s${s}`, s));
    }

    updateData({
      seriesRounds: newSeriesRounds,
      seriesPlayerOrder: newSeriesPlayerOrder,
      // Keep matchResults but clear series keys to avoid stale data
      matchResults: Object.fromEntries(
        Object.entries(matchResults).filter(([k]) => !k.startsWith("S"))
      ),
    });
  }

  // ── Series Standings ─────────────────────────────────────────────────────
  function getSeriesStandings(s: number) {
    const playerIndices = seriesPlayerOrder[s] ?? [];
    return playerIndices
      .map(i => ({ index: i, pts: seriesPoints[i] || 0, diff: seriesDiff[i] || 0, wins: seriesWins[i] || 0 }))
      .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.wins - a.wins);
  }

  // ── Score Handler ─────────────────────────────────────────────────────────
  function handleScoreChange(match: Match, key: "scoreA" | "scoreB", value: string, prefix: string) {
    const gid = `${prefix}${match.globalId}`;
    const copy = { ...matchResults };
    if (!copy[gid]) copy[gid] = { scoreA: "", scoreB: "" };
    copy[gid] = { ...copy[gid], [key]: value === "" ? "" : Number(value) };
    setMatchResults(copy);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function matchLabel(m: Match) {
    const g = (n: number) => players[n]?.name ?? `P${n + 1}`;
    return `${g(m.teamA.player1)}/${g(m.teamA.player2)} vs ${m.teamB
      ? `${g(m.teamB.player1)}/${g(m.teamB.player2)}` : "Bye"}`;
  }

  function getTotalMatchCount() {
    const g = groupRounds.reduce((sum, r) => sum + r.reduce((s, rnd) => s + rnd.matches.length, 0), 0);
    const s = seriesRounds.reduce((sum, r) => sum + r.reduce((ss, rnd) => ss + rnd.matches.length, 0), 0);
    return g + s;
  }

  function getDurationEstimate() {
    const totalMatches = getTotalMatchCount();
    const mpm = durationType === "shortset" ? 25 : durationType === "supertie" ? 10 : 40;
    const courts = Math.max(1, numCourts);
    const em = Math.ceil(totalMatches / courts) * mpm;
    return { totalMatches, courts, hours: Math.floor(em / 60), minutes: em % 60 };
  }

  function handleExportCSV() {
    const header = ["Posição", "Grupo", "Jogador", "Pts Grupos", "V", "D", "Saldo"];
    const sorted = getGlobalStandings();
    const rows = sorted.map((c, idx) => [
      idx + 1, GROUP_LETTERS[Math.floor(c.index / 4)], players[c.index]?.name ?? "",
      c.pts, groupWins[c.index] || 0, groupLosses[c.index] || 0, c.diff,
    ]);
    const csv = [header.join(";"), ...rows.map(r => r.map(cell => `"${cell}"`).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tournamentName.replace(/\s+/g, "_")}_Classificacao.csv`;
    link.click();
  }

  const durationEstimate = getDurationEstimate();

  // ── Loading gate ──────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: "16px" }}>
        <div style={{ fontSize: "2rem" }}>⏳</div>
        <p style={{ fontSize: "1.1rem", color: "#6B7280", fontWeight: 500 }}>Carregando dados do torneio...</p>
        <SyncStatusBadge status={syncStatus} lastSavedAt={lastSavedAt} />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-1 py-4 sm:p-6 max-w-7xl mx-auto" style={{ fontFamily: "'Century Gothic','Arial Narrow',Arial,sans-serif" }}>

      {/* CABEÇALHO */}
      <div className="mb-4 rounded-2xl overflow-hidden shadow-md border border-gray-100">
        <div className="flex flex-col sm:flex-row items-stretch">
          <div
            className="flex items-center justify-center px-6 py-4 shrink-0"
            style={{ background: "linear-gradient(135deg, #1a0a2e 0%, #3b0a6e 50%, #6b1a9e 100%)", minWidth: 140 }}
          >
            <img src="https://i.imgur.com/sQWqNap.png" alt="Logo Wall BT" className="h-20 object-contain" />
          </div>
          <div className="flex-1 bg-white px-5 py-3 flex flex-col justify-center gap-1.5">
            <h1 className="text-2xl font-black leading-tight" style={{ color: "#FB0395" }}>
              {tournamentName || "Rei da Quadra"}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setMode(mode === "local" ? "cloud" : "local")}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${mode === "cloud" ? "bg-blue-600 text-white border-blue-700" : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"}`}
              >
                {mode === "cloud" ? "☁️ Nuvem Ativa" : "💻 Modo Local"}
              </button>
              {mode === "cloud" && (
                <span className={`text-xs font-semibold ${isConnected ? "text-green-600" : "text-gray-400"}`}>
                  {isConnected ? "🟢 Conectado" : "⚪ Aguardando..."}
                </span>
              )}
              <SyncStatusBadge status={syncStatus} lastSavedAt={lastSavedAt} />
            </div>
          </div>
        </div>

        {/* Formulário */}
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 items-end">
            <div className="col-span-2 sm:col-span-1 lg:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Nome do Torneio</label>
              <input
                className="border border-gray-200 bg-white px-3 py-1.5 rounded-lg w-full focus:ring-2 focus:ring-pink-400 outline-none text-sm h-9 shadow-sm"
                value={tournamentName} onChange={e => setTournamentName(e.target.value)} placeholder="Ex: Rei da Quadra Verão"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Nº Jogadores</label>
              <select
                className="border border-gray-200 bg-white px-2 py-1.5 rounded-lg w-full focus:ring-2 focus:ring-pink-400 outline-none h-9 cursor-pointer text-sm shadow-sm"
                value={n} onChange={e => setN(Number(e.target.value))}
              >
                {VALID_N.map(x => <option key={x} value={x}>{x} ({x / 4} grupo{x / 4 > 1 ? "s" : ""})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Quadras</label>
              <input
                type="number" min={1} max={8}
                className="border border-gray-200 bg-white px-2 py-1.5 rounded-lg w-full focus:ring-2 focus:ring-pink-400 outline-none h-9 text-sm shadow-sm"
                value={numCourts} onChange={e => setNumCourts(Number(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Partida</label>
              <select
                className="border border-gray-200 bg-white px-2 py-1.5 rounded-lg w-full focus:ring-2 focus:ring-pink-400 outline-none h-9 cursor-pointer text-sm shadow-sm"
                value={durationType} onChange={e => setDurationType(e.target.value as any)}
              >
                <option value="set6">Set 6 (40min)</option>
                <option value="shortset">Short Set (25min)</option>
                <option value="supertie">Super Tie (10min)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-lg">⏱️</span>
              <span className="text-sm text-gray-700">
                {durationEstimate.totalMatches} partidas · {numGroups} grupo{numGroups > 1 ? "s" : ""} de 4
              </span>
              <span className="text-lg font-black text-[#FB0395]">{durationEstimate.hours}h {durationEstimate.minutes}min</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={shuffleBeforeGenerating} 
                  onChange={e => setShuffleBeforeGenerating(e.target.checked)} 
                  className="w-4 h-4 text-pink-500 rounded focus:ring-pink-400 cursor-pointer" 
                />
                Sorteio Aleatório
              </label>
              <button
                className="px-5 py-1.5 rounded-lg font-bold text-gray-900 text-sm h-9 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-sm shrink-0"
                style={{ backgroundColor: "#00F1FD" }} onClick={handleGenerate}
              >
                ⚙️ Gerar Cronograma da Fase de Grupos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* JOGADORES POR GRUPO */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl px-2 py-4 sm:p-4 shadow col-span-2">
          <h2 className="text-lg font-semibold mb-3">🎾 Jogadores por Grupo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: numGroups }, (_, g) => (
              <div key={g} className="rounded-lg border-2 overflow-hidden" style={{ borderColor: courtColors[g % courtColors.length].border }}>
                <div className="px-3 py-1.5 text-sm font-bold text-center" style={{ backgroundColor: courtColors[g % courtColors.length].bg }}>
                  Grupo {GROUP_LETTERS[g]}
                </div>
                <div className="p-2 space-y-1">
                  {Array.from({ length: 4 }, (_, pos) => {
                    const i = g * 4 + pos;
                    return (
                      <input key={i}
                        className="border border-gray-200 px-2 py-1 rounded w-full text-sm"
                        value={players[i]?.name ?? ""} placeholder={`Jogador ${i + 1}`}
                        onChange={e => { const c = [...players]; c[i] = { name: e.target.value }; setPlayers(c); }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Classificação da fase de grupos */}
        <div className="bg-white rounded-xl px-2 py-4 sm:p-4 shadow">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">📊 Classificação Geral</h2>
            <button className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: "#00F1FD" }} onClick={handleExportCSV}>CSV</button>
          </div>
          {numGroups === 1 && groupRounds.length > 0 && (
            <div className="mb-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800 font-semibold">
              ✨ Com 1 grupo, o campeão é quem liderar a classificação abaixo!
            </div>
          )}
          <p className="text-xs text-gray-400 mb-2">Fase de Grupos · Critérios: Pts → Saldo → Vitórias</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-1">Pos</th>
                <th className="pb-1">Gr</th>
                <th className="pb-1">Jogador</th>
                <th className="pb-1 text-center">Pts</th>
                <th className="pb-1 text-center">V</th>
                <th className="pb-1 text-center">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {getGlobalStandings().map((c, idx) => (
                <tr key={c.index} className={`border-t ${idx === 0 ? "bg-yellow-50 font-bold" : idx < 4 && numGroups > 1 ? "bg-blue-50" : ""}`}>
                  <td className="py-0.5">{idx + 1}</td>
                  <td>
                    <span className="px-1 rounded font-bold text-xs" style={{ backgroundColor: courtColors[Math.floor(c.index / 4) % courtColors.length].bg }}>
                      {GROUP_LETTERS[Math.floor(c.index / 4)]}
                    </span>
                  </td>
                  <td className="py-0.5 truncate max-w-[80px]" title={players[c.index]?.name}>{players[c.index]?.name}</td>
                  <td className="text-center font-bold">{c.pts}</td>
                  <td className="text-center text-green-600">{groupWins[c.index] || 0}</td>
                  <td className="text-center">{(c.diff > 0 ? "+" : "") + c.diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          {numGroups >= 2 && groupRounds.length > 0 && (
            <div className="mt-3">
              <button
                className="w-full px-3 py-2 rounded-lg text-sm font-bold text-white transition hover:scale-105"
                style={{ backgroundColor: "#FB0395" }}
                onClick={generateSeries}
              >
                🏆 Gerar Fase Final ({SERIES_NAMES.slice(0, numGroups).join(", ")})
              </button>
              <p className="text-xs text-gray-400 mt-1 text-center">
                Top 4 → Série Ouro · Próximos 4 → Prata{numGroups > 2 ? " · etc." : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* FASE DE GRUPOS — CONFRONTOS */}
      {groupRounds.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 px-2">Fase de Grupos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {groupRounds.map((rounds, g) => (
              <div key={g} className="bg-white rounded-xl px-2 py-4 sm:p-4 shadow">
                <div
                  className="text-base font-bold mb-3 text-center py-1.5 rounded-lg"
                  style={{ backgroundColor: courtColors[g % courtColors.length].bg, borderBottom: `2px solid ${courtColors[g % courtColors.length].border}` }}
                >
                  Grupo {GROUP_LETTERS[g]}
                </div>

                {/* Classificação interna */}
                <div className="mb-3 p-2 bg-gray-50 rounded-lg text-xs">
                  {getGroupStandings(g).map((s, rank) => (
                    <div key={s.index} className="flex justify-between py-0.5">
                      <span>{rank + 1}. {players[s.index]?.name}</span>
                      <span className="font-bold">{s.pts} pts · {s.diff > 0 ? "+" : ""}{s.diff}</span>
                    </div>
                  ))}
                </div>

                {rounds.map((rnd) => (
                  <div key={rnd.round} className="border rounded-lg p-2 mb-2">
                    <div className="text-xs font-semibold text-gray-500 mb-1">Rodada {rnd.round}</div>
                    {rnd.matches.map(m => {
                      const prefix = `G${g}_`;
                      const result = matchResults[`${prefix}${m.globalId}`];
                      return (
                        <div key={m.globalId}
                          className="flex items-center gap-2 p-2 rounded"
                          style={{ backgroundColor: courtColors[g % courtColors.length].bg, border: `2px solid ${courtColors[g % courtColors.length].border}` }}
                        >
                          <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full border text-xs font-bold bg-white"
                            style={{ borderColor: courtColors[g % courtColors.length].border }}>
                            {m.court}
                          </div>
                          <div className="flex-1 text-xs">{matchLabel(m)}</div>
                          <input type="number" min={0} max={20}
                            className="w-12 border px-1 py-1 rounded bg-white text-center text-sm"
                            placeholder="A"
                            key={`${prefix}${m.globalId}_A_${result?.scoreA}`}
                            defaultValue={result?.scoreA ?? ""}
                            onBlur={e => handleScoreChange(m, "scoreA", e.target.value, prefix)}
                          />
                          <span className="text-gray-400 text-xs">:</span>
                          <input type="number" min={0} max={20}
                            className="w-12 border px-1 py-1 rounded bg-white text-center text-sm"
                            placeholder="B"
                            key={`${prefix}${m.globalId}_B_${result?.scoreB}`}
                            defaultValue={result?.scoreB ?? ""}
                            onBlur={e => handleScoreChange(m, "scoreB", e.target.value, prefix)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FASE FINAL — SÉRIE OURO, PRATA, BRONZE... */}
      {seriesRounds.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4 px-2">🏆 Fase Final</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {seriesRounds.map((rounds, s) => {
              const seriesName = SERIES_NAMES[s] || `Série ${GROUP_LETTERS[s] || s + 1}`;
              const sc = SERIES_COLORS[s % SERIES_COLORS.length];
              const standings = getSeriesStandings(s);
              const champion = standings[0];
              const allDone = rounds.every(rnd =>
                rnd.matches.every(m => {
                  const res = matchResults[`S${s}_${m.globalId}`];
                  return res && res.scoreA !== "" && res.scoreB !== "";
                })
              );

              return (
                <div key={s} className="bg-white rounded-xl shadow overflow-hidden">
                  <div className="px-3 py-3 font-bold text-center text-sm sm:text-base" style={{ backgroundColor: sc.bg, color: sc.text, borderBottom: `3px solid ${sc.border}` }}>
                    {seriesName.startsWith("Série") ? seriesName : `Série ${seriesName}`}
                  </div>

                  <div className="p-2 sm:p-4">
                    {/* Classificação interna */}
                    <div className="mb-4 p-2 rounded-lg text-xs" style={{ backgroundColor: sc.bg + "88" }}>
                      <div className="font-semibold text-gray-600 mb-1">Classificação da série:</div>
                      {standings.map((s2, rank) => (
                        <div key={s2.index} className="flex justify-between py-0.5">
                          <span className={rank === 0 && allDone ? "font-bold text-yellow-700" : ""}>
                            {rank === 0 && allDone ? "🏅 " : ""}{rank + 1}. {players[s2.index]?.name}
                          </span>
                          <span className="font-bold">{s2.pts} pts · {s2.diff > 0 ? "+" : ""}{s2.diff}</span>
                        </div>
                      ))}
                      {allDone && champion && (
                        <div className="mt-2 text-center font-bold" style={{ color: sc.text }}>
                          🎉 Campeão da {seriesName}: {players[champion.index]?.name}
                        </div>
                      )}
                    </div>

                    {rounds.map((rnd) => (
                      <div key={rnd.round} className="border rounded-lg p-2 mb-2">
                        <div className="text-xs font-semibold text-gray-500 mb-1">Rodada {rnd.round}</div>
                        {rnd.matches.map(m => {
                          const prefix = `S${s}_`;
                          const result = matchResults[`${prefix}${m.globalId}`];
                          return (
                            <div key={m.globalId}
                              className="flex items-center gap-2 p-2 rounded"
                              style={{ backgroundColor: sc.bg, border: `2px solid ${sc.border}` }}
                            >
                              <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full border text-xs font-bold bg-white"
                                style={{ borderColor: sc.border, color: sc.text }}>
                                {m.court}
                              </div>
                              <div className="flex-1 text-xs">{matchLabel(m)}</div>
                              <input type="number" min={0} max={20}
                                className="w-12 border px-1 py-1 rounded bg-white text-center text-sm"
                                placeholder="A"
                                key={`${prefix}${m.globalId}_A_${result?.scoreA}`}
                                defaultValue={result?.scoreA ?? ""}
                                onBlur={e => handleScoreChange(m, "scoreA", e.target.value, prefix)}
                              />
                              <span className="text-gray-400 text-xs">:</span>
                              <input type="number" min={0} max={20}
                                className="w-12 border px-1 py-1 rounded bg-white text-center text-sm"
                                placeholder="B"
                                key={`${prefix}${m.globalId}_B_${result?.scoreB}`}
                                defaultValue={result?.scoreB ?? ""}
                                onBlur={e => handleScoreChange(m, "scoreB", e.target.value, prefix)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
