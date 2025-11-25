import React from 'react';
import { BetListItem } from './BetListItem';
import { formatDate, formatTime, formatResolvedBetText } from '../../utils/formatting';

interface Bet {
  id: string;
  betType: string;
  displayText: string;
  priority: number;
  outcome?: string;
  config?: any;
  displayTextOverride?: string;
}

interface Game {
  id: string;
  externalId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  metadata?: any;
  bets: Bet[];
}

interface GameCardProps {
  game: Game;
  isExpanded: boolean;
  onToggle: (gameId: string) => void;
  onCreateBets: (game: Game) => void;
  onQuickMoneyline: (game: Game) => void;
  onEditBet: (bet: Bet, game: Game) => void;
  onDeleteBet: (bet: Bet, game: Game) => void;
  onResolveBet: (bet: Bet) => void;
  onMoveBetPriority: (gameId: string, betId: string, direction: 'up' | 'down') => void;
  creatingMoneyline: string | null;
  loadingRoster: boolean;
  resolvingBet: string | null;
}

function getSportEmoji(sport: string): string {
  switch (sport) {
    case 'BASKETBALL':
      return '🏀';
    case 'FOOTBALL':
      return '🏈';
    case 'BASEBALL':
      return '⚾';
    case 'HOCKEY':
      return '🏒';
    case 'SOCCER':
      return '⚽';
    default:
      return '🏆';
  }
}

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
  const sortedBets = [...game.bets].sort((a, b) => a.priority - b.priority);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition">
      {/* Game Header */}
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {/* Game Info */}
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => onToggle(game.id)}
                className="text-slate-400 hover:text-white transition"
                aria-label={isExpanded ? 'Collapse game' : 'Expand game'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
              <span className="text-2xl">{getSportEmoji(game.sport)}</span>
              <div>
                <div className="text-lg font-semibold text-white">
                  {game.awayTeam} @ {game.homeTeam}
                </div>
                <div className="text-sm text-slate-400">
                  {formatTime(game.startTime)} • {formatDate(game.startTime)}
                </div>
              </div>
            </div>

            {/* Score (if game started) */}
            {(game.homeScore !== null || game.awayScore !== null) && (
              <div className="flex gap-4 text-sm mb-3 ml-8">
                <span className="text-slate-300">
                  {game.awayTeam}: <span className="font-bold text-white">{game.awayScore}</span>
                </span>
                <span className="text-slate-300">
                  {game.homeTeam}: <span className="font-bold text-white">{game.homeScore}</span>
                </span>
              </div>
            )}

            {/* Status Badge */}
            <div className="flex gap-2 items-center ml-8">
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
          <div className="flex gap-2">
            <button
              onClick={() => onQuickMoneyline(game)}
              disabled={creatingMoneyline === game.id}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition text-sm font-medium"
              title="Quickly create a moneyline bet (home team vs away team)"
            >
              {creatingMoneyline === game.id ? 'Creating...' : 'Quick Moneyline'}
            </button>
            <button
              onClick={() => onCreateBets(game)}
              disabled={loadingRoster}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition text-sm font-medium"
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

