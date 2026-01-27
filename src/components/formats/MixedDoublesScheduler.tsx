// MixedDoublesScheduler.tsx - VERSÃO SEM QR CODES
import { useSyncedState } from "../../hooks/useSyncedState";
import { useStorage } from "../../services/storage/StorageContext";
import React, { useState, useEffect } from "react";

// Tipos auxiliares
interface Couple {
  manName: string;
  womanName: string;
}
interface Match {
  id: string;
  globalId: string;
  round: number;
  teamA: { man: number; woman: number };
  teamB: { man: number; woman: number } | null;
  court?: number;
  group?: "A" | "B";
  scheduledTime?: string;
  originalRound?: number;
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
interface SemifinalMatch {
  id: string;
  coupleA: number;
  coupleB: number;
  scoreA: string | number;
  scoreB: string | number;
}
interface FinalMatch {
  coupleA: number;
  coupleB: number;
  scoreA: string | number;
  scoreB: string | number;
}

export default function MixedDoublesScheduler({ storagePrefix = "wallbt_md" }: { storagePrefix?: string }) {
  const { mode, setMode, isConnected } = useStorage();

  // ========== ESTADOS PRINCIPAIS (SINCRONIZADOS) ==========
  const [n, setN] = useSyncedState<number>(`${storagePrefix}_n`, 6);

  const [couples, setCouples] = useSyncedState<Couple[]>(`${storagePrefix}_couples`,
    Array.from({ length: 6 }, (_, i) => ({
      manName: String(i + 1),
      womanName: String.fromCharCode(65 + i),
    }))
  );

  const [roundsGroupA, setRoundsGroupA] = useSyncedState<Round[]>(`${storagePrefix}_roundsA`, []);
  const [roundsGroupB, setRoundsGroupB] = useSyncedState<Round[]>(`${storagePrefix}_roundsB`, []);

  const [matchResults, setMatchResults] = useSyncedState<Record<string, MatchResult>>(`${storagePrefix}_results`, {});

  const [finalMatch, setFinalMatch] = useSyncedState<FinalMatch | null>(`${storagePrefix}_final`, null);
  const [semifinalMatches, setSemifinalMatches] = useSyncedState<SemifinalMatch[]>(`${storagePrefix}_semis`, []);

  const [tournamentName, setTournamentName] = useSyncedState<string>(`${storagePrefix}_name`, "Wall BT - Troca de Casais");

  const [tournamentFormat, setTournamentFormat] = useSyncedState<"single" | "groups">(`${storagePrefix}_format`, "single");

  const [durationType, setDurationType] = useSyncedState<"set6" | "shortset" | "supertie">(`${storagePrefix}_duration`, "set6");

  const [numCourts, setNumCourts] = useSyncedState<number>(`${storagePrefix}_courts`, 2);

  // ========== ESTADOS PARA MODO OPERAÇÃO (SINCRONIZADOS) ==========
  const [viewMode, setViewMode] = useSyncedState<"planning" | "operation" | "presentation">(`${storagePrefix}_viewMode`, "planning");

  const [matchQueue, setMatchQueue] = useSyncedState<Match[]>(`${storagePrefix}_queue`, []);

  const [inProgressMatches, setInProgressMatches] = useSyncedState<Record<number, Match>>(`${storagePrefix}_inProgress`, {});

  const [completedMatches, setCompletedMatches] = useSyncedState<Match[]>(`${storagePrefix}_completed`, []);

  // ========== ESTADOS NÃO PERSISTIDOS (DERIVADOS OU VOLÁTEIS) ==========
  const [scoreDiff, setScoreDiff] = useState<number[]>([]);
  const [wins, setWins] = useState<number[]>([]);
  const [losses, setLosses] = useState<number[]>([]);
  const [editingCompletedMatch, setEditingCompletedMatch] = useState<string | null>(null);
  const [reschedulingMatch, setReschedulingMatch] = useState<Match | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<{ round: number; court: number; } | null>(null);
  const [gamesWon, setGamesWon] = useState<number[]>([]);
  const [gamesLost, setGamesLost] = useState<number[]>([]);
  const [presentationView, setPresentationView] = useState<"classification" | "matches">("classification");

  // NOTA: Os efeitos manuais de localStorage e initializeDefault foram removidos pois usePersistedState cuida disso.

  // Inicializa o agendamento se estiver vazio (primeira vez)
  useEffect(() => {
    if (roundsGroupA.length === 0 && roundsGroupB.length === 0 && tournamentFormat === "single") {
      setRoundsGroupA(generateSchedule(n));
    }
  }, []); // Run once on mount attempt

  // ========== HANDLERS DE CONFIGURAÇÃO (SUBSITUINDO O USEEFFECT) ==========
  function handleCoupleCountChange(newN: number) {
    setN(newN);

    // Atualizar lista de casais preservando os existentes
    setCouples(prev => {
      const newCouples = [...prev];
      if (newN > prev.length) {
        // Adicionar novos
        for (let i = prev.length; i < newN; i++) {
          newCouples.push({
            manName: String(i + 1),
            womanName: String.fromCharCode(65 + i),
          });
        }
      } else if (newN < prev.length) {
        // Remover excedentes
        newCouples.splice(newN);
      }
      return newCouples;
    });

    // Resetar estados derivados
    resetTournamentStats(newN, tournamentFormat);
  }

  function handleFormatChange(newFormat: "single" | "groups") {
    setTournamentFormat(newFormat);
    resetTournamentStats(n, newFormat);
  }

  function resetTournamentStats(currentN: number, currentFormat: "single" | "groups") {
    setMatchResults({});
    setFinalMatch(null);
    setSemifinalMatches([]);
    setGamesWon(Array(currentN).fill(0));
    setGamesLost(Array(currentN).fill(0));
    setWins(Array(currentN).fill(0));
    setLosses(Array(currentN).fill(0));
    setScoreDiff(Array(currentN).fill(0));

    if (currentFormat === "single") {
      setRoundsGroupA(generateSchedule(currentN));
      setRoundsGroupB([]);
    } else {
      const groupASize = Math.ceil(currentN / 2);
      const groupBSize = currentN - groupASize;
      setRoundsGroupA(generateSchedule(groupASize));
      setRoundsGroupB(groupBSize > 0 ? generateSchedule(groupBSize) : []);
    }
  }

  useEffect(() => {
    recomputeStats();
  }, [matchResults, roundsGroupA, roundsGroupB, completedMatches]);

  // ========== FUNÇÕES PRINCIPAIS ==========
  function generateSchedule(N: number): Round[] {
    if (N < 2) return [];
    const R = N % 2 === 0 ? N - 1 : N;
    let allRounds: Round[] = [];
    for (let r = 0; r < R; r++) {
      const pairs = [];
      for (let i = 0; i < N; i++) {
        const woman = (i + r + 1) % N;
        pairs.push({ man: i, woman });
      }
      const rawMatches: Match[] = [];
      for (let k = 0; k < pairs.length; k += 2) {
        const teamA = pairs[k];
        const teamB = k + 1 < pairs.length ? pairs[k + 1] : null;
        if (!teamB) continue;
        rawMatches.push({
          id: `R${r + 1}M${rawMatches.length + 1}`,
          globalId: `r${r + 1}_m${rawMatches.length + 1}`,
          round: r + 1,
          teamA,
          teamB,
          originalRound: r + 1,
        });
      }
      const orderedMatches =
        N > 6
          ? rawMatches
          : reorderMatchesToAvoidConsecutivePlayers(rawMatches);
      const matchesWithCourts = assignCourtsToMatches(
        orderedMatches,
        numCourts
      );
      allRounds.push({ round: r + 1, matches: matchesWithCourts });
    }
    return allRounds;
  }

  function assignCourtsToMatches(matches: Match[], courts: number): Match[] {
    return matches.map((match, index) => ({
      ...match,
      court: (index % courts) + 1,
    }));
  }

  function reorderMatchesToAvoidConsecutivePlayers(matches: Match[]): Match[] {
    if (matches.length <= 1) return matches;
    const result: Match[] = [];
    const used = new Set<number>();
    let lastPlayers = new Set<number>();
    while (result.length < matches.length) {
      let placed = false;
      for (let i = 0; i < matches.length; i++) {
        if (used.has(i)) continue;
        const match = matches[i];
        const playersInThisMatch = new Set([
          match.teamA.man,
          match.teamA.woman,
          match.teamB!.man,
          match.teamB!.woman,
        ]);
        const hasConflict = [...playersInThisMatch].some((p) =>
          lastPlayers.has(p)
        );
        if (!hasConflict) {
          result.push(match);
          used.add(i);
          lastPlayers = playersInThisMatch;
          placed = true;
          break;
        }
      }
      if (!placed) {
        for (let i = 0; i < matches.length; i++) {
          if (!used.has(i)) {
            result.push(matches[i]);
            used.add(i);
            lastPlayers = new Set([
              matches[i].teamA.man,
              matches[i].teamA.woman,
              matches[i].teamB!.man,
              matches[i].teamB!.woman,
            ]);
            break;
          }
        }
      }
    }
    return result;
  }

  function recomputeStats() {
    const totalCouples = n;
    const diff = Array(totalCouples).fill(0);
    const winsArr = Array(totalCouples).fill(0);
    const lossesArr = Array(totalCouples).fill(0);
    const gamesWonArr = Array(totalCouples).fill(0);
    const gamesLostArr = Array(totalCouples).fill(0);

    const matchesToProcess =
      viewMode === "planning"
        ? [
          ...roundsGroupA.flatMap((r) => r.matches),
          ...roundsGroupB.flatMap((r) => r.matches),
        ]
        : completedMatches;

    for (const m of matchesToProcess) {
      const isGroupB = tournamentFormat === "groups" && m.group === "B";
      const prefix = isGroupB ? "B_" : "A_";
      const res = matchResults[`${prefix}${m.globalId}`];
      if (!res || res.scoreA === "" || res.scoreB === "" || !m.teamB) continue;
      const sA = Number(res.scoreA);
      const sB = Number(res.scoreB);
      if (Number.isNaN(sA) || Number.isNaN(sB)) continue;

      const groupOffset = isGroupB ? Math.ceil(n / 2) : 0;
      const manA = groupOffset + m.teamA.man;
      const womanA = groupOffset + m.teamA.woman;
      const manB = groupOffset + m.teamB.man;
      const womanB = groupOffset + m.teamB.woman;

      gamesWonArr[manA] += sA;
      gamesWonArr[womanA] += sA;
      gamesWonArr[manB] += sB;
      gamesWonArr[womanB] += sB;
      gamesLostArr[manA] += sB;
      gamesLostArr[womanA] += sB;
      gamesLostArr[manB] += sA;
      gamesLostArr[womanB] += sA;

      diff[manA] += sA - sB;
      diff[womanA] += sA - sB;
      diff[manB] += sB - sA;
      diff[womanB] += sB - sA;
      if (sA > sB) {
        winsArr[manA]++;
        winsArr[womanA]++;
        lossesArr[manB]++;
        lossesArr[womanB]++;
      } else if (sB > sA) {
        winsArr[manB]++;
        winsArr[womanB]++;
        lossesArr[manA]++;
        lossesArr[womanA]++;
      }
    }
    setScoreDiff(diff);
    setWins(winsArr);
    setLosses(lossesArr);
    setGamesWon(gamesWonArr);
    setGamesLost(gamesLostArr);
  }

  function handleScoreChange(
    match: Match,
    teamKey: string,
    value: string,
    prefix = ""
  ) {
    const gid = `${prefix}${match.globalId}`;
    setMatchResults((prev) => {
      const copy = { ...prev };
      if (!copy[gid]) copy[gid] = { scoreA: "", scoreB: "" };
      copy[gid] = {
        ...copy[gid],
        [teamKey]: value === "" ? "" : Number(value),
      };
      return copy;
    });
  }

  function handleCoupleNameChange(
    index: number,
    kind: keyof Couple,
    value: string
  ) {
    setCouples((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [kind]: value };
      return copy;
    });
  }

  // ========== SISTEMA DE DESEMPATE SIMPLIFICADO ==========
  function calculateTiebreakers() {
    const coupleTotals = getCoupleTotals();

    // Ordenar por: 1. Vitórias → 2. Saldo → 3. Games Ganhos
    const sorted = [...coupleTotals].sort((a, b) => {
      // 1. Critério: Número de Vitórias (decrescente)
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }

      // 2. Critério: Saldo de Games (decrescente)
      if (b.saldo !== a.saldo) {
        return b.saldo - a.saldo;
      }

      // 3. Critério: Games Ganhos (decrescente)
      if (b.gamesWon !== a.gamesWon) {
        return b.gamesWon - a.gamesWon;
      }

      // Critério final: posição original (menor índice primeiro)
      return a.index - b.index;
    });

    return sorted;
  }

  function getCoupleTotals() {
    return couples.map((c, i) => {
      const saldo = scoreDiff[i] || 0;
      const v = wins[i] || 0;
      const d = losses[i] || 0;
      const totalGames = v + d;
      const aproveitamento =
        totalGames > 0 ? ((v / totalGames) * 100).toFixed(1) : "0.0";
      const gamesWonTotal = gamesWon[i] || 0;
      const gamesLostTotal = gamesLost[i] || 0;

      return {
        index: i,
        coupleName: `${c.manName} & ${c.womanName}`,
        wins: v,
        losses: d,
        saldo,
        aproveitamento,
        gamesWon: gamesWonTotal,
        gamesLost: gamesLostTotal,
        gamesBalance: gamesWonTotal - gamesLostTotal,
      };
    });
  }

  function handleGenerate() {
    if (tournamentFormat === "single") {
      setRoundsGroupA(generateSchedule(n));
      setRoundsGroupB([]);
    } else {
      const groupASize = Math.ceil(n / 2);
      const groupBSize = n - groupASize;
      setRoundsGroupA(generateSchedule(groupASize));
      setRoundsGroupB(groupBSize > 0 ? generateSchedule(groupBSize) : []);
    }
    setMatchResults({});
    setFinalMatch(null);
    setSemifinalMatches([]);
    setMatchQueue([]);
    setInProgressMatches({});
    setCompletedMatches([]);
    setViewMode("planning");
  }

  // ========== FUNÇÕES DE MODO OPERAÇÃO ==========
  function convertRoundsToQueue() {
    let allMatches: Match[] = [];
    roundsGroupA.forEach((rnd) => {
      rnd.matches.forEach((m) => allMatches.push({ ...m, group: "A" }));
    });
    if (tournamentFormat === "groups") {
      roundsGroupB.forEach((rnd) => {
        rnd.matches.forEach((m) => allMatches.push({ ...m, group: "B" }));
      });
    }
    return allMatches;
  }

  function handleStartOperationMode() {
    const queue = convertRoundsToQueue();
    const initialInProgress: Record<number, Match> = {};
    const remainingQueue = [...queue];

    for (let i = 1; i <= numCourts; i++) {
      if (remainingQueue.length > 0) {
        const nextMatch = remainingQueue.shift()!;
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

    const prefix =
      tournamentFormat === "groups" && finishedMatch.group === "B"
        ? "B_"
        : "A_";
    const result = matchResults[`${prefix}${finishedMatch.globalId}`];
    if (!result || result.scoreA === "" || result.scoreB === "") {
      alert("Por favor, preencha o placar antes de finalizar a partida.");
      return;
    }

    setCompletedMatches((prev) => [...prev, finishedMatch]);
    const newInProgress = { ...inProgressMatches };
    const newQueue = [...matchQueue];

    if (newQueue.length > 0) {
      const nextMatch = newQueue.shift()!;
      newInProgress[courtNumber] = { ...nextMatch, court: courtNumber };
    } else {
      delete newInProgress[courtNumber];
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

    const prefix =
      tournamentFormat === "groups" && match.group === "B" ? "B_" : "A_";
    setMatchResults((prev) => ({
      ...prev,
      [`${prefix}${globalId}`]: {
        scoreA: Number(scoreA),
        scoreB: Number(scoreB),
      },
    }));
    setEditingCompletedMatch(null);
  }

  // ========== FUNÇÕES DE EXPORTAÇÃO ==========
  function getTotalMatchCount() {
    let total = 0;
    for (const rnd of roundsGroupA) total += rnd.matches.length;
    for (const rnd of roundsGroupB) total += rnd.matches.length;
    if (semifinalMatches.length > 0) total += semifinalMatches.length;
    if (finalMatch) total += 1;
    return total;
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

  function getMatchesPerPlayer() {
    const matchesPerMan = Array(n).fill(0);
    const matchesPerWoman = Array(n).fill(0);

    const allMatches =
      viewMode === "planning"
        ? [
          ...roundsGroupA.flatMap((r) => r.matches),
          ...roundsGroupB.flatMap((r) => r.matches),
        ]
        : [
          ...completedMatches,
          ...Object.values(inProgressMatches),
          ...matchQueue,
        ];

    for (const m of allMatches) {
      const offset =
        tournamentFormat === "groups" && m.group === "B" ? Math.ceil(n / 2) : 0;
      matchesPerMan[offset + m.teamA.man]++;
      matchesPerWoman[offset + m.teamA.woman]++;
      if (m.teamB) {
        matchesPerMan[offset + m.teamB.man]++;
        matchesPerWoman[offset + m.teamB.woman]++;
      }
    }

    for (const semi of semifinalMatches) {
      matchesPerMan[semi.coupleA]++;
      matchesPerWoman[semi.coupleA]++;
      matchesPerMan[semi.coupleB]++;
      matchesPerWoman[semi.coupleB]++;
    }
    if (finalMatch) {
      matchesPerMan[finalMatch.coupleA]++;
      matchesPerWoman[finalMatch.coupleA]++;
      matchesPerMan[finalMatch.coupleB]++;
      matchesPerWoman[finalMatch.coupleB]++;
    }

    return { matchesPerMan, matchesPerWoman };
  }

  function champion() {
    if (!finalMatch) return null;
    if (finalMatch.scoreA === "" || finalMatch.scoreB === "") return null;
    if (finalMatch.scoreA > finalMatch.scoreB)
      return couples[finalMatch.coupleA];
    if (finalMatch.scoreB > finalMatch.scoreA)
      return couples[finalMatch.coupleB];
    return { manName: "Empate", womanName: "(sem desempate)" };
  }

  function handlePrint() {
    const { hours, minutes, totalMatches, label } = getDurationEstimate();
    const { matchesPerMan, matchesPerWoman } = getMatchesPerPlayer();

    const renderRounds = (
      rounds: Round[],
      prefix: string,
      offset: number = 0
    ) => {
      return rounds
        .map(
          (rnd) => `
        <div style="margin-bottom: 15px;">
          <h4 style="margin-bottom: 8px; color: #333;">${prefix} - Rodada ${rnd.round
            }</h4>
          <table border="1" cellpadding="6" style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th>Quadra</th>
                <th>Dupla A</th>
                <th>Dupla B</th>
                <th>Placar</th>
              </tr>
            </thead>
            <tbody>
              ${rnd.matches
              .map((m) => {
                const scoreA =
                  matchResults[`${prefix.charAt(0)}_${m.globalId}`]?.scoreA ||
                  "";
                const scoreB =
                  matchResults[`${prefix.charAt(0)}_${m.globalId}`]?.scoreB ||
                  "";
                const manA = couples[offset + m.teamA.man]?.manName || "";
                const womanA =
                  couples[offset + m.teamA.woman]?.womanName || "";
                const manB = m.teamB
                  ? couples[offset + m.teamB.man]?.manName || ""
                  : "";
                const womanB = m.teamB
                  ? couples[offset + m.teamB.woman]?.womanName || ""
                  : "";
                return `
                  <tr>
                    <td style="text-align: center;">${m.court}</td>
                    <td>${manA} + ${womanA}</td>
                    <td>${m.teamB ? `${manB} + ${womanB}` : "(BYE)"}</td>
                    <td style="text-align: center;">${scoreA}:${scoreB}</td>
                  </tr>
                `;
              })
              .join("")}
            </tbody>
          </table>
        </div>
      `
        )
        .join("");
    };

    const printContent = `
      <html>
        <head>
          <title>Relatório Completo - ${tournamentName}</title>
          <style>
            body { 
              font-family: 'Century Gothic', 'Arial Narrow', Arial, sans-serif; 
              padding: 20px; 
              max-width: 1200px; 
              margin: 0 auto; 
            }
            h1, h2, h3, h4 { color: #FB0395; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f8f8f8; }
            .section { margin-bottom: 30px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { height: 80px; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="https://i.imgur.com/sQWqNap.png" alt="Wall BT" class="logo">
            <h1>${tournamentName}</h1>
          </div>
          <!-- CONFIGURAÇÕES -->
          <div class="section">
            <h2>⚙️ Configurações do Torneio</h2>
            <table>
              <tr><td><strong>Formato</strong></td><td>${tournamentFormat === "single" ? "Único" : "Grupos"
      }</td></tr>
              <tr><td><strong>Número de Casais</strong></td><td>${n}</td></tr>
              <tr><td><strong>Formato das Partidas</strong></td><td>${label}</td></tr>
              <tr><td><strong>Número de Quadras</strong></td><td>${numCourts}</td></tr>
              <tr><td><strong>Estimativa de Tempo</strong></td><td>${hours}h${minutes}min (${totalMatches} partidas)</td></tr>
              <tr><td><strong>Partidas por Jogador</strong></td><td>
                ${(() => {
        const maxMan = Math.max(...matchesPerMan);
        const maxWoman = Math.max(...matchesPerWoman);
        const minMan = Math.min(...matchesPerMan);
        const minWoman = Math.min(...matchesPerWoman);
        if (maxMan === minMan && maxWoman === minWoman) {
          return `${maxMan} partidas (todos os jogadores)`;
        } else {
          return `Homens: ${minMan}–${maxMan} | Mulheres: ${minWoman}–${maxWoman}`;
        }
      })()}
              </td></tr>
            </table>
          </div>
          <!-- CASAIS -->
          <div class="section">
            <h2>👥 Casais</h2>
            <table>
              <thead>
                <tr><th>#</th><th>Homem</th><th>Mulher</th></tr>
              </thead>
              <tbody>
                ${couples
        .map(
          (c, i) => `
                  <tr><td>${i + 1}</td><td>${c.manName}</td><td>${c.womanName
            }</td></tr>
                `
        )
        .join("")}
              </tbody>
            </table>
          </div>
          <!-- PARTIDAS -->
          <div class="section">
            <h2>🎾 Partidas</h2>
            ${tournamentFormat === "single"
        ? renderRounds(roundsGroupA, "Grupo Único")
        : `${renderRounds(roundsGroupA, "Grupo A")} ${renderRounds(
          roundsGroupB,
          "Grupo B",
          Math.ceil(n / 2)
        )}`
      }
          </div>
          <!-- CLASSIFICAÇÃO -->
          <div class="section">
            <h2>📊 Classificação Final</h2>
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Casal</th>
                  <th>Vitórias</th>
                  <th>Derrotas</th>
                  <th>Saldo</th>
                  <th>Jogos</th>
                  <th>Aproveitamento</th>
                </tr>
              </thead>
              <tbody>
                ${calculateTiebreakers()
        .map(
          (c, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${c.coupleName}</td>
                      <td>${c.wins}</td>
                      <td>${c.losses}</td>
                      <td>${c.saldo}</td>
                      <td>${c.gamesWon}-${c.gamesLost}</td>
                      <td>${c.aproveitamento}%</td>
                    </tr>
                  `
        )
        .join("")}
              </tbody>
            </table>
          </div>
          <!-- CAMPEÃO -->
          ${champion()
        ? `
            <div class="section">
              <h2>🏆 Campeão</h2>
              <p style="font-size: 24px; font-weight: bold; color: #FB0395;">
                ${champion()!.manName} & ${champion()!.womanName}
              </p>
            </div>
          `
        : ""
      }
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  }

  function handleExportCSV() {
    const { hours, minutes, totalMatches, label } = getDurationEstimate();
    const { matchesPerMan, matchesPerWoman } = getMatchesPerPlayer();
    const escapeCsv = (str: string) => `"${String(str).replace(/"/g, '""')}"`;

    let csvContent = "=== CONFIGURAÇÃO ===\n";
    csvContent += "Campo,Valor\n";
    csvContent += `Nome do Torneio,${escapeCsv(tournamentName)}\n`;
    csvContent += `Formato,${tournamentFormat === "single" ? "Único" : "Grupos"
      }\n`;
    csvContent += `Número de Casais,${n}\n`;
    csvContent += `Formato das Partidas,${escapeCsv(label)}\n`;
    csvContent += `Número de Quadras,${numCourts}\n`;
    csvContent += `Estimativa de Tempo,${hours}h${minutes}min\n`;
    csvContent += `Total de Partidas,${totalMatches}\n`;

    const partidasStr = (() => {
      const maxMan = Math.max(...matchesPerMan);
      const maxWoman = Math.max(...matchesPerWoman);
      const minMan = Math.min(...matchesPerMan);
      const minWoman = Math.min(...matchesPerWoman);
      if (maxMan === minMan && maxWoman === minWoman) {
        return `${maxMan} partidas (todos os jogadores)`;
      } else {
        return `Homens: ${minMan}–${maxMan} | Mulheres: ${minWoman}–${maxWoman}`;
      }
    })();
    csvContent += `Partidas por Jogador,${partidasStr}\n\n`;

    csvContent += "=== CASAIS ===\n";
    csvContent += "ID,Homem,Mulher\n";
    couples.forEach((c, i) => {
      csvContent += `${i + 1},${escapeCsv(c.manName)},${escapeCsv(
        c.womanName
      )}\n`;
    });
    csvContent += "\n";

    csvContent += "=== PARTIDAS ===\n";
    csvContent +=
      "Grupo,Rodada,Quadra,Dupla A (Homem),Dupla A (Mulher),Dupla B (Homem),Dupla B (Mulher),Placar A,Placar B\n";

    const addMatches = (rounds: Round[], group: string, offset: number = 0) => {
      rounds.forEach((rnd) => {
        rnd.matches.forEach((m) => {
          const manA = couples[offset + m.teamA.man]?.manName || "";
          const womanA = couples[offset + m.teamA.woman]?.womanName || "";
          const manB = m.teamB
            ? couples[offset + m.teamB.man]?.manName || ""
            : "";
          const womanB = m.teamB
            ? couples[offset + m.teamB.woman]?.womanName || ""
            : "";
          const scoreA =
            matchResults[`${group.charAt(0)}_${m.globalId}`]?.scoreA || "";
          const scoreB =
            matchResults[`${group.charAt(0)}_${m.globalId}`]?.scoreB || "";
          csvContent += `${escapeCsv(group)},${rnd.round},${m.court
            },${escapeCsv(manA)},${escapeCsv(womanA)},${escapeCsv(
              manB
            )},${escapeCsv(womanB)},${scoreA},${scoreB}\n`;
        });
      });
    };

    if (tournamentFormat === "single") {
      addMatches(roundsGroupA, "Único");
    } else {
      addMatches(roundsGroupA, "A");
      addMatches(roundsGroupB, "B", Math.ceil(n / 2));
    }
    csvContent += "\n";

    csvContent += "=== CLASSIFICAÇÃO ===\n";
    csvContent +=
      "Posição,Casal,Vitórias,Derrotas,Saldo de Games,Jogos (Ganhos-Perdedos),Aproveitamento (%)\n";
    calculateTiebreakers().forEach((c, idx) => {
      csvContent += `${idx + 1},${escapeCsv(c.coupleName)},${c.wins},${c.losses
        },${c.saldo},${c.gamesWon}-${c.gamesLost},${c.aproveitamento}\n`;
    });
    csvContent += "\n";

    csvContent += "=== RESUMO EXECUTIVO ===\n";
    csvContent += "Item,Valor\n";
    csvContent += `Campeão,${champion()
      ? `${escapeCsv(champion()!.manName)} & ${escapeCsv(
        champion()!.womanName
      )}`
      : "Não definido"
      }\n`;
    csvContent += `Total de Casais,${n}\n`;
    csvContent += `Total de Partidas,${totalMatches}\n`;
    csvContent += `Tempo Estimado,${hours}h${minutes}min\n`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tournamentName.replace(
      /\s+/g,
      "_"
    )}_Relatorio_Completo.csv`;
    link.click();
  }

  // ========== FUNÇÕES DE ELIMINATÓRIAS ==========
  function handleCreateFinalOrSemifinal() {
    if (tournamentFormat === "single") {
      const top = calculateTiebreakers().slice(0, 2);
      if (top.length < 2) return;
      setFinalMatch({
        coupleA: top[0].index,
        coupleB: top[1].index,
        scoreA: "",
        scoreB: "",
      });
    } else {
      const groupASize = Math.ceil(n / 2);
      const groupBSize = n - groupASize;
      const totalsA = calculateTiebreakers().slice(0, groupASize);
      const totalsB = calculateTiebreakers().slice(groupASize);
      const sortedA = [...totalsA].sort(
        (a, b) =>
          b.wins - a.wins || b.saldo - a.saldo || b.gamesWon - a.gamesWon
      );
      const sortedB = [...totalsB].sort(
        (a, b) =>
          b.wins - a.wins || b.saldo - a.saldo || b.gamesWon - a.gamesWon
      );
      if (sortedA.length < 2 || sortedB.length < 2) return;
      setSemifinalMatches([
        {
          id: "semi1",
          coupleA: sortedA[0].index,
          coupleB: sortedB[1].index,
          scoreA: "",
          scoreB: "",
        },
        {
          id: "semi2",
          coupleA: sortedA[1].index,
          coupleB: sortedB[0].index,
          scoreA: "",
          scoreB: "",
        },
      ]);
    }
  }

  function handleSemifinalScoreChange(
    semiId: string,
    key: string,
    value: string
  ) {
    setSemifinalMatches((prev) =>
      prev.map((semi) =>
        semi.id === semiId
          ? { ...semi, [key]: value === "" ? "" : Number(value) }
          : semi
      )
    );
  }

  function generateFinalFromSemifinals() {
    const semi1 = semifinalMatches.find((s) => s.id === "semi1");
    const semi2 = semifinalMatches.find((s) => s.id === "semi2");
    if (
      !semi1 ||
      !semi2 ||
      semi1.scoreA === "" ||
      semi1.scoreB === "" ||
      semi2.scoreA === "" ||
      semi2.scoreB === ""
    )
      return;
    const winner1 = semi1.scoreA > semi1.scoreB ? semi1.coupleA : semi1.coupleB;
    const winner2 = semi2.scoreA > semi2.scoreB ? semi2.coupleA : semi2.coupleB;
    setFinalMatch({
      coupleA: winner1,
      coupleB: winner2,
      scoreA: "",
      scoreB: "",
    });
  }

  function handleFinalScoreChange(key: string, value: string) {
    setFinalMatch((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: value === "" ? "" : Number(value),
      };
    });
  }

  // ========== FUNÇÕES DO MODO APRESENTAÇÃO ==========
  function getNextMatches(count: number = 8): Match[] {
    const allMatches = convertRoundsToQueue();
    const inProgressArray = Object.values(inProgressMatches);
    const upcomingMatches = [...inProgressArray, ...matchQueue];
    return upcomingMatches.slice(0, count);
  }

  function getRecentResults(count: number = 6): Match[] {
    return completedMatches.slice(-count).reverse();
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

    const updateRounds = (rounds: Round[]) => {
      return rounds
        .map((r) => ({
          ...r,
          matches: r.matches.filter(
            (m) => m.globalId !== reschedulingMatch.globalId
          ),
        }))
        .filter((r) => r.matches.length > 0);
    };

    let updatedRoundsGroupA = [...roundsGroupA];
    let updatedRoundsGroupB = [...roundsGroupB];

    if (reschedulingMatch.group === "A" || tournamentFormat === "single") {
      updatedRoundsGroupA = updateRounds(roundsGroupA);
    } else if (reschedulingMatch.group === "B") {
      updatedRoundsGroupB = updateRounds(roundsGroupB);
    }

    const newMatch = {
      ...reschedulingMatch,
      round: targetRound,
      court: targetCourt,
      scheduledTime: new Date().toISOString(),
    };

    if (reschedulingMatch.group === "A" || tournamentFormat === "single") {
      let targetRoundIndex = updatedRoundsGroupA.findIndex(
        (r) => r.round === targetRound
      );
      if (targetRoundIndex === -1) {
        updatedRoundsGroupA.push({ round: targetRound, matches: [newMatch] });
      } else {
        updatedRoundsGroupA[targetRoundIndex].matches.push(newMatch);
        updatedRoundsGroupA[targetRoundIndex].matches = assignCourtsToMatches(
          updatedRoundsGroupA[targetRoundIndex].matches,
          numCourts
        );
      }
    } else {
      let targetRoundIndex = updatedRoundsGroupB.findIndex(
        (r) => r.round === targetRound
      );
      if (targetRoundIndex === -1) {
        updatedRoundsGroupB.push({ round: targetRound, matches: [newMatch] });
      } else {
        updatedRoundsGroupB[targetRoundIndex].matches.push(newMatch);
        updatedRoundsGroupB[targetRoundIndex].matches = assignCourtsToMatches(
          updatedRoundsGroupB[targetRoundIndex].matches,
          numCourts
        );
      }
    }

    setRoundsGroupA(updatedRoundsGroupA);
    setRoundsGroupB(updatedRoundsGroupB);
    cancelRescheduling();
  }

  // ========== CONSTANTES E RENDERIZAÇÃO ==========
  const courtColors: CourtColor[] = [
    { bg: "#A0F0FF", border: "#70D0E0", text: "#000" },
    { bg: "#F8A0D0", border: "#E070B0", text: "#000" },
    { bg: "#FFD9A0", border: "#E0B070", text: "#000" },
    { bg: "#D1C0FF", border: "#A080E0", text: "#000" },
    { bg: "#A0F0C0", border: "#70D0A0", text: "#000" },
    { bg: "#FFCBA0", border: "#E0A070", text: "#000" },
  ];

  const sortedCouples = calculateTiebreakers();
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
                        <th className="text-left pb-3 text-gray-300">Casal</th>
                        <th className="text-center pb-3 text-gray-300">V</th>
                        <th className="text-center pb-3 text-gray-300">D</th>
                        <th className="text-center pb-3 text-gray-300">
                          Saldo
                        </th>
                        <th className="text-center pb-3 text-gray-300">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCouples.slice(0, 8).map((c, idx) => (
                        <tr
                          key={c.index}
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
                            {c.coupleName}
                          </td>
                          <td className="text-center py-4 text-green-400 text-xl font-bold">
                            {c.wins}
                          </td>
                          <td className="text-center py-4 text-red-400">
                            {c.losses}
                          </td>
                          <td className="text-center py-4 text-white">
                            {c.saldo > 0 ? `+${c.saldo}` : c.saldo}
                          </td>
                          <td className="text-center py-4 text-white">
                            {c.aproveitamento}%
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
                    {nextMatches.slice(0, 4).map((match, index) => {
                      const groupOffset =
                        tournamentFormat === "groups" && match.group === "B"
                          ? Math.ceil(n / 2)
                          : 0;
                      return (
                        <div
                          key={match.globalId}
                          className="bg-gray-800 rounded-lg p-3 border-l-4 border-[#FB0395]"
                        >
                          <div className="font-semibold text-sm mb-1 text-gray-300">
                            Quadra {match.court}
                          </div>
                          <div className="text-sm text-white">
                            {`${couples[groupOffset + match.teamA.man].manName
                              }+${couples[groupOffset + match.teamA.woman].womanName
                              }`}
                            <span className="mx-2 opacity-60">vs</span>
                            {`${couples[groupOffset + match.teamB!.man].manName
                              }+${couples[groupOffset + match.teamB!.woman]
                                .womanName
                              }`}
                          </div>
                        </div>
                      );
                    })}
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
                      const groupOffset =
                        tournamentFormat === "groups" && match.group === "B"
                          ? Math.ceil(n / 2)
                          : 0;
                      const prefix =
                        tournamentFormat === "groups" && match.group === "B"
                          ? "B_"
                          : "A_";
                      const result = matchResults[`${prefix}${match.globalId}`];
                      return (
                        <div
                          key={match.globalId}
                          className="bg-gray-800 rounded-lg p-3"
                        >
                          <div className="flex justify-between items-center text-sm">
                            <div className="flex-1 text-right text-white">
                              {`${couples[groupOffset + match.teamA.man].manName
                                }+${couples[groupOffset + match.teamA.woman]
                                  .womanName
                                }`}
                            </div>
                            <div className="mx-3 font-bold text-lg text-white">
                              {result
                                ? `${result.scoreA} - ${result.scoreB}`
                                : " - "}
                            </div>
                            <div className="flex-1 text-left text-white">
                              {`${couples[groupOffset + match.teamB!.man].manName
                                }+${couples[groupOffset + match.teamB!.woman]
                                  .womanName
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
          /* VISÃO PARTIDAS - APENAS PRÓXIMAS PARTIDAS E ÚLTIMOS RESULTADOS */
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
                    const groupOffset =
                      tournamentFormat === "groups" && match.group === "B"
                        ? Math.ceil(n / 2)
                        : 0;
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
                            {`${couples[groupOffset + match.teamA.man].manName
                              } + ${couples[groupOffset + match.teamA.woman].womanName
                              }`}
                          </div>
                          <div className="opacity-60 text-lg mb-2 text-gray-400">
                            vs
                          </div>
                          <div className="font-semibold text-lg text-white">
                            {`${couples[groupOffset + match.teamB!.man].manName
                              } + ${couples[groupOffset + match.teamB!.woman]
                                .womanName
                              }`}
                          </div>
                        </div>
                        <div className="text-center mt-3">
                          <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">
                            Rodada {match.round}
                          </span>
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
                      <div className="text-sm mt-2 text-gray-500">
                        Todas as partidas foram concluídas
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
                    const groupOffset =
                      tournamentFormat === "groups" && match.group === "B"
                        ? Math.ceil(n / 2)
                        : 0;
                    const prefix =
                      tournamentFormat === "groups" && match.group === "B"
                        ? "B_"
                        : "A_";
                    const result = matchResults[`${prefix}${match.globalId}`];
                    return (
                      <div
                        key={match.globalId}
                        className="bg-gray-800 rounded-xl p-4"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-lg text-sm font-bold">
                            Quadra {match.court}
                          </span>
                          <span className="bg-[#FB0395] text-white px-2 py-1 rounded text-xs">
                            Rodada {match.round}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-center flex-1">
                            <div className="font-semibold text-sm mb-1 text-white">
                              {`${couples[groupOffset + match.teamA.man].manName
                                } + ${couples[groupOffset + match.teamA.woman]
                                  .womanName
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
                              {`${couples[groupOffset + match.teamB!.man].manName
                                } + ${couples[groupOffset + match.teamB!.woman]
                                  .womanName
                                }`}
                            </div>
                          </div>
                        </div>
                        {result && (
                          <div className="text-center mt-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${Number(result.scoreA) > Number(result.scoreB)
                                ? "bg-green-900 text-green-300"
                                : "bg-red-900 text-red-300"
                                }`}
                            >
                              {Number(result.scoreA) > Number(result.scoreB)
                                ? `Vitória de ${couples[groupOffset + match.teamA.man]
                                  .manName
                                } + ${couples[groupOffset + match.teamA.woman]
                                  .womanName
                                }`
                                : `Vitória de ${couples[groupOffset + match.teamB!.man]
                                  .manName
                                } + ${couples[groupOffset + match.teamB!.woman]
                                  .womanName
                                }`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {recentResults.length === 0 && (
                    <div className="text-center py-12 opacity-60">
                      <div className="text-6xl mb-4 text-gray-500">📊</div>
                      <div className="text-xl text-gray-400">
                        Nenhum resultado disponível
                      </div>
                      <div className="text-sm mt-2 text-gray-500">
                        Os resultados aparecerão aqui
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
                {sortedCouples.slice(0, 3).map((c, idx) => (
                  <div
                    key={c.index}
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
                      {c.coupleName}
                    </div>
                    <div className="text-4xl font-bold mb-2 text-white">
                      {c.wins} V
                    </div>
                    <div className="text-lg opacity-80 mb-3 text-gray-300">
                      {c.wins}V - {c.losses}D • {c.aproveitamento}%
                    </div>
                    <div className="text-sm bg-black/40 rounded-lg p-2 text-white">
                      Saldo: {c.saldo > 0 ? `+${c.saldo}` : c.saldo}
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
              <label className="block mb-2">Formato do Torneio:</label>
              <div className="flex gap-2">
                <label>
                  <input
                    type="radio"
                    name="format"
                    value="single"
                    checked={tournamentFormat === "single"}
                    onChange={() => handleFormatChange("single")}
                    className="mr-1"
                  />
                  Único (4–16)
                </label>
                <label>
                  <input
                    type="radio"
                    name="format"
                    value="groups"
                    checked={tournamentFormat === "groups"}
                    onChange={() => handleFormatChange("groups")}
                    className="mr-1"
                  />
                  Grupos (4–16)
                </label>
              </div>
            </div>
            <div>
              <label className="block mb-2">Número de Casais:</label>
              <select
                className="border px-2 py-1 rounded w-full"
                value={n}
                onChange={(e) => handleCoupleCountChange(Number(e.target.value))}
              >
                {Array.from({ length: 13 }, (_, i) => i + 4).map((x) => (
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
                min="1"
                max="6"
                className="border px-2 py-1 rounded w-full"
                value={numCourts}
                onChange={(e) => setNumCourts(Number(e.target.value) || 1)}
              />
            </div>
            <div>
              <button
                className="mt-6 px-3 py-1 rounded transition w-full font-bold"
                style={{ backgroundColor: "#00F1FD", color: "black" }}
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
              <strong>Partidas por jogador:</strong>
              {(() => {
                const { matchesPerMan, matchesPerWoman } =
                  getMatchesPerPlayer();
                const maxMan = Math.max(...matchesPerMan);
                const maxWoman = Math.max(...matchesPerWoman);
                const minMan = Math.min(...matchesPerMan);
                const minWoman = Math.min(...matchesPerWoman);
                if (maxMan === minMan && maxWoman === minWoman) {
                  return `${maxMan} partidas (todos os jogadores)`;
                } else {
                  return `Homens: ${minMan}–${maxMan} | Mulheres: ${minWoman}–${maxWoman}`;
                }
              })()}
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
              disabled={roundsGroupA.length === 0}
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
      {reschedulingMatch && viewMode !== "presentation" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4">
            <h2 className="text-xl font-bold mb-4">🔄 Reagendar Partida</h2>
            <div className="mb-4">
              <p>Partida selecionada:</p>
              <p className="font-semibold">
                {couples[reschedulingMatch.teamA.man].manName}+
                {couples[reschedulingMatch.teamA.woman].womanName}
                vs
                {reschedulingMatch.teamB
                  ? ` ${couples[reschedulingMatch.teamB.man].manName}+${couples[reschedulingMatch.teamB.woman].womanName
                  }`
                  : " (BYE)"}
              </p>
            </div>

            <div className="mb-4">
              <label className="block mb-2">
                Selecione nova rodada e quadra:
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {[...roundsGroupA, ...roundsGroupB].map((round) =>
                  Array.from({ length: numCourts }, (_, i) => i + 1).map(
                    (court) => (
                      <button
                        key={`${round.round}-${court}`}
                        className={`p-2 border rounded text-sm ${rescheduleTarget?.round === round.round &&
                          rescheduleTarget?.court === court
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100"
                          }`}
                        onClick={() =>
                          setRescheduleDestination(round.round, court)
                        }
                      >
                        Rodada {round.round} - Quadra {court}
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
            <h2 className="text-lg font-semibold mb-2">Casais</h2>
            {couples.map((c, i) => (
              <div key={i} className="flex gap-2 items-center mb-1">
                <input
                  className="border px-2 py-1 rounded w-20"
                  value={c.manName}
                  onChange={(e) =>
                    handleCoupleNameChange(i, "manName", e.target.value)
                  }
                />
                <span>&</span>
                <input
                  className="border px-2 py-1 rounded w-20"
                  value={c.womanName}
                  onChange={(e) =>
                    handleCoupleNameChange(i, "womanName", e.target.value)
                  }
                />
              </div>
            ))}
          </div>

          <div className="bg-white rounded p-4 shadow">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">Classificação</h2>
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

            {/* LEGENDA DE DESEMPATE */}
            <div className="mb-3 p-2 bg-yellow-50 rounded text-xs">
              <strong>Critérios de Desempate:</strong> 1. Vitórias → 2. Saldo de
              Games → 3. Games Ganhos
            </div>

            {tournamentFormat === "single" ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th>Pos</th>
                    <th>Casal</th>
                    <th>V</th>
                    <th>D</th>
                    <th>Saldo</th>
                    <th>Jogos</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCouples.map((c, idx) => (
                    <tr key={c.index} className="border-t">
                      <td>{idx + 1}</td>
                      <td>{c.coupleName}</td>
                      <td>{c.wins}</td>
                      <td>{c.losses}</td>
                      <td>{c.saldo}</td>
                      <td>
                        {c.gamesWon}-{c.gamesLost}
                      </td>
                      <td>{c.aproveitamento}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h3
                    className="font-bold text-center mb-2"
                    style={{ color: "#007BFF" }}
                  >
                    Grupo A
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left bg-blue-100">
                        <th>Pos</th>
                        <th>Casal</th>
                        <th>V</th>
                        <th>D</th>
                        <th>Saldo</th>
                        <th>Jogos</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const groupASize = Math.ceil(n / 2);
                        const groupATotals = calculateTiebreakers().slice(
                          0,
                          groupASize
                        );
                        return groupATotals.map((c, idx) => (
                          <tr key={c.index} className="border-t">
                            <td>{idx + 1}</td>
                            <td>{c.coupleName}</td>
                            <td>{c.wins}</td>
                            <td>{c.losses}</td>
                            <td>{c.saldo}</td>
                            <td>
                              {c.gamesWon}-{c.gamesLost}
                            </td>
                            <td>{c.aproveitamento}%</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                <div className="bg-pink-50 p-3 rounded-lg">
                  <h3
                    className="font-bold text-center mb-2"
                    style={{ color: "#FB0395" }}
                  >
                    Grupo B
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left bg-pink-100">
                        <th>Pos</th>
                        <th>Casal</th>
                        <th>V</th>
                        <th>D</th>
                        <th>Saldo</th>
                        <th>Jogos</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const groupASize = Math.ceil(n / 2);
                        const groupBTotals =
                          calculateTiebreakers().slice(groupASize);
                        return groupBTotals.map((c, idx) => (
                          <tr key={c.index} className="border-t">
                            <td>{idx + 1}</td>
                            <td>{c.coupleName}</td>
                            <td>{c.wins}</td>
                            <td>{c.losses}</td>
                            <td>{c.saldo}</td>
                            <td>
                              {c.gamesWon}-{c.gamesLost}
                            </td>
                            <td>{c.aproveitamento}%</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button
              className="mt-2 px-3 py-1 rounded transition"
              style={{
                backgroundColor: "#00F1FD",
                color: "black",
                fontWeight: "bold",
              }}
              onClick={handleCreateFinalOrSemifinal}
            >
              {tournamentFormat === "groups"
                ? "Criar Semifinais"
                : "Criar Final"}
            </button>
            {tournamentFormat === "groups" && semifinalMatches.length > 0 && (
              <button
                className="mt-2 ml-2 px-3 py-1 rounded transition"
                style={{
                  backgroundColor: "#FB0395",
                  color: "white",
                  fontWeight: "bold",
                }}
                onClick={generateFinalFromSemifinals}
              >
                Gerar Final
              </button>
            )}
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
              Object.values(inProgressMatches).map((match) => {
                const groupOffset =
                  tournamentFormat === "groups" && match.group === "B"
                    ? Math.ceil(n / 2)
                    : 0;
                const prefix =
                  tournamentFormat === "groups" && match.group === "B"
                    ? "B_"
                    : "A_";
                return (
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
                      {`${couples[groupOffset + match.teamA.man].manName}+${couples[groupOffset + match.teamA.woman].womanName
                        }`}
                      <span className="font-normal mx-1"> vs </span>
                      {`${couples[groupOffset + match.teamB!.man].manName}+${couples[groupOffset + match.teamB!.woman].womanName
                        }`}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        className="w-16 border px-2 py-1 rounded bg-white"
                        placeholder="A"
                        value={
                          matchResults[`${prefix}${match.globalId}`]?.scoreA ??
                          ""
                        }
                        onChange={(e) =>
                          handleScoreChange(
                            match,
                            "scoreA",
                            e.target.value,
                            prefix
                          )
                        }
                      />
                      <span>:</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        className="w-16 border px-2 py-1 rounded bg-white"
                        placeholder="B"
                        value={
                          matchResults[`${prefix}${match.globalId}`]?.scoreB ??
                          ""
                        }
                        onChange={(e) =>
                          handleScoreChange(
                            match,
                            "scoreB",
                            e.target.value,
                            prefix
                          )
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
                );
              })
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
                  {matchQueue.slice(0, 5).map((match, index) => {
                    const groupOffset =
                      tournamentFormat === "groups" && match.group === "B"
                        ? Math.ceil(n / 2)
                        : 0;
                    return (
                      <li
                        key={match.globalId}
                        className="text-sm p-2 bg-gray-50 rounded"
                      >
                        <span className="font-bold mr-2">{index + 1}º:</span>
                        {`${couples[groupOffset + match.teamA.man].manName}+${couples[groupOffset + match.teamA.woman].womanName
                          }`}
                        <span className="font-normal mx-1"> vs </span>
                        {`${couples[groupOffset + match.teamB!.man].manName}+${couples[groupOffset + match.teamB!.woman].womanName
                          }`}
                      </li>
                    );
                  })}
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
                      const groupOffset =
                        tournamentFormat === "groups" && match.group === "B"
                          ? Math.ceil(n / 2)
                          : 0;
                      const prefix =
                        tournamentFormat === "groups" && match.group === "B"
                          ? "B_"
                          : "A_";
                      const result = matchResults[`${prefix}${match.globalId}`];
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
                            {`${couples[groupOffset + match.teamA.man].manName
                              }+${couples[groupOffset + match.teamA.woman].womanName
                              }`}
                            <span className="font-normal mx-1"> vs </span>
                            {`${couples[groupOffset + match.teamB!.man].manName
                              }+${couples[groupOffset + match.teamB!.woman]
                                .womanName
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
                  <th>Casal</th>
                  <th>V</th>
                  <th>D</th>
                  <th>Saldo</th>
                  <th>Jogos</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {sortedCouples.map((c, idx) => (
                  <tr key={c.index} className="border-t">
                    <td>{idx + 1}</td>
                    <td>{c.coupleName}</td>
                    <td>{c.wins}</td>
                    <td>{c.losses}</td>
                    <td>{c.saldo}</td>
                    <td>
                      {c.gamesWon}-{c.gamesLost}
                    </td>
                    <td>{c.aproveitamento}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RODADAS (APENAS NO MODO PLANEJAMENTO) */}
      {viewMode === "planning" && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Grupo A */}
          <div className="bg-white rounded p-4 shadow">
            <h2 className="text-lg font-semibold mb-3">Grupo A</h2>
            {tournamentFormat === "groups" && roundsGroupA.length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <h3 className="font-semibold mb-2">Legenda de Quadras:</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: Math.min(numCourts, 6) }).map(
                    (_, i) => (
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
                    )
                  )}
                </div>
              </div>
            )}
            {roundsGroupA.map((rnd) => (
              <div key={rnd.round} className="border rounded p-3 mb-3">
                <div className="font-semibold mb-2">Rodada {rnd.round}</div>
                {rnd.matches.map((m) => (
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
                          courtColors[(m.court! - 1) % courtColors.length]
                            .border,
                        color:
                          courtColors[(m.court! - 1) % courtColors.length].text,
                      }}
                    >
                      {m.court}
                    </div>
                    <div className="flex-1 text-sm">
                      {`${couples[m.teamA.man].manName}+${couples[m.teamA.woman].womanName
                        }`}
                      {m.teamB
                        ? ` vs ${couples[m.teamB.man].manName}+${couples[m.teamB.woman].womanName
                        }`
                        : "(BYE)"}
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="20"
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
                      min="0"
                      max="20"
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

          {/* Grupo B */}
          {tournamentFormat === "groups" && roundsGroupB.length > 0 && (
            <div className="bg-white rounded p-4 shadow">
              <h2 className="text-lg font-semibold mb-3">Grupo B</h2>
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <h3 className="font-semibold mb-2">Legenda de Quadras:</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: Math.min(numCourts, 6) }).map(
                    (_, i) => (
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
                    )
                  )}
                </div>
              </div>
              {roundsGroupB.map((rnd) => {
                const offset = Math.ceil(n / 2);
                return (
                  <div key={rnd.round} className="border rounded p-3 mb-3">
                    <div className="font-semibold mb-2">Rodada {rnd.round}</div>
                    {rnd.matches.map((m) => (
                      <div
                        key={m.globalId}
                        className="flex items-center gap-2 mb-1 p-2 rounded group relative"
                        style={{
                          backgroundColor:
                            courtColors[(m.court! - 1) % courtColors.length].bg,
                          borderColor:
                            courtColors[(m.court! - 1) % courtColors.length]
                              .border,
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
                              courtColors[(m.court! - 1) % courtColors.length]
                                .border,
                            color:
                              courtColors[(m.court! - 1) % courtColors.length]
                                .text,
                          }}
                        >
                          {m.court}
                        </div>
                        <div className="flex-1 text-sm">
                          {`${couples[offset + m.teamA.man].manName}+${couples[offset + m.teamA.woman].womanName
                            }`}
                          {m.teamB
                            ? ` vs ${couples[offset + m.teamB.man].manName}+${couples[offset + m.teamB.woman].womanName
                            }`
                            : "(BYE)"}
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          className="w-16 border px-2 py-1 rounded bg-white"
                          placeholder="A"
                          value={matchResults[`B_${m.globalId}`]?.scoreA ?? ""}
                          onChange={(e) =>
                            handleScoreChange(m, "scoreA", e.target.value, "B_")
                          }
                        />
                        <span>:</span>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          className="w-16 border px-2 py-1 rounded bg-white"
                          placeholder="B"
                          value={matchResults[`B_${m.globalId}`]?.scoreB ?? ""}
                          onChange={(e) =>
                            handleScoreChange(m, "scoreB", e.target.value, "B_")
                          }
                          disabled={!m.teamB}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SEMIFINAIS E FINAL (APENAS NO MODO PLANEJAMENTO) */}
      {viewMode === "planning" && (
        <>
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
                        borderColor:
                          courtColors[idx % courtColors.length].border,
                        color: courtColors[idx % courtColors.length].text,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="ml-2">
                      {`Semifinal: ${couples[semi.coupleA].manName}&${couples[semi.coupleA].womanName
                        } vs ${couples[semi.coupleB].manName}&${couples[semi.coupleB].womanName
                        }`}
                    </div>
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
                  <div className="ml-2">
                    {`Final: ${couples[finalMatch.coupleA].manName}&${couples[finalMatch.coupleA].womanName
                      } vs ${couples[finalMatch.coupleB].manName}&${couples[finalMatch.coupleB].womanName
                      }`}
                  </div>
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
                  {champion()
                    ? `${champion()!.manName} & ${champion()!.womanName}`
                    : "(informe o placar)"}
                </div>
              </div>
            ) : (
              <p>Nenhuma final criada.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
