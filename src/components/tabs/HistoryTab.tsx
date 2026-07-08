"use client";

import React from 'react';
import { Clock, Trash2, Crown, Trophy } from 'lucide-react';
import { Player, Match } from '../../types/championship';
import { RankingMode } from '../../utils/ranking';
import { useAuth } from '../../hooks/useAuth';

interface HistoryTabProps {
  players: Player[];
  matchFilterPlayerId: number | null;
  setMatchFilterPlayerId: React.Dispatch<React.SetStateAction<number | null>>;
  filteredMatches: Match[];
  rankingMode: RankingMode;
  onDeleteMatch: (match: Match) => void;
  onPlayerStatsClick?: (playerId: number) => void;
  canEditMatches?: boolean;
  tournamentLabelByMatchId?: Map<number, string>;
}

const HistoryTab: React.FC<HistoryTabProps> = ({
  players,
  matchFilterPlayerId,
  setMatchFilterPlayerId,
  filteredMatches,
  rankingMode,
  onDeleteMatch,
  onPlayerStatsClick,
  canEditMatches = true,
  tournamentLabelByMatchId
}) => {
  const { permissions, user } = useAuth();
  const selectedPlayer = matchFilterPlayerId !== null
    ? players.find(player => player.id === matchFilterPlayerId)
    : null;
  const selectedPlayerName = selectedPlayer?.name ?? 'Unknown player';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-6 h-6 text-blue-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Match History</h2>
      </div>

      {/* Player Filter */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by player:</label>
        <select
          value={matchFilterPlayerId ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            setMatchFilterPlayerId(value ? Number(value) : null);
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
        >
          <option value="">All players</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        
        {matchFilterPlayerId !== null && (
          <button
            onClick={() => setMatchFilterPlayerId(null)}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md border border-gray-300 dark:border-gray-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Remove filter
          </button>
        )}
      </div>

      {filteredMatches.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {matchFilterPlayerId !== null ? `No matches found for ${selectedPlayerName}` : 'No matches yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {matchFilterPlayerId !== null ? 'Try selecting a different player or clear the filter.' : 'Add your first match to see history here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Showing {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''}
            {matchFilterPlayerId !== null && ` for ${selectedPlayerName}`}
          </div>
          
          {filteredMatches.map((match, index) => (
            <div
              key={`${match.id}-${match.date}-${match.time}-${index}`}
              className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              {/* Match Header */}
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
                <div className="flex justify-between items-center gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                      {new Date(match.date).toLocaleDateString('en-UK')} at {match.time}
                    </span>
                    {tournamentLabelByMatchId?.has(match.id) && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full truncate">
                        <Trophy className="w-3 h-3 shrink-0" />
                        {tournamentLabelByMatchId.get(match.id)}
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {match.scores.join(' - ')}
                  </div>
                </div>
              </div>

              {/* Teams Display */}
              <div className="p-4">
                <div
                  className="grid gap-4 items-start"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
                >
                  {match.teams.map((team, teamIndex) => (
                    <div
                      key={`team-${teamIndex}`}
                      className={`text-center p-3 rounded-lg border-2 transition-all duration-200 ${
                        match.winnerIndex === teamIndex
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Team {teamIndex + 1}{' '}
                        {match.winnerIndex === teamIndex && <Crown className="inline h-3 w-3 text-yellow-500" />}
                      </div>
                      <div className="space-y-1">
                        {team.map((player, index) => (
                          <div
                            key={`${player.id}-${index}`}
                            onClick={(e) => {
                              if (onPlayerStatsClick) {
                                e.stopPropagation();
                                onPlayerStatsClick(player.id);
                              }
                            }}
                            className={`text-sm font-medium cursor-pointer hover:underline transition-colors duration-200 ${
                              matchFilterPlayerId === player.id
                                ? 'text-blue-600 dark:text-blue-400 font-bold'
                                : 'text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400'
                            }`}
                          >
                            {player.name}
                          </div>
                        ))}
                      </div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                        {match.scores[teamIndex] ?? 0}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ELO Changes */}
                {rankingMode === 'elo' && (
                <div className="mt-4 pt-3 border-t dark:border-gray-600">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    ELO Changes
                  </div>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
                  >
                    {match.teams.flat().map((player) => {
                      const change = match.eloChanges[String(player.id)] ?? 0;
                      return (
                      <div
                        key={`elo-${player.id}`}
                        onClick={(e) => {
                          if (onPlayerStatsClick) {
                            e.stopPropagation();
                            onPlayerStatsClick(player.id);
                          }
                        }}
                        className={`text-center p-2 rounded border cursor-pointer hover:shadow-md transition-all duration-200 ${
                          matchFilterPlayerId === player.id 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-600' 
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div className={`text-xs font-medium hover:underline ${
                          matchFilterPlayerId === player.id 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {player.name}
                        </div>
                        <div className={`text-sm font-bold ${
                          change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {change > 0 ? '+' : ''}{change}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
                )}
              </div>

              {/* Delete Button */}
              {canEditMatches && (permissions.canDeleteAnyMatch || (permissions.canDeleteOwnMatches && match.createdBy === user?.id)) && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => onDeleteMatch(match)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Match
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryTab; 
