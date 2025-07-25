import React from 'react';
import { X, Target, Users } from 'lucide-react';
import { Player, Match } from '../types/foosball';

interface PlayerStatsModalProps {
  player: Player | null;
  matches: Match[];
  isOpen: boolean;
  onClose: () => void;
}

interface TeammateStats {
  name: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

interface OpponentStats {
  name: string;
  winsAgainst: number;
  lossesAgainst: number;
  total: number;
  winRateAgainst: number;
}

const PlayerStatsModal: React.FC<PlayerStatsModalProps> = ({
  player,
  matches,
  isOpen,
  onClose
}) => {
  if (!isOpen || !player) return null;

  // Get all matches for this player
  const playerMatches = matches.filter(match => 
    match.team1.includes(player.name) || match.team2.includes(player.name)
  );

  // Calculate teammate statistics
  const teammateStats = new Map<string, { wins: number; losses: number }>();
  
  playerMatches.forEach(match => {
    const isTeam1 = match.team1.includes(player.name);
    const teammates = isTeam1 ? match.team1 : match.team2;
    const won = (isTeam1 && match.winner === 'team1') || (!isTeam1 && match.winner === 'team2');
    
    teammates.forEach(teammate => {
      if (teammate !== player.name) {
        if (!teammateStats.has(teammate)) {
          teammateStats.set(teammate, { wins: 0, losses: 0 });
        }
        const stats = teammateStats.get(teammate)!;
        if (won) {
          stats.wins++;
        } else {
          stats.losses++;
        }
      }
    });
  });

  // Calculate opponent statistics
  const opponentStats = new Map<string, { winsAgainst: number; lossesAgainst: number }>();
  
  playerMatches.forEach(match => {
    const isTeam1 = match.team1.includes(player.name);
    const opponents = isTeam1 ? match.team2 : match.team1;
    const won = (isTeam1 && match.winner === 'team1') || (!isTeam1 && match.winner === 'team2');
    
    opponents.forEach(opponent => {
      if (!opponentStats.has(opponent)) {
        opponentStats.set(opponent, { winsAgainst: 0, lossesAgainst: 0 });
      }
      const stats = opponentStats.get(opponent)!;
      if (won) {
        stats.winsAgainst++;
      } else {
        stats.lossesAgainst++;
      }
    });
  });

  // Convert to arrays and sort
  const sortedTeammates: TeammateStats[] = Array.from(teammateStats.entries())
    .map(([name, stats]) => ({
      name,
      wins: stats.wins,
      losses: stats.losses,
      total: stats.wins + stats.losses,
      winRate: stats.wins + stats.losses > 0 ? (stats.wins / (stats.wins + stats.losses)) * 100 : 0
    }))
    .filter(stats => stats.total > 0)
    .sort((a, b) => {
      // Primary sort: win rate (descending)
      if (b.winRate !== a.winRate) {
        return b.winRate - a.winRate;
      }
      // Tiebreaker: total games played (descending)
      return b.total - a.total;
    });

  const sortedOpponents: OpponentStats[] = Array.from(opponentStats.entries())
    .map(([name, stats]) => ({
      name,
      winsAgainst: stats.winsAgainst,
      lossesAgainst: stats.lossesAgainst,
      total: stats.winsAgainst + stats.lossesAgainst,
      winRateAgainst: stats.winsAgainst + stats.lossesAgainst > 0 ? (stats.winsAgainst / (stats.winsAgainst + stats.lossesAgainst)) * 100 : 0
    }))
    .filter(stats => stats.total > 0)
    .sort((a, b) => {
      // Primary sort: win rate against (descending)
      if (b.winRateAgainst !== a.winRateAgainst) {
        return b.winRateAgainst - a.winRateAgainst;
      }
      // Tiebreaker: total games played (descending)
      return b.total - a.total;
    });

  // Calculate overall win rate
  const winRate = player.matches > 0 ? (player.wins / player.matches * 100).toFixed(1) : '0.0';

  // Get best and worst teammates/opponents
  const bestTeammate = sortedTeammates[0];
  const worstTeammate = sortedTeammates[sortedTeammates.length - 1];
  const dominatedOpponent = sortedOpponents[0]; // Opponent we win against most
  const dominatingOpponent = sortedOpponents[sortedOpponents.length - 1]; // Opponent who beats us most

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-white">{player.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{player.name}</h2>
                <p className="text-gray-500 dark:text-gray-400">Player Statistics</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Basic Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center border border-blue-200 dark:border-blue-800">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{player.elo}</div>
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">ELO Rating</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center border border-green-200 dark:border-green-800">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{player.wins}</div>
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">Wins</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center border border-red-200 dark:border-red-800">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{player.losses}</div>
                <div className="text-sm text-red-600 dark:text-red-400 font-medium">Losses</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center border border-purple-200 dark:border-purple-800">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{winRate}%</div>
                <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Win Rate</div>
              </div>
            </div>

            {/* Key Relationships */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Best Partnerships */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border dark:border-gray-600 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Team Partnerships</h3>
                </div>
                
                {bestTeammate ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Best Partner</span>
                        <span className="text-sm text-green-600 dark:text-green-400 font-bold">
                          {bestTeammate.winRate.toFixed(1)}% win rate
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 dark:text-white">{bestTeammate.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {bestTeammate.wins}W-{bestTeammate.losses}L ({bestTeammate.total} games)
                        </span>
                      </div>
                    </div>
                    
                    {worstTeammate && worstTeammate !== bestTeammate && (
                      <div className="pt-3 border-t dark:border-gray-600">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Needs Work</span>
                          <span className="text-sm text-red-600 dark:text-red-400 font-bold">
                            {worstTeammate.winRate.toFixed(1)}% win rate
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900 dark:text-white">{worstTeammate.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {worstTeammate.wins}W-{worstTeammate.losses}L ({worstTeammate.total} games)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No team data available</p>
                )}
              </div>

              {/* Key Rivalries */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border dark:border-gray-600 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-red-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Key Rivalries</h3>
                </div>
                
                {dominatedOpponent || dominatingOpponent ? (
                  <div className="space-y-3">
                    {dominatedOpponent && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dominates</span>
                          <span className="text-sm text-green-600 dark:text-green-400 font-bold">
                            {dominatedOpponent.winRateAgainst.toFixed(1)}% win rate
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900 dark:text-white">{dominatedOpponent.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {dominatedOpponent.winsAgainst}W-{dominatedOpponent.lossesAgainst}L ({dominatedOpponent.total} games)
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {dominatingOpponent && dominatingOpponent !== dominatedOpponent && (
                      <div className="pt-3 border-t dark:border-gray-600">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tough Opponent</span>
                          <span className="text-sm text-red-600 dark:text-red-400 font-bold">
                            {dominatingOpponent.winRateAgainst.toFixed(1)}% win rate
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-900 dark:text-white">{dominatingOpponent.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {dominatingOpponent.winsAgainst}W-{dominatingOpponent.lossesAgainst}L ({dominatingOpponent.total} games)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No rivalry data available</p>
                )}
              </div>
            </div>

            {/* Detailed Tables */}
            {(sortedTeammates.length > 0 || sortedOpponents.length > 0) && (
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* All Teammates */}
                {sortedTeammates.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      All Teammates
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <div className="space-y-2">
                        {sortedTeammates.map((teammate, index) => (
                          <div key={teammate.name} className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-700 rounded border dark:border-gray-600">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-6">#{index + 1}</span>
                              <span className="font-medium text-gray-900 dark:text-white">{teammate.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {teammate.winRate.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {teammate.wins}W-{teammate.losses}L
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* All Opponents */}
                {sortedOpponents.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      All Opponents
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <div className="space-y-2">
                        {sortedOpponents.map((opponent, index) => (
                          <div key={opponent.name} className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-700 rounded border dark:border-gray-600">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-6">#{index + 1}</span>
                              <span className="font-medium text-gray-900 dark:text-white">{opponent.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {opponent.winRateAgainst.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {opponent.winsAgainst}W-{opponent.lossesAgainst}L
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PlayerStatsModal; 