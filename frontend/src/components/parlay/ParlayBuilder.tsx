import { useState, useEffect } from 'react';
import { useParlay } from '../../context/ParlayContext';
import { useBets } from '../../context/BetsContext';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../common/ConfirmModal';
import type { BetConfig } from '@shared/types/bets';
import type { Parlay, ParlaySelection } from '../../interfaces';

/**
 * Get display label for a selected side
 */
function getSideDisplayLabel(selection: ParlaySelection): string {
  const { bet, selectedSide } = selection;
  const config = bet.config;

  if (bet.betType === 'COMPARISON') {
    const compConfig = config as any;
    const participant = selectedSide === 'participant_1' ? compConfig.participant_1 : compConfig.participant_2;
    let name = participant?.subject_name || 'Participant';
    
    // Handle spread
    if (compConfig.spread && selectedSide === 'participant_1') {
      const spreadValue = compConfig.spread.value;
      const spreadDir = compConfig.spread.direction;
      name = spreadDir === '+' ? `${name} +${spreadValue}` : `${name} -${spreadValue}`;
    }
    
    return name;
  } else if (bet.betType === 'THRESHOLD') {
    const threshConfig = config as any;
    const threshold = threshConfig.threshold || 0;
    return selectedSide === 'over' ? `OVER ${threshold}` : `UNDER ${threshold}`;
  } else if (bet.betType === 'EVENT') {
    return selectedSide === 'yes' ? 'YES' : 'NO';
  }
  
  return selectedSide;
}

export function ParlayBuilder() {
  const { activeParlay, setActiveParlay, isParlayBuilderOpen, setIsParlayBuilderOpen, refreshActiveParlay } = useParlay();
  const { triggerRefresh } = useBets();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Close builder if parlay is deleted or becomes invalid
  useEffect(() => {
    if (activeParlay && activeParlay.betCount === 0) {
      setActiveParlay(null);
      setIsParlayBuilderOpen(false);
    }
  }, [activeParlay, setActiveParlay, setIsParlayBuilderOpen]);

  // Don't render content if no active parlay
  if (!activeParlay) {
    return null;
  }

  const handleRemoveSelection = async (selectionId: string) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.removeSelectionFromParlay(activeParlay.id, selectionId);
      if (response.success) {
        if (response.data) {
          const data = response.data as { message?: string; parlay?: any };
          if (data.message?.includes('deleted')) {
            // Parlay was deleted (no bets left or became invalid)
            setActiveParlay(null);
            setIsParlayBuilderOpen(false);
            triggerRefresh(); // Refresh when parlay is deleted
          } else if (data.parlay) {
            setActiveParlay(data.parlay);
            await refreshActiveParlay();
            // Don't refresh - overlay will update automatically via activeParlay state
          }
        }
      } else {
        setError(response.error?.message || 'Failed to remove bet');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove bet');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleInsurance = async () => {
    if (loading || activeParlay.betCount < 4) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.updateParlay(activeParlay.id, {
        insured: !activeParlay.insured
      });
      if (response.success && response.data?.parlay) {
        setActiveParlay(response.data.parlay);
        await refreshActiveParlay();
      } else {
        setError(response.error?.message || 'Failed to update insurance');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update insurance');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveParlay = async () => {
    if (activeParlay.betCount < 2) {
      setError('Parlay must have at least 2 bets');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Just verify the parlay exists (it's already saved)
      const response = await api.getParlay(activeParlay.id);
      if (response.success) {
        // Show success message briefly, then close builder
        setTimeout(() => {
          setSaving(false);
          setIsParlayBuilderOpen(false);
          triggerRefresh();
        }, 1000);
      } else {
        setError('Failed to verify parlay');
        setSaving(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save parlay');
      setSaving(false);
    }
  };

  const handleClose = async () => {
    // If parlay only has 1 bet, convert it back to a single bet (delete parlay)
    if (activeParlay && activeParlay.betCount === 1) {
      try {
        await api.deleteParlay(activeParlay.id);
        triggerRefresh();
      } catch (err) {
        console.error('Error converting parlay to single bet:', err);
      }
    }
    // Clear the active parlay when closing
    setActiveParlay(null);
    setIsParlayBuilderOpen(false);
    triggerRefresh();
  };

  const performDeleteParlay = async () => {
    if (!activeParlay) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.deleteParlay(activeParlay.id);
      if (response.success) {
        setActiveParlay(null);
        setIsParlayBuilderOpen(false);
        triggerRefresh();
      } else {
        setError(response.error?.message || 'Failed to delete parlay');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete parlay');
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  };

  const handleDeleteParlay = () => {
    // For 1-bet parlays, no confirmation needed (just cancel)
    if (activeParlay.betCount === 1) {
      performDeleteParlay();
    } else {
      // For multi-bet parlays, show confirmation
      setConfirmDelete(true);
    }
  };

  // Insurance cost comes from backend, but we can display it
  const getInsuranceCost = () => {
    if (activeParlay.betCount < 4) return null;
    return activeParlay.insuranceCost || null;
  };

  const insuranceCost = getInsuranceCost();
  const canInsure = activeParlay.betCount >= 4 && !activeParlay.lockedAt;
  const isLocked = activeParlay.lockedAt !== null && activeParlay.lockedAt !== undefined;

  return (
    <div className={`fixed right-4 top-4 bottom-4 w-80 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 flex flex-col transition-all duration-300 ease-in-out ${
      isParlayBuilderOpen
        ? 'opacity-100 translate-x-0'
        : 'opacity-0 translate-x-full pointer-events-none'
    }`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Parlay Builder</h3>
        <button
          onClick={handleClose}
          className="text-slate-400 hover:text-white transition"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Warning for 1-bet parlay */}
        {activeParlay.betCount === 1 && (
          <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-400 mb-2">
              ⚠️ Add at least one more bet to create a valid parlay.
            </p>
            <button
              onClick={handleDeleteParlay}
              disabled={loading}
              className="text-xs text-red-400 hover:text-red-300 underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Parlay Info */}
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Bets</span>
            <span className="text-lg font-bold text-white">{activeParlay.betCount}/5</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Value</span>
            <span className="text-lg font-bold text-orange-400">
              {activeParlay.parlayValue > 0 ? `+${activeParlay.parlayValue}` : '0'}
            </span>
          </div>
          {isLocked && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <span className="text-xs text-yellow-400">🔒 Locked</span>
            </div>
          )}
        </div>

        {/* Bet Slots */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-300 mb-2">Bets</div>
          {[1, 2, 3, 4, 5].map((slotNum) => {
            const selection = activeParlay.selections[slotNum - 1];
            return (
              <div
                key={slotNum}
                className={`
                  p-3 rounded-lg border
                  ${selection
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-800/30 border-slate-800 border-dashed'
                  }
                `}
              >
                {selection ? (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-400 mb-1">
                          {selection.game.homeTeam} vs {selection.game.awayTeam}
                        </div>
                        <div className="text-sm text-white font-medium truncate">
                          {selection.bet.displayText}
                        </div>
                        <div className="text-xs text-orange-400 mt-1">
                          {getSideDisplayLabel(selection)}
                        </div>
                      </div>
                      {!isLocked && (
                        <button
                          onClick={() => handleRemoveSelection(selection.id)}
                          disabled={loading}
                          className="text-red-400 hover:text-red-300 text-sm font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <span className="text-xs text-slate-500">Slot {slotNum}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Insurance Toggle */}
        {canInsure && (
          <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-300">Insurance</label>
              <button
                onClick={handleToggleInsurance}
                disabled={loading || user?.insuranceLocked}
                className={`
                  relative w-12 h-6 rounded-full transition
                  ${activeParlay.insured
                    ? 'bg-orange-600'
                    : 'bg-slate-700'
                  }
                  ${loading || user?.insuranceLocked
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                  }
                `}
              >
                <div
                  className={`
                    absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition
                    ${activeParlay.insured ? 'translate-x-6' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
            {insuranceCost !== null && (
              <div className="text-xs text-slate-400 space-y-1">
                <div>Cost: {insuranceCost} streak</div>
                {activeParlay.insured && (
                  <div className="text-green-400">
                    Net if win: +{activeParlay.parlayValue - insuranceCost}
                  </div>
                )}
              </div>
            )}
            {user?.insuranceLocked && !activeParlay.insured && (
              <div className="text-xs text-yellow-400">
                Insurance locked - complete an uninsured bet first
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="px-3 py-2 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-slate-800 space-y-2">
        {!isLocked && (
          <>
            <button
              onClick={handleSaveParlay}
              disabled={saving || activeParlay.betCount < 2}
              className={`
                w-full px-4 py-2 rounded-lg font-medium transition
                ${saving || activeParlay.betCount < 2
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
                }
              `}
            >
              {saving ? 'Saved!' : 'Save Parlay'}
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={loading}
              className="w-full px-4 py-2 rounded-lg font-medium bg-red-900/50 hover:bg-red-900/70 text-red-400 transition"
            >
              Delete Parlay
            </button>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDelete}
        title="Delete Parlay"
        message="Are you sure you want to delete this parlay? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={performDeleteParlay}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

