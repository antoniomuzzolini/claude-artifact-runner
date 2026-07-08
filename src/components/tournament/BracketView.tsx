"use client";

import React from 'react';
import { ResolvedSlot, knockoutRoundLabel } from '../../utils/tournament';
import SlotScoreEntry from './SlotScoreEntry';

interface BracketViewProps {
  slots: ResolvedSlot[]; // knockout slots only
  getPlayerName: (playerId: number) => string;
  canRecordResults: boolean;
  onRecordResult: (slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
}

const sideLabel = (
  playerId: number | null,
  isBye: boolean,
  getPlayerName: (playerId: number) => string
) => {
  if (isBye) return 'Bye';
  if (playerId === null) return 'TBD';
  return getPlayerName(playerId);
};

const BracketSlotCard: React.FC<{
  slot: ResolvedSlot;
  getPlayerName: (playerId: number) => string;
  canRecordResults: boolean;
  onRecordResult: BracketViewProps['onRecordResult'];
}> = ({ slot, getPlayerName, canRecordResults, onRecordResult }) => {
  const homeLabel = sideLabel(slot.homePlayerId, slot.homeIsBye, getPlayerName);
  const awayLabel = sideLabel(slot.awayPlayerId, slot.awayIsBye, getPlayerName);
  const scores = slot.match?.scores ?? null;

  const scoreFor = (playerId: number | null): number | null => {
    if (!slot.match || !scores || playerId === null) return null;
    const teamIndex = slot.match.teams.findIndex(team => team.some(member => member.id === playerId));
    return teamIndex === -1 ? null : scores[teamIndex] ?? null;
  };

  const renderSide = (playerId: number | null, isBye: boolean, label: string) => {
    const isWinner = slot.winnerPlayerId !== null && playerId === slot.winnerPlayerId;
    const score = scoreFor(playerId);
    return (
      <div className={`flex items-center justify-between gap-2 px-3 py-1.5 ${
        isWinner ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
      }`}>
        <span className={`truncate ${isBye || playerId === null ? 'italic text-gray-400 dark:text-gray-500' : ''}`}>
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
    <div className={`w-52 rounded-lg border text-sm ${
      slot.status === 'ready'
        ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      {renderSide(slot.homePlayerId, slot.homeIsBye, homeLabel)}
      <div className="border-t border-gray-100 dark:border-gray-700/60" />
      {renderSide(slot.awayPlayerId, slot.awayIsBye, awayLabel)}
      {slot.status === 'ready' && canRecordResults && (
        <div className="px-3 pb-2">
          <SlotScoreEntry
            homeName={homeLabel}
            awayName={awayLabel}
            allowDraw={false}
            onSubmit={(homeScore, awayScore) => onRecordResult(slot, homeScore, awayScore)}
          />
        </div>
      )}
    </div>
  );
};

const BracketView: React.FC<BracketViewProps> = ({
  slots,
  getPlayerName,
  canRecordResults,
  onRecordResult
}) => {
  const totalRounds = slots.reduce((max, slot) => Math.max(max, slot.round), 0);
  const rounds = Array.from({ length: totalRounds }, (_, index) =>
    slots
      .filter(slot => slot.round === index + 1)
      .sort((a, b) => a.position - b.position)
  );

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-8 min-w-max">
        {rounds.map((roundSlots, roundIndex) => (
          <div key={roundIndex} className="flex flex-col">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 text-center">
              {knockoutRoundLabel(roundIndex + 1, totalRounds)}
            </div>
            <div className="flex flex-col justify-around flex-1 gap-4">
              {roundSlots.map(slot => (
                <BracketSlotCard
                  key={slot.id}
                  slot={slot}
                  getPlayerName={getPlayerName}
                  canRecordResults={canRecordResults}
                  onRecordResult={onRecordResult}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BracketView;
