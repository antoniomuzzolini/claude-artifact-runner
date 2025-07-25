import React from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { Player, Match } from '../../types/foosball';
import { useAuth } from '../../hooks/useAuth';

interface HistoryTabProps {
  players: Player[];
  matchFilterPlayer: string;
  setMatchFilterPlayer: React.Dispatch<React.SetStateAction<string>>;
  filteredMatches: Match[];
  onDeleteMatch: (match: Match) => void;
  onBackToRankings: () => void;
}

const HistoryTab: React.FC<HistoryTabProps> = ({
  players,
  matchFilterPlayer,
  setMatchFilterPlayer,
  filteredMatches,
  onDeleteMatch,
  onBackToRankings
}) => {
  const { permissions } = useAuth();

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
          value={matchFilterPlayer}
          onChange={(e) => setMatchFilterPlayer(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
        >
          <option value="">All players</option>
          {players.map((player) => (
            <option key={player.id} value={player.name}>
              {player.name}
            </option>
          ))}
        </select>
        
        {matchFilterPlayer && (
          <button
            onClick={onBackToRankings}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors duration-200"
          >
            View {matchFilterPlayer} in rankings
          </button>
        )}
      </div>

      {filteredMatches.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {matchFilterPlayer ? `No matches found for ${matchFilterPlayer}` : 'No matches yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {matchFilterPlayer ? 'Try selecting a different player or clear the filter.' : 'Add your first match to see history here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Showing {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''}
            {matchFilterPlayer && ` for ${matchFilterPlayer}`}
          </div>
          
          {filteredMatches.map((match) => (
            <div
              key={match.id}
              className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              {/* Match Header */}
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                      {match.date} at {match.time}
                    </span>
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {match.team1Score} - {match.team2Score}
                  </div>
                </div>
              </div>

              {/* Teams Display */}
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  {/* Team 1 */}
                  <div className={`text-center p-3 rounded-lg border-2 transition-all duration-200 ${
                    match.winner === 'team1' 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600' 
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                  }`}>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Team 1 {match.winner === 'team1' && '👑'}
                    </div>
                    <div className="space-y-1">
                      {match.team1.map((player, index) => (
                        <div
                          key={index}
                          className={`text-sm font-medium ${
                            matchFilterPlayer === player 
                              ? 'text-blue-600 dark:text-blue-400 font-bold' 
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {player}
                        </div>
                      ))}
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                      {match.team1Score}
                    </div>
                  </div>

                  {/* VS Separator */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">VS</div>
                  </div>

                  {/* Team 2 */}
                  <div className={`text-center p-3 rounded-lg border-2 transition-all duration-200 ${
                    match.winner === 'team2' 
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600' 
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                  }`}>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Team 2 {match.winner === 'team2' && '👑'}
                    </div>
                    <div className="space-y-1">
                      {match.team2.map((player, index) => (
                        <div
                          key={index}
                          className={`text-sm font-medium ${
                            matchFilterPlayer === player 
                              ? 'text-blue-600 dark:text-blue-400 font-bold' 
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {player}
                        </div>
                      ))}
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                      {match.team2Score}
                    </div>
                  </div>
                </div>

                {/* ELO Changes */}
                <div className="mt-4 pt-3 border-t dark:border-gray-600">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    ELO Changes
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(match.eloChanges).map(([playerName, change]) => (
                      <div
                        key={playerName}
                        className={`text-center p-2 rounded border ${
                          matchFilterPlayer === playerName 
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-600' 
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className={`text-xs font-medium ${
                          matchFilterPlayer === playerName 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {playerName}
                        </div>
                        <div className={`text-sm font-bold ${
                          change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {change > 0 ? '+' : ''}{change}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              {permissions.canDeleteOwnMatches && (
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