import React from 'react';
import type { BetListItemProps } from '../../interfaces';
  onEdit: (bet: Bet, game: Game) => void;
  onDelete: (bet: Bet, game: Game) => void;
  onResolve: (bet: Bet) => void;
  onMovePriority: (gameId: string, betId: string, direction: 'up' | 'down') => void;
  resolvingBet: string | null;
  formatResolvedBetText: (bet: Bet, game: Game) => string;
}

export function BetListItem({
  bet,
  game,
  index,
  totalBets,
  onEdit,
  onDelete,
  onResolve,
  onMovePriority,
  resolvingBet,
  formatResolvedBetText
}: BetListItemProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between hover:bg-slate-750 transition">
      <div className="flex items-center gap-3 flex-1">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onMovePriority(game.id, bet.id, 'up')}
            disabled={index === 0}
            className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs"
            title="Move up"
          >
            ▲
          </button>
          <button
            onClick={() => onMovePriority(game.id, bet.id, 'down')}
            disabled={index === totalBets - 1}
            className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs"
            title="Move down"
          >
            ▼
          </button>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-slate-400">#{bet.priority}</span>
            <span className="text-sm font-medium text-white">
              {formatResolvedBetText(bet, game)}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${
                bet.outcome === 'win'
                  ? 'bg-green-900/50 text-green-400'
                  : bet.outcome === 'loss'
                  ? 'bg-red-900/50 text-red-400'
                  : bet.outcome === 'push'
                  ? 'bg-yellow-900/50 text-yellow-400'
                  : bet.outcome === 'void'
                  ? 'bg-slate-700 text-slate-300'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {bet.outcome?.toUpperCase() || 'PENDING'}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            {bet.betType}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onResolve(bet)}
          disabled={
            resolvingBet === bet.id || 
            bet.outcome !== 'pending' ||
            (game.status === 'scheduled' && new Date(game.startTime) > new Date())
          }
          className="px-3 py-1.5 text-xs bg-green-900/50 hover:bg-green-900/70 disabled:bg-slate-700 disabled:text-slate-500 text-green-400 rounded transition"
          title={
            bet.outcome !== 'pending' 
              ? 'Bet already resolved' 
              : game.status === 'scheduled' && new Date(game.startTime) > new Date()
              ? 'Game has not started yet'
              : 'Manually resolve this bet'
          }
        >
          {resolvingBet === bet.id ? 'Resolving...' : 'Resolve'}
        </button>
        <button
          onClick={() => onEdit(bet, game)}
          className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(bet, game)}
          className="px-3 py-1.5 text-xs bg-red-900/50 hover:bg-red-900/70 text-red-400 rounded transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

