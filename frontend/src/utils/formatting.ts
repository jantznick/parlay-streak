/**
 * Utility functions for formatting dates, times, and bet-related text
 */

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
  bets?: any[];
}

interface Bet {
  id: string;
  betType: string;
  displayText: string;
  outcome?: string;
  config?: any;
  displayTextOverride?: string;
}

/**
 * Formats a date string for display
 * Handles both YYYY-MM-DD format (from date input) and ISO date strings (from database)
 */
export function formatDate(dateString: string): string {
  // Handle YYYY-MM-DD format from date input (treat as local date, not UTC)
  // Or ISO date string from database
  let date: Date;
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // YYYY-MM-DD format (from date input)
    const [year, month, day] = dateString.split('-').map(Number);
    date = new Date(year, month - 1, day); // month is 0-indexed
  } else {
    // ISO date string (from database)
    date = new Date(dateString);
  }

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a time string for display
 */
export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Gets the team name from a participant object
 * Matches participant subject_id with game metadata to determine home/away team
 */
export function getTeamName(participant: any, game: Game): string {
  if (participant?.subject_type === 'TEAM') {
    const metadata = game.metadata;
    const apiData = metadata?.apiData;
    if (apiData?.teams?.home?.id === participant.subject_id) {
      return game.homeTeam;
    } else if (apiData?.teams?.away?.id === participant.subject_id) {
      return game.awayTeam;
    }
  }
  return participant?.subject_name || 'Unknown';
}

/**
 * Formats resolved bet text for display
 * Shows what actually happened based on outcome and scores
 * Used when displaying bets without a user selection (e.g., in admin panel or available bets)
 */
export function formatResolvedBetText(bet: Bet, game: Game): string {
  if (!bet.outcome || bet.outcome === 'pending' || !bet.config) {
    return bet.displayTextOverride || bet.displayText;
  }

  if (bet.betType === 'COMPARISON' && bet.config) {
    const compConfig = bet.config;
    const p1 = compConfig.participant_1;
    const p2 = compConfig.participant_2;
    
    if (p1?.subject_type === 'TEAM' && p2?.subject_type === 'TEAM' && 
        game.homeScore !== null && game.awayScore !== null) {
      const name1 = getTeamName(p1, game);
      const name2 = getTeamName(p2, game);
      const shortName1 = name1.split(' ').pop() || name1;
      const shortName2 = name2.split(' ').pop() || name2;
      
      // Determine which team won based on scores
      const p1IsHome = game.metadata?.apiData?.teams?.home?.id === p1?.subject_id;
      const p1Score = p1IsHome ? game.homeScore : game.awayScore;
      const p2Score = p1IsHome ? game.awayScore : game.homeScore;
      
      if (p1Score > p2Score) {
        return `${shortName1} over ${shortName2} (${p1Score}-${p2Score})`;
      } else if (p2Score > p1Score) {
        return `${shortName2} over ${shortName1} (${p2Score}-${p1Score})`;
      } else {
        return `${shortName1} vs ${shortName2} (${p1Score}-${p2Score})`;
      }
    }
  }
  
  return bet.displayTextOverride || bet.displayText;
}

