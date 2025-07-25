import React from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import { Player } from '../../types/foosball';

interface RankingsTabProps {
  players: Player[];
}

const RankingsTab: React.FC<RankingsTabProps> = ({ players }) => {
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
                className={`${getRankColor(rank)} rounded-lg p-4 border transition-all duration-200 hover:shadow-md`}
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
                    <div className="text-sm text-gray-600 dark:text-gray-300">ELO Rating</div>
                  </div>
                </div>
                
                <div className="mt-3 flex justify-between items-center text-sm">
                  <div className="flex gap-6">
                    <span className="text-green-600 dark:text-green-400">
                      <strong>{player.wins}</strong> wins
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      <strong>{player.losses}</strong> losses
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      <strong>{winRate}%</strong> win rate
                    </span>
                  </div>
                  
                  {rank <= 3 && (
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {rank === 1 ? 'Champion' : rank === 2 ? 'Runner-up' : 'Third Place'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RankingsTab; 