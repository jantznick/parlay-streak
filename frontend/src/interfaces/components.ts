/**
 * Component prop interfaces for the frontend
 */

import { Game, HistoricalGame } from './game';
import { Bet, BetSelection } from './bet';
import { Parlay, ParlaySelection } from './parlay';

export interface HeaderProps {
  // Add props if needed
}

export interface DateNavigationProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  formatDateDisplay?: (date: string) => string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'default';
  children?: React.ReactNode;
}

export interface ParlayCardProps {
  parlay: Parlay;
  formatSelectionText: (side: string, betType: string, config: any, game: any, outcome?: string) => string;
  formatTime: (dateString: string) => string;
  getSportEmoji: (sport: string) => string;
  onOpenParlay: (parlay: Parlay) => void;
}

export interface SingleBetCardProps {
  selection: {
    id: string;
    betId: string;
    selectedSide: string;
    status: string;
    outcome?: string;
    bet: {
      id: string;
      displayText: string;
      betType: string;
      outcome?: string;
      config?: any;
      game: {
        id: string;
        homeTeam: string;
        awayTeam: string;
        startTime: string;
        status?: string;
        sport?: string;
        homeScore?: number | null;
        awayScore?: number | null;
        metadata?: any;
      };
    };
  };
  formatSelectionText: (side: string, betType: string, config: any, game: any, outcome?: string) => string;
  formatTime: (dateString: string) => string;
  getSportEmoji: (sport: string) => string;
  isBetInActiveParlay: (selectionId: string, betId: string) => boolean;
  canModify: boolean;
  startingParlayId: string | null;
  deletingId: string | null;
  onStartParlay: (selectionId: string, betId: string, selectedSide: string) => void;
  onDelete: (selectionId: string) => void;
}

export interface BetSelectionCardProps {
  side: string; // 'participant_1', 'participant_2', 'over', 'under', 'yes', 'no'
  label: string; // Display label for this side
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
}

export interface BetSelectionGroupProps {
  bet: Bet;
  game: Game;
  onSelectionSaved?: () => void;
}

export interface AvailableBetsSectionProps {
  games: HistoricalGame[];
  selections: Array<{ id: string; betId: string }>;
  formatResolvedBetText: (bet: any, game: any) => string;
  formatTime: (dateString: string) => string;
  getSportEmoji: (sport: string) => string;
  selectedDate: string;
  loading: boolean;
  isPastDate: boolean;
}

export interface BetListItemProps {
  bet: Bet;
  game: Game;
  index: number;
  totalBets: number;
  onEdit: (bet: Bet, game: Game) => void;
  onDelete: (bet: Bet, game: Game) => void;
  onResolve: (bet: Bet) => void;
  onMovePriority: (gameId: string, betId: string, direction: 'up' | 'down') => void;
  resolvingBet: string | null;
  formatResolvedBetText: (bet: Bet, game: Game) => string;
}

export interface GameCardProps {
  game: Game & { bets: Bet[] };
  isExpanded: boolean;
  onToggle: (gameId: string) => void;
  onCreateBets: (game: Game) => void;
  onQuickMoneyline: (game: Game) => void;
  onEditBet: (bet: Bet, game: Game) => void;
  onForceRefresh: (gameId: string) => void;
  onDeleteBet: (bet: Bet, game: Game) => void;
  onResolveBet: (bet: Bet) => void;
  onMoveBetPriority: (gameId: string, betId: string, direction: 'up' | 'down') => void;
  creatingMoneyline: string | null;
  loadingRoster: boolean;
  resolvingBet: string | null;
}

export interface GameFiltersProps {
  selectedDate: string;
  sportsConfig: Array<{
    sport: string;
    leagues: Array<{ id: string; name: string }>;
  }>;
  selectedSport: string;
  selectedLeague: string;
  onDateChange: (date: string) => void;
  onSportChange: (sport: string) => void;
  onLeagueChange: (league: string) => void;
  onFetchGames: (force: boolean) => void;
  loading: boolean;
  gamesCount: number;
}

export interface Player {
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

export interface RosterData {
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

export interface BetModalProps {
  game: Game;
  rosterData: RosterData | null;
  bet?: Bet;
  onClose: () => void;
  onBetCreated?: () => void;
  onBetUpdated?: () => void;
}

export interface SportConfig {
  sport: string;
  leagues: Array<{ id: string; name: string }>;
}

