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

/**
 * Gets the sport emoji for a given sport string
 */
export function getSportEmoji(sport: string): string {
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

/**
 * Formats a date string with time for display
 * Used for displaying game start times with date
 */
export function formatDateWithTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Gets today's date in YYYY-MM-DD format (local timezone, not UTC)
 * Used for date inputs and date comparisons
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the timezone offset in hours
 * Returns positive value for timezones ahead of UTC (e.g., EST is -5, so returns -5)
 * Used for API calls that need timezone information
 */
export function getTimezoneOffset(): number {
  // getTimezoneOffset() returns offset in minutes, negative for ahead of UTC
  // We want hours, positive for ahead of UTC (e.g., EST is -5, so offset is -5)
  return -new Date().getTimezoneOffset() / 60;
}

/**
 * Formats selection text for user bets
 * Shows user's selection with context (win/loss/push outcomes, scores)
 * Different from formatResolvedBetText which doesn't include user selection context
 */
export function formatSelectionText(
  side: string,
  betType: string,
  config: any,
  game: any,
  outcome?: string
): string {
  if (betType === 'COMPARISON' && config) {
    const compConfig = config;
    const p1 = compConfig.participant_1;
    const p2 = compConfig.participant_2;
    
    let name1 = getTeamName(p1, game);
    let name2 = getTeamName(p2, game);
    
    // Use short names for display
    const shortName1 = name1.split(' ').pop() || name1;
    const shortName2 = name2.split(' ').pop() || name2;
    
    // Handle spread
    if (compConfig.spread) {
      const spreadValue = compConfig.spread.value;
      const spreadDir = compConfig.spread.direction;
      if (side === 'participant_1') {
        name1 = spreadDir === '+' ? `${shortName1} +${spreadValue}` : `${shortName1} -${spreadValue}`;
      } else {
        name2 = spreadDir === '+' ? `${shortName2} +${spreadValue}` : `${shortName2} -${spreadValue}`;
      }
    } else {
      name1 = shortName1;
      name2 = shortName2;
    }
    
    // If bet is resolved, show what actually happened with scores
    if (outcome && outcome !== 'pending' && game.homeScore !== null && game.awayScore !== null) {
      // Determine which participant won based on outcome and user's selection
      let winner: any;
      let loser: any;
      let winnerScore: number;
      let loserScore: number;
      
      if (outcome === 'push') {
        // Push means tie - show both teams with same score
        const p1IsHome = game.metadata?.apiData?.teams?.home?.id === p1?.subject_id;
        const p1Score = p1IsHome ? game.homeScore : game.awayScore;
        return `${shortName1} vs ${shortName2} (${p1Score}-${p1Score})`;
      } else if (outcome === 'win') {
        // User's selection won
        winner = side === 'participant_1' ? p1 : p2;
        loser = side === 'participant_1' ? p2 : p1;
      } else {
        // outcome === 'loss' - user's selection lost, so the other participant won
        winner = side === 'participant_1' ? p2 : p1;
        loser = side === 'participant_1' ? p1 : p2;
      }
      
      // Get scores for winner and loser
      const winnerIsHome = game.metadata?.apiData?.teams?.home?.id === winner?.subject_id;
      winnerScore = winnerIsHome ? game.homeScore : game.awayScore;
      loserScore = winnerIsHome ? game.awayScore : game.homeScore;
      
      const winnerShortName = (winner === p1 ? shortName1 : shortName2);
      const loserShortName = (winner === p1 ? shortName2 : shortName1);
      
      return `${winnerShortName} over ${loserShortName} (${winnerScore}-${loserScore})`;
    }
    
    // Not resolved yet - show user's selection
    return side === 'participant_1' ? `${name1} over ${name2}` : `${name2} over ${name1}`;
  } else if (betType === 'THRESHOLD' && config) {
    const threshold = config.threshold;
    const participant = config.participant;
    let name = getTeamName(participant, game);
    const shortName = name.split(' ').pop() || name;
    
    // If resolved, show what actually happened
    if (outcome && outcome !== 'pending' && game.homeScore !== null && game.awayScore !== null && participant?.subject_type === 'TEAM') {
      const pIsHome = game.metadata?.apiData?.teams?.home?.id === participant?.subject_id;
      const pScore = pIsHome ? game.homeScore : game.awayScore;
      return `${shortName} ${side} ${threshold} (${pScore})`;
    }
    
    return side === 'over' ? `${shortName} over ${threshold}` : `${shortName} under ${threshold}`;
  } else if (betType === 'EVENT' && config) {
    const event = config.event || 'Event';
    return side === 'yes' ? `${event} ✓` : `${event} ✗`;
  }
  return side;
}

