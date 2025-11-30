import React from 'react';
import type { SingleBetCardProps } from '../../interfaces';

export function SingleBetCard({
  selection,
  formatSelectionText,
  formatTime,
  getSportEmoji,
  isBetInActiveParlay,
  canModify,
  startingParlayId,
  deletingId,
  onStartParlay,
  onDelete
}: SingleBetCardProps) {
  const inBuilder = isBetInActiveParlay(selection.id, selection.bet.id);

  return (
    <div
      className={`bg-slate-900 border rounded-lg px-3 py-2 transition-all duration-200 relative ${
        inBuilder
          ? 'border-blue-500 border-2'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Greyed out overlay for bets in parlay builder */}
      {inBuilder && (
        <>
          <div className="absolute inset-0 bg-slate-950/85 rounded-lg z-20 pointer-events-none" />
          <div className="absolute top-1.5 right-1.5 z-30">
            <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-xs font-medium border border-blue-500 shadow-lg">
              In Builder
            </span>
          </div>
        </>
      )}
      <div className="flex items-center gap-3">
        <span className="text-lg flex-shrink-0">{getSportEmoji(selection.bet.game.sport)}</span>
        <span className="text-xs text-slate-400 flex-shrink-0">{formatTime(selection.bet.game.startTime)}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium truncate">
            {formatSelectionText(selection.selectedSide, selection.bet.betType, selection.bet.config, selection.bet.game, selection.outcome || selection.bet.outcome)}
          </div>
          {selection.bet.game.status === 'completed' && selection.bet.game.homeScore !== null && selection.bet.game.awayScore !== null && (
            <div className="text-xs text-slate-400 mt-0.5">
              {selection.bet.game.awayTeam} {selection.bet.game.awayScore} - {selection.bet.game.homeScore} {selection.bet.game.homeTeam}
            </div>
          )}
        </div>
        {selection.status === 'locked' && (
          <span className="px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 bg-yellow-900/30 text-yellow-400 border border-yellow-600/30">
            🔒
          </span>
        )}
        {selection.outcome && selection.outcome !== 'pending' && (
          <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
            selection.outcome === 'win' ? 'bg-green-900/50 text-green-400' :
            selection.outcome === 'loss' ? 'bg-red-900/50 text-red-400' :
            'bg-yellow-900/50 text-yellow-400'
          }`}>
            {selection.outcome.toUpperCase()}
          </span>
        )}
        {canModify && (
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => onStartParlay(selection.id, selection.bet.id, selection.selectedSide)}
              disabled={startingParlayId === selection.id}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startingParlayId === selection.id ? '...' : 'Make Parlay'}
            </button>
            <button
              onClick={() => onDelete(selection.id)}
              disabled={deletingId === selection.id}
              className="px-2 py-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 text-xs font-medium border border-red-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove"
            >
              {deletingId === selection.id ? '...' : '×'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

