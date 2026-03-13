"use client";

import React from 'react';
import { Plus, Minus, X } from 'lucide-react';
import { Player, NewMatch } from '../../types/foosball';
import AutoCompleteInput from '../AutoCompleteInput';

interface NewMatchTabProps {
  players: Player[];
  newMatch: NewMatch;
  setNewMatch: React.Dispatch<React.SetStateAction<NewMatch>>;
  onAddMatch: () => void;
  isReadOnly?: boolean;
  readOnlyMessage?: string;
}

const NewMatchTab: React.FC<NewMatchTabProps> = ({
  players,
  newMatch,
  setNewMatch,
  onAddMatch,
  isReadOnly = false,
  readOnlyMessage
}) => {
  const addTeam = () => {
    if (isReadOnly) return;
    setNewMatch(prev => ({
      ...prev,
      teams: [...prev.teams, ['']],
      scores: [...prev.scores, 0]
    }));
  };

  const removeTeam = (teamIndex: number) => {
    if (isReadOnly) return;
    if (newMatch.teams.length <= 2) return;
    setNewMatch(prev => ({
      ...prev,
      teams: prev.teams.filter((_, index) => index !== teamIndex),
      scores: prev.scores.filter((_, index) => index !== teamIndex)
    }));
  };

  const addPlayerToTeam = (teamIndex: number) => {
    if (isReadOnly) return;
    setNewMatch(prev => ({
      ...prev,
      teams: prev.teams.map((team, index) => 
        index === teamIndex ? [...team, ''] : team
      )
    }));
  };

  const removePlayerFromTeam = (teamIndex: number, playerIndex: number) => {
    if (isReadOnly) return;
    setNewMatch(prev => ({
      ...prev,
      teams: prev.teams.map((team, index) => 
        index === teamIndex ? team.filter((_, player) => player !== playerIndex) : team
      )
    }));
  };

  const updatePlayerInTeam = (teamIndex: number, playerIndex: number, value: string) => {
    if (isReadOnly) return;
    setNewMatch(prev => ({
      ...prev,
      teams: prev.teams.map((team, index) => {
        if (index !== teamIndex) return team;
        return team.map((player, playerIdx) => (playerIdx === playerIndex ? value : player));
      })
    }));
  };

  const updateTeamScore = (teamIndex: number, value: number) => {
    if (isReadOnly) return;
    setNewMatch(prev => ({
      ...prev,
      scores: prev.scores.map((score, index) => (index === teamIndex ? value : score))
    }));
  };

  const renderTeam = (teamIndex: number) => {
    const team = newMatch.teams[teamIndex] || [];
    const teamColor = teamIndex % 2 === 0 ? 'blue' : 'red';
    const teamName = `Team ${teamIndex + 1}`;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold text-lg text-${teamColor}-600 dark:text-${teamColor}-400`}>
            {teamName} ({team.length} player{team.length !== 1 ? 's' : ''})
          </h3>
          <div className="flex items-center gap-2">
            {newMatch.teams.length > 2 && (
              <button
                onClick={() => removeTeam(teamIndex)}
                disabled={isReadOnly}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 p-2 rounded-md transition-colors duration-200"
                title="Remove team"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => addPlayerToTeam(teamIndex)}
              disabled={isReadOnly}
              className={`bg-${teamColor}-600 hover:bg-${teamColor}-700 dark:bg-${teamColor}-500 dark:hover:bg-${teamColor}-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 transition-colors duration-200`}
            >
              <Plus className="w-4 h-4" />
              Add Player
            </button>
          </div>
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
                  onChange={(value) => updatePlayerInTeam(teamIndex, index, value)}
                  placeholder="Player name"
                  className={`w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-${teamColor}-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 transition-colors duration-200`}
                  players={players}
                  disabled={isReadOnly}
                />
              </div>
              
              {team.length > 1 && (
                <button
                  onClick={() => removePlayerFromTeam(teamIndex, index)}
                  disabled={isReadOnly}
                  className="mt-6 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white p-2 rounded-md transition-colors duration-200 flex-shrink-0"
                  title="Remove player"
                >
                  <Minus className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="pt-3 border-t dark:border-gray-700">
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Score
          </label>
          <input
            type="number"
            min="0"
            max="99"
            value={newMatch.scores[teamIndex] ?? 0}
            onChange={(e) => updateTeamScore(teamIndex, parseInt(e.target.value) || 0)}
            disabled={isReadOnly}
            className={`w-full p-2 text-center text-lg font-bold border rounded-md focus:outline-none focus:ring-2 focus:ring-${teamColor}-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white transition-colors duration-200`}
          />
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

      {isReadOnly && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
          {readOnlyMessage || 'You are viewing a past season. Matches are read-only.'}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border dark:border-gray-700 transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            Teams
          </h3>
          <button
            onClick={addTeam}
            disabled={isReadOnly}
            className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm flex items-center gap-1 transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Team
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {newMatch.teams.map((_, index) => renderTeam(index))}
        </div>

        {/* Add Match Button */}
        <div className="mt-6 text-center">
          <button
            onClick={onAddMatch}
            disabled={isReadOnly || newMatch.teams.length < 2}
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
