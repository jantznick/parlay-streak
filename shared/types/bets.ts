/**
 * Bet configuration types for structured bet creation
 */

export type BetType = 'COMPARISON' | 'THRESHOLD' | 'EVENT';
export type SubjectType = 'TEAM' | 'PLAYER';
export type TimePeriod = 'FULL_GAME' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2' | 'OT' | 'P1' | 'P2' | 'P3';
export type ComparisonOperator = 'GREATER_THAN' | 'GREATER_EQUAL';
export type ThresholdOperator = 'OVER' | 'UNDER';
export type EventType = 'SCORES_TD' | 'SCORES_FIRST' | 'GAME_GOES_TO_OT' | 'SHUTOUT' | 'DOUBLE_DOUBLE' | 'TRIPLE_DOUBLE';

export interface Participant {
  subject_type: SubjectType;
  subject_id: string; // API's ID for team/player
  subject_name: string; // Display name
  metric: string; // e.g., 'points', 'rushing_yards'
  time_period: TimePeriod;
}

export interface ComparisonConfig {
  type: 'COMPARISON';
  participant_1: Participant;
  participant_2: Participant;
  operator: ComparisonOperator;
  spread?: {
    direction: '+' | '-';
    value: number; // must be X.5 (half-point)
  };
}

export interface ThresholdConfig {
  type: 'THRESHOLD';
  participant: Participant;
  operator: ThresholdOperator;
  threshold: number;
}

export interface EventConfig {
  type: 'EVENT';
  participant: Participant;
  event_type: EventType;
  time_period: TimePeriod; // when event must occur
}

export type BetConfig = ComparisonConfig | ThresholdConfig | EventConfig;

export interface Bet {
  id: string;
  game_id: string;
  bet_type: BetType;
  display_text: string;
  display_text_override?: string;
  config: BetConfig;
  outcome: 'pending' | 'win' | 'loss' | 'push' | 'void';
  priority: number;
  resolved_at?: Date;
  last_fetched_at?: Date;
  needs_admin_resolution: boolean;
  admin_resolution_notes?: string;
  visible_from?: Date;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

