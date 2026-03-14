"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Pencil, Save, X, Users } from 'lucide-react';
import { Player, Season } from '../../types/championship';

interface PlayersTabProps {
  players: Player[];
  seasons: Season[];
  onRenamePlayer: (playerId: number, newName: string) => Promise<{ success: boolean; error?: string }>;
}

const PlayersTab: React.FC<PlayersTabProps> = ({
  players,
  seasons,
  onRenamePlayer
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [seasonFilter, setSeasonFilter] = useState<number | 'all'>('all');
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (seasonFilter === 'all') return;
    const stillExists = seasons.some(season => season.id === seasonFilter);
    if (!stillExists) {
      setSeasonFilter('all');
    }
  }, [seasonFilter, seasons]);

  const seasonsById = useMemo(() => {
    return new Map(seasons.map(season => [season.id, season]));
  }, [seasons]);

  const filteredPlayers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return [...players]
      .filter(player => (seasonFilter === 'all' ? true : player.season_id === seasonFilter))
      .filter(player => (search ? player.name.toLowerCase().includes(search) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, searchTerm, seasonFilter]);

  const handleStartEdit = (player: Player) => {
    setEditingPlayerId(player.id);
    setDraftName(player.name);
    setErrorMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingPlayerId(null);
    setDraftName('');
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (editingPlayerId === null) return;
    setIsSaving(true);
    setErrorMessage(null);

    const result = await onRenamePlayer(editingPlayerId, draftName);
    setIsSaving(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Rename failed.');
      return;
    }

    handleCancelEdit();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-6 h-6 text-blue-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Players</h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Season</label>
          <select
            value={seasonFilter}
            onChange={(e) => {
              const value = e.target.value;
              setSeasonFilter(value === 'all' ? 'all' : Number(value));
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All seasons</option>
            {seasons.map(season => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search player name"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
          {errorMessage}
        </div>
      )}

      {filteredPlayers.length === 0 ? (
        <div className="text-center py-10 text-gray-600 dark:text-gray-400">
          No players found for the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Season</th>
                <th className="text-right px-4 py-3 font-semibold">ELO</th>
                <th className="text-right px-4 py-3 font-semibold">Matches</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map(player => {
                const isEditing = editingPlayerId === player.id;
                const seasonName = seasonsById.get(player.season_id)?.name ?? 'Unknown season';
                return (
                  <tr key={player.id} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="font-medium text-gray-900 dark:text-white">{player.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{seasonName}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{player.elo}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{player.matches}</td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(player)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Rename
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlayersTab;
