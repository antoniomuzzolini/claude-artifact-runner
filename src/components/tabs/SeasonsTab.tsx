"use client";

import React from 'react';
import { Trophy, Calendar, PlusCircle } from 'lucide-react';
import { Player, Season } from '../../types/foosball';

interface SeasonsTabProps {
  seasons: Season[];
  players: Player[];
  minMatchesForRanking: number;
  currentSeasonId: number | null;
  selectedSeasonId: number | null;
  onSelectSeason: (seasonId: number) => void;
  onCreateSeason?: () => void;
  canCreateSeason?: boolean;
  isCreating?: boolean;
}

const formatDateRange = (season: Season) => {
  const start = season.startDate ? new Date(season.startDate).toLocaleDateString('en-US') : 'N/A';
  const end = season.endDate ? new Date(season.endDate).toLocaleDateString('en-US') : 'Ongoing';
  return `${start} - ${end}`;
};

const SeasonsTab: React.FC<SeasonsTabProps> = ({
  seasons,
  players,
  minMatchesForRanking,
  currentSeasonId,
  selectedSeasonId,
  onSelectSeason,
  onCreateSeason,
  canCreateSeason = false,
  isCreating = false
}) => {
  const sortedSeasons = [...seasons].sort((a, b) => {
    const aTime = new Date(a.startDate).getTime();
    const bTime = new Date(b.startDate).getTime();
    return bTime - aTime;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Seasons</h2>
        </div>
        {canCreateSeason && onCreateSeason && (
          <button
            onClick={onCreateSeason}
            disabled={isCreating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <PlusCircle className="w-4 h-4" />
            {isCreating ? 'Creating...' : 'New Season'}
          </button>
        )}
      </div>

      {sortedSeasons.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No seasons yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create a season to start tracking podiums.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedSeasons.map((season) => {
            const seasonPlayers = players.filter(p => p.season_id === season.id);
            const podium = seasonPlayers
              .filter(p => p.matches >= minMatchesForRanking)
              .sort((a, b) => b.elo - a.elo)
              .slice(0, 3);

            const isCurrent = season.id === currentSeasonId;
            const isSelected = season.id === selectedSeasonId;

            return (
              <button
                key={season.id}
                onClick={() => onSelectSeason(season.id)}
                className={`text-left rounded-lg border p-4 transition-all duration-200 hover:shadow-md ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{season.name}</h3>
                      {isCurrent && (
                        <span className="text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatDateRange(season)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {seasonPlayers.length} players
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Podium
                  </div>
                  {podium.length === 0 ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      No rankings yet for this season.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {podium.map((player, index) => (
                        <div
                          key={player.id}
                          className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 text-sm font-bold text-gray-700 dark:text-gray-200">#{index + 1}</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{player.name}</span>
                          </div>
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{player.elo}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SeasonsTab;
