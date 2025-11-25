/**
 * Bet resolution service
 * Wraps the shared bet resolution logic for use in the backend
 */

// Import from root shared folder (relative path from backend/src/services)
// The shared folder is at the repo root level
const { resolveBet } = require('@shared/utils/betResolution');
const { SPORT_CONFIGS } = require('@shared/config/sports/basketball');

/**
 * Get sport config by sport key
 * Normalizes the sport key to lowercase for lookup since configs use lowercase keys
 */
function getSportConfig(sportKey: string) {
  // Normalize to lowercase since SPORT_CONFIGS uses lowercase keys (e.g., 'basketball' not 'BASKETBALL')
  const normalizedKey = sportKey.toLowerCase();
  const config = SPORT_CONFIGS[normalizedKey];
  
  if (!config) {
    const availableSports = Object.keys(SPORT_CONFIGS).join(', ');
    throw new Error(`Sport config not found for: ${sportKey} (normalized: ${normalizedKey}). Available sports: ${availableSports}`);
  }
  
  return config;
}

export { resolveBet, getSportConfig };

