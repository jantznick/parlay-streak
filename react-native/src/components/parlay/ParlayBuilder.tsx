import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useParlay } from '../../context/ParlayContext';
import { useBets } from '../../context/BetsContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import type { ParlaySelection } from '../../interfaces/parlay';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
const MINIMIZED_HEIGHT = 80;

function getSideDisplayLabel(selection: ParlaySelection): string {
  const { bet, selectedSide } = selection;
  const config = bet.config;

  if (bet.betType === 'COMPARISON') {
    const compConfig = config as any;
    const participant = selectedSide === 'participant_1' ? compConfig.participant_1 : compConfig.participant_2;
    let name = participant?.subject_name || 'Participant';
    
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

function getSportEmoji(sport?: string): string {
  if (!sport) return '🎮';
  const emojiMap: Record<string, string> = {
    basketball: '🏀',
    football: '🏈',
    baseball: '⚾',
    hockey: '🏒',
    soccer: '⚽',
  };
  return emojiMap[sport.toLowerCase()] || '🎮';
}

export function ParlayBuilder() {
  const { activeParlay, setActiveParlay, isParlayBuilderOpen, setIsParlayBuilderOpen, refreshActiveParlay } = useParlay();
  const { triggerRefresh } = useBets();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  
  // Animation for expanded/minimized states
  const sheetHeight = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Calculate positions
  const expandedPosition = SCREEN_HEIGHT - SHEET_HEIGHT - insets.bottom;
  const minimizedPosition = SCREEN_HEIGHT - MINIMIZED_HEIGHT - insets.bottom;
  const hiddenPosition = SCREEN_HEIGHT;

  // Pan responder for drag gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (isMinimized) {
          // When minimized, only allow dragging up
          if (gestureState.dy < 0) {
            const newPos = minimizedPosition + gestureState.dy;
            sheetHeight.setValue(Math.max(expandedPosition, newPos));
          }
        } else {
          // When expanded, allow dragging down
          if (gestureState.dy > 0) {
            const newPos = expandedPosition + gestureState.dy;
            sheetHeight.setValue(Math.min(minimizedPosition, newPos));
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isMinimized) {
          // From minimized: if dragged up enough, expand
          if (gestureState.dy < -50 || gestureState.vy < -0.5) {
            expandSheet();
          } else {
            minimizeSheet();
          }
        } else {
          // From expanded: if dragged down enough, minimize (not close!)
          if (gestureState.dy > 100 || gestureState.vy > 0.5) {
            minimizeSheet();
          } else {
            expandSheet();
          }
        }
      },
    })
  ).current;

  const expandSheet = () => {
    setIsMinimized(false);
    Animated.parallel([
      Animated.spring(sheetHeight, {
        toValue: expandedPosition,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const minimizeSheet = () => {
    setIsMinimized(true);
    Animated.parallel([
      Animated.spring(sheetHeight, {
        toValue: minimizedPosition,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideSheet = () => {
    Animated.parallel([
      Animated.timing(sheetHeight, {
        toValue: hiddenPosition,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    if (isParlayBuilderOpen && activeParlay) {
      // Start minimized when first opening
      sheetHeight.setValue(hiddenPosition);
      setIsMinimized(false);
      
      // Then animate to expanded
      setTimeout(() => {
        expandSheet();
      }, 50);
    } else {
      hideSheet();
    }
  }, [isParlayBuilderOpen, activeParlay?.id]);

  const handleCloseButton = () => {
    // If parlay has 2+ bets, show confirmation modal
    if (activeParlay && activeParlay.betCount >= 2) {
      setShowCloseModal(true);
    } else {
      // For 1-bet parlays, just cancel directly
      handleDiscardParlay();
    }
  };

  const handleDiscardParlay = async () => {
    setShowCloseModal(false);
    
    if (activeParlay) {
      try {
        await api.deleteParlay(activeParlay.id);
        showToast('Parlay discarded', 'info');
        triggerRefresh();
      } catch (err) {
        console.error('Error deleting parlay:', err);
      }
    }
    
    hideSheet();
    setTimeout(() => {
      setActiveParlay(null);
      setIsParlayBuilderOpen(false);
      triggerRefresh();
    }, 250);
  };

  const handleSaveAndClose = async () => {
    setShowCloseModal(false);
    await handleSaveParlay();
  };

  const handleRemoveSelection = async (selectionId: string) => {
    if (loading || !activeParlay) return;

    setRemovingId(selectionId);

    try {
      const response = await api.removeSelectionFromParlay(activeParlay.id, selectionId);
      if (response.success) {
        if (response.data) {
          const data = response.data as { message?: string; parlay?: any };
          if (data.message?.includes('deleted')) {
            setActiveParlay(null);
            setIsParlayBuilderOpen(false);
            showToast('Parlay deleted', 'info');
            triggerRefresh();
          } else if (data.parlay) {
            setActiveParlay(data.parlay);
            await refreshActiveParlay();
          }
        }
      } else {
        showToast(response.error?.message || 'Failed to remove bet', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to remove bet', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const handleToggleInsurance = async () => {
    if (loading || !activeParlay || activeParlay.betCount < 4) return;

    setLoading(true);

    try {
      const response = await api.updateParlay(activeParlay.id, {
        insured: !activeParlay.insured
      });
      if (response.success && response.data?.parlay) {
        setActiveParlay(response.data.parlay);
        showToast(
          response.data.parlay.insured ? 'Insurance enabled' : 'Insurance disabled',
          'success'
        );
      } else {
        showToast(response.error?.message || 'Failed to update insurance', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update insurance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveParlay = async () => {
    if (!activeParlay || activeParlay.betCount < 2) {
      showToast('Parlay must have at least 2 bets', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await api.getParlay(activeParlay.id);
      if (response.success) {
        showToast('Parlay saved!', 'success');
        hideSheet();
        setTimeout(() => {
          setIsParlayBuilderOpen(false);
          triggerRefresh();
        }, 250);
      } else {
        showToast('Failed to verify parlay', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save parlay', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteParlay = async () => {
    if (!activeParlay) return;

    setLoading(true);

    try {
      const response = await api.deleteParlay(activeParlay.id);
      if (response.success) {
        showToast('Parlay deleted', 'info');
        hideSheet();
        setTimeout(() => {
          setActiveParlay(null);
          setIsParlayBuilderOpen(false);
          triggerRefresh();
        }, 250);
      } else {
        showToast(response.error?.message || 'Failed to delete parlay', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete parlay', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!activeParlay || !isParlayBuilderOpen) {
    return null;
  }

  const isLocked = activeParlay.lockedAt !== null && activeParlay.lockedAt !== undefined;
  const canInsure = activeParlay.betCount >= 4 && !isLocked;
  const insuranceCost = activeParlay.betCount >= 4 ? activeParlay.insuranceCost : null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' }}>
      {/* Backdrop - only visible when expanded */}
      <Animated.View
        pointerEvents={isMinimized ? 'none' : 'auto'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          opacity: backdropAnim,
        }}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={minimizeSheet}
        />
      </Animated.View>

      {/* Bottom Sheet */}
      <Animated.View
        style={{
          position: 'absolute',
          top: sheetHeight,
          left: 0,
          right: 0,
          height: SHEET_HEIGHT,
          backgroundColor: '#0f172a',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 20,
        }}
      >
        {/* Handle */}
        <View 
          {...panResponder.panHandlers}
          style={{ alignItems: 'center', paddingVertical: 12 }}
        >
          <View style={{ width: 40, height: 4, backgroundColor: '#475569', borderRadius: 2 }} />
        </View>

        {/* Minimized View */}
        {isMinimized ? (
          <TouchableOpacity 
            onPress={expandSheet}
            activeOpacity={0.9}
            style={{ flex: 1, paddingHorizontal: 16 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Left: Parlay badge + bet count + value */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                    {activeParlay.betCount} {activeParlay.betCount === 1 ? 'Bet' : 'Bets'}
                  </Text>
                </View>
                <Text style={{ color: '#fb923c', fontWeight: 'bold', fontSize: 18 }}>
                  +{activeParlay.parlayValue}
                </Text>
              </View>
              
              {/* Right: Save button or chevron */}
              {activeParlay.betCount >= 2 && !isLocked ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleSaveParlay();
                  }}
                  disabled={loading}
                  style={{
                    backgroundColor: '#ea580c',
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Save</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-up" size={24} color="#64748b" />
              )}
            </View>
          </TouchableOpacity>
        ) : (
          /* Expanded View */
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                    {activeParlay.betCount} {activeParlay.betCount === 1 ? 'Bet' : 'Bets'}
                  </Text>
                </View>
                <Text style={{ color: '#fb923c', fontWeight: 'bold', fontSize: 18 }}>
                  +{activeParlay.parlayValue}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCloseButton} style={{ padding: 8 }}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Warning for 1-bet parlay */}
            {activeParlay.betCount === 1 && (
              <View style={{ backgroundColor: 'rgba(161, 98, 7, 0.3)', borderWidth: 1, borderColor: '#a16207', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <Text style={{ color: '#fbbf24', fontSize: 13 }}>
                  Add at least one more bet to create a valid parlay, or tap ✕ to cancel.
                </Text>
              </View>
            )}

            {/* Bet Selections - only show actual bets, no empty slots */}
            <View style={{ gap: 8, marginBottom: 16 }}>
              {activeParlay.selections.map((selection) => (
                <View
                  key={selection.id}
                  style={{ backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 12 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{ fontSize: 16 }}>{getSportEmoji(selection.game.sport)}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 11 }}>
                          {selection.game.awayTeam} @ {selection.game.homeTeam}
                        </Text>
                      </View>
                      <Text style={{ color: '#fff', fontWeight: '500', fontSize: 13 }} numberOfLines={1}>
                        {selection.bet.displayText}
                      </Text>
                      <Text style={{ color: '#fb923c', fontSize: 11, marginTop: 2 }}>
                        {getSideDisplayLabel(selection)}
                      </Text>
                    </View>
                    {!isLocked && (
                      <TouchableOpacity
                        onPress={() => handleRemoveSelection(selection.id)}
                        disabled={removingId === selection.id}
                        style={{ height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#334155' }}
                      >
                        {removingId === selection.id ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <Ionicons name="close" size={16} color="#ef4444" />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Insurance Toggle */}
            {canInsure && (
              <View style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: '#cbd5e1', fontSize: 14, fontWeight: '500' }}>Insurance</Text>
                    {insuranceCost !== null && (
                      <Text style={{ color: '#64748b', fontSize: 11 }}>
                        Cost: {insuranceCost} streak point{insuranceCost !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={handleToggleInsurance}
                    disabled={loading}
                    style={{
                      width: 48,
                      height: 28,
                      borderRadius: 14,
                      justifyContent: 'center',
                      backgroundColor: activeParlay.insured ? '#ea580c' : '#334155',
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: '#fff',
                        marginLeft: activeParlay.insured ? 24 : 4,
                      }}
                    />
                  </TouchableOpacity>
                </View>
                {activeParlay.insured && insuranceCost !== null && (
                  <Text style={{ color: '#34d399', fontSize: 11, marginTop: 8 }}>
                    Net if win: +{activeParlay.parlayValue - insuranceCost}
                  </Text>
                )}
              </View>
            )}

            {/* Locked indicator */}
            {isLocked && (
              <View style={{ backgroundColor: 'rgba(161, 98, 7, 0.2)', borderWidth: 1, borderColor: 'rgba(161, 98, 7, 0.3)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <Text style={{ color: '#fbbf24', fontSize: 13, textAlign: 'center' }}>
                  🔒 This parlay is locked
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            {!isLocked && (
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={handleSaveParlay}
                  disabled={loading || activeParlay.betCount < 2}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: loading || activeParlay.betCount < 2 ? '#334155' : '#ea580c',
                  }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ fontWeight: 'bold', color: activeParlay.betCount < 2 ? '#64748b' : '#fff' }}>
                      Save Parlay
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDiscardParlay}
                  disabled={loading}
                  style={{
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: 'rgba(127, 29, 29, 0.3)',
                    borderWidth: 1,
                    borderColor: 'rgba(127, 29, 29, 0.5)',
                  }}
                >
                  <Text style={{ color: '#f87171', fontWeight: '500' }}>
                    {activeParlay.betCount === 1 ? 'Cancel Parlay' : 'Delete Parlay'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </Animated.View>

      {/* Close Confirmation Modal */}
      <Modal
        visible={showCloseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCloseModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
              Save Parlay?
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
              You have {activeParlay?.betCount} bets in your parlay worth +{activeParlay?.parlayValue} points.
            </Text>
            
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={handleSaveAndClose}
                style={{
                  backgroundColor: '#ea580c',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Save</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleDiscardParlay}
                style={{
                  backgroundColor: 'rgba(100, 116, 139, 0.2)',
                  borderWidth: 1,
                  borderColor: 'rgba(100, 116, 139, 0.3)',
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#94a3b8', fontWeight: '600', fontSize: 16 }}>Discard Changes</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => setShowCloseModal(false)}
                style={{
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#64748b', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
