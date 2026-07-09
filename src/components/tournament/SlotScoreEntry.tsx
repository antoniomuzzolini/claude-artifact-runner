"use client";

import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

interface SlotScoreEntryProps {
  homeName: string;
  awayName: string;
  allowDraw: boolean;
  onSubmit: (homeScore: number, awayScore: number) => void;
  size?: 'sm' | 'lg';
  initialHomeScore?: number;
  initialAwayScore?: number;
  onCancel?: () => void;
}

const SlotScoreEntry: React.FC<SlotScoreEntryProps> = ({
  homeName,
  awayName,
  allowDraw,
  onSubmit,
  size = 'sm',
  initialHomeScore,
  initialAwayScore,
  onCancel
}) => {
  const [homeScore, setHomeScore] = useState<string>(
    initialHomeScore !== undefined ? String(initialHomeScore) : ''
  );
  const [awayScore, setAwayScore] = useState<string>(
    initialAwayScore !== undefined ? String(initialAwayScore) : ''
  );

  const parsedHome = Number(homeScore);
  const parsedAway = Number(awayScore);
  const hasScores = homeScore !== '' && awayScore !== ''
    && Number.isFinite(parsedHome) && Number.isFinite(parsedAway)
    && parsedHome >= 0 && parsedAway >= 0;
  const isForbiddenDraw = hasScores && !allowDraw && parsedHome === parsedAway;
  const canSubmit = hasScores && !isForbiddenDraw;

  const isLarge = size === 'lg';
  const inputClass = isLarge
    ? 'w-20 px-2 py-2.5 text-lg font-semibold text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
    : 'w-14 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
  const buttonClass = isLarge
    ? 'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
    : 'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={isLarge ? '' : 'mt-2'}>
      <div className={`flex items-center ${isLarge ? 'gap-3' : 'gap-2'}`}>
        <input
          type="number"
          min={0}
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          placeholder="0"
          aria-label={`Score for ${homeName}`}
          className={inputClass}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">-</span>
        <input
          type="number"
          min={0}
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          placeholder="0"
          aria-label={`Score for ${awayName}`}
          className={inputClass}
        />
        <button
          onClick={() => canSubmit && onSubmit(parsedHome, parsedAway)}
          disabled={!canSubmit}
          className={buttonClass}
        >
          <Check className={isLarge ? 'w-4 h-4' : 'w-3 h-3'} />
          Save
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className={`${isLarge ? 'p-2.5' : 'p-1'} text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors duration-200`}
            aria-label="Cancel"
          >
            <X className={isLarge ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          </button>
        )}
      </div>
      {isForbiddenDraw && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">Draws are not allowed in this match.</p>
      )}
    </div>
  );
};

export default SlotScoreEntry;
