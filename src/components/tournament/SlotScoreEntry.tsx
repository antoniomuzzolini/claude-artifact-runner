"use client";

import React, { useState } from 'react';
import { Check } from 'lucide-react';

interface SlotScoreEntryProps {
  homeName: string;
  awayName: string;
  allowDraw: boolean;
  onSubmit: (homeScore: number, awayScore: number) => void;
}

const SlotScoreEntry: React.FC<SlotScoreEntryProps> = ({ homeName, awayName, allowDraw, onSubmit }) => {
  const [homeScore, setHomeScore] = useState<string>('');
  const [awayScore, setAwayScore] = useState<string>('');

  const parsedHome = Number(homeScore);
  const parsedAway = Number(awayScore);
  const hasScores = homeScore !== '' && awayScore !== ''
    && Number.isFinite(parsedHome) && Number.isFinite(parsedAway)
    && parsedHome >= 0 && parsedAway >= 0;
  const isForbiddenDraw = hasScores && !allowDraw && parsedHome === parsedAway;
  const canSubmit = hasScores && !isForbiddenDraw;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          placeholder="0"
          aria-label={`Score for ${homeName}`}
          className="w-14 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">-</span>
        <input
          type="number"
          min={0}
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          placeholder="0"
          aria-label={`Score for ${awayName}`}
          className="w-14 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => canSubmit && onSubmit(parsedHome, parsedAway)}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-3 h-3" />
          Save
        </button>
      </div>
      {isForbiddenDraw && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">Draws are not allowed in knockout matches.</p>
      )}
    </div>
  );
};

export default SlotScoreEntry;
