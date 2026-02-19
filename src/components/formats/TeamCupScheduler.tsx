// src/components/formats/TeamCupScheduler.tsx
import BaseTournamentTemplate from './BaseTournamentTemplate';

export default function TeamCupScheduler({ storagePrefix: _storagePrefix }: { storagePrefix?: string }) {
  // Nota: storagePrefix não está sendo usado no BaseTournamentTemplate ainda, 
  // mas foi adicionado para consistência de interface.
  return <BaseTournamentTemplate tournamentType="team-cup" title="Team Cup" />;
}