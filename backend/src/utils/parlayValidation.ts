/**
 * Validation helper functions for parlay routes
 */

/**
 * Validates that a user is authenticated
 * @throws Error with 401 status if not authenticated
 */
export function validateUserAuthenticated(userId: string | undefined): void {
  if (!userId) {
    const error: any = new Error('Authentication required');
    error.status = 401;
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
}

/**
 * Validates that a parlay belongs to the user
 * @throws Error with 403 status if parlay doesn't belong to user
 */
export function validateParlayOwnership(parlay: any, userId: string): void {
  if (!parlay) {
    const error: any = new Error('Parlay not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (parlay.userId !== userId) {
    const error: any = new Error('Parlay does not belong to user');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }
}

/**
 * Validates that a parlay is not locked
 * @throws Error with 400 status if parlay is locked
 */
export function validateParlayNotLocked(parlay: any): void {
  if (parlay.lockedAt !== null) {
    const error: any = new Error('Parlay is locked and cannot be modified');
    error.status = 400;
    error.code = 'PARLAY_LOCKED';
    throw error;
  }
}

/**
 * Validates that a game has not started
 * @throws Error with 400 status if game has started
 */
export function validateGameNotStarted(game: any, context: string = 'Cannot add bets from games that have already started'): void {
  if (game.status !== 'scheduled') {
    const error: any = new Error(context);
    error.status = 400;
    error.code = 'GAME_STARTED';
    throw error;
  }
}

/**
 * Validates an existing selection for use in a parlay
 * @throws Error if selection is invalid
 */
export function validateExistingSelection(selection: any, userId: string): void {
  if (!selection) {
    const error: any = new Error('Selection not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (selection.userId !== userId) {
    const error: any = new Error('Selection does not belong to user');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  if (selection.parlayId !== null) {
    const error: any = new Error('Selection is already in a parlay');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  validateGameNotStarted(selection.bet.game, 'Cannot add bets from games that have already started');
}

/**
 * Validates a new bet for selection
 * @throws Error if bet is invalid
 */
export function validateNewBet(bet: any, selectedSide: string, validateSelectedSide: (betType: string, selectedSide: string) => boolean): void {
  if (!bet) {
    const error: any = new Error('Bet not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (bet.outcome !== 'pending') {
    const error: any = new Error('Bet is no longer available for selection');
    error.status = 400;
    error.code = 'BET_UNAVAILABLE';
    throw error;
  }

  if (bet.visibleFrom && bet.visibleFrom > new Date()) {
    const error: any = new Error('Bet is not yet visible');
    error.status = 400;
    error.code = 'BET_NOT_VISIBLE';
    throw error;
  }

  validateGameNotStarted(bet.game, 'Cannot select bets for games that have already started');

  if (!validateSelectedSide(bet.betType, selectedSide)) {
    const error: any = new Error(`Invalid selectedSide for bet type ${bet.betType}`);
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
}

/**
 * Validates that a parlay has not reached maximum bet count
 * @throws Error with 400 status if parlay is full
 */
export function validateParlayNotFull(parlay: any): void {
  if (parlay.selections.length >= 5) {
    const error: any = new Error('Parlay already has maximum number of bets (5)');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
}

