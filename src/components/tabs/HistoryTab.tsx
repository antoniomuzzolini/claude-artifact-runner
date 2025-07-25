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

  const formatMatchResult = (match: Match) => {
    const team1 = match.team1.join(' & ');
    const team2 = match.team2.join(' & ');
    return `${team1} vs ${team2}`;
  };

  const getWinnerDisplay = (match: Match) => {
    if (match.winner === 'team1') {
      return match.team1.join(' & ');
    } else {
      return match.team2.join(' & ');
    }
  };

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
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {match.date} at {match.time}
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <div className="font-medium text-gray-900 dark:text-white mb-1">
                      {formatMatchResult(match)}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        Score: {match.team1Score} - {match.team2Score}
                      </span>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        Winner: {getWinnerDisplay(match)}
                      </span>
                    </div>
                  </div>

                  {/* ELO Changes */}
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">ELO changes: </span>
                    {Object.entries(match.eloChanges).map(([playerName, change], index) => (
                      <span key={playerName}>
                        {index > 0 && ', '}
                        <span className={`font-medium ${
                          matchFilterPlayer === playerName ? 'text-blue-600 dark:text-blue-400' : ''
                        }`}>
                          {playerName}: {change > 0 ? '+' : ''}{change}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Delete Button */}
                {permissions.canDeleteOwnMatches && (
                  <button
                    onClick={() => onDeleteMatch(match)}
                    className="ml-4 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    title="Delete match"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryTab; 