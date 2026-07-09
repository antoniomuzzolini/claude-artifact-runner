"use client";

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, X } from 'lucide-react';
import {
  Player,
  TournamentConfig,
  TournamentFormat,
  TournamentPointsScheme,
  TournamentSeedingMode
} from '../../types/championship';
import {
  FormatSuggestion,
  formatLabel,
  splitGroupSizes,
  suggestFormats
} from '../../utils/tournament';

export interface TournamentDraft {
  name: string;
  format: TournamentFormat;
  seeding: TournamentSeedingMode;
  participantIds: number[];
  config: TournamentConfig;
}

interface TournamentWizardProps {
  players: Player[];
  onCreate: (draft: TournamentDraft) => void;
  onCancel: () => void;
}

const FORMAT_DESCRIPTIONS: Record<TournamentFormat, string> = {
  single_elimination: 'Classic knockout bracket. Lose once and you are out. Fast and dramatic.',
  round_robin: 'Everyone plays everyone. The fairest format, with the most matches.',
  groups_knockout: 'Group stage first, then the best of each group advance to a knockout bracket.',
  swiss: 'Fixed number of rounds, opponents paired by score. Nobody is eliminated.'
};

const TournamentWizard: React.FC<TournamentWizardProps> = ({ players, onCreate, onCancel }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [format, setFormat] = useState<TournamentFormat | null>(null);
  const [seeding, setSeeding] = useState<TournamentSeedingMode>('random');
  const [manualOrder, setManualOrder] = useState<number[]>([]);
  const [groupCount, setGroupCount] = useState(2);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [swissRounds, setSwissRounds] = useState(3);
  const [pointsScheme, setPointsScheme] = useState<TournamentPointsScheme>('flat');

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );
  const participantCount = selectedIds.size;
  const suggestions = useMemo(() => suggestFormats(participantCount), [participantCount]);

  const togglePlayer = (playerId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const selectFormat = (suggestion: FormatSuggestion) => {
    setFormat(suggestion.format);
    if (suggestion.defaultConfig.groupCount) setGroupCount(suggestion.defaultConfig.groupCount);
    if (suggestion.defaultConfig.qualifiersPerGroup) setQualifiersPerGroup(suggestion.defaultConfig.qualifiersPerGroup);
    if (suggestion.defaultConfig.swissRounds) setSwissRounds(suggestion.defaultConfig.swissRounds);
    setManualOrder(Array.from(selectedIds));
    setStep(3);
  };

  const moveManual = (index: number, delta: number) => {
    setManualOrder(prev => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const groupCountOptions = useMemo(() => {
    const max = Math.floor(participantCount / 3);
    return Array.from({ length: Math.max(0, max - 1) }, (_, i) => i + 2);
  }, [participantCount]);

  const qualifierOptions = useMemo(() => {
    const sizes = splitGroupSizes(participantCount, groupCount);
    const max = sizes.length > 0 ? Math.min(...sizes) : 1;
    return Array.from({ length: max }, (_, i) => i + 1)
      .filter(count => count * groupCount >= 2);
  }, [participantCount, groupCount]);

  const nameById = useMemo(
    () => new Map(players.map(player => [player.id, player.name])),
    [players]
  );

  const handleCreate = () => {
    if (!format || participantCount < 2) return;
    const participantIds = seeding === 'manual' ? manualOrder : Array.from(selectedIds);
    const config: TournamentConfig = {
      pointsWin: 3,
      pointsDraw: 1,
      ...(format !== 'single_elimination' ? { pointsScheme } : {}),
      ...(format === 'groups_knockout' ? { groupCount, qualifiersPerGroup } : {}),
      ...(format === 'swiss' ? { swissRounds } : {})
    };
    onCreate({
      name: name.trim() || 'Tournament',
      format,
      seeding,
      participantIds,
      config
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step === 3 ? 2 : 1)}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              aria-label="Previous step"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">New Tournament</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">Step {step} of 3</span>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tournament name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Cup 2026"
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Participants ({participantCount} selected)
              </label>
              <button
                onClick={() => setSelectedIds(
                  selectedIds.size === sortedPlayers.length
                    ? new Set()
                    : new Set(sortedPlayers.map(player => player.id))
                )}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {selectedIds.size === sortedPlayers.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-72 overflow-y-auto p-1">
              {sortedPlayers.map(player => (
                <label
                  key={player.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors duration-200 ${
                    selectedIds.has(player.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(player.id)}
                    onChange={() => togglePlayer(player.id)}
                    className="accent-blue-600"
                  />
                  <span className="truncate">{player.name}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={participantCount < 2}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Choose format
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            With <strong>{participantCount} players</strong>, here is how each format would look:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.map(suggestion => (
              <button
                key={suggestion.format}
                onClick={() => suggestion.available && selectFormat(suggestion)}
                disabled={!suggestion.available}
                className={`text-left rounded-lg border p-4 transition-all duration-200 ${
                  suggestion.available
                    ? 'hover:shadow-md hover:border-blue-400 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    : 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatLabel(suggestion.format)}
                  </h3>
                  {suggestion.recommended && (
                    <span className="text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {FORMAT_DESCRIPTIONS[suggestion.format]}
                </p>
                {suggestion.available ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <span><strong className="text-gray-700 dark:text-gray-200">{suggestion.totalMatches}</strong> total matches</span>
                    <span>
                      <strong className="text-gray-700 dark:text-gray-200">
                        {suggestion.minMatchesPerPlayer === suggestion.maxMatchesPerPlayer
                          ? suggestion.minMatchesPerPlayer
                          : `${suggestion.minMatchesPerPlayer}-${suggestion.maxMatchesPerPlayer}`}
                      </strong> matches per player
                    </span>
                    <span><strong className="text-gray-700 dark:text-gray-200">{suggestion.rounds}</strong> rounds</span>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Needs more players
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && format && (
        <div className="space-y-5">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <strong className="text-gray-900 dark:text-white">{formatLabel(format)}</strong> with {participantCount} players
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Seeding
            </label>
            <select
              value={seeding}
              onChange={(e) => setSeeding(e.target.value as TournamentSeedingMode)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="random">Random draw</option>
              <option value="elo">Seeded by ELO</option>
              <option value="manual">Manual order</option>
            </select>
          </div>

          {seeding === 'manual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Seed order (1 = top seed)
              </label>
              <div className="space-y-1 max-w-md">
                {manualOrder.map((playerId, index) => (
                  <div
                    key={playerId}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 text-sm"
                  >
                    <span className="text-gray-900 dark:text-white">
                      <span className="text-gray-400 dark:text-gray-500 mr-2">{index + 1}.</span>
                      {nameById.get(playerId) ?? playerId}
                    </span>
                    <span className="flex gap-1">
                      <button
                        onClick={() => moveManual(index, -1)}
                        disabled={index === 0}
                        className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveManual(index, 1)}
                        disabled={index === manualOrder.length - 1}
                        className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {format !== 'single_elimination' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Points system
              </label>
              <select
                value={pointsScheme}
                onChange={(e) => setPointsScheme(e.target.value as TournamentPointsScheme)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="flat">Standard — 3 per win, 1 per draw</option>
                <option value="set_based">Set-based (volleyball) — 3 pts, or 2/1 at the deciding set</option>
              </select>
              {pointsScheme === 'set_based' && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter results as sets won (e.g. 2-1, 3-0). A win by 2+ sets gives 3/0 points, a
                  deciding-set win gives 2/1. Draws are disabled. Works for best-of-3 and best-of-5.
                </p>
              )}
            </div>
          )}

          {format === 'groups_knockout' && (
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Number of groups
                </label>
                <select
                  value={groupCount}
                  onChange={(e) => setGroupCount(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {groupCountOptions.map(count => (
                    <option key={count} value={count}>{count} groups of ~{Math.round(participantCount / count)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Qualifiers per group
                </label>
                <select
                  value={qualifiersPerGroup}
                  onChange={(e) => setQualifiersPerGroup(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {qualifierOptions.map(count => (
                    <option key={count} value={count}>Top {count}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {format === 'swiss' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number of rounds
              </label>
              <select
                value={swissRounds}
                onChange={(e) => setSwissRounds(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: Math.max(1, Math.min(10, participantCount - 1) - 2) }, (_, i) => i + 3).map(count => (
                  <option key={count} value={count}>{count} rounds</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
          >
            <Check className="w-4 h-4" />
            Create tournament
          </button>
        </div>
      )}
    </div>
  );
};

export default TournamentWizard;
