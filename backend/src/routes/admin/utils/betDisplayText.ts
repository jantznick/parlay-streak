/**
 * Utility functions for generating bet display text from bet configurations
 */

/**
 * Format metric label from snake_case to Title Case
 */
export function formatMetricLabel(metric: string): string {
  return metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format time period label to user-friendly format
 */
export function formatTimePeriodLabel(period: string): string {
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
}

/**
 * Generate display text from bet configuration
 */
export function generateDisplayText(betType: string, config: any): string {
  if (betType === 'COMPARISON') {
    const { participant_1, participant_2, spread } = config;
    
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
  
  if (betType === 'THRESHOLD') {
    const { participant, operator, threshold } = config;
    const metricLabel = formatMetricLabel(participant.metric);
    const period = participant.time_period !== 'FULL_GAME'
      ? ` (${formatTimePeriodLabel(participant.time_period)})`
      : '';
    
    return `${participant.subject_name} ${operator} ${threshold} ${metricLabel}${period}`;
  }
  
  if (betType === 'EVENT') {
    const { participant, event_type, time_period } = config;
    const eventLabel = event_type.replace(/_/g, ' ').toLowerCase();
    const period = time_period !== 'FULL_GAME'
      ? ` (${formatTimePeriodLabel(time_period)})`
      : '';
    
    return `${participant.subject_name} ${eventLabel}${period}`;
  }
  
  return 'Unknown bet';
}

