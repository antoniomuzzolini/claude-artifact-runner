import React from 'react';
import { Plus } from 'lucide-react';
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
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Plus className="w-6 h-6 text-green-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">New Match</h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border dark:border-gray-700 transition-colors duration-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team 1 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">Team 1</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Player 1</label>
                <AutoCompleteInput
                  value={newMatch.team1Player1}
                  onChange={(value) => setNewMatch({...newMatch, team1Player1: value})}
                  placeholder="Player name"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 transition-colors duration-200"
                  players={players}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Player 2</label>
                <AutoCompleteInput
                  value={newMatch.team1Player2}
                  onChange={(value) => setNewMatch({...newMatch, team1Player2: value})}
                  placeholder="Player name"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 transition-colors duration-200"
                  players={players}
                />
              </div>
            </div>
          </div>

          {/* Team 2 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-red-600 dark:text-red-400">Team 2</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Player 1</label>
                <AutoCompleteInput
                  value={newMatch.team2Player1}
                  onChange={(value) => setNewMatch({...newMatch, team2Player1: value})}
                  placeholder="Player name"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 transition-colors duration-200"
                  players={players}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Player 2</label>
                <AutoCompleteInput
                  value={newMatch.team2Player2}
                  onChange={(value) => setNewMatch({...newMatch, team2Player2: value})}
                  placeholder="Player name"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 transition-colors duration-200"
                  players={players}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Final Score */}
        <div className="mt-6 pt-6 border-t dark:border-gray-700">
          <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Final Score</h3>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <label className="block text-sm font-medium mb-1 text-blue-600 dark:text-blue-400">Team 1</label>
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
              <label className="block text-sm font-medium mb-1 text-red-600 dark:text-red-400">Team 2</label>
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

        {/* Add Match Button */}
        <div className="mt-6 text-center">
          <button
            onClick={onAddMatch}
            className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white px-6 py-3 rounded-md font-medium flex items-center gap-2 mx-auto transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
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