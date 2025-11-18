import { useState, useEffect } from 'react';
import { api } from '../../services/api';

interface BetSelection {
  id: string;
  betId: string;
  selectedSide: string;
  status: string;
  createdAt: string;
  bet: {
    id: string;
    displayText: string;
    betType: string;
    outcome: string;
    config?: any;
    game: {
      id: string;
      homeTeam: string;
      awayTeam: string;
      startTime: string;
      status: string;
      sport: string;
      metadata?: any;
    };
  };
}

export function MyBetsSection() {
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMySelections();
  }, []);

  const fetchMySelections = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getMySelections();
      if (response.success && response.data?.selections) {
        setSelections(response.data.selections);
      } else {
        setSelections([]);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load your bets');
      setSelections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (selectionId: string) => {
    if (!confirm('Are you sure you want to remove this bet selection?')) {
      return;
    }

    setDeletingId(selectionId);
    try {
      const response = await api.deleteSelection(selectionId);
      if (response.success) {
        await fetchMySelections();
      } else {
        alert(response.error?.message || 'Failed to delete selection');
      }
    } catch (error: any) {
      alert(error.message || 'Failed to delete selection');
    } finally {
      setDeletingId(null);
    }
  };

  const formatSideLabel = (side: string, betType: string, config: any, game: any) => {
    if (betType === 'COMPARISON' && config) {
      const compConfig = config;
      if (side === 'participant_1') {
        const participant = compConfig.participant_1;
        let name = participant?.subject_name || 'Participant 1';
        
        // If it's a team, try to use the game team names
        if (participant?.subject_type === 'TEAM') {
          const metadata = game.metadata;
          const apiData = metadata?.apiData;
          if (apiData?.teams?.home?.id === participant.subject_id) {
            name = game.homeTeam;
          } else if (apiData?.teams?.away?.id === participant.subject_id) {
            name = game.awayTeam;
          }
        }
        
        // Handle spread
        if (compConfig.spread) {
          const spreadValue = compConfig.spread.value;
          const spreadDir = compConfig.spread.direction;
          if (spreadDir === '+') {
            name = `${name} +${spreadValue}`;
          } else {
            name = `${name} -${spreadValue}`;
          }
        }
        
        return name;
      } else if (side === 'participant_2') {
        const participant = compConfig.participant_2;
        let name = participant?.subject_name || 'Participant 2';
        
        // If it's a team, try to use the game team names
        if (participant?.subject_type === 'TEAM') {
          const metadata = game.metadata;
          const apiData = metadata?.apiData;
          if (apiData?.teams?.home?.id === participant.subject_id) {
            name = game.homeTeam;
          } else if (apiData?.teams?.away?.id === participant.subject_id) {
            name = game.awayTeam;
          }
        }
        
        return name;
      }
    } else if (betType === 'THRESHOLD') {
      return side.toUpperCase();
    } else if (betType === 'EVENT') {
      return side.toUpperCase();
    }
    return side;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getSportEmoji = (sport: string) => {
    switch (sport) {
      case 'BASKETBALL': return '🏀';
      case 'FOOTBALL': return '🏈';
      case 'BASEBALL': return '⚾';
      case 'HOCKEY': return '🏒';
      case 'SOCCER': return '⚽';
      default: return '🏆';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-slate-400">Loading your bets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (selections.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">📝</div>
        <p className="text-slate-300 mb-2">You haven't selected any bets yet</p>
        <p className="text-slate-500 text-sm">
          Browse today's bets above and make your selections
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">
            My Bet Selections
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {selections.length} active selection{selections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchMySelections}
          className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {selections.map((selection) => {
          const canDelete = selection.bet.game.status === 'scheduled' && selection.status !== 'locked';
          
          return (
            <div
              key={selection.id}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getSportEmoji(selection.bet.game.sport)}</span>
                    <div>
                      <h3 className="font-semibold text-white">
                        {selection.bet.game.awayTeam} @ {selection.bet.game.homeTeam}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {formatTime(selection.bet.game.startTime)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 p-3 bg-slate-800 rounded-lg">
                    <p className="text-sm text-slate-300 mb-2">
                      {selection.bet.displayText}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded text-xs font-medium border border-orange-600/30">
                        {formatSideLabel(selection.selectedSide, selection.bet.betType, selection.bet.config, selection.bet.game)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        selection.status === 'locked'
                          ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-600/30'
                          : 'bg-green-900/30 text-green-400 border border-green-600/30'
                      }`}>
                        {selection.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-500 mt-2">
                    Selected {formatDate(selection.createdAt)}
                  </p>
                </div>
                
                {canDelete && (
                  <button
                    onClick={() => handleDelete(selection.id)}
                    disabled={deletingId === selection.id}
                    className="px-3 py-1.5 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition text-sm font-medium border border-red-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === selection.id ? 'Removing...' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

