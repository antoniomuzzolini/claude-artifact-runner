import React from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import { Player } from '../../types/foosball';

interface RankingsTabProps {
  players: Player[];
  onPlayerClick?: (playerName: string) => void;
  onPlayerStatsClick?: (playerName: string) => void;
}

const RankingsTab: React.FC<RankingsTabProps> = ({ players, onPlayerClick, onPlayerStatsClick }) => {
  // Sort players by ELO rating (highest first)
  const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold">{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200 dark:border-yellow-800';
      case 2:
        return 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 border-gray-200 dark:border-gray-600';
      case 3:
        return 'bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Rankings</h2>
      </div>

      {sortedPlayers.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No players yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add your first match to see rankings appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedPlayers.map((player, index) => {
            const rank = index + 1;
            const winRate = player.matches > 0 ? (player.wins / player.matches * 100).toFixed(1) : '0.0';
            
            return (
              <div
                key={player.id}
                className={`p-6 rounded-lg border-2 transition-all duration-200 ${getRankColor(rank)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center">
                      {getRankIcon(rank)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{player.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {player.matches} match{player.matches !== 1 ? 'es' : ''} played
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{player.elo}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">ELO Rating</div>
                  </div>
                </div>
                
                {/* Player Stats */}
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">{player.wins}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Wins</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-600 dark:text-red-400">{player.losses}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Losses</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{winRate}%</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Win Rate</div>
                  </div>
                </div>

                {/* Action Buttons */}
                {(onPlayerClick || onPlayerStatsClick) && (
                  <div className="mt-4 pt-3 border-t dark:border-gray-600 flex gap-2">
                    {onPlayerStatsClick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayerStatsClick(player.name);
                        }}
                        className="flex-1 px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 font-medium"
                      >
                        View Stats
                      </button>
                    )}
                    {onPlayerClick && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayerClick(player.name);
                        }}
                        className="flex-1 px-3 py-2 bg-gray-600 dark:bg-gray-500 text-white text-sm rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200 font-medium"
                      >
                        Match History
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RankingsTab; 