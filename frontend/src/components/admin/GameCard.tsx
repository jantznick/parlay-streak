import React from 'react';
import { BetListItem } from './BetListItem';
import { formatDate, formatTime, formatResolvedBetText, getSportEmoji } from '../../utils/formatting';
import type { GameCardProps } from '../../interfaces';

export function GameCard({
  game,
  isExpanded,
  onToggle,
  onCreateBets,
  onQuickMoneyline,
  onEditBet,
  onDeleteBet,
  onResolveBet,
  onMoveBetPriority,
  creatingMoneyline,
  loadingRoster,
  resolvingBet
}: GameCardProps) {
  const sortedBets = [...(game.bets || [])].sort((a, b) => a.priority - b.priority);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition">
      {/* Game Header */}
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-0">
          <div className="flex-1 min-w-0">
            {/* Game Info */}
            <div className="flex items-center gap-2 sm:gap-3 mb-3">
              <button
                onClick={() => onToggle(game.id)}
                className="text-slate-400 hover:text-white transition flex-shrink-0"
                aria-label={isExpanded ? 'Collapse game' : 'Expand game'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
              <span className="text-xl sm:text-2xl flex-shrink-0">{getSportEmoji(game.sport)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-base sm:text-lg font-semibold text-white truncate">
                  {game.awayTeam} @ {game.homeTeam}
                </div>
                <div className="text-xs sm:text-sm text-slate-400">
                  {formatTime(game.startTime)} • {formatDate(game.startTime)}
                </div>
              </div>
            </div>

            {/* Score and Live Info (if game started) */}
            {(game.homeScore !== null || game.awayScore !== null) && (
              <div className="ml-6 sm:ml-8 mb-3">
                {game.status === 'in_progress' && game.metadata?.liveInfo?.periodDisplay ? (
                  // Live game format: "7:23 3rd Quarter: Pacers 97 - Pistons 83"
                  <div className="text-xs sm:text-sm text-yellow-400 font-medium break-words">
                    {game.metadata.liveInfo.periodDisplay}: {game.awayTeam} {game.awayScore ?? 0} - {game.homeScore ?? 0} {game.homeTeam}
                  </div>
                ) : (
                  // Completed or scheduled game format: "Pacers: 97 - Pistons: 83"
                  <div className="text-xs sm:text-sm text-slate-300 break-words">
                    {game.awayTeam}: <span className="font-bold text-white">{game.awayScore ?? 0}</span> - <span className="font-bold text-white">{game.homeScore ?? 0}</span> {game.homeTeam}
                  </div>
                )}
              </div>
            )}

            {/* Status Badge */}
            <div className="flex gap-2 items-center ml-6 sm:ml-8 flex-wrap">
              <span
                className={`px-2 py-1 text-xs font-medium rounded ${
                  game.status === 'completed'
                    ? 'bg-green-900/50 text-green-400'
                    : game.status === 'in_progress'
                    ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {game.status.replace('_', ' ').toUpperCase()}
              </span>
              
              {/* Bet Count */}
              <span className="px-2 py-1 text-xs font-medium rounded bg-blue-900/50 text-blue-400">
                {game.bets.length} bet{game.bets.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={() => onQuickMoneyline(game)}
              disabled={creatingMoneyline === game.id}
              className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition text-xs sm:text-sm font-medium whitespace-nowrap"
              title="Quickly create a moneyline bet (home team vs away team)"
            >
              {creatingMoneyline === game.id ? 'Creating...' : <><span className="hidden sm:inline">Quick </span>Moneyline</>}
            </button>
            <button
              onClick={() => onCreateBets(game)}
              disabled={loadingRoster}
              className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition text-xs sm:text-sm font-medium whitespace-nowrap"
            >
              {loadingRoster ? 'Loading...' : 'Create Bets'}
            </button>
          </div>
        </div>
      </div>

      {/* Bets Accordion */}
      {isExpanded && sortedBets.length > 0 && (
        <div className="border-t border-slate-800 p-4 space-y-2">
          {sortedBets.map((bet, index) => (
            <BetListItem
              key={bet.id}
              bet={bet}
              game={game}
              index={index}
              totalBets={sortedBets.length}
              onEdit={onEditBet}
              onDelete={onDeleteBet}
              onResolve={onResolveBet}
              onMovePriority={onMoveBetPriority}
              resolvingBet={resolvingBet}
              formatResolvedBetText={formatResolvedBetText}
            />
          ))}
        </div>
      )}

      {isExpanded && sortedBets.length === 0 && (
        <div className="border-t border-slate-800 p-4 text-center text-slate-400 text-sm">
          No bets created yet. Click "Create Bets" to add some.
        </div>
      )}
    </div>
  );
}

