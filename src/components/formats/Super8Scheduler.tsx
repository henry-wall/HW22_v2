// Super8Individual.tsx - VERSÃO ATUALIZADA COM NOVO SISTEMA DE PONTUAÇÃO
import { useTournamentState } from "../../hooks/useTournamentState";
import { useStorage } from "../../services/storage/StorageContext";
import SyncStatusBadge from "../SyncStatusBadge";
import { useState, useEffect, useCallback } from "react";

interface Player {
  name: string;
}
interface Match {
  id: string;
  globalId: string;
  teamA: [number, number];
  teamB: [number, number];
  court?: number;
  round?: number;
  scheduledTime?: string;
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

// Tipo do estado unificado
interface Super8TournamentData {
  n: number;
  players: Player[];
  matches: Match[];
  matchResults: Record<string, MatchResult>;
  wins: number[];
  losses: number[];
  scoreDiff: number[];
  gamesWon: number[];
  gamesLost: number[];
  tournamentName: string;
  durationType: "set6" | "shortset" | "supertie";
  numCourts: number;
  viewMode: "planning" | "operation" | "presentation";
  matchQueue: Match[];
  inProgressMatches: Record<number, Match>;
  completedMatches: Match[];
}

const DEFAULT_S8_DATA: Super8TournamentData = {
  n: 8,
  players: Array.from({ length: 8 }, (_, i) => ({ name: String(i + 1) })),
  matches: [],
  matchResults: {},
  wins: [],
  losses: [],
  scoreDiff: [],
  gamesWon: [],
  gamesLost: [],
  tournamentName: "Wall BT - Super 8 Individual",
  durationType: "set6",
  numCourts: 2,
  viewMode: "planning",
  matchQueue: [],
  inProgressMatches: {},
  completedMatches: [],
};

export default function Super8Individual({ storagePrefix = "wallbt_s8" }: { storagePrefix?: string }) {
  const { mode, setMode, isConnected } = useStorage();

  const VALID_N = [4, 5, 8, 9, 12, 13, 16];

  // ========== ESTADO UNIFICADO DO TORNEIO ==========
  const { data: tournamentData, updateField, syncStatus, lastSavedAt, isLoaded } = useTournamentState<Super8TournamentData>(
    `${storagePrefix}_data`,
    DEFAULT_S8_DATA
  );

  // Aliases para compatibilidade
  const n = tournamentData.n;
  const setN = useCallback((v: number) => updateField("n", v), [updateField]);
  const players = tournamentData.players;
  const setPlayers = useCallback((v: Player[]) => updateField("players", v), [updateField]);
  const matches = tournamentData.matches;
  const setMatches = useCallback((v: Match[]) => updateField("matches", v), [updateField]);
  const matchResults = tournamentData.matchResults;
  const setMatchResults = useCallback((v: Record<string, MatchResult>) => updateField("matchResults", v), [updateField]);
  const wins = tournamentData.wins;
  const setWins = useCallback((v: number[]) => updateField("wins", v), [updateField]);
  const losses = tournamentData.losses;
  const setLosses = useCallback((v: number[]) => updateField("losses", v), [updateField]);
  const scoreDiff = tournamentData.scoreDiff;
  const setScoreDiff = useCallback((v: number[]) => updateField("scoreDiff", v), [updateField]);
  const gamesWon = tournamentData.gamesWon;
  const setGamesWon = useCallback((v: number[]) => updateField("gamesWon", v), [updateField]);
  const gamesLost = tournamentData.gamesLost;
  const setGamesLost = useCallback((v: number[]) => updateField("gamesLost", v), [updateField]);
  const tournamentName = tournamentData.tournamentName;
  const setTournamentName = useCallback((v: string) => updateField("tournamentName", v), [updateField]);
  const durationType = tournamentData.durationType;
  const setDurationType = useCallback((v: "set6" | "shortset" | "supertie") => updateField("durationType", v), [updateField]);
  const numCourts = tournamentData.numCourts;
  const setNumCourts = useCallback((v: number) => updateField("numCourts", v), [updateField]);
  const viewMode = tournamentData.viewMode;
  const setViewMode = useCallback((v: "planning" | "operation" | "presentation") => updateField("viewMode", v), [updateField]);
  const matchQueue = tournamentData.matchQueue;
  const setMatchQueue = useCallback((v: Match[]) => updateField("matchQueue", v), [updateField]);
  const inProgressMatches = tournamentData.inProgressMatches;
  const setInProgressMatches = useCallback((v: Record<number, Match>) => updateField("inProgressMatches", v), [updateField]);
  const completedMatches = tournamentData.completedMatches;
  const setCompletedMatches = useCallback((v: Match[]) => updateField("completedMatches", v), [updateField]);

  const [editingCompletedMatch, setEditingCompletedMatch] = useState<string | null>(null);

  // ========== ESTADOS PARA REAGENDAMENTO (LOCAIS) ==========
  const [reschedulingMatch, setReschedulingMatch] = useState<Match | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    round: number;
    court: number;
  } | null>(null);

  // ========== ESTADO PARA MODO APRESENTAÇÃO (LOCAL) ==========
  const [presentationView, setPresentationView] = useState<"classification" | "matches">("classification");



  // Init default matches if empty and format is valid (similar to MixedDoubles logic)
  useEffect(() => {
    if (matches.length === 0 && VALID_N.includes(n)) {
      // Only auto-generate if we really have no matches and players seem ready
      // But wait, n might be LOADING default 8. 
      // Better to rely on manual generation or generate only if explicit action?
      // The original code generated on mount if default.
      // Let's keep it simple: manual generation or existing state.
      // If empty, user can click "Generate".
    }
  }, []);

  useEffect(() => {
    // Regenerate players if N changes (and matches cleared? Original code did this)
    // Original: 
    // useEffect(() => { ... setPlayers(base); setMatches(generateSchedule(n)); ... }, [n, numCourts]);
    // This is dangerous with synced state because it might overwrite cloud data just by local N changing?
    // Actually, in the original code, setN triggers the effect.
    // Here, if valid cloud data comes in, setN comes from cloud.
    // If I change N locally, I want to regen.
    // But I should separate "initial load" from "user change".
    // useSyncedState handles the load.
    // So we don't need an effect to regen matches on load.
    // We only need a handler for when the user changes configuration.
  }, []);

  // ========== HANDLERS DE CONFIGURAÇÃO (MANUAIS) ==========
  const handleNChange = (newN: number) => {
    setN(newN);
    const base = Array.from({ length: newN }, (_, i) => ({
      name: players[i]?.name || String(i + 1),
    }));
    setPlayers(base);
    setMatches(generateSchedule(newN, numCourts));
    setMatchResults({});
    setMatchQueue([]);
    setInProgressMatches({});
    setCompletedMatches([]);
    setViewMode("planning");
  };

  const handleCourtsChange = (newCourts: number) => {
    setNumCourts(newCourts);
    if (viewMode === "planning") {
      setMatches(generateSchedule(n, newCourts));
    }
  };

  // Recalculate stats when data changes
  useEffect(() => {
    recomputeStats();
  }, [matchResults, matches, completedMatches]);


  function handleGenerateSchedule() {
    if (matches.length > 0) {
      if (
        !window.confirm(
          "Já existem partidas geradas. Gerar novamente apagará todos os resultados atuais. Deseja continuar?"
        )
      ) {
        return;
      }
    }

    const newMatches = generateSchedule(n);
    if (!newMatches || newMatches.length === 0) {
      alert("Não foi possível gerar cronograma para este número de jogadores.");
      return;
    }

    setMatches(newMatches);
    setMatchQueue(newMatches);
    setInProgressMatches({});
    setCompletedMatches([]);
    setMatchResults({});
    setReschedulingMatch(null);
    setRescheduleTarget(null);
  }

  // ========== GERAÇÃO DE CRONOGRAMA ==========
  function generateSchedule(N: number, courtsOverride?: number): Match[] {
    const activeCourts = courtsOverride || numCourts;
    if (!VALID_N.includes(N)) return [];
    const total = N % 2 === 0 ? N : N + 1;
    const rounds = total - 1;
    const matches: Match[] = [];
    for (let r = 0; r < rounds; r++) {
      const fixed = 0;
      const rotating = Array.from({ length: total - 1 }, (_, i) => i + 1);
      const rotated = [...rotating.slice(r), ...rotating.slice(0, r)];

      if (rotated.length > 0 && fixed < N && rotated[rotated.length - 1] < N) {
        matches.push({
          id: `m${matches.length}`,
          globalId: `m${matches.length}`,
          teamA: [fixed, rotated[rotated.length - 1]],
          teamB: [-1, -1],
        });
      }

      for (let i = 0; i < Math.floor(rotated.length / 2); i++) {
        const a = rotated[i];
        const b = rotated[rotated.length - 2 - i];
        if (a < N && b < N && a !== b) {
          matches.push({
            id: `m${matches.length}`,
            globalId: `m${matches.length}`,
            teamA: [a, b],
            teamB: [-1, -1],
          });
        }
      }
    }
    const realMatches: Match[] = [];
    const used = new Set<string>();

    for (let i = 0; i < matches.length; i++) {
      if (matches[i].teamB[0] !== -1) continue;

      const pair1 = matches[i].teamA;
      const key1 = `${Math.min(pair1[0], pair1[1])}-${Math.max(
        pair1[0],
        pair1[1]
      )}`;
      if (used.has(key1)) continue;

      for (let j = i + 1; j < matches.length; j++) {
        if (matches[j].teamB[0] !== -1) continue;

        const pair2 = matches[j].teamA;
        const key2 = `${Math.min(pair2[0], pair2[1])}-${Math.max(
          pair2[0],
          pair2[1]
        )}`;
        if (used.has(key2)) continue;

        const hasCommon = pair1.some((p) => pair2.includes(p));
        if (!hasCommon) {
          realMatches.push({
            id: `m${realMatches.length}`,
            globalId: `m${realMatches.length}`,
            teamA: pair1,
            teamB: pair2,
            court: (realMatches.length % activeCourts) + 1,
            round: Math.floor(realMatches.length / activeCourts) + 1,
          });
          used.add(key1);
          used.add(key2);
          matches[j] = { ...matches[j], teamB: [0, 0] };
          break;
        }
      }
    }

    return realMatches;
  }
  function recomputeStats() {
    const winsArr = Array(n).fill(0);
    const lossesArr = Array(n).fill(0);
    const diffArr = Array(n).fill(0);
    const gamesWonArr = Array(n).fill(0);
    const gamesLostArr = Array(n).fill(0);
    const matchesToProcess =
      viewMode === "planning" ? matches : completedMatches;
    for (const m of matchesToProcess) {
      const res = matchResults[m.globalId];
      if (!res || res.scoreA === "" || res.scoreB === "") continue;
      const sA = Number(res.scoreA);
      const sB = Number(res.scoreB);
      if (Number.isNaN(sA) || Number.isNaN(sB)) continue;
      const [p1, p2] = m.teamA;
      const [p3, p4] = m.teamB;

      // Atualizar games ganhos e perdidos
      gamesWonArr[p1] += sA;
      gamesWonArr[p2] += sA;
      gamesWonArr[p3] += sB;
      gamesWonArr[p4] += sB;

      gamesLostArr[p1] += sB;
      gamesLostArr[p2] += sB;
      gamesLostArr[p3] += sA;
      gamesLostArr[p4] += sA;

      // Atualizar saldo de games
      diffArr[p1] += sA - sB;
      diffArr[p2] += sA - sB;
      diffArr[p3] += sB - sA;
      diffArr[p4] += sB - sA;

      // Atualizar vitórias e derrotas
      if (sA > sB) {
        winsArr[p1]++;
        winsArr[p2]++;
        lossesArr[p3]++;
        lossesArr[p4]++;
      } else if (sB > sA) {
        winsArr[p3]++;
        winsArr[p4]++;
        lossesArr[p1]++;
        lossesArr[p2]++;
      }
    }

    setWins(winsArr);
    setLosses(lossesArr);
    setScoreDiff(diffArr);
    setGamesWon(gamesWonArr);
    setGamesLost(gamesLostArr);
  }
  function handleScoreChange(match: Match, teamKey: string, value: string) {
    const copy = { ...matchResults };
    if (!copy[match.globalId])
      copy[match.globalId] = { scoreA: "", scoreB: "" };
    copy[match.globalId] = {
      ...copy[match.globalId],
      [teamKey]: value === "" ? "" : Number(value),
    };
    setMatchResults(copy);
  }
  function handlePlayerNameChange(index: number, value: string) {
    const copy = [...players];
    copy[index] = { ...copy[index], name: value };
    setPlayers(copy);
  }
  // ========== SISTEMA DE DESEMPATE ==========
  function getPlayerTotals() {
    return players.map((p, i) => {
      const v = wins[i] || 0;
      const d = losses[i] || 0;
      const saldo = scoreDiff[i] || 0;
      const gamesWonCount = gamesWon[i] || 0;
      const totalGames = v + d;
      const aproveitamento =
        totalGames > 0 ? ((v / totalGames) * 100).toFixed(1) : "0.0";

      return {
        index: i,
        playerName: p.name,
        wins: v,
        losses: d,
        saldo,
        gamesWon: gamesWonCount,
        aproveitamento,
      };
    });
  }
  // Função para calcular confronto direto entre dois jogadores
  function getHeadToHead(playerA: number, playerB: number): number {
    let winsA = 0;
    let winsB = 0;
    const matchesToProcess =
      viewMode === "planning" ? matches : completedMatches;
    for (const m of matchesToProcess) {
      const res = matchResults[m.globalId];
      if (!res || res.scoreA === "" || res.scoreB === "") continue;
      const [p1, p2] = m.teamA;
      const [p3, p4] = m.teamB;
      // Verificar se os jogadores estão na mesma partida
      const playersInMatch = [p1, p2, p3, p4];
      if (
        !playersInMatch.includes(playerA) ||
        !playersInMatch.includes(playerB)
      )
        continue;
      const sA = Number(res.scoreA);
      const sB = Number(res.scoreB);
      // Determinar em qual time está cada jogador
      const teamAHasA = p1 === playerA || p2 === playerA;
      const teamBHasA = p3 === playerA || p4 === playerA;
      const teamAHasB = p1 === playerB || p2 === playerB;
      const teamBHasB = p3 === playerB || p4 === playerB;
      // Se estão em times opostos
      if ((teamAHasA && teamBHasB) || (teamBHasA && teamAHasB)) {
        if (sA > sB) {
          if (teamAHasA) winsA++;
          else winsB++;
        } else if (sB > sA) {
          if (teamBHasA) winsA++;
          else winsB++;
        }
      }
    }
    return winsA - winsB; // positivo se A tem vantagem, negativo se B tem vantagem
  }
  function calculateRanking() {
    const totals = getPlayerTotals();

    return totals.sort((a, b) => {
      // 1. Critério: Vitórias
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }

      // 2. Critério: Saldo de Games
      if (b.saldo !== a.saldo) {
        return b.saldo - a.saldo;
      }

      // 3. Critério: Games Ganhos
      return b.gamesWon - a.gamesWon;
    });
  }
  // ========== FUNÇÕES DE MODO OPERAÇÃO ==========
  function getBusyPlayers(inProgress: Record<string, Match>): Set<number> {
    const busy = new Set<number>();
    Object.values(inProgress).forEach((m) => {
      m.teamA.forEach((p) => busy.add(p));
      m.teamB.forEach((p) => busy.add(p));
    });
    return busy;
  }

  function findNextValidMatch(queue: Match[], busyPlayers: Set<number>): number {
    return queue.findIndex((m) => {
      const players = [...m.teamA, ...m.teamB];
      return !players.some((p) => busyPlayers.has(p));
    });
  }

  function convertMatchesToQueue() {
    return [...matches];
  }

  function handleStartOperationMode() {
    const queue = convertMatchesToQueue();
    const initialInProgress: Record<number, Match> = {};
    const remainingQueue = [...queue];

    for (let i = 1; i <= numCourts; i++) {
      const busy = getBusyPlayers(initialInProgress);
      const idx = findNextValidMatch(remainingQueue, busy);

      if (idx !== -1) {
        const nextMatch = remainingQueue.splice(idx, 1)[0];
        initialInProgress[i] = { ...nextMatch, court: i };
      }
    }

    setMatchQueue(remainingQueue);
    setInProgressMatches(initialInProgress);
    setCompletedMatches([]);
    setViewMode("operation");
  }
  function handleMatchFinish(courtNumber: number) {
    const finishedMatch = inProgressMatches[courtNumber];
    if (!finishedMatch) return;

    const result = matchResults[finishedMatch.globalId];
    if (!result || result.scoreA === "" || result.scoreB === "") {
      alert("Por favor, preencha o placar antes de finalizar a partida.");
      return;
    }

    // 1. Remove current match matches from inProgress (freeing players)
    const newInProgress = { ...inProgressMatches };
    delete newInProgress[courtNumber];

    // 2. Add to completed
    const newCompleted = [...completedMatches, finishedMatch];
    setCompletedMatches(newCompleted);

    // 3. Try to fill ALL empty courts (including the one just freed)
    const newQueue = [...matchQueue];

    // Iterate over all available courts to fill them if possible
    for (let c = 1; c <= numCourts; c++) {
      if (!newInProgress[c]) {
        const busy = getBusyPlayers(newInProgress);
        const idx = findNextValidMatch(newQueue, busy);

        if (idx !== -1) {
          const nextMatch = newQueue.splice(idx, 1)[0];
          newInProgress[c] = { ...nextMatch, court: c };
        }
      }
    }

    setInProgressMatches(newInProgress);
    setMatchQueue(newQueue);
  }
  function handleEditCompletedMatch(globalId: string) {
    setEditingCompletedMatch(globalId);
  }
  function handleSaveEditedMatch(
    globalId: string,
    scoreA: string,
    scoreB: string
  ) {
    const match = completedMatches.find((m) => m.globalId === globalId);
    if (!match) return;

    setMatchResults({
      ...matchResults,
      [globalId]: { scoreA: Number(scoreA), scoreB: Number(scoreB) },
    });
    setEditingCompletedMatch(null);
  }
  // ========== FUNÇÕES DE REAGENDAMENTO ==========
  function startRescheduling(match: Match) {
    setReschedulingMatch(match);
  }
  function cancelRescheduling() {
    setReschedulingMatch(null);
    setRescheduleTarget(null);
  }
  function setRescheduleDestination(round: number, court: number) {
    setRescheduleTarget({ round, court });
  }
  function confirmReschedule() {
    if (!reschedulingMatch || !rescheduleTarget) return;
    const { round: targetRound, court: targetCourt } = rescheduleTarget;

    const updatedMatches = matches.filter(
      (m) => m.globalId !== reschedulingMatch.globalId
    );

    const newMatch = {
      ...reschedulingMatch,
      round: targetRound,
      court: targetCourt,
      scheduledTime: new Date().toISOString(),
    };
    updatedMatches.push(newMatch);
    setMatches(updatedMatches);
    cancelRescheduling();
  }
  // ========== FUNÇÕES DE EXPORTAÇÃO ==========
  function handlePrint() {
    const printContent = `
      <html>
        <head>
          <title>Classificação - ${tournamentName}</title>
          <style>
            body { font-family: 'Century Gothic', 'Arial Narrow', Arial, sans-serif; padding: 20px; }
            h1, h2, h3 { color: #FB0395; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f8f8f8; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://i.imgur.com/sQWqNap.png" alt="Wall BT" style="height: 80px; margin-bottom: 15px;">
            <h1>${tournamentName}</h1>
          </div>
          
          <h2>Classificação Individual</h2>
          <table>
            <thead>
              <tr>
                <th>Pos</th>
                <th>Jogador</th>
                <th>Vitórias</th>
                <th>Derrotas</th>
                <th>Saldo de Games</th>
                <th>Games Ganhos</th>
                <th>Aproveitamento</th>
              </tr>
            </thead>
            <tbody>
              ${calculateRanking()
        .map(
          (p, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${p.playerName}</td>
                  <td>${p.wins}</td>
                  <td>${p.losses}</td>
                  <td>${p.saldo}</td>
                  <td>${p.gamesWon}</td>
                  <td>${p.aproveitamento}%</td>
                </tr>
              `
        )
        .join("")}
            </tbody>
          </table>
          <h2>Partidas</h2>
          <table>
            <thead>
              <tr>
                <th>Quadra</th>
                <th>Dupla A</th>
                <th>Dupla B</th>
                <th>Placar</th>
              </tr>
            </thead>
            <tbody>
              ${matches
        .map((m) => {
          const result = matchResults[m.globalId];
          return `
                  <tr>
                    <td style="text-align: center;">${m.court}</td>
                    <td>${players[m.teamA[0]].name} + ${players[m.teamA[1]].name
            }</td>
                    <td>${players[m.teamB[0]].name} + ${players[m.teamB[1]].name
            }</td>
                    <td style="text-align: center;">${result ? `${result.scoreA}:${result.scoreB}` : ""
            }</td>
                  </tr>
                `;
        })
        .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  }
  function handleExportCSV() {
    const escapeCsv = (str: string) => `"${String(str).replace(/"/g, '""')}"`;

    let csvContent = "=== CONFIGURAÇÃO ===\n";
    csvContent += "Campo,Valor\n";
    csvContent += `Nome do Torneio,${escapeCsv(tournamentName)}\n`;
    csvContent += `Número de Jogadores,${n}\n`;
    csvContent += `Formato das Partidas,${durationType}\n`;
    csvContent += `Número de Quadras,${numCourts}\n\n`;

    csvContent += "=== JOGADORES ===\n";
    csvContent += "ID,Nome\n";
    players.forEach((p, i) => {
      csvContent += `${i + 1},${escapeCsv(p.name)}\n`;
    });
    csvContent += "\n";

    csvContent += "=== PARTIDAS ===\n";
    csvContent +=
      "Quadra,Dupla A (Jogador 1),Dupla A (Jogador 2),Dupla B (Jogador 1),Dupla B (Jogador 2),Placar A,Placar B\n";
    matches.forEach((m) => {
      const result = matchResults[m.globalId];
      csvContent += `${m.court},${escapeCsv(
        players[m.teamA[0]].name
      )},${escapeCsv(players[m.teamA[1]].name)},${escapeCsv(
        players[m.teamB[0]].name
      )},${escapeCsv(players[m.teamB[1]].name)},${result?.scoreA || ""},${result?.scoreB || ""
        }\n`;
    });
    csvContent += "\n";

    csvContent += "=== CLASSIFICAÇÃO ===\n";
    csvContent +=
      "Posição,Jogador,Vitórias,Derrotas,Saldo de Games,Games Ganhos,Aproveitamento (%)\n";
    calculateRanking().forEach((p, idx) => {
      csvContent += `${idx + 1},${escapeCsv(p.playerName)},${p.wins},${p.losses
        },${p.saldo},${p.gamesWon},${p.aproveitamento}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tournamentName.replace(/\s+/g, "_")}_Relatorio.csv`;
    link.click();
  }
  function getTotalMatchCount() {
    return matches.length;
  }
  function getDurationEstimate() {
    const totalMatches = getTotalMatchCount();
    let minutesPerMatch = 40;
    if (durationType === "shortset") minutesPerMatch = 25;
    if (durationType === "supertie") minutesPerMatch = 10;
    const courts = Math.max(1, numCourts);
    const estimatedMinutes = Math.ceil(totalMatches / courts) * minutesPerMatch;
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;
    return { totalMatches, hours, minutes, courts };
  }
  // ========== FUNÇÕES DO MODO APRESENTAÇÃO ==========
  function getNextMatches(count: number = 8): Match[] {
    const allMatches = [...Object.values(inProgressMatches), ...matchQueue];
    return allMatches.slice(0, count);
  }
  function getRecentResults(count: number = 6): Match[] {
    return completedMatches.slice(-count).reverse();
  }
  // ========== CONSTANTES ==========
  const courtColors: CourtColor[] = [
    { bg: "#A0F0FF", border: "#70D0E0", text: "#000" },
    { bg: "#F8A0D0", border: "#E070B0", text: "#000" },
    { bg: "#FFD9A0", border: "#E0B070", text: "#000" },
    { bg: "#D1C0FF", border: "#A080E0", text: "#000" },
    { bg: "#A0F0C0", border: "#70D0A0", text: "#000" },
    { bg: "#FFCBA0", border: "#E0A070", text: "#000" },
  ];
  const sortedPlayers = calculateRanking();
  const durationEstimate = getDurationEstimate();
  // ========== RENDERIZAÇÃO DO MODO APRESENTAÇÃO ==========
  const renderPresentationMode = () => {
    const nextMatches = getNextMatches(8);
    const recentResults = getRecentResults(6);
    return (
      <div className="min-h-screen bg-black text-white p-8 relative">
        {/* BOTÃO FLUTUANTE PARA VOLTAR */}
        <div className="fixed top-6 right-6 z-50">
          <button
            onClick={() => setViewMode("operation")}
            className="bg-[#FB0395] text-white px-6 py-3 rounded-full font-bold shadow-2xl hover:bg-pink-600 transition-all duration-300 flex items-center gap-2 border-2 border-pink-400"
            title="Voltar ao modo operação"
          >
            ⚙️ Sair
          </button>
        </div>
        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="https://i.imgur.com/sQWqNap.png"
              alt="Wall BT"
              className="h-28 object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold mb-2" style={{ color: "#FB0395" }}>
            {tournamentName}
          </h1>
          <p className="text-xl opacity-80 text-gray-300">
            Modo Apresentação - Ao Vivo
          </p>

          {/* CONTROLES DE VISUALIZAÇÃO */}
          <div className="flex justify-center gap-4 mt-4">
            <button
              className={`px-6 py-3 rounded-lg font-bold text-lg transition ${presentationView === "classification"
                ? "bg-[#FB0395] text-white"
                : "bg-gray-800 text-gray-300"
                }`}
              onClick={() => setPresentationView("classification")}
            >
              🏆 Classificação
            </button>
            <button
              className={`px-6 py-3 rounded-lg font-bold text-lg transition ${presentationView === "matches"
                ? "bg-[#FB0395] text-white"
                : "bg-gray-800 text-gray-300"
                }`}
              onClick={() => setPresentationView("matches")}
            >
              🎾 Partidas
            </button>
          </div>
        </div>
        {presentationView === "classification" ? (
          /* VISÃO CLASSIFICAÇÃO */
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* CLASSIFICAÇÃO PRINCIPAL */}
              <div className="xl:col-span-2 bg-gray-900 rounded-2xl p-6 border border-gray-700">
                <h2
                  className="text-3xl font-bold mb-6 text-center"
                  style={{ color: "#FB0395" }}
                >
                  📊 Classificação
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-lg">
                    <thead>
                      <tr className="border-b-2 border-gray-700">
                        <th className="text-left pb-3 text-gray-300">Pos</th>
                        <th className="text-left pb-3 text-gray-300">
                          Jogador
                        </th>
                        <th className="text-center pb-3 text-gray-300">V</th>
                        <th className="text-center pb-3 text-gray-300">D</th>
                        <th className="text-center pb-3 text-gray-300">
                          Saldo
                        </th>
                        <th className="text-center pb-3 text-gray-300">
                          Games
                        </th>
                        <th className="text-center pb-3 text-gray-300">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPlayers.slice(0, 8).map((p, idx) => (
                        <tr
                          key={p.index}
                          className={`border-b border-gray-800 hover:bg-gray-800 transition ${idx < 3 ? "bg-gray-800 font-semibold" : ""
                            }`}
                        >
                          <td className="py-4">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${idx === 0
                                ? "bg-yellow-500 text-black"
                                : idx === 1
                                  ? "bg-gray-400 text-black"
                                  : idx === 2
                                    ? "bg-orange-500 text-black"
                                    : "bg-gray-700 text-white"
                                }`}
                            >
                              {idx + 1}
                            </div>
                          </td>
                          <td className="py-4 font-semibold text-white">
                            {p.playerName}
                          </td>
                          <td className="text-center py-4 text-xl font-bold text-green-400">
                            {p.wins}
                          </td>
                          <td className="text-center py-4 text-red-400">
                            {p.losses}
                          </td>
                          <td className="text-center py-4 text-white">
                            {p.saldo > 0 ? `+${p.saldo}` : p.saldo}
                          </td>
                          <td className="text-center py-4 text-white">
                            {p.gamesWon}
                          </td>
                          <td className="text-center py-4 text-white">
                            {p.aproveitamento}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* SIDEBAR COM INFORMAÇÕES */}
              <div className="space-y-6">
                {/* PRÓXIMAS PARTIDAS */}
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
                  <h3
                    className="text-2xl font-bold mb-4"
                    style={{ color: "#FB0395" }}
                  >
                    ⏭️ Próximas Partidas
                  </h3>
                  <div className="space-y-3">
                    {nextMatches.slice(0, 4).map((match, index) => (
                      <div
                        key={match.globalId}
                        className="bg-gray-800 rounded-lg p-3 border-l-4 border-[#FB0395]"
                      >
                        <div className="font-semibold text-sm mb-1 text-gray-300">
                          Quadra {match.court}
                        </div>
                        <div className="text-sm text-white">
                          {`${players[match.teamA[0]].name}+${players[match.teamA[1]].name
                            }`}
                          <span className="mx-2 opacity-60">vs</span>
                          {`${players[match.teamB[0]].name}+${players[match.teamB[1]].name
                            }`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* ULTIMOS RESULTADOS */}
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
                  <h3
                    className="text-2xl font-bold mb-4"
                    style={{ color: "#FB0395" }}
                  >
                    ✅ Últimos Resultados
                  </h3>
                  <div className="space-y-3">
                    {recentResults.map((match, index) => {
                      const result = matchResults[match.globalId];
                      return (
                        <div
                          key={match.globalId}
                          className="bg-gray-800 rounded-lg p-3"
                        >
                          <div className="flex justify-between items-center text-sm">
                            <div className="flex-1 text-right text-white">
                              {`${players[match.teamA[0]].name}+${players[match.teamA[1]].name
                                }`}
                            </div>
                            <div className="mx-3 font-bold text-lg text-white">
                              {result
                                ? `${result.scoreA} - ${result.scoreB}`
                                : " - "}
                            </div>
                            <div className="flex-1 text-left text-white">
                              {`${players[match.teamB[0]].name}+${players[match.teamB[1]].name
                                }`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* VISÃO PARTIDAS */
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* PRÓXIMAS PARTIDAS */}
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
                <h2
                  className="text-3xl font-bold mb-6 text-center"
                  style={{ color: "#FB0395" }}
                >
                  ⏭️ Próximas Partidas
                </h2>
                <div className="space-y-4">
                  {nextMatches.slice(0, 8).map((match, index) => {
                    const isInProgress = Object.values(inProgressMatches).some(
                      (m) => m.globalId === match.globalId
                    );

                    return (
                      <div
                        key={match.globalId}
                        className={`bg-gray-800 rounded-xl p-4 border-l-4 ${isInProgress ? "border-green-500" : "border-[#FB0395]"
                          }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-sm font-bold">
                            Quadra {match.court}
                          </span>
                          {isInProgress && (
                            <span className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-bold">
                              🔴 AO VIVO
                            </span>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-lg mb-2 text-white">
                            {`${players[match.teamA[0]].name} + ${players[match.teamA[1]].name
                              }`}
                          </div>
                          <div className="opacity-60 text-lg mb-2 text-gray-400">
                            vs
                          </div>
                          <div className="font-semibold text-lg text-white">
                            {`${players[match.teamB[0]].name} + ${players[match.teamB[1]].name
                              }`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {nextMatches.length === 0 && (
                    <div className="text-center py-12 opacity-60">
                      <div className="text-6xl mb-4 text-gray-500">📭</div>
                      <div className="text-xl text-gray-400">
                        Nenhuma partida na fila
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* ÚLTIMOS RESULTADOS */}
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
                <h2
                  className="text-3xl font-bold mb-6 text-center"
                  style={{ color: "#FB0395" }}
                >
                  ✅ Últimos Resultados
                </h2>
                <div className="space-y-4">
                  {recentResults.map((match, index) => {
                    const result = matchResults[match.globalId];
                    return (
                      <div
                        key={match.globalId}
                        className="bg-gray-800 rounded-xl p-4"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-sm font-bold">
                            Quadra {match.court}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-center flex-1">
                            <div className="font-semibold text-sm mb-1 text-white">
                              {`${players[match.teamA[0]].name} + ${players[match.teamA[1]].name
                                }`}
                            </div>
                          </div>
                          <div className="mx-4">
                            <div className="text-3xl font-bold bg-gray-700 rounded-lg px-4 py-2 min-w-20 text-white">
                              {result
                                ? `${result.scoreA} - ${result.scoreB}`
                                : " - "}
                            </div>
                          </div>
                          <div className="text-center flex-1">
                            <div className="font-semibold text-sm mb-1 text-white">
                              {`${players[match.teamB[0]].name} + ${players[match.teamB[1]].name
                                }`}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {recentResults.length === 0 && (
                    <div className="text-center py-12 opacity-60">
                      <div className="text-6xl mb-4 text-gray-500">📊</div>
                      <div className="text-xl text-gray-400">
                        Nenhum resultado disponível
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* TOP 3 NA CLASSIFICAÇÃO */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700">
              <h2
                className="text-3xl font-bold mb-6 text-center"
                style={{ color: "#FB0395" }}
              >
                🏆 Top 3 da Classificação
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {sortedPlayers.slice(0, 3).map((p, idx) => (
                  <div
                    key={p.index}
                    className={`rounded-2xl p-6 text-center ${idx === 0
                      ? "bg-gradient-to-br from-yellow-900 to-yellow-700 border-2 border-yellow-500"
                      : idx === 1
                        ? "bg-gradient-to-br from-gray-800 to-gray-600 border-2 border-gray-400"
                        : "bg-gradient-to-br from-orange-900 to-orange-700 border-2 border-orange-500"
                      }`}
                  >
                    <div
                      className={`text-4xl mb-4 ${idx === 0
                        ? "text-yellow-300"
                        : idx === 1
                          ? "text-gray-300"
                          : "text-orange-300"
                        }`}
                    >
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                    </div>
                    <div className="text-2xl font-bold mb-2 text-white">
                      {p.playerName}
                    </div>
                    <div className="text-4xl font-bold mb-2 text-green-400">
                      {p.wins} V
                    </div>
                    <div className="text-lg opacity-80 mb-3 text-gray-300">
                      {p.losses}D • {p.aproveitamento}%
                    </div>
                    <div className="text-sm bg-black/40 rounded-lg p-2 text-white">
                      Saldo: {p.saldo > 0 ? `+${p.saldo}` : p.saldo} | Games:{" "}
                      {p.gamesWon}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* RODAPÉ */}
        <div className="text-center mt-8" style={{ color: "#00f2ff" }}>
          <p>Atualizado em: {new Date().toLocaleString("pt-BR")}</p>
          <p className="text-sm">
            Wall BT - Sistema de Gerenciamento de Torneios
          </p>
        </div>
      </div>
    );
  };
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

  // ========== RENDERIZAÇÃO PRINCIPAL ==========
  return (
    <div
      className="p-6 max-w-7xl mx-auto"
      style={{
        fontFamily: "'Century Gothic', 'Arial Narrow', Arial, sans-serif",
      }}
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

      {/* CONTROLES PRINCIPAIS */}
      {viewMode !== "presentation" && (
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
              <label className="block mb-2">Número de Jogadores:</label>
              <select
                className="border px-2 py-1 rounded w-full"
                value={n}
                onChange={(e) => handleNChange(Number(e.target.value))}
              >
                {VALID_N.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block mb-2">Número de Quadras:</label>
              <input
                type="number"
                min="1"
                max="6"
                className="border px-2 py-1 rounded w-full"
                value={numCourts}
                onChange={(e) =>
                  handleCourtsChange(
                    Math.max(1, Math.min(6, Number(e.target.value) || 1))
                  )
                }
              />
            </div>
            <div></div>
            <div></div>
          </div>

          <div
            className="mt-4 p-3 rounded"
            style={{ backgroundColor: "#00F1FD20" }}
          >
            <strong>
              ⏱️ Estimativa de Duração ({durationEstimate.courts} quadra(s)):
            </strong>
            <br />
            {durationEstimate.totalMatches} partidas ×{" "}
            {durationType === "set6"
              ? "40 min"
              : durationType === "shortset"
                ? "25 min"
                : "10 min"}
            <br />
            <strong>Tempo total estimado:</strong> {durationEstimate.hours}h
            {durationEstimate.minutes}min
            <br />
            <small>
              <strong>Partidas por jogador:</strong>{" "}
              {n === 4
                ? "3"
                : n === 5
                  ? "4"
                  : n === 8
                    ? "7"
                    : n === 9
                      ? "8"
                      : n === 12
                        ? "11"
                        : n === 13
                          ? "12"
                          : "15"}
            </small>
          </div>

          {/* TOGGLE DE MODO */}
          <div className="mt-4 flex justify-center gap-4 flex-wrap">
            <button
              className={`px-4 py-2 rounded font-bold transition ${viewMode === "planning"
                ? "bg-blue-500 text-white"
                : "bg-gray-200"
                }`}
              onClick={() => setViewMode("planning")}
            >
              📋 Modo Planejamento
            </button>
            <button
              className={`px-4 py-2 rounded font-bold transition ${viewMode === "operation"
                ? "bg-green-500 text-white"
                : "bg-gray-200"
                }`}
              onClick={handleStartOperationMode}
              disabled={matches.length === 0}
            >
              🎾 Modo Operação
            </button>
            <button
              className={`px-4 py-2 rounded font-bold transition ${viewMode === "presentation"
                ? "bg-purple-500 text-white"
                : "bg-gray-200"
                }`}
              onClick={() => setViewMode("presentation")}
            >
              🖥️ Modo Apresentação
            </button>
          </div>
        </div>
      )}
      {/* MODAL DE REAGENDAMENTO */}
      {reschedulingMatch && viewMode === "planning" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4">
            <h2 className="text-xl font-bold mb-4">🔄 Reagendar Partida</h2>
            <div className="mb-4">
              <p>Partida selecionada:</p>
              <p className="font-semibold">
                {`${players[reschedulingMatch.teamA[0]].name}+${players[reschedulingMatch.teamA[1]].name
                  } vs ${players[reschedulingMatch.teamB[0]].name}+${players[reschedulingMatch.teamB[1]].name
                  }`}
              </p>
            </div>

            <div className="mb-4">
              <label className="block mb-2">
                Selecione nova rodada e quadra:
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {Array.from(
                  { length: Math.ceil(matches.length / numCourts) },
                  (_, i) => i + 1
                ).map((round) =>
                  Array.from({ length: numCourts }, (_, i) => i + 1).map(
                    (court) => (
                      <button
                        key={`${round}-${court}`}
                        className={`p-2 border rounded text-sm ${rescheduleTarget?.round === round &&
                          rescheduleTarget?.court === court
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100"
                          }`}
                        onClick={() => setRescheduleDestination(round, court)}
                      >
                        Rodada {round} - Quadra {court}
                      </button>
                    )
                  )
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-gray-500 text-white rounded"
                onClick={cancelRescheduling}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
                onClick={confirmReschedule}
                disabled={!rescheduleTarget}
              >
                Confirmar Reagendamento
              </button>
            </div>
          </div>
        </div>
      )}
      {/* CONTEÚDO PRINCIPAL */}
      {viewMode === "presentation" ? (
        renderPresentationMode()
      ) : viewMode === "planning" ? (
        // ========== MODO PLANEJAMENTO ==========
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded p-4 shadow">
            <h2 className="text-lg font-semibold mb-2">Jogadores</h2>
            {players.map((p, i) => (
              <div key={i} className="flex gap-2 items-center mb-1">
                <input
                  className="border px-2 py-1 rounded w-full"
                  value={p.name}
                  onChange={(e) => handlePlayerNameChange(i, e.target.value)}
                />
              </div>
            ))}
            <div className="mt-4 border-t pt-4">
              <button
                className="w-full py-3 rounded font-bold text-white transition transform hover:scale-105"
                style={{
                  backgroundColor: "#FB0395",
                  boxShadow: "0 4px 14px 0 rgba(251, 3, 149, 0.39)",
                }}
                onClick={handleGenerateSchedule}
              >
                📅 Gerar Cronograma
              </button>
            </div>
          </div>

          <div className="bg-white rounded p-4 shadow">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">
                Classificação Individual
              </h2>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 rounded text-sm transition"
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
                  className="px-3 py-1 rounded text-sm transition"
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
                  <th>V</th>
                  <th>D</th>
                  <th>Saldo</th>
                  <th>Games</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p, idx) => (
                  <tr key={p.index} className="border-t">
                    <td>{idx + 1}</td>
                    <td>{p.playerName}</td>
                    <td>{p.wins}</td>
                    <td>{p.losses}</td>
                    <td>{p.saldo}</td>
                    <td>{p.gamesWon}</td>
                    <td>{p.aproveitamento}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // ========== MODO OPERAÇÃO ==========
        <div className="mt-8">
          <h2
            className="text-2xl font-bold text-center mb-4"
            style={{ color: "#FB0395" }}
          >
            Painel do Torneio
          </h2>

          <div className="bg-white rounded p-4 shadow mb-6">
            <h3 className="text-lg font-semibold mb-3">
              Partidas em Andamento
            </h3>
            {Object.keys(inProgressMatches).length > 0 ? (
              Object.values(inProgressMatches).map((match) => (
                <div
                  key={match.globalId}
                  className="flex flex-col sm:flex-row items-center gap-2 mb-2 p-2 rounded"
                  style={{
                    backgroundColor:
                      courtColors[(match.court! - 1) % courtColors.length].bg,
                    border: `2px solid ${courtColors[(match.court! - 1) % courtColors.length]
                      .border
                      }`,
                  }}
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border text-sm font-bold bg-white"
                    style={{
                      borderColor:
                        courtColors[(match.court! - 1) % courtColors.length]
                          .border,
                    }}
                  >
                    {match.court}
                  </div>
                  <div className="flex-1 text-sm font-semibold text-center sm:text-left">
                    {`${players[match.teamA[0]].name}+${players[match.teamA[1]].name
                      }`}
                    <span className="font-normal mx-1"> vs </span>
                    {`${players[match.teamB[0]].name}+${players[match.teamB[1]].name
                      }`}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      className="w-16 border px-2 py-1 rounded bg-white"
                      placeholder="A"
                      value={matchResults[match.globalId]?.scoreA ?? ""}
                      onChange={(e) =>
                        handleScoreChange(match, "scoreA", e.target.value)
                      }
                    />
                    <span>:</span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      className="w-16 border px-2 py-1 rounded bg-white"
                      placeholder="B"
                      value={matchResults[match.globalId]?.scoreB ?? ""}
                      onChange={(e) =>
                        handleScoreChange(match, "scoreB", e.target.value)
                      }
                    />
                    <button
                      className="px-3 py-1 text-sm font-bold rounded bg-green-500 hover:bg-green-600 text-white transition-colors"
                      onClick={() => handleMatchFinish(match.court!)}
                      title="Finalizar Partida"
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">
                Nenhuma partida em andamento.
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded p-4 shadow">
              <h3 className="text-lg font-semibold mb-3">Fila de Espera</h3>
              {matchQueue.length > 0 ? (
                <ul className="space-y-2">
                  {matchQueue.slice(0, 5).map((match, index) => (
                    <li
                      key={match.globalId}
                      className="text-sm p-2 bg-gray-50 rounded"
                    >
                      <span className="font-bold mr-2">{index + 1}º:</span>
                      {`${players[match.teamA[0]].name}+${players[match.teamA[1]].name
                        }`}
                      <span className="font-normal mx-1"> vs </span>
                      {`${players[match.teamB[0]].name}+${players[match.teamB[1]].name
                        }`}
                    </li>
                  ))}
                  {matchQueue.length > 5 && (
                    <p className="text-xs text-gray-400 mt-2">
                      ... e mais {matchQueue.length - 5} partidas.
                    </p>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  Nenhuma partida na fila.
                </p>
              )}
            </div>

            <div className="bg-white rounded p-4 shadow">
              <h3 className="text-lg font-semibold mb-3">
                Partidas Concluídas
              </h3>
              {completedMatches.length > 0 ? (
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                  {completedMatches
                    .slice()
                    .reverse()
                    .map((match) => {
                      const result = matchResults[match.globalId];
                      const isEditing =
                        editingCompletedMatch === match.globalId;

                      return (
                        <li
                          key={match.globalId}
                          className="text-sm p-2 bg-green-50 rounded flex justify-between items-center"
                        >
                          <div className="truncate pr-2">
                            <span className="text-gray-500">
                              Q{match.court}:{" "}
                            </span>
                            {`${players[match.teamA[0]].name}+${players[match.teamA[1]].name
                              }`}
                            <span className="font-normal mx-1"> vs </span>
                            {`${players[match.teamB[0]].name}+${players[match.teamB[1]].name
                              }`}
                          </div>
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  className="w-12 border px-1 py-0.5 rounded bg-white text-xs"
                                  defaultValue={result?.scoreA}
                                  onBlur={(e) =>
                                    handleSaveEditedMatch(
                                      match.globalId,
                                      e.target.value,
                                      String(result?.scoreB || "")
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    e.key === "Enter" &&
                                    handleSaveEditedMatch(
                                      match.globalId,
                                      (e.target as HTMLInputElement).value,
                                      String(result?.scoreB || "")
                                    )
                                  }
                                />
                                <span>:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  className="w-12 border px-1 py-0.5 rounded bg-white text-xs"
                                  defaultValue={result?.scoreB}
                                  onBlur={(e) =>
                                    handleSaveEditedMatch(
                                      match.globalId,
                                      String(result?.scoreA || ""),
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    e.key === "Enter" &&
                                    handleSaveEditedMatch(
                                      match.globalId,
                                      String(result?.scoreA || ""),
                                      (e.target as HTMLInputElement).value
                                    )
                                  }
                                />
                              </>
                            ) : (
                              <div className="font-bold text-md flex-shrink-0">
                                {result
                                  ? `${result.scoreA} : ${result.scoreB}`
                                  : "N/A"}
                              </div>
                            )}
                            {!isEditing && (
                              <button
                                className="ml-2 px-2 py-0.5 text-xs bg-yellow-500 text-white rounded"
                                onClick={() =>
                                  handleEditCompletedMatch(match.globalId)
                                }
                              >
                                Editar
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">
                  Nenhuma partida concluída.
                </p>
              )}
            </div>
          </div>

          {/* CLASSIFICAÇÃO NO MODO OPERAÇÃO */}
          <div className="mt-6 bg-white rounded p-4 shadow">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">Classificação Atual</h2>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 rounded text-sm transition"
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
                  className="px-3 py-1 rounded text-sm transition"
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
                  <th>V</th>
                  <th>D</th>
                  <th>Saldo</th>
                  <th>Games</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p, idx) => (
                  <tr key={p.index} className="border-t">
                    <td>{idx + 1}</td>
                    <td>{p.playerName}</td>
                    <td>{p.wins}</td>
                    <td>{p.losses}</td>
                    <td>{p.saldo}</td>
                    <td>{p.gamesWon}</td>
                    <td>{p.aproveitamento}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PARTIDAS (APENAS NO MODO PLANEJAMENTO) */}
      {viewMode === "planning" && (
        <div className="mt-6">
          <div className="bg-white rounded p-4 shadow">
            <h2 className="text-lg font-semibold mb-3">
              Partidas ({matches.length} partidas)
            </h2>
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
            {matches.map((m, idx) => (
              <div
                key={m.globalId}
                className="flex items-center gap-2 mb-1 p-2 rounded group relative"
                style={{
                  backgroundColor:
                    courtColors[(m.court! - 1) % courtColors.length].bg,
                  borderColor:
                    courtColors[(m.court! - 1) % courtColors.length].border,
                  borderWidth: "2px",
                  borderStyle: "solid",
                }}
              >
                {/* BOTÃO DE REAGENDAMENTO */}
                <button
                  className="absolute -top-2 -right-2 bg-yellow-500 text-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => startRescheduling(m)}
                  title="Reagendar partida"
                >
                  ↺
                </button>

                <div
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border text-sm font-bold"
                  style={{
                    backgroundColor: "white",
                    borderColor:
                      courtColors[(m.court! - 1) % courtColors.length].border,
                    color:
                      courtColors[(m.court! - 1) % courtColors.length].text,
                  }}
                >
                  {m.court}
                </div>
                <div className="flex-1 text-sm">
                  {`Partida ${idx + 1}: ${players[m.teamA[0]].name}+${players[m.teamA[1]].name
                    } vs ${players[m.teamB[0]].name}+${players[m.teamB[1]].name}`}
                </div>
                <input
                  type="number"
                  min="0"
                  max="20"
                  className="w-16 border px-2 py-1 rounded bg-white"
                  placeholder="A"
                  value={matchResults[m.globalId]?.scoreA ?? ""}
                  onChange={(e) =>
                    handleScoreChange(m, "scoreA", e.target.value)
                  }
                />
                <span>:</span>
                <input
                  type="number"
                  min="0"
                  max="20"
                  className="w-16 border px-2 py-1 rounded bg-white"
                  placeholder="B"
                  value={matchResults[m.globalId]?.scoreB ?? ""}
                  onChange={(e) =>
                    handleScoreChange(m, "scoreB", e.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
