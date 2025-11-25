import { useState, useEffect, useMemo } from 'react';
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

interface Bet {
  id: string;
  betType: string;
  displayText: string;
  priority: number;
  outcome: string;
  config?: any;
  displayTextOverride?: string;
}

interface BetEditModalProps {
  bet: Bet;
  game: Game;
  rosterData: RosterData | null;
  onClose: () => void;
  onBetUpdated: () => void;
}

// Extract ParticipantSelector as a separate component
function ParticipantSelector({ 
  value, 
  onChange, 
  label,
  game,
  players,
  sportConfig
}: { 
  value: Participant | null; 
  onChange: (p: Participant | null) => void;
  label: string;
  game: Game;
  players: Player[];
  sportConfig: typeof BASKETBALL_CONFIG;
}) {
  const [subjectType, setSubjectType] = useState<'TEAM' | 'PLAYER'>(value?.subject_type || 'TEAM');
  const [selectedId, setSelectedId] = useState<string>(value?.subject_id || '');
  const [metric, setMetric] = useState<string>(value?.metric || '');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(value?.time_period || 'FULL_GAME');

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
        } else {
          // If selectedId is already a team ID (from existing bet), use it as-is
          actualSubjectId = selectedId;
          // Try to find team name from metadata
          const metadata = (game as any).metadata;
          const apiData = metadata?.apiData;
          if (apiData?.teams?.home?.id === selectedId) {
            subjectName = game.homeTeam;
          } else if (apiData?.teams?.away?.id === selectedId) {
            subjectName = game.awayTeam;
          } else {
            subjectName = selectedId; // Fallback
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
    </div>
  );
}

export function BetEditModal({ bet, game, rosterData, onClose, onBetUpdated }: BetEditModalProps) {
  const [betType, setBetType] = useState<BetType>(bet.betType as BetType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayTextOverride, setDisplayTextOverride] = useState<string>(bet.displayTextOverride || '');

  // Initialize state from bet config
  const initialConfig = bet.config || {};
  
  // Helper to get initial participant with proper team ID resolution
  const getInitialParticipant = (participant: any): Participant | null => {
    if (!participant) return null;
    
    // If it's a team and subject_id looks like a team ID (numeric), check if we need to map it
    if (participant.subject_type === 'TEAM' && participant.subject_id) {
      const metadata = (game as any).metadata;
      const apiData = metadata?.apiData;
      
      // Check if subject_id matches home or away team ID
      if (apiData?.teams?.home?.id === participant.subject_id) {
        return {
          ...participant,
          subject_id: 'home', // Use 'home' for the selector, will be converted to actual ID on save
          subject_name: game.homeTeam
        };
      } else if (apiData?.teams?.away?.id === participant.subject_id) {
        return {
          ...participant,
          subject_id: 'away', // Use 'away' for the selector, will be converted to actual ID on save
          subject_name: game.awayTeam
        };
      }
    }
    
    return participant;
  };
  
  // COMPARISON state
  const [compParticipant1, setCompParticipant1] = useState<Participant | null>(
    getInitialParticipant(initialConfig.participant_1)
  );
  const [compParticipant2, setCompParticipant2] = useState<Participant | null>(
    getInitialParticipant(initialConfig.participant_2)
  );
  const [compOperator, setCompOperator] = useState<'GREATER_THAN' | 'spread'>(
    initialConfig.spread ? 'spread' : 'GREATER_THAN'
  );
  const [spreadDirection, setSpreadDirection] = useState<'+' | '-'>(
    initialConfig.spread?.direction || '+'
  );
  const [spreadValue, setSpreadValue] = useState<number>(
    initialConfig.spread?.value || 3.5
  );

  // THRESHOLD state
  const [threshParticipant, setThreshParticipant] = useState<Participant | null>(
    getInitialParticipant(initialConfig.participant)
  );
  const [threshOperator, setThreshOperator] = useState<'OVER' | 'UNDER'>(
    initialConfig.operator || 'OVER'
  );
  const [threshold, setThreshold] = useState<number>(
    initialConfig.threshold || 0
  );

  // EVENT state - removed for now, will be re-added later
  // const [eventParticipant, setEventParticipant] = useState<Participant | null>(
  //   getInitialParticipant(initialConfig.participant)
  // );
  // const [eventType, setEventType] = useState<'DOUBLE_DOUBLE' | 'TRIPLE_DOUBLE'>(
  //   initialConfig.event_type || 'DOUBLE_DOUBLE'
  // );
  // const [eventTimePeriod, setEventTimePeriod] = useState<TimePeriod>(
  //   initialConfig.time_period || 'FULL_GAME'
  // );

  // Memoize players list
  const players = useMemo((): Player[] => {
    if (!rosterData) return [];
    
    const playersList: Player[] = [];
    
    if (rosterData.home?.roster?.athletes && Array.isArray(rosterData.home.roster.athletes)) {
      const homePlayers = rosterData.home.roster.athletes;
      if (homePlayers.length > 0 && 'items' in homePlayers[0]) {
        for (const positionGroup of homePlayers as any[]) {
          if (positionGroup.items && Array.isArray(positionGroup.items)) {
            playersList.push(...positionGroup.items.map((p: any) => ({ ...p, team: game.homeTeam })));
          }
        }
      } else {
        playersList.push(...homePlayers.map((p: any) => ({ ...p, team: game.homeTeam })));
      }
    }
    
    if (rosterData.away?.roster?.athletes && Array.isArray(rosterData.away.roster.athletes)) {
      const awayPlayers = rosterData.away.roster.athletes;
      if (awayPlayers.length > 0 && 'items' in awayPlayers[0]) {
        for (const positionGroup of awayPlayers as any[]) {
          if (positionGroup.items && Array.isArray(positionGroup.items)) {
            playersList.push(...positionGroup.items.map((p: any) => ({ ...p, team: game.awayTeam })));
          }
        }
      } else {
        playersList.push(...awayPlayers.map((p: any) => ({ ...p, team: game.awayTeam })));
      }
    }
    
    return playersList;
  }, [rosterData, game.homeTeam, game.awayTeam]);

  const sportConfig = BASKETBALL_CONFIG;

  const handleUpdateBet = async () => {
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
        // EVENT bets removed for now
        setError('Event bets are not yet available');
        setLoading(false);
        return;
      }

      const response = await api.updateBet(bet.id, {
        bet_type: betType,
        config,
        display_text_override: displayTextOverride || undefined
      });
      
      if (response.success) {
        onBetUpdated();
        onClose();
      } else {
        setError(response.error?.message || 'Failed to update bet');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update bet');
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
            <h2 className="text-2xl font-bold text-white">Edit Bet</h2>
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

          {/* Display Text Override */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Display Text Override (optional)
            </label>
            <input
              type="text"
              value={displayTextOverride}
              onChange={(e) => setDisplayTextOverride(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              placeholder="Leave empty to use auto-generated text"
            />
            <p className="text-xs text-slate-400 mt-1">
              Current: {bet.displayText}
            </p>
          </div>

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
              {/* EVENT bets removed for now - will be re-added later */}
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
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Operator
                  </label>
                  <select
                    value={threshOperator}
                    onChange={(e) => setThreshOperator(e.target.value as 'OVER' | 'UNDER')}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="OVER">Over</option>
                    <option value="UNDER">Under</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Threshold
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={threshold}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) setThreshold(val);
                    }}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    placeholder="28.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* EVENT Form - Removed for now, will be re-added later */}
          {betType === 'EVENT' && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">
                Event bets are temporarily disabled. They will be re-added in a future update.
              </p>
            </div>
          )}
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
            onClick={handleUpdateBet}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition font-medium"
          >
            {loading ? 'Updating...' : 'Update Bet'}
          </button>
        </div>
      </div>
    </div>
  );
}

