import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Service to handle automatic parlay locking when games start
 */
export class ParlayLockingService {
  /**
   * Check and lock parlays where the first game has started
   * This should be called periodically (e.g., every minute) or when games are updated
   */
  static async checkAndLockParlays(): Promise<void> {
    try {
      const now = new Date();

      // Find all parlays in 'building' status that haven't been locked yet
      const buildingParlays = await prisma.parlay.findMany({
        where: {
          status: 'building',
          lockedAt: null
        },
        include: {
          selections: {
            include: {
              bet: {
                include: {
                  game: true
                }
              }
            }
          }
        }
      });

      logger.info('Checking parlays for locking', { count: buildingParlays.length });

      for (const parlay of buildingParlays) {
        // Check if any game in this parlay has started
        const anyGameStarted = parlay.selections.some(selection => {
          const game = selection.bet.game;
          // Game has started if:
          // 1. Status is not 'scheduled' (could be 'in_progress', 'completed', etc.)
          // 2. OR startTime is in the past
          return game.status !== 'scheduled' || game.startTime < now;
        });

        if (anyGameStarted) {
          await this.lockParlay(parlay.id);
          logger.info('Parlay auto-locked', {
            parlayId: parlay.id,
            userId: parlay.userId,
            betCount: parlay.betCount
          });
        }
      }
    } catch (error: any) {
      logger.error('Error checking and locking parlays', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Lock a specific parlay
   */
  static async lockParlay(parlayId: string): Promise<void> {
    try {
      const now = new Date();

      // Update parlay
      await prisma.parlay.update({
        where: { id: parlayId },
        data: {
          status: 'locked',
          lockedAt: now
        }
      });

      // Update all selections in the parlay
      await prisma.userBetSelection.updateMany({
        where: { parlayId },
        data: {
          status: 'locked'
        }
      });

      logger.info('Parlay locked', { parlayId });
    } catch (error: any) {
      logger.error('Error locking parlay', {
        parlayId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Check if a parlay should be locked (helper for manual checks)
   */
  static async shouldLockParlay(parlayId: string): Promise<boolean> {
    const parlay = await prisma.parlay.findUnique({
      where: { id: parlayId },
      include: {
        selections: {
          include: {
            bet: {
              include: {
                game: true
              }
            }
          }
        }
      }
    });

    if (!parlay || parlay.lockedAt !== null) {
      return false;
    }

    const now = new Date();
    return parlay.selections.some(selection => {
      const game = selection.bet.game;
      return game.status !== 'scheduled' || game.startTime < now;
    });
  }
}

