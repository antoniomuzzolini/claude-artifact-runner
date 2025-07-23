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
        <h2 className="text-2xl font-bold">New Match</h2>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team 1 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-blue-600">Team 1</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Player 1</label>
                <AutoCompleteInput
                  value={newMatch.team1Player1}
                  onChange={(value) => setNewMatch({...newMatch, team1Player1: value})}
                  placeholder="Player name"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  players={players}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Player 2</label>
                <AutoCompleteInput
                  value={newMatch.team1Player2}
                  onChange={(value) => setNewMatch({...newMatch, team1Player2: value})}
                  placeholder="Player name"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  players={players}
                />
              </div>
            </div>
          </div>

          {/* Team 2 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-red-600">Team 2</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Player 1</label>
                <AutoCompleteInput
                  value={newMatch.team2Player1}
                  onChange={(value) => setNewMatch({...newMatch, team2Player1: value})}
                  placeholder="Player name"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  players={players}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Player 2</label>
                <AutoCompleteInput
                  value={newMatch.team2Player2}
                  onChange={(value) => setNewMatch({...newMatch, team2Player2: value})}
                  placeholder="Player name"
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  players={players}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Final Score */}
        <div className="mt-6">
          <label className="block text-sm font-medium mb-3">Final Score</label>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
              <div className="font-semibold text-blue-700 mb-2">Team 1</div>
              <div className="text-sm text-blue-600 mb-3">
                {newMatch.team1Player1 && newMatch.team1Player2 
                  ? `${newMatch.team1Player1} & ${newMatch.team1Player2}`
                  : 'Enter names'
                }
              </div>
              <input
                type="number"
                value={newMatch.team1Score}
                onChange={(e) => setNewMatch({...newMatch, team1Score: parseInt(e.target.value) || 0})}
                className="w-full p-2 border rounded-md text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="99"
                placeholder="0"
              />
            </div>
            <div className="p-4 border-2 border-red-200 rounded-lg bg-red-50">
              <div className="font-semibold text-red-700 mb-2">Team 2</div>
              <div className="text-sm text-red-600 mb-3">
                {newMatch.team2Player1 && newMatch.team2Player2 
                  ? `${newMatch.team2Player1} & ${newMatch.team2Player2}`
                  : 'Enter names'
                }
              </div>
              <input
                type="number"
                value={newMatch.team2Score}
                onChange={(e) => setNewMatch({...newMatch, team2Score: parseInt(e.target.value) || 0})}
                className="w-full p-2 border rounded-md text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                min="0"
                max="99"
                placeholder="0"
              />
            </div>
          </div>
          {newMatch.team1Score === newMatch.team2Score && (newMatch.team1Score > 0 || newMatch.team2Score > 0) && (
            <div className="mt-2 text-center text-sm text-amber-600">
              ⚠️ Scores cannot be equal
            </div>
          )}
        </div>

        <button
          onClick={onAddMatch}
          className="w-full mt-6 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold"
        >
          Add Match
        </button>
      </div>
    </div>
  );
};

export default NewMatchTab; 