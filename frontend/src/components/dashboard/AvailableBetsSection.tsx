import React from 'react';
import { formatDateDisplay } from './DateNavigation';
import type { AvailableBetsSectionProps } from '../../interfaces';
  loading: boolean;
  isPastDate: boolean;
}

export function AvailableBetsSection({
  games,
  selections,
  formatResolvedBetText,
  formatTime,
  getSportEmoji,
  selectedDate,
  loading,
  isPastDate
}: AvailableBetsSectionProps) {
  const userSelectedBetIds = new Set(selections.map(s => s.betId));

  if (loading) {
    return (
      <div className="text-center text-slate-400 text-sm py-8">
        Loading available bets...
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-8 text-center border border-slate-800">
        <div className="text-4xl mb-4">📅</div>
        <p className="text-slate-300 mb-2">No bets available for {formatDateDisplay(selectedDate)}</p>
        <p className="text-slate-500 text-sm">
          {isPastDate 
            ? "There were no games with bets available on this date"
            : "No games with bets available for this date"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {games.map((game) => {
        const sortedBets = [...game.bets].sort((a, b) => a.priority - b.priority);
        
        return (
          <div key={game.id} className="rounded-lg border p-4 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-lg">{getSportEmoji(game.sport)}</span>
              <div className="flex-1">
                <div className="text-white font-medium">
                  {game.awayTeam} @ {game.homeTeam}
                </div>
                <div className="text-xs text-slate-400">
                  {formatTime(game.startTime)} • {game.status}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {sortedBets.map((bet) => {
                const isSelected = userSelectedBetIds.has(bet.id);
                const formattedText = formatResolvedBetText(bet, game);
                
                return (
                  <div
                    key={bet.id}
                    className={`text-sm px-3 py-2 rounded ${
                      isSelected
                        ? 'bg-blue-900/30 border border-blue-700/50 text-blue-200'
                        : 'bg-slate-700/30 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">#{bet.priority}</span>
                      <span className="flex-1">{formattedText}</span>
                      {isSelected && (
                        <span className="text-xs text-blue-400">✓ Selected</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

