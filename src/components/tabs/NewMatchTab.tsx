import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { Player, NewMatch } from '../../types/foosball';
import AutoCompleteInput from '../AutoCompleteInput';

interface NewMatchTabProps {
  players: Player[];
  newMatch: NewMatch;
  setNewMatch: React.Dispatch<React.SetStateAction<NewMatch>>;
  onAddMatch: () => void;
}

const NewMatchTab: React.FC<NewMatchTabProps> = ({
  players,
  newMatch,
  setNewMatch,
  onAddMatch
}) => {
  const addPlayerToTeam = (teamNumber: 1 | 2) => {
    const teamKey = teamNumber === 1 ? 'team1' : 'team2';
    setNewMatch(prev => ({
      ...prev,
      [teamKey]: [...prev[teamKey], '']
    }));
  };

  const removePlayerFromTeam = (teamNumber: 1 | 2, playerIndex: number) => {
    const teamKey = teamNumber === 1 ? 'team1' : 'team2';
    setNewMatch(prev => ({
      ...prev,
      [teamKey]: prev[teamKey].filter((_, index) => index !== playerIndex)
    }));
  };

  const updatePlayerInTeam = (teamNumber: 1 | 2, playerIndex: number, value: string) => {
    const teamKey = teamNumber === 1 ? 'team1' : 'team2';
    setNewMatch(prev => ({
      ...prev,
      [teamKey]: prev[teamKey].map((player, index) => 
        index === playerIndex ? value : player
      )
    }));
  };

  const renderTeam = (teamNumber: 1 | 2) => {
    const team = teamNumber === 1 ? newMatch.team1 : newMatch.team2;
    const teamColor = teamNumber === 1 ? 'blue' : 'red';
    const teamName = `Team ${teamNumber}`;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-lg text-${teamColor}-600 dark:text-${teamColor}-400`}>
            {teamName} ({team.length} player{team.length !== 1 ? 's' : ''})
          </h3>
          <button
            onClick={() => addPlayerToTeam(teamNumber)}
            className={`bg-${teamColor}-600 hover:bg-${teamColor}-700 dark:bg-${teamColor}-500 dark:hover:bg-${teamColor}-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 transition-colors duration-200`}
          >
            <Plus className="w-4 h-4" />
            Add Player
          </button>
        </div>
        
        <div className="space-y-3">
          {team.length === 0 && (
            <div className="text-gray-500 dark:text-gray-400 text-sm italic text-center py-4">
              No players added yet. Click "Add Player" to start.
            </div>
          )}
          
          {team.map((playerName, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Player {index + 1}
                </label>
                <AutoCompleteInput
                  value={playerName}
                  onChange={(value) => updatePlayerInTeam(teamNumber, index, value)}
                  placeholder="Player name"
                  className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-${teamColor}-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 transition-colors duration-200`}
                  players={players}
                />
              </div>
              
              {team.length > 1 && (
                <button
                  onClick={() => removePlayerFromTeam(teamNumber, index)}
                  className="mt-6 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white p-2 rounded-md transition-colors duration-200 flex-shrink-0"
                  title="Remove player"
                >
                  <Minus className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Plus className="w-6 h-6 text-green-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">New Match</h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border dark:border-gray-700 transition-colors duration-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderTeam(1)}
          {renderTeam(2)}
        </div>

        {/* Final Score */}
        <div className="mt-6 pt-6 border-t dark:border-gray-700">
          <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Final Score</h3>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <label className="block text-sm font-medium mb-1 text-blue-600 dark:text-blue-400">
                Team 1 ({newMatch.team1.length})
              </label>
              <input
                type="number"
                min="0"
                max="99"
                value={newMatch.team1Score}
                onChange={(e) => setNewMatch({...newMatch, team1Score: parseInt(e.target.value) || 0})}
                className="w-20 p-2 text-center text-lg font-bold border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white transition-colors duration-200"
              />
            </div>
            
            <div className="text-2xl font-bold text-gray-500 dark:text-gray-400">vs</div>
            
            <div className="text-center">
              <label className="block text-sm font-medium mb-1 text-red-600 dark:text-red-400">
                Team 2 ({newMatch.team2.length})
              </label>
              <input
                type="number"
                min="0"
                max="99"
                value={newMatch.team2Score}
                onChange={(e) => setNewMatch({...newMatch, team2Score: parseInt(e.target.value) || 0})}
                className="w-20 p-2 text-center text-lg font-bold border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white transition-colors duration-200"
              />
            </div>
          </div>
        </div>

        {/* Team Balance Indicator */}
        {newMatch.team1.length !== newMatch.team2.length && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">
                Unbalanced teams: {newMatch.team1.length} vs {newMatch.team2.length} players
              </span>
            </div>
          </div>
        )}

        {/* Add Match Button */}
        <div className="mt-6 text-center">
          <button
            onClick={onAddMatch}
            disabled={newMatch.team1.length === 0 || newMatch.team2.length === 0}
            className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white px-6 py-3 rounded-md font-medium flex items-center gap-2 mx-auto transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            Add Match
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewMatchTab; 