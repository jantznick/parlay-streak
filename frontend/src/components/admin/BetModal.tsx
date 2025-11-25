import { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { BASKETBALL_CONFIG } from '@shared/config/sports/basketball';
import type { BetType, Participant, ComparisonConfig, ThresholdConfig, EventConfig, BetConfig, TimePeriod } from '@shared/types/bets';
import { Modal } from '../common/Modal';

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

interface BetModalProps {
  game: Game;
  rosterData: RosterData | null;
  bet?: Bet; // If provided, we're in edit mode
  onClose: () => void;
  onBetCreated?: () => void;
  onBetUpdated?: () => void;
}

// Extract ParticipantSelector as a separate component
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
  // Initialize from value if provided (for edit mode)
  const [subjectType, setSubjectType] = useState<'TEAM' | 'PLAYER'>(value?.subject_type || 'TEAM');
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (value?.subject_type === 'TEAM') {
      // Check if it's a team ID that needs to be mapped to 'home' or 'away'
      const metadata = (game as any).metadata;
      const apiData = metadata?.apiData;
      if (apiData?.teams?.home?.id === value.subject_id) {
        return 'home';
      } else if (apiData?.teams?.away?.id === value.subject_id) {
        return 'away';
      }
      // If it's already 'home' or 'away', use it
      if (value.subject_id === 'home' || value.subject_id === 'away') {
        return value.subject_id;
      }
    }
    return value?.subject_id || '';
  });
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

export function BetModal({ game, rosterData, bet, onClose, onBetCreated, onBetUpdated }: BetModalProps) {
  const isEditMode = !!bet;
  const initialConfig = bet?.config || {};
  
  const [betType, setBetType] = useState<BetType>((bet?.betType as BetType) || 'COMPARISON');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayTextOverride, setDisplayTextOverride] = useState<string>(bet?.displayTextOverride || '');

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

  const sportConfig = BASKETBALL_CONFIG; // TODO: Get from game.sport

  // Helper to format metric label
  const formatMetricLabel = (metric: string): string => {
    return metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Helper to format time period label
  const formatTimePeriodLabel = (period: string): string => {
    const periodMap: Record<string, string> = {
      'FULL_GAME': 'Full Game',
      'Q1': 'Q1',
      'Q2': 'Q2',
      'Q3': 'Q3',
      'Q4': 'Q4',
      'H1': '1H',
      'H2': '2H',
      'OT': 'OT'
    };
    return periodMap[period] || period;
  };

  // Generate display text preview (matches backend logic)
  const generateDisplayTextPreview = (): string => {
    if (betType === 'COMPARISON' && compParticipant1 && compParticipant2) {
      const { participant_1, participant_2 } = { participant_1: compParticipant1, participant_2: compParticipant2 };
      const spread = compOperator === 'spread' ? { direction: spreadDirection, value: spreadValue } : undefined;
      
      // Moneyline (simple comparison, no spread, both teams, points, full game)
      if (!spread && 
          participant_1.metric === 'points' && 
          participant_1.time_period === 'FULL_GAME' &&
          participant_1.subject_type === 'TEAM' &&
          participant_2.subject_type === 'TEAM' &&
          participant_2.metric === 'points' &&
          participant_2.time_period === 'FULL_GAME') {
        return `${participant_1.subject_name} ML`;
      }
      
      // Spread (both teams, points, full game)
      if (spread && 
          participant_1.metric === 'points' && 
          participant_1.time_period === 'FULL_GAME' &&
          participant_1.subject_type === 'TEAM' &&
          participant_2.subject_type === 'TEAM' &&
          participant_2.metric === 'points' &&
          participant_2.time_period === 'FULL_GAME') {
        return `${participant_1.subject_name} ${spread.direction}${spread.value}`;
      }
      
      // Generic comparison - always show all values explicitly
      const metric1Label = formatMetricLabel(participant_1.metric);
      const metric2Label = formatMetricLabel(participant_2.metric);
      const period1 = participant_1.time_period !== 'FULL_GAME'
        ? ` (${formatTimePeriodLabel(participant_1.time_period)})`
        : '';
      const period2 = participant_2.time_period !== 'FULL_GAME'
        ? ` (${formatTimePeriodLabel(participant_2.time_period)})`
        : '';
      
      // Always show both metrics and periods explicitly
      if (spread) {
        return `${participant_1.subject_name} ${metric1Label}${period1} ${spread.direction}${spread.value} > ${participant_2.subject_name} ${metric2Label}${period2}`;
      } else {
        return `${participant_1.subject_name} ${metric1Label}${period1} > ${participant_2.subject_name} ${metric2Label}${period2}`;
      }
    }
    
    if (betType === 'THRESHOLD' && threshParticipant) {
      const participant = threshParticipant;
      const operator = threshOperator;
      const thresholdValue = threshold;
      const metricLabel = formatMetricLabel(participant.metric);
      const period = participant.time_period !== 'FULL_GAME'
        ? ` (${formatTimePeriodLabel(participant.time_period)})`
        : '';
      
      return `${participant.subject_name} ${operator} ${thresholdValue} ${metricLabel}${period}`;
    }
    
    return 'Complete the form to see preview';
  };

  const handleSubmit = async () => {
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

      if (isEditMode && bet) {
        // Update existing bet
        const response = await api.updateBet(bet.id, {
          bet_type: betType,
          config,
          display_text_override: displayTextOverride || undefined
        });
        
        if (response.success) {
          onBetUpdated?.();
          onClose();
        } else {
          setError(response.error?.message || 'Failed to update bet');
        }
      } else {
        // Create new bet
        const response = await api.createBet(game.id, betType, config, displayTextOverride || undefined);
        
        if (response.success) {
          onBetCreated?.();
          onClose();
        } else {
          setError(response.error?.message || 'Failed to create bet');
        }
      }
    } catch (error: any) {
      setError(error.message || (isEditMode ? 'Failed to update bet' : 'Failed to create bet'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditMode ? 'Edit Bet' : 'Create Bet'}
      subtitle={`${game.awayTeam} @ ${game.homeTeam}`}
      size="xl"
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition font-medium"
          >
            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Bet' : 'Create Bet')}
          </button>
        </div>
      }
    >
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
            {isEditMode && bet?.displayText && (
              <p className="text-xs text-slate-400 mt-1">
                Current: {bet.displayText}
              </p>
            )}
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
              {isEditMode && displayTextOverride ? displayTextOverride : generateDisplayTextPreview()}
            </p>
            {isEditMode && displayTextOverride && (
              <p className="text-xs text-slate-500 mt-1">
                (Override active - auto-generated: {generateDisplayTextPreview()})
              </p>
            )}
          </div>
      </div>
    </Modal>
  );
}

