import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../services/api';
import { BASKETBALL_CONFIG } from '@shared/config/sports/basketball';
import type { BetType, Participant, ComparisonConfig, ThresholdConfig, EventConfig, BetConfig, TimePeriod } from '@shared/types/bets';

interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  sport: string;
  metadata?: any;
}

interface Player {
  id: string;
  displayName: string;
  fullName?: string;
  position?: {
    displayName?: string;
    name?: string;
    abbreviation?: string;
  };
  jersey?: string;
  jerseyNumber?: string;
}

interface RosterData {
  home: {
    team: string;
    roster: {
      athletes: Array<Player>;
    } | null;
  };
  away: {
    team: string;
    roster: {
      athletes: Array<Player>;
    } | null;
  };
}

interface BetCreationModalProps {
  game: Game;
  rosterData: RosterData | null;
  onClose: () => void;
  onBetCreated: () => void;
}

// Extract ParticipantSelector as a separate component to prevent recreation
function ParticipantSelector({ 
  value, 
  onChange, 
  label,
  game,
  players,
  sportConfig,
  betType,
  // For THRESHOLD bets
  thresholdOperator,
  onThresholdOperatorChange,
  threshold,
  onThresholdChange,
  // For EVENT bets
  eventType,
  onEventTypeChange
}: { 
  value: Participant | null; 
  onChange: (p: Participant | null) => void;
  label: string;
  game: Game;
  players: Player[];
  sportConfig: typeof BASKETBALL_CONFIG;
  betType?: BetType;
  // For THRESHOLD bets
  thresholdOperator?: 'OVER' | 'UNDER';
  onThresholdOperatorChange?: (op: 'OVER' | 'UNDER') => void;
  threshold?: number;
  onThresholdChange?: (val: number) => void;
  // For EVENT bets
  eventType?: 'DOUBLE_DOUBLE' | 'TRIPLE_DOUBLE';
  onEventTypeChange?: (et: 'DOUBLE_DOUBLE' | 'TRIPLE_DOUBLE') => void;
}) {
  const [subjectType, setSubjectType] = useState<'TEAM' | 'PLAYER'>('TEAM');
  const [selectedId, setSelectedId] = useState<string>('');
  const [metric, setMetric] = useState<string>('');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('FULL_GAME');

  useEffect(() => {
    if (subjectType && selectedId && metric && timePeriod) {
      let subjectName = '';
      let actualSubjectId = selectedId;
      
      if (subjectType === 'TEAM') {
        if (selectedId === 'home') {
          subjectName = game.homeTeam;
          // Get actual team ID from game metadata
          const metadata = (game as any).metadata;
          const apiData = metadata?.apiData;
          if (apiData?.teams?.home?.id) {
            actualSubjectId = apiData.teams.home.id;
          }
        } else if (selectedId === 'away') {
          subjectName = game.awayTeam;
          // Get actual team ID from game metadata
          const metadata = (game as any).metadata;
          const apiData = metadata?.apiData;
          if (apiData?.teams?.away?.id) {
            actualSubjectId = apiData.teams.away.id;
          }
        }
      } else {
        const player = players.find(p => p.id === selectedId);
        subjectName = player?.displayName || '';
        actualSubjectId = selectedId; // Player IDs are already correct
      }

      if (subjectName) {
        onChange({
          subject_type: subjectType,
          subject_id: actualSubjectId,
          subject_name: subjectName,
          metric,
          time_period: timePeriod
        });
      }
    } else {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectType, selectedId, metric, timePeriod, game.homeTeam, game.awayTeam, players]);

  const availableMetrics = sportConfig.metrics.filter(m => 
    subjectType === 'TEAM' ? m.team : m.player
  );

  return (
    <div className="space-y-3 p-4 bg-slate-800 rounded-lg">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      
      <div>
        <label className="block text-xs text-slate-400 mb-1">Type</label>
        <select
          value={subjectType}
          onChange={(e) => {
            setSubjectType(e.target.value as 'TEAM' | 'PLAYER');
            setSelectedId('');
          }}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
        >
          <option value="TEAM">Team</option>
          <option value="PLAYER">Player</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">
          {subjectType === 'TEAM' ? 'Team' : 'Player'}
        </label>
        {subjectType === 'TEAM' ? (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          >
            <option value="">Select team</option>
            <option value="home">{game.homeTeam}</option>
            <option value="away">{game.awayTeam}</option>
          </select>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          >
            <option value="">Select player</option>
            {/* Group players by team */}
            {(() => {
              const homePlayers = players.filter((p: any) => p.team === game.homeTeam);
              const awayPlayers = players.filter((p: any) => p.team === game.awayTeam);
              
              return (
                <>
                  {homePlayers.length > 0 && (
                    <optgroup label={game.homeTeam}>
                      {homePlayers.map((player: any) => {
                        const jersey = player.jersey || player.jerseyNumber || '';
                        const position = player.position?.displayName || player.position?.name || player.position?.abbreviation || '';
                        const name = player.displayName || player.fullName || 'Unknown';
                        return (
                          <option key={player.id} value={player.id}>
                            {name} {jersey ? `#${jersey}` : ''} {position ? `(${position})` : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                  {awayPlayers.length > 0 && (
                    <optgroup label={game.awayTeam}>
                      {awayPlayers.map((player: any) => {
                        const jersey = player.jersey || player.jerseyNumber || '';
                        const position = player.position?.displayName || player.position?.name || player.position?.abbreviation || '';
                        const name = player.displayName || player.fullName || 'Unknown';
                        return (
                          <option key={player.id} value={player.id}>
                            {name} {jersey ? `#${jersey}` : ''} {position ? `(${position})` : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </>
              );
            })()}
          </select>
        )}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Metric</label>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
        >
          <option value="">Select metric</option>
          {availableMetrics.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Time Period</label>
        <select
          value={timePeriod}
          onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
        >
          {sportConfig.time_periods.map((tp) => (
            <option key={tp.value} value={tp.value}>
              {tp.label}
            </option>
          ))}
        </select>
      </div>

      {/* THRESHOLD-specific fields */}
      {betType === 'THRESHOLD' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Operator</label>
              <select
                value={thresholdOperator || 'OVER'}
                onChange={(e) => onThresholdOperatorChange?.(e.target.value as 'OVER' | 'UNDER')}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
              >
                <option value="OVER">Over</option>
                <option value="UNDER">Under</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Threshold</label>
              <input
                type="number"
                step="0.5"
                value={threshold || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) onThresholdChange?.(val);
                }}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                placeholder="28.5"
              />
            </div>
          </div>
        </>
      )}

      {/* EVENT-specific fields */}
      {betType === 'EVENT' && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">Event Type</label>
          <select
            value={eventType || 'DOUBLE_DOUBLE'}
            onChange={(e) => onEventTypeChange?.(e.target.value as 'DOUBLE_DOUBLE' | 'TRIPLE_DOUBLE')}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
          >
            <option value="DOUBLE_DOUBLE">Double Double</option>
            <option value="TRIPLE_DOUBLE">Triple Double</option>
          </select>
        </div>
      )}
    </div>
  );
}

export function BetCreationModal({ game, rosterData, onClose, onBetCreated }: BetCreationModalProps) {
  const [betType, setBetType] = useState<BetType>('COMPARISON');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // COMPARISON state
  const [compParticipant1, setCompParticipant1] = useState<Participant | null>(null);
  const [compParticipant2, setCompParticipant2] = useState<Participant | null>(null);
  const [compOperator, setCompOperator] = useState<'GREATER_THAN' | 'spread'>('GREATER_THAN');
  const [spreadDirection, setSpreadDirection] = useState<'+' | '-'>('+');
  const [spreadValue, setSpreadValue] = useState<number>(3.5);

  // THRESHOLD state
  const [threshParticipant, setThreshParticipant] = useState<Participant | null>(null);
  const [threshOperator, setThreshOperator] = useState<'OVER' | 'UNDER'>('OVER');
  const [threshold, setThreshold] = useState<number>(0);

  // EVENT state - removed for now, will be re-added later
  // const [eventParticipant, setEventParticipant] = useState<Participant | null>(null);
  // const [eventType, setEventType] = useState<'DOUBLE_DOUBLE' | 'TRIPLE_DOUBLE'>('DOUBLE_DOUBLE');

  // Memoize players list to prevent unnecessary recalculations
  const players = useMemo((): Player[] => {
    if (!rosterData) return [];
    
    const playersList: Player[] = [];
    
    // Handle flat array structure (from cached data)
    if (rosterData.home?.roster?.athletes && Array.isArray(rosterData.home.roster.athletes)) {
      const homePlayers = rosterData.home.roster.athletes;
      // Check if it's a flat array or nested structure
      if (homePlayers.length > 0 && 'items' in homePlayers[0]) {
        // Nested structure (position groups with items)
        for (const positionGroup of homePlayers as any[]) {
          if (positionGroup.items && Array.isArray(positionGroup.items)) {
            playersList.push(...positionGroup.items.map((p: any) => ({ ...p, team: game.homeTeam })));
          }
        }
      } else {
        // Flat array structure
        playersList.push(...homePlayers.map((p: any) => ({ ...p, team: game.homeTeam })));
      }
    }
    
    if (rosterData.away?.roster?.athletes && Array.isArray(rosterData.away.roster.athletes)) {
      const awayPlayers = rosterData.away.roster.athletes;
      // Check if it's a flat array or nested structure
      if (awayPlayers.length > 0 && 'items' in awayPlayers[0]) {
        // Nested structure
        for (const positionGroup of awayPlayers as any[]) {
          if (positionGroup.items && Array.isArray(positionGroup.items)) {
            playersList.push(...positionGroup.items.map((p: any) => ({ ...p, team: game.awayTeam })));
          }
        }
      } else {
        // Flat array structure
        playersList.push(...awayPlayers.map((p: any) => ({ ...p, team: game.awayTeam })));
      }
    }
    
    return playersList;
  }, [rosterData, game.homeTeam, game.awayTeam]);

  const sportConfig = BASKETBALL_CONFIG; // TODO: Get from game.sport

  const handleCreateBet = async () => {
    setLoading(true);
    setError(null);

    try {
      let config: BetConfig;

      if (betType === 'COMPARISON') {
        if (!compParticipant1 || !compParticipant2) {
          setError('Please select both participants');
          setLoading(false);
          return;
        }

        config = {
          type: 'COMPARISON',
          participant_1: compParticipant1,
          participant_2: compParticipant2,
          operator: 'GREATER_THAN',
          spread: compOperator === 'spread' ? {
            direction: spreadDirection,
            value: spreadValue
          } : undefined
        } as ComparisonConfig;
      } else if (betType === 'THRESHOLD') {
        if (!threshParticipant) {
          setError('Please select a participant');
          setLoading(false);
          return;
        }

        config = {
          type: 'THRESHOLD',
          participant: threshParticipant,
          operator: threshOperator,
          threshold
        } as ThresholdConfig;
      } else {
        setError('Invalid bet type');
        setLoading(false);
        return;
      }

      const response = await api.createBet(game.id, betType, config);
      
      if (response.success) {
        onBetCreated();
        onClose();
      } else {
        setError(response.error?.message || 'Failed to create bet');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create bet');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-800">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Create Bet</h2>
            <p className="text-slate-400 text-sm mt-1">
              {game.awayTeam} @ {game.homeTeam}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Bet Type Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Bet Type
            </label>
            <select
              value={betType}
              onChange={(e) => setBetType(e.target.value as BetType)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            >
              <option value="COMPARISON">Comparison (vs)</option>
              <option value="THRESHOLD">Threshold (Over/Under)</option>
            </select>
          </div>

          {/* COMPARISON Form */}
          {betType === 'COMPARISON' && (
            <div className="space-y-4">
              <ParticipantSelector
                label="Participant 1"
                value={compParticipant1}
                onChange={setCompParticipant1}
                game={game}
                players={players}
                sportConfig={sportConfig}
                betType="COMPARISON"
              />

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Operator
                </label>
                <select
                  value={compOperator}
                  onChange={(e) => setCompOperator(e.target.value as 'GREATER_THAN' | 'spread')}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  <option value="GREATER_THAN">Greater Than (&gt;)</option>
                  <option value="spread">Spread (+/-)</option>
                </select>
              </div>

              {compOperator === 'spread' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Direction</label>
                    <select
                      value={spreadDirection}
                      onChange={(e) => setSpreadDirection(e.target.value as '+' | '-')}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                    >
                      <option value="+">+</option>
                      <option value="-">-</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Value (must be X.5)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={spreadValue}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) setSpreadValue(val);
                      }}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                      placeholder="3.5"
                    />
                  </div>
                </div>
              )}

              <ParticipantSelector
                label="Participant 2"
                value={compParticipant2}
                onChange={setCompParticipant2}
                game={game}
                players={players}
                sportConfig={sportConfig}
                betType="COMPARISON"
              />
            </div>
          )}

          {/* THRESHOLD Form */}
          {betType === 'THRESHOLD' && (
            <div className="space-y-4">
              <ParticipantSelector
                label="Participant"
                value={threshParticipant}
                onChange={setThreshParticipant}
                game={game}
                players={players}
                sportConfig={sportConfig}
                betType="THRESHOLD"
                thresholdOperator={threshOperator}
                onThresholdOperatorChange={setThreshOperator}
                threshold={threshold}
                onThresholdChange={setThreshold}
              />
            </div>
          )}


          {/* Preview */}
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-xs text-slate-400 mb-2">Preview:</p>
            <p className="text-white font-medium">
              {betType === 'COMPARISON' && compParticipant1 && compParticipant2 && (
                compOperator === 'spread' && spreadValue
                  ? `${compParticipant1.subject_name} ${spreadDirection}${spreadValue}`
                  : `${compParticipant1.subject_name} > ${compParticipant2.subject_name}`
              )}
              {betType === 'THRESHOLD' && threshParticipant && (
                `${threshParticipant.subject_name} ${threshOperator} ${threshold} ${threshParticipant.metric}`
              )}
              {!((betType === 'COMPARISON' && compParticipant1 && compParticipant2) ||
                 (betType === 'THRESHOLD' && threshParticipant)) && (
                'Complete the form to see preview'
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateBet}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition font-medium"
          >
            {loading ? 'Creating...' : 'Create Bet'}
          </button>
        </div>
      </div>
    </div>
  );
}

