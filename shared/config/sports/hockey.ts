/**
 * Hockey sport configuration
 * Defines available metrics, time periods, and bet templates
 */

import { TimePeriod } from '../../types/bets';
import type { SportConfig } from './index';

export const HOCKEY_CONFIG: SportConfig = {
  sport_key: 'hockey',
  display_name: 'Hockey',
  
  time_periods: [
    { value: 'FULL_GAME', label: 'Full Game', api_key: 'game' },
    { value: 'P1', label: '1st Period', api_key: 'period_1' },
    { value: 'P2', label: '2nd Period', api_key: 'period_2' },
    { value: 'P3', label: '3rd Period', api_key: 'period_3' },
    { value: 'OT', label: 'Overtime', api_key: 'overtime' },
  ],
  
  metrics: [
    {
      value: 'goals',
      label: 'Goals',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'assists',
      label: 'Assists',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'points',
      label: 'Points',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'shots',
      label: 'Shots',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'saves',
      label: 'Saves',
      team: false, // Team saves would be sum of goalie saves
      player: true, // Goalies only
      resolvable: true
    },
    {
      value: 'goals_against',
      label: 'Goals Against',
      team: true, // Team goals against would be sum of goalie goals against
      player: true, // Goalies only
      resolvable: true
    },
    {
      value: 'power_play_goals',
      label: 'Power Play Goals',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'short_handed_goals',
      label: 'Short Handed Goals',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'hits',
      label: 'Hits',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'blocked_shots',
      label: 'Blocked Shots',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'faceoffs_won',
      label: 'Faceoffs Won',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'takeaways',
      label: 'Takeaways',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'giveaways',
      label: 'Giveaways',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'penalty_minutes',
      label: 'Penalty Minutes',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'plus_minus',
      label: 'Plus/Minus',
      team: false, // Plus/minus is a player stat
      player: true,
      resolvable: true,
      timePeriods: ['FULL_GAME'] // Plus/minus is only available for full game
    },
  ]
};

