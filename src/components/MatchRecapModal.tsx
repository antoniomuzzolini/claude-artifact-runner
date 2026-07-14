"use client";

import React from 'react';
import { CheckCircle2, Crown, TrendingDown, TrendingUp } from 'lucide-react';

export interface MatchRecapTeam {
  names: string[];
  score: number;
  isWinner: boolean;
}

export interface MatchRecapPlayer {
  name: string;
  delta: number;
  newElo: number;
}

export interface MatchRecapData {
  teams: MatchRecapTeam[];
  isDraw: boolean;
  players: MatchRecapPlayer[];
}

// Confirmation shown right after a match is saved: what was recorded and how
// each player's ELO moved
const MatchRecapModal: React.FC<{
  recap: MatchRecapData;
  onClose: () => void;
}> = ({ recap, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl p-5"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="w-6 h-6 text-green-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Match saved</h3>
      </div>

      <div className="space-y-2 mb-4">
        {recap.teams.map((team, index) => (
          <div
            key={index}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md border ${
              team.isWinner
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40'
            }`}
          >
            <span className="flex items-center gap-1.5 min-w-0 text-sm text-gray-900 dark:text-white">
              {team.isWinner && <Crown className="w-4 h-4 shrink-0 text-amber-500" />}
              <span className="truncate">{team.names.join(', ')}</span>
            </span>
            <span className={`text-lg font-bold tabular-nums ${
              team.isWinner ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-300'
            }`}>
              {team.score}
            </span>
          </div>
        ))}
        {recap.isDraw && (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Draw</p>
        )}
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          ELO changes
        </div>
        <div className="space-y-1">
          {recap.players.map(player => (
            <div key={player.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-gray-700 dark:text-gray-300">{player.name}</span>
              <span className="flex items-center gap-2 whitespace-nowrap tabular-nums">
                <span className={`inline-flex items-center gap-1 font-semibold ${
                  player.delta > 0
                    ? 'text-green-600 dark:text-green-400'
                    : player.delta < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {player.delta > 0 && <TrendingUp className="w-3.5 h-3.5" />}
                  {player.delta < 0 && <TrendingDown className="w-3.5 h-3.5" />}
                  {player.delta > 0 ? `+${player.delta}` : player.delta}
                </span>
                <span className="text-gray-500 dark:text-gray-400">→ {player.newElo}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
      >
        OK
      </button>
    </div>
  </div>
);

export default MatchRecapModal;
