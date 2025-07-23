import React from 'react';
import { Users, Trophy, Clock, Medal } from 'lucide-react';
import { Player } from '../../types/foosball';

interface RankingsTabProps {
  players: Player[];
  onPlayerClick: (playerName: string) => void;
}

const RankingsTab: React.FC<RankingsTabProps> = ({ players, onPlayerClick }) => {
  const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h2 className="text-2xl font-bold">ELO Rankings</h2>
      </div>

      {sortedPlayers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-blue-700">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              <strong>Tip:</strong> Click on a player's name to view their match history.
            </span>
          </div>
        </div>
      )}
      
      {sortedPlayers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No players registered yet</p>
          <p className="text-sm">Add the first match to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedPlayers.map((player, index) => (
            <div key={player.id} className="bg-white rounded-lg p-4 shadow-sm border flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 font-bold">
                  {index === 0 ? <Medal className="w-5 h-5 text-yellow-500" /> : index + 1}
                </div>
                <div 
                  className="cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors flex-1"
                  onClick={() => onPlayerClick(player.name)}
                  title={`View matches for ${player.name}`}
                >
                  <h3 className="font-semibold text-blue-600 hover:text-blue-800 hover:underline">
                    {player.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {player.matches} matches • {player.wins}W-{player.losses}L
                    {player.matches > 0 && (
                      <span className="ml-1">
                        ({Math.round((player.wins / player.matches) * 100)}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{player.elo}</div>
                <div className="text-sm text-gray-500">ELO</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RankingsTab; 