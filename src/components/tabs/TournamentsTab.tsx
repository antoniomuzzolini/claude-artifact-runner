"use client";

import React, { useState } from 'react';
import { Crown, Medal, PlusCircle, Swords } from 'lucide-react';
import { Match, Player, Tournament } from '../../types/championship';
import { ResolvedSlot, computeTournamentState, formatLabel } from '../../utils/tournament';
import TournamentDetail from '../tournament/TournamentDetail';
import TournamentWizard, { TournamentDraft } from '../tournament/TournamentWizard';

interface TournamentsTabProps {
  tournaments: Tournament[]; // scoped to the selected season
  players: Player[];
  matches: Match[];
  canCreate: boolean;
  canRecordResults: boolean;
  canManage: boolean;
  onCreateTournament: (draft: TournamentDraft) => number | null;
  onRecordResult: (tournament: Tournament, slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
  onGenerateNextRound: (tournament: Tournament) => void;
  onDeleteTournament: (tournament: Tournament) => Promise<boolean>;
}

const TournamentsTab: React.FC<TournamentsTabProps> = ({
  tournaments,
  players,
  matches,
  canCreate,
  canRecordResults,
  canManage,
  onCreateTournament,
  onRecordResult,
  onGenerateNextRound,
  onDeleteTournament
}) => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);

  const nameById = new Map(players.map(player => [player.id, player.name]));
  const selectedTournament = tournaments.find(tournament => tournament.id === selectedTournamentId) ?? null;

  if (isWizardOpen) {
    return (
      <TournamentWizard
        players={players}
        onCreate={(draft) => {
          const createdId = onCreateTournament(draft);
          setIsWizardOpen(false);
          if (createdId !== null) {
            setSelectedTournamentId(createdId);
          }
        }}
        onCancel={() => setIsWizardOpen(false)}
      />
    );
  }

  if (selectedTournament) {
    return (
      <TournamentDetail
        tournament={selectedTournament}
        matches={matches}
        players={players}
        canRecordResults={canRecordResults}
        canManage={canManage}
        onRecordResult={onRecordResult}
        onGenerateNextRound={onGenerateNextRound}
        onDelete={async (tournament) => {
          const deleted = await onDeleteTournament(tournament);
          if (deleted) {
            setSelectedTournamentId(null);
          }
        }}
        onBack={() => setSelectedTournamentId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Swords className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tournaments</h2>
        </div>
        {canCreate && (
          <button
            onClick={() => setIsWizardOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
          >
            <PlusCircle className="w-4 h-4" />
            New Tournament
          </button>
        )}
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-12">
          <Medal className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No tournaments yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {canCreate
              ? 'Create a tournament and let the system build the bracket for you.'
              : 'Tournaments for this season will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tournaments.map(tournament => {
            const state = computeTournamentState(tournament, matches);
            const totalPlayable = state.playedMatches + state.pendingMatches;
            return (
              <button
                key={tournament.id}
                onClick={() => setSelectedTournamentId(tournament.id)}
                className="text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-all duration-200 hover:shadow-md hover:border-blue-400"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {tournament.name}
                      </h3>
                      {state.isComplete ? (
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                          Completed
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                          In progress
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatLabel(tournament.format)} · {tournament.participantIds.length} players
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {state.playedMatches}/{totalPlayable} played
                  </div>
                </div>
                {state.isComplete && state.championId !== null && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
                    <Crown className="w-4 h-4" />
                    {nameById.get(state.championId) ?? `Player ${state.championId}`}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TournamentsTab;
