"use client";

import React from 'react';
import { StandingsRow } from '../../utils/tournament';

interface StandingsTableProps {
  rows: StandingsRow[];
  getPlayerName: (playerId: number) => string;
  qualifiedCount?: number; // highlight the top N rows (group qualifiers)
  title?: string;
}

const StandingsTable: React.FC<StandingsTableProps> = ({
  rows,
  getPlayerName,
  qualifiedCount = 0,
  title
}) => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    {title && (
      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {title}
      </div>
    )}
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700">
            <th className="px-3 py-2 text-left w-8">#</th>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-2 py-2 text-center" title="Played">P</th>
            <th className="px-2 py-2 text-center" title="Wins">W</th>
            <th className="px-2 py-2 text-center" title="Draws">D</th>
            <th className="px-2 py-2 text-center" title="Losses">L</th>
            <th className="px-2 py-2 text-center" title="Score difference">+/-</th>
            <th className="px-3 py-2 text-center font-bold" title="Points">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.playerId}
              className={`border-b border-gray-100 dark:border-gray-700/60 last:border-b-0 ${
                index < qualifiedCount
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : ''
              }`}
            >
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{index + 1}</td>
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                {getPlayerName(row.playerId)}
              </td>
              <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{row.played}</td>
              <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{row.wins}</td>
              <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{row.draws}</td>
              <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">{row.losses}</td>
              <td className="px-2 py-2 text-center text-gray-700 dark:text-gray-300">
                {row.scoreFor - row.scoreAgainst > 0 ? '+' : ''}{row.scoreFor - row.scoreAgainst}
              </td>
              <td className="px-3 py-2 text-center font-bold text-gray-900 dark:text-white">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default StandingsTable;
