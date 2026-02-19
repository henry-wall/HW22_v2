import { useTournamentState } from "../../hooks/useTournamentState";
import { useStorage } from "../../services/storage/StorageContext";
import SyncStatusBadge from "../SyncStatusBadge";
import { useEffect, useState, useCallback } from "react";

interface Player {
  name: string;
}

// ATUALIZADO: Suporte a duplas (Rei da Quadra)
interface Match {
  id: string;
  globalId: string;
  round: number;
  teamA: { player1: number; player2: number };
  teamB: { player1: number; player2: number } | null;
  court?: number;
}

interface Round {
  round: number;
  matches: Match[];
}
interface MatchResult {
  scoreA: string | number;
  scoreB: string | number;
}
interface CourtColor {
  bg: string;
  border: string;
  text: string;
}
// Semifinais e finais não são comuns no Rei da Quadra tradicional, 
// mas se quiser manter, precisaria adaptar. 
// Vamos simplificar e focar na fase de grupos (todos vs todos do grupo).
interface SemifinalMatch {
  id: string;
  playerA: number;
  playerB: number;
  scoreA: string | number;
  scoreB: string | number;
}
interface FinalMatch {
  playerA: number;
  playerB: number;
  scoreA: string | number;
  scoreB: string | number;
}

// Tipo do estado unificado
interface KingQueenTournamentData {
  n: number;
  players: Player[];
  roundsGroupA: Round[];
  roundsGroupB: Round[];
  matchResults: Record<string, MatchResult>;
  finalMatch: FinalMatch | null;
  semifinalMatches: SemifinalMatch[];
  tournamentName: string;
  tournamentFormat: "single" | "groups";
  durationType: "set6" | "shortset" | "supertie";
  numCourts: number;
}

const DEFAULT_KQ_DATA: KingQueenTournamentData = {
  n: 8,
  players: Array.from({ length: 8 }, (_, i) => ({ name: `Jogador ${i + 1}` })),
  roundsGroupA: [],
  roundsGroupB: [],
  matchResults: {},
  finalMatch: null,
  semifinalMatches: [],
  tournamentName: "Rei da Quadra",
  tournamentFormat: "single",
  durationType: "set6",
  numCourts: 2,
};

export default function KingQueenScheduler({ storagePrefix = "wallbt_kq" }: { storagePrefix?: string }) {
  const { mode, setMode, isConnected } = useStorage();

  // ========== ESTADO UNIFICADO DO TORNEIO ==========
  const { data: tournamentData, updateField, syncStatus, lastSavedAt, isLoaded } = useTournamentState<KingQueenTournamentData>(
    `${storagePrefix}_data`,
    DEFAULT_KQ_DATA
  );

  // Aliases para compatibilidade
  const n = tournamentData.n;
  const setN = useCallback((v: number) => updateField("n", v), [updateField]);
  const players = tournamentData.players;
  const setPlayers = useCallback((v: Player[]) => updateField("players", v), [updateField]);
  const roundsGroupA = tournamentData.roundsGroupA;
  const setRoundsGroupA = useCallback((v: Round[]) => updateField("roundsGroupA", v), [updateField]);
  const roundsGroupB = tournamentData.roundsGroupB;
  const setRoundsGroupB = useCallback((v: Round[]) => updateField("roundsGroupB", v), [updateField]);
  const matchResults = tournamentData.matchResults;
  const setMatchResults = useCallback((v: Record<string, MatchResult>) => updateField("matchResults", v), [updateField]);
  const finalMatch = tournamentData.finalMatch;
  const setFinalMatch = useCallback((v: FinalMatch | null) => updateField("finalMatch", v), [updateField]);
  const semifinalMatches = tournamentData.semifinalMatches;
  const setSemifinalMatches = useCallback((v: SemifinalMatch[]) => updateField("semifinalMatches", v), [updateField]);
  const tournamentName = tournamentData.tournamentName;
  const setTournamentName = useCallback((v: string) => updateField("tournamentName", v), [updateField]);
  const tournamentFormat = tournamentData.tournamentFormat;
  const setTournamentFormat = useCallback((v: "single" | "groups") => updateField("tournamentFormat", v), [updateField]);
  const durationType = tournamentData.durationType;
  const setDurationType = useCallback((v: "set6" | "shortset" | "supertie") => updateField("durationType", v), [updateField]);
  const numCourts = tournamentData.numCourts;
  const setNumCourts = useCallback((v: number) => updateField("numCourts", v), [updateField]);

  // Estados derivados (NÃO PERSISTIDOS)
  const [points, setPoints] = useState<number[]>([]);
  const [wins, setWins] = useState<number[]>([]);
  const [losses, setLosses] = useState<number[]>([]);
  const [scoreDiff, setScoreDiff] = useState<number[]>([]);

  const courtColors: CourtColor[] = [
    { bg: "#A0F0FF", border: "#70D0E0", text: "#000" },
    { bg: "#F8A0D0", border: "#E070B0", text: "#000" },
    { bg: "#FFD9A0", border: "#E0B070", text: "#000" },
    { bg: "#D1C0FF", border: "#A080E0", text: "#000" },
    { bg: "#A0F0C0", border: "#70D0A0", text: "#000" },
    { bg: "#FFCBA0", border: "#E0A070", text: "#000" },
  ];



  // Garante array de jogadores correto
  useEffect(() => {
    if (players.length === n) return;
    const base = Array.from({ length: n }, (_, i) => ({
      name: `Jogador ${i + 1}`,
    }));
    for (let i = 0; i < Math.min(players.length, base.length); i++)
      base[i].name = players[i].name || base[i].name;
    setPlayers(base);
  }, [n]);

  useEffect(() => {
    // Wait for players to be initialized
    if (players.length !== n) return;

    // On config change, regenerate schedule similarly to the couples version
    if (tournamentFormat === "single") {
      const logicalA = generateKingSchedule(n, 0); // Gera para todos
      setRoundsGroupA(logicalA);
      setRoundsGroupB([]);
    } else {
      // Se for Groups, divide na metade?
      // O usuário disse: "formando grupos diferentes de 4 jogadores"
      // Se n=8, single gera 2 grupos de 4 (Q1 e Q2).
      // Talvez "groups" signifique outra coisa, mas vamos manter o padrão:
      // Single = todos num chaveamento único (mas divididos em quadras)
      // Groups = divisão explícita A e B?
      // Vamos assumir Single gera tudo por enquanto.
      const logicalA = generateKingSchedule(n, 0);
      setRoundsGroupA(logicalA);
      setRoundsGroupB([]);
    }
    setMatchResults({});
    setFinalMatch(null);
    setSemifinalMatches([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentFormat, numCourts, players.length]);

  useEffect(() => {
    recomputePoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchResults, finalMatch, semifinalMatches, roundsGroupA, roundsGroupB]);



  // ---------------- scheduling (Rei da Quadra) ----------------
  // Gera jogos para grupos de 4 jogadores
  function generateKingSchedule(totalPlayers: number, indexOffset: number) {
    // Apenas múltiplos de 4
    if (totalPlayers % 4 !== 0) return [] as Round[];

    const numGroups = totalPlayers / 4;
    const logicRounds: Round[] = [];

    // 3 Rodadas fixas para cada grupo de 4
    for (let r = 1; r <= 3; r++) {
      const matchesInRound: Match[] = [];

      for (let g = 0; g < numGroups; g++) {
        // Índices dos 4 jogadores deste grupo
        const p1 = indexOffset + g * 4 + 0;
        const p2 = indexOffset + g * 4 + 1;
        const p3 = indexOffset + g * 4 + 2;
        const p4 = indexOffset + g * 4 + 3;

        let m: Match | null = null;

        // Lógica de rodízio de duplas (Rei da Quadra)
        if (r === 1) {
          // Rodada 1: 1+2 vs 3+4
          m = {
            id: `R${r}M${matchesInRound.length + 1}`,
            globalId: `r${r}_m${matchesInRound.length + 1}`,
            round: r,
            teamA: { player1: p1, player2: p2 },
            teamB: { player1: p3, player2: p4 },
            court: undefined
          };
        } else if (r === 2) {
          // Rodada 2: 1+3 vs 2+4
          m = {
            id: `R${r}M${matchesInRound.length + 1}`,
            globalId: `r${r}_m${matchesInRound.length + 1}`,
            round: r,
            teamA: { player1: p1, player2: p3 },
            teamB: { player1: p2, player2: p4 },
            court: undefined
          };
        } else if (r === 3) {
          // Rodada 3: 1+4 vs 2+3
          m = {
            id: `R${r}M${matchesInRound.length + 1}`,
            globalId: `r${r}_m${matchesInRound.length + 1}`,
            round: r,
            teamA: { player1: p1, player2: p4 },
            teamB: { player1: p2, player2: p3 },
            court: undefined
          };
        }

        if (m) matchesInRound.push(m);
      }

      // Distribuir quadras
      const matchesWithCourts = matchesInRound.map((m, i) => ({
        ...m,
        court: (i % Math.max(1, numCourts)) + 1,
      }));

      logicRounds.push({ round: r, matches: matchesWithCourts });
    }

    return logicRounds;
  }

  // ---------------- finals & semifinals ----------------
  // (Mantido simples ou desativado se não fizer sentido, 
  // mas vamos deixar funcional caso queiram definir finalistas manualmente)
  function createFinalOrSemifinal() {
    if (tournamentFormat === "single") {
      // champion by classification, final optional — keep same behavior: create a final between top 2
      const top = getPlayerTotals()
        .sort(
          (a, b) => b.total - a.total || b.saldo - a.saldo || b.index - a.index
        )
        .slice(0, 2);
      if (top.length < 2) return;
      setFinalMatch({
        playerA: top[0].index,
        playerB: top[1].index,
        scoreA: "",
        scoreB: "",
      });
    } else {
      const groupASize = Math.ceil(n / 2);
      const totals = getPlayerTotals();
      const totalsA = totals
        .slice(0, groupASize)
        .sort(
          (a, b) => b.total - a.total || b.saldo - a.saldo || b.index - a.index
        );
      const totalsB = totals
        .slice(groupASize)
        .sort(
          (a, b) => b.total - a.total || b.saldo - a.saldo || b.index - a.index
        );
      if (totalsA.length < 2 || totalsB.length < 2) return;
      setSemifinalMatches([
        {
          id: "semi1",
          playerA: totalsA[0].index,
          playerB: totalsB[1].index,
          scoreA: "",
          scoreB: "",
        },
        {
          id: "semi2",
          playerA: totalsA[1].index,
          playerB: totalsB[0].index,
          scoreA: "",
          scoreB: "",
        },
      ]);
    }
  }

  function generateFinalFromSemifinals() {
    const semi1 = semifinalMatches.find((s) => s.id === "semi1");
    const semi2 = semifinalMatches.find((s) => s.id === "semi2");
    if (!semi1 || !semi2) return;
    if (
      semi1.scoreA === "" ||
      semi1.scoreB === "" ||
      semi2.scoreA === "" ||
      semi2.scoreB === ""
    )
      return;
    const winner1 =
      Number(semi1.scoreA) > Number(semi1.scoreB)
        ? semi1.playerA
        : semi1.playerB;
    const winner2 =
      Number(semi2.scoreA) > Number(semi2.scoreB)
        ? semi2.playerA
        : semi2.playerB;
    setFinalMatch({
      playerA: winner1,
      playerB: winner2,
      scoreA: "",
      scoreB: "",
    });
  }

  // ---------------- scoring ----------------
  function recomputePoints() {
    const totalPlayers = n;
    const pts = Array(totalPlayers).fill(0);
    const w = Array(totalPlayers).fill(0);
    const l = Array(totalPlayers).fill(0);
    const diff = Array(totalPlayers).fill(0);

    // Group A
    for (const rnd of roundsGroupA) {
      for (const m of rnd.matches) {
        const res = matchResults[`A_${m.globalId}`];
        if (!res || !m.teamB) continue;
        const sA = Number(res.scoreA);
        const sB = Number(res.scoreB);
        if (Number.isNaN(sA) || Number.isNaN(sB)) continue;

        const playersA = [m.teamA.player1, m.teamA.player2];
        const playersB = [m.teamB.player1, m.teamB.player2];

        // Atualiza stats para os 4 jogadores
        playersA.forEach(p => diff[p] += (sA - sB));
        playersB.forEach(p => diff[p] += (sB - sA));

        if (sA > sB) {
          playersA.forEach(p => { pts[p] += 3; w[p]++; }); // Vitória
          playersB.forEach(p => { l[p]++; });
        } else if (sB > sA) {
          playersB.forEach(p => { pts[p] += 3; w[p]++; });
          playersA.forEach(p => { l[p]++; });
        }
      }
    }

    // Group B
    if (tournamentFormat === "groups") {
      const groupASize = Math.ceil(n / 2);
      for (const rnd of roundsGroupB) {
        for (const m of rnd.matches) {
          const res = matchResults[`B_${m.globalId}`];
          if (!res || !m.teamB) continue;
          const sA = Number(res.scoreA);
          const sB = Number(res.scoreB);
          if (Number.isNaN(sA) || Number.isNaN(sB)) continue;

          // Adjust player indices for Group B
          const playersA = [groupASize + m.teamA.player1, groupASize + m.teamA.player2];
          const playersB = [groupASize + m.teamB.player1, groupASize + m.teamB.player2];

          playersA.forEach(p => diff[p] += (sA - sB));
          playersB.forEach(p => diff[p] += (sB - sA));

          if (sA > sB) {
            playersA.forEach(p => { pts[p] += 3; w[p]++; });
            playersB.forEach(p => { l[p]++; });
          } else if (sB > sA) {
            playersB.forEach(p => { pts[p] += 3; w[p]++; });
            playersA.forEach(p => { l[p]++; });
          }
        }
      }
    }

    // Finals
    if (finalMatch) {
      const res = matchResults[`F_final`];
      if (res && finalMatch.playerA != null && finalMatch.playerB != null) {
        const sA = Number(res.scoreA),
          sB = Number(res.scoreB);
        if (!Number.isNaN(sA) && !Number.isNaN(sB)) {
          const a = finalMatch.playerA,
            b = finalMatch.playerB;
          diff[a] += sA - sB;
          diff[b] += sB - sA;
          if (sA > sB) {
            pts[a] += 2;
            w[a]++;
            l[b]++;
          } else if (sB > sA) {
            pts[b] += 2;
            w[b]++;
            l[a]++;
          }
        }
      }
    }

    setPoints(pts);
    setWins(w);
    setLosses(l);
    setScoreDiff(diff);
  }

  useEffect(() => {
    recomputePoints(); /* eslint-disable-line */
  }, [matchResults, roundsGroupA, roundsGroupB, finalMatch]);

  // ---------------- helpers ----------------
  function handleScoreChange(
    match: Match,
    key: "scoreA" | "scoreB",
    value: string,
    prefix = ""
  ) {
    const gid = `${prefix}${match.globalId}`;
    const copy = { ...matchResults };
    if (!copy[gid]) copy[gid] = { scoreA: "", scoreB: "" };
    copy[gid] = { ...copy[gid], [key]: value === "" ? "" : Number(value) };
    setMatchResults(copy);
  }

  function handleSemifinalScoreChange(
    semiId: string,
    key: "scoreA" | "scoreB",
    value: string
  ) {
    setSemifinalMatches(
      semifinalMatches.map((s) =>
        s.id === semiId ? { ...s, [key]: value === "" ? "" : Number(value) } : s
      )
    );
  }

  function handleFinalScoreChange(key: "scoreA" | "scoreB", value: string) {
    if (!finalMatch) return;
    setFinalMatch({ ...finalMatch, [key]: value === "" ? "" : Number(value) });
  }

  function matchLabelSingle(m: Match, offset = 0) {
    const getName = (idx: number) => players[idx]?.name ?? `P${idx + 1}`;

    const tA = `${getName(m.teamA.player1)} / ${getName(m.teamA.player2)}`;
    const tB = m.teamB
      ? `${getName(m.teamB.player1)} / ${getName(m.teamB.player2)}`
      : "Bye";

    return `${tA} vs ${tB}`;
  }

  function getPlayerTotals() {
    return players.map((p, i) => {
      const tot = points[i] || 0;
      const saldo = scoreDiff[i] || 0;
      const v = wins[i] || 0;
      const d = losses[i] || 0;
      const totalGames = v + d;
      const aproveitamento =
        totalGames > 0 ? ((v / totalGames) * 100).toFixed(1) : "0.0";
      return {
        index: i,
        playerName: p.name,
        total: tot,
        saldo,
        wins: v,
        losses: d,
        aproveitamento,
      };
    });
  }

  function handleGenerate() {
    if (tournamentFormat === "single") {
      const logicalA = generateKingSchedule(n, 0);
      setRoundsGroupA(logicalA);
      setRoundsGroupB([]);
    } else {
      const logicalA = generateKingSchedule(n, 0);
      setRoundsGroupA(logicalA);
      setRoundsGroupB([]);
    }
    setMatchResults({});
    setFinalMatch(null);
    setSemifinalMatches([]);
  }

  function handlePrint() {
    const htmlRows = [];
    const rowsA: string[] = [];

    // Simplificando impressão pois removemos groups B logic complexa para focar no King
    for (const rnd of roundsGroupA)
      rowsA.push(
        rnd.matches
          .map((m) => `${matchLabelSingle(m)} (Q${m.court})`)
          .join(" | ")
      );

    const maxRows = rowsA.length;
    for (let i = 0; i < maxRows; i++)
      htmlRows.push(
        `<tr><td>${rowsA[i] || ""}</td></tr>`
      );

    const html = `<html><head><title>${tournamentName}</title><style>body{font-family:Century Gothic, Arial, sans-serif;}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px}</style></head><body><h2 style="text-align:center">${tournamentName}</h2><table><thead><tr><th>Rodadas</th></tr></thead><tbody>${htmlRows.join(
      ""
    )}</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  }

  function handleExportCSV() {
    const header = [
      "Posição",
      "Jogador",
      "Pontos Totais",
      "Saldo",
      "Vitórias",
      "Derrotas",
      "Aproveitamento (%)",
    ];
    const rows = getPlayerTotals()
      .sort((a, b) => b.total - a.total || b.saldo - a.saldo)
      .map((c, idx) => [
        idx + 1,
        c.playerName,
        c.total,
        c.saldo,
        c.wins,
        c.losses,
        c.aproveitamento,
      ]);
    const csv = [
      header.join(";"),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(";")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tournamentName.replace(/\s+/g, "_")}_Classificacao.csv`;
    link.click();
  }

  function getTotalMatchCount() {
    let total = 0;
    for (const rnd of roundsGroupA) total += rnd.matches.length;
    for (const rnd of roundsGroupB) total += rnd.matches.length;
    if (semifinalMatches.length) total += semifinalMatches.length;
    if (finalMatch) total += 1;
    return total;
  }

  function getDurationEstimate() {
    const totalMatches = getTotalMatchCount();
    let minutesPerMatch =
      durationType === "shortset" ? 25 : durationType === "supertie" ? 10 : 40;
    const courts = Math.max(1, numCourts);
    const estimatedMinutes = Math.ceil(totalMatches / courts) * minutesPerMatch;
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;
    return {
      totalMatches,
      estimatedMinutes,
      hours,
      minutes,
      label:
        durationType === "set6"
          ? "Set 6 games (40 min/partida)"
          : durationType === "shortset"
            ? "Short Set (25 min/partida)"
            : "Super Tie (10 min/partida)",
      courts,
    };
  }

  // Matches per player
  // Updates for Doubles logic
  function getMatchesPerPlayer() {
    const counts = Array(n).fill(0);
    for (const rnd of roundsGroupA)
      for (const m of rnd.matches) {
        counts[m.teamA.player1]++;
        counts[m.teamA.player2]++;
        if (m.teamB) {
          counts[m.teamB.player1]++;
          counts[m.teamB.player2]++;
        }
      }

    // Se tiver semi/final (opcional)
    for (const semi of semifinalMatches) {
      counts[semi.playerA]++;
      counts[semi.playerB]++;
    }
    if (finalMatch) {
      counts[finalMatch.playerA]++;
      counts[finalMatch.playerB]++;
    }
    return counts;
  }

  // Duration estimate for UI
  const durationEstimate = getDurationEstimate();
  const sortedPlayers = getPlayerTotals().sort(
    (a, b) => b.total - a.total || b.saldo - a.saldo || a.index - b.index
  );

  // ========== LOADING GATE ==========
  if (!isLoaded) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: "16px" }}>
        <div style={{ fontSize: "2rem" }}>⏳</div>
        <p style={{ fontSize: "1.1rem", color: "#6B7280", fontWeight: 500 }}>Carregando dados do torneio...</p>
        <SyncStatusBadge status={syncStatus} lastSavedAt={lastSavedAt} />
      </div>
    );
  }

  // UI render (keeps the same layout)
  return (
    <div
      className="p-6 max-w-7xl mx-auto"
      style={{ fontFamily: "'Century Gothic','Arial Narrow',Arial,sans-serif" }}
    >
      <div className="mb-4 flex flex-col items-center justify-center">
        <img
          src="https://i.imgur.com/sQWqNap.png"
          alt="Logomarca Wall BT"
          className="h-24 object-contain mb-2"
        />
        <div className="flex gap-2 items-center text-sm">
          <button
            onClick={() => setMode(mode === "local" ? "cloud" : "local")}
            className={`px-3 py-1 rounded border ${mode === "cloud"
              ? "bg-blue-600 text-white border-blue-700"
              : "bg-gray-200 text-gray-700 border-gray-300"
              }`}
          >
            {mode === "cloud" ? "☁️ Nuvem Ativa" : "💻 Modo Local"}
          </button>
          {mode === "cloud" && (
            <span className="text-xs text-gray-500">
              {isConnected ? "🟢 Conectado" : "⚪ Aguardando id..."}
            </span>
          )}
        </div>
      </div>
      <h1
        className="text-2xl font-bold mb-4 text-center"
        style={{ color: "#FB0395" }}
      >
        {tournamentName}
      </h1>

      <div className="bg-slate-50 p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block mb-2">Nome do Torneio:</label>
            <input
              className="border px-2 py-1 rounded w-full"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-2">Formato do Torneio:</label>
            <div className="flex gap-2">
              <label>
                <input
                  type="radio"
                  name="format"
                  value="single"
                  checked={tournamentFormat === "single"}
                  onChange={() => setTournamentFormat("single")}
                  className="mr-1"
                />{" "}
                Único (4–16)
              </label>
              <label>
                <input
                  type="radio"
                  name="format"
                  value="groups"
                  checked={tournamentFormat === "groups"}
                  onChange={() => setTournamentFormat("groups")}
                  className="mr-1"
                />{" "}
                Grupos (4–16)
              </label>
            </div>
          </div>

          <div>
            <label className="block mb-2">Número de Jogadores:</label>
            <select
              className="border px-2 py-1 rounded w-full"
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
            >
              {[4, 8, 12, 16, 20, 24].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block mb-2">Formato das Partidas:</label>
            <select
              className="border px-2 py-1 rounded w-full"
              value={durationType}
              onChange={(e) => setDurationType(e.target.value as any)}
            >
              <option value="set6">Set 6 games (40 min)</option>
              <option value="shortset">Short Set (25 min)</option>
              <option value="supertie">Super Tie (10 min)</option>
            </select>
          </div>

          <div>
            <label className="block mb-2">Número de Quadras:</label>
            <input
              type="number"
              min={1}
              max={6}
              className="border px-2 py-1 rounded w-full"
              value={numCourts}
              onChange={(e) => setNumCourts(Number(e.target.value) || 1)}
            />
          </div>

          <div>
            <button
              className="mt-6 px-3 py-1 rounded transition"
              style={{
                backgroundColor: "#00F1FD",
                color: "black",
                fontWeight: "bold",
              }}
              onClick={handleGenerate}
            >
              Gerar Cronograma
            </button>
          </div>
        </div>

        <div
          className="mt-4 p-3 rounded"
          style={{ backgroundColor: "#00F1FD20" }}
        >
          <strong>
            ⏱️ Estimativa de Duração ({durationEstimate.courts} quadra(s)):
          </strong>
          <br />
          {durationEstimate.totalMatches} partidas × {durationEstimate.label}
          <br />
          <strong>Tempo total estimado:</strong> {durationEstimate.hours}h
          {durationEstimate.minutes}min
          <br />
          <small>
            <strong>Partidas por jogador:</strong>{" "}
            {(() => {
              const counts = getMatchesPerPlayer();
              const max = Math.max(...counts);
              const min = Math.min(...counts);
              return min === max ? `${max} (todos)` : `${min}–${max}`;
            })()}
          </small>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded p-4 shadow col-span-2">
          <h2 className="text-lg font-semibold mb-2">Jogadores</h2>
          <div className="grid grid-cols-2 gap-2">
            {players.map((p, i) => (
              <div key={i} className="flex gap-2 items-center mb-1">
                <input
                  className="border px-2 py-1 rounded w-full"
                  value={p.name}
                  onChange={(e) => {
                    const c = [...players];
                    c[i] = { name: e.target.value };
                    setPlayers(c);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded p-4 shadow">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Classificação</h2>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded text-sm"
                style={{
                  backgroundColor: "#00F1FD",
                  color: "black",
                  fontWeight: "bold",
                }}
                onClick={handlePrint}
              >
                🖨️ Imprimir
              </button>
              <button
                className="px-3 py-1 rounded text-sm"
                style={{
                  backgroundColor: "#FB0395",
                  color: "white",
                  fontWeight: "bold",
                }}
                onClick={handleExportCSV}
              >
                📊 Exportar CSV
              </button>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Pos</th>
                <th>Jogador</th>
                <th>Pts</th>
                <th>Saldo</th>
                <th>V</th>
                <th>D</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((c, idx) => (
                <tr key={c.index} className="border-t">
                  <td>{idx + 1}</td>
                  <td>{c.playerName}</td>
                  <td>{c.total}</td>
                  <td>{c.saldo}</td>
                  <td>{c.wins}</td>
                  <td>{c.losses}</td>
                  <td>{c.aproveitamento}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2">
            <button
              className="px-3 py-1 rounded"
              style={{
                backgroundColor: "#00F1FD",
                color: "black",
                fontWeight: "bold",
              }}
              onClick={createFinalOrSemifinal}
            >
              Criar Final/Semifinais
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grupo A */}
        <div className="bg-white rounded p-4 shadow">
          <h2 className="text-lg font-semibold mb-3">Grupo A</h2>

          {tournamentFormat === "groups" && roundsGroupA.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <h3 className="font-semibold mb-2">Legenda de Quadras:</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Math.min(numCourts, 6) }).map((_, i) => (
                  <div
                    key={i}
                    className="px-3 py-1 rounded text-sm font-medium"
                    style={{
                      backgroundColor: courtColors[i].bg,
                      borderColor: courtColors[i].border,
                      color: courtColors[i].text,
                      borderWidth: "2px",
                      borderStyle: "solid",
                    }}
                  >
                    Quadra {i + 1}
                  </div>
                ))}
              </div>
            </div>
          )}

          {roundsGroupA.map((rnd) => (
            <div key={rnd.round} className="border rounded p-3 mb-3">
              <div className="font-semibold mb-2">Rodada {rnd.round}</div>
              {rnd.matches.map((m) => (
                <div
                  key={m.globalId}
                  className="flex items-center gap-2 mb-1 p-2 rounded"
                  style={{
                    backgroundColor:
                      courtColors[((m.court || 1) - 1) % courtColors.length].bg,
                    borderColor:
                      courtColors[((m.court || 1) - 1) % courtColors.length]
                        .border,
                    borderWidth: "2px",
                    borderStyle: "solid",
                  }}
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border text-sm font-bold bg-white"
                    style={{
                      borderColor:
                        courtColors[((m.court || 1) - 1) % courtColors.length]
                          .border,
                    }}
                  >
                    {m.court}
                  </div>
                  <div className="flex-1 text-sm">{matchLabelSingle(m)}</div>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    className="w-16 border px-2 py-1 rounded bg-white"
                    placeholder="A"
                    value={matchResults[`A_${m.globalId}`]?.scoreA ?? ""}
                    onChange={(e) =>
                      handleScoreChange(m, "scoreA", e.target.value, "A_")
                    }
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    className="w-16 border px-2 py-1 rounded bg-white"
                    placeholder="B"
                    value={matchResults[`A_${m.globalId}`]?.scoreB ?? ""}
                    onChange={(e) =>
                      handleScoreChange(m, "scoreB", e.target.value, "A_")
                    }
                    disabled={!m.teamB}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* SEMIFINAIS */}
      {semifinalMatches.length > 0 && (
        <div className="mt-6 bg-white rounded p-4 shadow">
          <h2 className="text-lg font-semibold mb-3">Semifinais</h2>
          {semifinalMatches.map((semi, idx) => (
            <div
              key={semi.id}
              className="mb-3 p-3 rounded"
              style={{
                backgroundColor: courtColors[idx % courtColors.length].bg,
                borderColor: courtColors[idx % courtColors.length].border,
                borderWidth: "2px",
                borderStyle: "solid",
              }}
            >
              <div className="flex items-center mb-2">
                <div
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border text-sm font-bold"
                  style={{
                    backgroundColor: "white",
                    borderColor: courtColors[idx % courtColors.length].border,
                    color: courtColors[idx % courtColors.length].text,
                  }}
                >
                  {idx + 1}
                </div>
                <div className="ml-2">{`Semifinal: ${players[semi.playerA].name
                  } vs ${players[semi.playerB].name}`}</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="20"
                  className="w-20 border px-2 py-1 rounded bg-white"
                  placeholder="Pts A"
                  value={semi.scoreA ?? ""}
                  onChange={(e) =>
                    handleSemifinalScoreChange(
                      semi.id,
                      "scoreA",
                      e.target.value
                    )
                  }
                />
                <span>:</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  className="w-20 border px-2 py-1 rounded bg-white"
                  placeholder="Pts B"
                  value={semi.scoreB ?? ""}
                  onChange={(e) =>
                    handleSemifinalScoreChange(
                      semi.id,
                      "scoreB",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FINAL */}
      <div className="mt-6 bg-white rounded p-4 shadow">
        <h2 className="text-lg font-semibold mb-3">Final</h2>
        {finalMatch ? (
          <div
            className="p-3 rounded"
            style={{
              background: "linear-gradient(90deg, #A0F0FF30, #F8A0D030)",
              border: "2px solid #A0F0FF",
            }}
          >
            <div className="flex items-center mb-2">
              <div
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border text-sm font-bold"
                style={{
                  backgroundColor: "white",
                  borderColor: "#FB0395",
                  color: "#FB0395",
                }}
              >
                🏆
              </div>
              <div className="ml-2">{`Final: ${players[finalMatch.playerA].name
                } vs ${players[finalMatch.playerB].name}`}</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="20"
                className="w-20 border px-2 py-1 rounded bg-white"
                placeholder="Pts A"
                value={finalMatch.scoreA ?? ""}
                onChange={(e) =>
                  handleFinalScoreChange("scoreA", e.target.value)
                }
              />
              <span>:</span>
              <input
                type="number"
                min="0"
                max="20"
                className="w-20 border px-2 py-1 rounded bg-white"
                placeholder="Pts B"
                value={finalMatch.scoreB ?? ""}
                onChange={(e) =>
                  handleFinalScoreChange("scoreB", e.target.value)
                }
              />
            </div>
            <div className="mt-2">
              <strong>Campeão:</strong>{" "}
              {finalMatch.scoreA !== "" && finalMatch.scoreB !== ""
                ? finalMatch.scoreA > finalMatch.scoreB
                  ? players[finalMatch.playerA].name
                  : players[finalMatch.playerB].name
                : "(informe o placar)"}
            </div>
          </div>
        ) : (
          <p>Nenhuma final criada.</p>
        )}
      </div>
    </div>
  );
}
