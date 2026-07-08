"use client";

import React from 'react';
import { ResolvedSlot, knockoutRoundLabel } from '../../utils/tournament';

interface BracketViewProps {
  slots: ResolvedSlot[]; // knockout slots only
  getPlayerName: (playerId: number) => string;
}

const BracketSlotCard: React.FC<{
  slot: ResolvedSlot;
  getPlayerName: (playerId: number) => string;
}> = ({ slot, getPlayerName }) => {
  const scoreFor = (playerId: number | null): number | null => {
    if (!slot.match || playerId === null) return null;
    const teamIndex = slot.match.teams.findIndex(team => team.some(member => member.id === playerId));
    return teamIndex === -1 ? null : slot.match.scores[teamIndex] ?? null;
  };

  const renderSide = (
    playerId: number | null,
    isBye: boolean,
    placeholder: string | null
  ) => {
    const isWinner = slot.winnerPlayerId !== null && playerId === slot.winnerPlayerId;
    const isUnresolved = isBye || playerId === null;
    const label = isBye ? 'Bye' : (playerId !== null ? getPlayerName(playerId) : placeholder ?? 'TBD');
    const score = scoreFor(playerId);
    return (
      <div className={`flex items-center justify-between gap-2 px-3 py-1.5 ${
        isWinner ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
      }`}>
        <span className={`truncate ${isUnresolved ? 'italic text-gray-400 dark:text-gray-500 text-xs' : ''}`}>
          {label}
        </span>
        {score !== null && (
          <span className={`text-sm tabular-nums ${isWinner ? 'text-blue-600 dark:text-blue-400' : ''}`}>
            {score}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={`w-full rounded-lg border text-sm ${
      slot.status === 'ready'
        ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 shadow-sm'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      {renderSide(slot.homePlayerId, slot.homeIsBye, slot.homePlaceholder)}
      <div className="border-t border-gray-100 dark:border-gray-700/60" />
      {renderSide(slot.awayPlayerId, slot.awayIsBye, slot.awayPlaceholder)}
    </div>
  );
};

// Connector lines between a round with 2n matches and the next round with n
// matches. Column layout uses equal flex bands, so slot centers sit at fixed
// fractional heights — the SVG (stretched, non-scaling stroke) can draw the
// classic bracket joins without measuring the DOM.
const RoundConnector: React.FC<{ matchesInNextRound: number }> = ({ matchesInNextRound }) => (
  <div className="flex flex-col w-8 shrink-0">
    <div className="h-4 mb-3" />
    <div className="flex-1 relative text-gray-300 dark:text-gray-600">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {Array.from({ length: matchesInNextRound }, (_, position) => {
          const n = matchesInNextRound;
          const yTop = ((2 * position + 0.5) / (2 * n)) * 100;
          const yBottom = ((2 * position + 1.5) / (2 * n)) * 100;
          const yTarget = ((position + 0.5) / n) * 100;
          return (
            <path
              key={position}
              d={`M 0 ${yTop} H 50 V ${yBottom} H 0 M 50 ${yTarget} H 100`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  </div>
);

const BracketView: React.FC<BracketViewProps> = ({ slots, getPlayerName }) => {
  const totalRounds = slots.reduce((max, slot) => Math.max(max, slot.round), 0);
  const rounds = Array.from({ length: totalRounds }, (_, index) =>
    slots
      .filter(slot => slot.round === index + 1)
      .sort((a, b) => a.position - b.position)
  );

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-stretch">
        {rounds.map((roundSlots, roundIndex) => (
          <React.Fragment key={roundIndex}>
            {roundIndex > 0 && <RoundConnector matchesInNextRound={roundSlots.length} />}
            <div className="flex flex-col w-52">
              <div className="h-4 mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
                {knockoutRoundLabel(roundIndex + 1, totalRounds)}
              </div>
              <div className="flex flex-col flex-1">
                {roundSlots.map(slot => (
                  <div key={slot.id} className="flex-1 flex items-center py-1.5">
                    <BracketSlotCard slot={slot} getPlayerName={getPlayerName} />
                  </div>
                ))}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default BracketView;
