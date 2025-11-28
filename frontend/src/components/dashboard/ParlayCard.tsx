import React from 'react';
import type { Parlay, ParlayCardProps } from '../../interfaces';

export function ParlayCard({
  parlay,
  formatSelectionText,
  formatTime,
  getSportEmoji,
  onOpenParlay
}: ParlayCardProps) {
  const isLocked = parlay.lockedAt !== null && parlay.lockedAt !== undefined;

  return (
    <div className="bg-gradient-to-br from-blue-900/20 to-slate-900 border-2 border-blue-800/50 rounded-lg px-3 py-2 hover:border-blue-700/50 transition-all duration-200">
      <div className="flex items-center gap-3">
        <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-bold border border-blue-500 flex-shrink-0">
          {parlay.betCount} LEG PARLAY
        </span>
        {parlay.insured && (
          <span className="px-1.5 py-0.5 bg-orange-900/30 text-orange-400 rounded text-xs font-medium border border-orange-600/30 flex-shrink-0">
            INSURED
          </span>
        )}
        {isLocked && (
          <span className="px-1.5 py-0.5 bg-yellow-900/30 text-yellow-400 rounded text-xs font-medium border border-yellow-600/30 flex-shrink-0">
            🔒
          </span>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
          {parlay.selections.map((selection, idx) => (
            <div key={selection.id} className="flex items-center gap-1.5 flex-shrink-0">
              {idx > 0 && <span className="text-slate-500">•</span>}
              <span className="text-xs">{getSportEmoji(selection.game.sport)}</span>
              <span className="text-xs text-slate-400">{formatTime(selection.game.startTime)}</span>
              <span className="text-xs text-white font-medium whitespace-nowrap">
                {formatSelectionText(selection.selectedSide, selection.bet.betType, selection.bet.config, selection.game, selection.outcome)}
              </span>
              {selection.status === 'locked' && (
                <span className="px-1 py-0.5 rounded text-xs flex-shrink-0 bg-yellow-900/30 text-yellow-400">
                  🔒
                </span>
              )}
              {selection.outcome && selection.outcome !== 'pending' && (
                <span className={`px-1 py-0.5 rounded text-xs flex-shrink-0 ${
                  selection.outcome === 'win' ? 'bg-green-900/50 text-green-400' :
                  selection.outcome === 'loss' ? 'bg-red-900/50 text-red-400' :
                  'bg-yellow-900/50 text-yellow-400'
                }`}>
                  {selection.outcome.toUpperCase()}
                </span>
              )}
            </div>
          ))}
        </div>
        {!isLocked && (
          <button
            onClick={() => onOpenParlay(parlay)}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex-shrink-0"
          >
            Open
          </button>
        )}
      </div>
    </div>
  );
}

