// scheduler.ts

import { Match } from "./types";

/**
 * Embaralha um array de forma determinística usando o algoritmo Fisher-Yates.
 * Usamos isso para garantir que a ordem dos jogos em uma rodada seja variada,
 * mas consistente para os mesmos parâmetros de entrada (ajuda em testes).
 */
function shuffle(array: any[], seed: number) {
  let currentIndex = array.length, randomIndex;
  let seededRandom = () => {
      var x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
  };

  while (currentIndex !== 0) {
    randomIndex = Math.floor(seededRandom() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

/**
 * Esta é a nova função de agendamento, construída para garantir que a "Regra A"
 * (marido não joga com esposa) seja sempre respeitada.
 */
export function generateSchedule(N: number): Match[] {
  if (N < 2) return [];
  // Se N for ímpar, um jogador ficará de fora a cada rodada.
  // Para simplificar a lógica de confrontos, garantimos que sempre haja um número par de jogadores por rodada.
  const isOdd = N % 2 !== 0;
  const numPlayersInRound = isOdd ? N - 1 : N;

  const R = N - 1; // Para N jogadores, há N-1 rodadas para todos jogarem com todos os parceiros (exceto o original)
  let allMatches: Match[] = [];

  for (let r = 0; r < R; r++) {
    // A cada rodada, geramos uma lista de duplas (homem, mulher)
    const pairsThisRound = [];
    
    // Lista de mulheres disponíveis para formar par nesta rodada
    const availableWomen = Array.from({ length: N }, (_, i) => i);
    
    for (let i = 0; i < N; i++) {
      const man = i;
      
      // O parceiro do homem 'i' nesta rodada 'r' é determinado por esta fórmula.
      // O '+1' garante que ele nunca jogue com sua parceira original (mulher 'i').
      const partnerIndex = (i + r + 1) % N;
      const woman = partnerIndex;

      pairsThisRound.push({ man, woman });
    }

    // Agora que temos as N duplas da rodada (ex: 1+B, 2+C, ...), vamos criar os confrontos.
    // Embaralhamos as duplas para garantir que os confrontos sejam variados.
    const shuffledPairs = shuffle([...pairsThisRound], r); // a semente 'r' garante que o embaralhamento seja diferente a cada rodada

    for (let k = 0; k < shuffledPairs.length; k += 2) {
      // Se houver um número ímpar de duplas, a última fica de fora (BYE)
      if (k + 1 >= shuffledPairs.length) continue;

      const teamA = shuffledPairs[k];
      const teamB = shuffledPairs[k + 1];

      allMatches.push({
        id: `R${r + 1}M${allMatches.length + 1}`,
        globalId: `r${r + 1}_m${allMatches.length + 1}`,
        round: r + 1,
        teamA,
        teamB,
      });
    }
  }

  return allMatches;
}