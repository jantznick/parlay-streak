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
import { LockTimer } from '../common/LockTimer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
const MINIMIZED_HEIGHT = 80;

// Returns labels for both sides of a bet + optional context
function getBetSideLabels(selection: ParlaySelection): {
  side1: { value: string; label: string };
  side2: { value: string; label: string };
  context?: string;
} {
  const { bet, game } = selection;
  const config = bet.config;

  if (!config) {
    return {
      side1: { value: 'participant_1', label: 'Side 1' },
      side2: { value: 'participant_2', label: 'Side 2' },
    };
  }

  if (bet.betType === 'COMPARISON') {
    const compConfig = config as any;
    const participant1 = compConfig.participant_1;
    const participant2 = compConfig.participant_2;
    const isTeamVsTeam = participant1?.subject_type === 'TEAM' && participant2?.subject_type === 'TEAM';

    let name1 = participant1?.subject_name || 'Participant 1';
    let name2 = participant2?.subject_name || 'Participant 2';

    // For teams, try to get actual team name from game data
    if (participant1?.subject_type === 'TEAM' && game) {
      const metadata = game.metadata;
      const apiData = metadata?.apiData;
      if (apiData?.teams?.home?.id === participant1.subject_id) {
        name1 = game.homeTeam;
      } else if (apiData?.teams?.away?.id === participant1.subject_id) {
        name1 = game.awayTeam;
      }
    }

    if (participant2?.subject_type === 'TEAM' && game) {
      const metadata = game.metadata;
      const apiData = metadata?.apiData;
      if (apiData?.teams?.home?.id === participant2.subject_id) {
        name2 = game.homeTeam;
      } else if (apiData?.teams?.away?.id === participant2.subject_id) {
        name2 = game.awayTeam;
      }
    }

    // For non-team-vs-team, add metric and time period to labels
    if (!isTeamVsTeam) {
      if (participant1?.metric) {
        const timePeriod = participant1.time_period && participant1.time_period !== 'FULL_GAME'
          ? ` (${participant1.time_period})`
          : '';
        name1 = `${name1} - ${participant1.metric}${timePeriod}`;
      }
      if (participant2?.metric) {
        const timePeriod = participant2.time_period && participant2.time_period !== 'FULL_GAME'
          ? ` (${participant2.time_period})`
          : '';
        name2 = `${name2} - ${participant2.metric}${timePeriod}`;
      }
    }

    // Add spread if applicable (only for participant_1)
    if (compConfig.spread) {
      const spreadValue = compConfig.spread.value;
      const spreadDir = compConfig.spread.direction;
      name1 = spreadDir === '+' ? `${name1} +${spreadValue}` : `${name1} -${spreadValue}`;
    }

    return {
      side1: { value: 'participant_1', label: name1 },
      side2: { value: 'participant_2', label: name2 },
    };

  } else if (bet.betType === 'THRESHOLD') {
    const threshConfig = config as any;
    const threshold = threshConfig.threshold || 0;
    const participant = threshConfig.participant;

    let context = '';
    if (participant) {
      const subjectName = participant.subject_name || '';
      const metric = participant.metric || '';
      const timePeriod = participant.time_period && participant.time_period !== 'FULL_GAME'
        ? ` (${participant.time_period})`
        : '';
      context = `${subjectName} ${metric}${timePeriod}`.trim();
    }

    return {
      side1: { value: 'over', label: `OVER ${threshold}` },
      side2: { value: 'under', label: `UNDER ${threshold}` },
      context: context || undefined,
    };

  } else if (bet.betType === 'EVENT') {
    return {
      side1: { value: 'yes', label: 'YES' },
      side2: { value: 'no', label: 'NO' },
      context: bet.displayText || undefined,
    };
  }

  return {
    side1: { value: 'participant_1', label: 'Side 1' },
    side2: { value: 'participant_2', label: 'Side 2' },
  };
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
      // Start from hidden position
      sheetHeight.setValue(hiddenPosition);
      
      // If editing (2+ bets), open fully expanded
      // If new (1 bet), open minimized
      setTimeout(() => {
        if (activeParlay.betCount >= 2) {
          // Editing - open fully expanded
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
        } else {
          // New parlay - open minimized
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
              duration: 250,
              useNativeDriver: true,
            }),
          ]).start();
        }
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
      // For 1-bet parlays, just delete and cancel
      handleDeleteParlay();
    }
  };

  // Just close the builder without deleting - parlay stays saved
  const handleDiscardChanges = () => {
    setShowCloseModal(false);
    hideSheet();
    setTimeout(() => {
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
        // showToast(
        //   response.data.parlay.insured ? 'Insurance enabled' : 'Insurance disabled',
        //   'success'
        // );
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
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 20,
        }}
        className="bg-background-light dark:bg-card-dark"
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
                <Text className="text-primary font-bold text-lg">
                  +{activeParlay.insured && activeParlay.insuranceCost ? activeParlay.parlayValue - activeParlay.insuranceCost : activeParlay.parlayValue}
                </Text>
                {activeParlay.insured && (
                  <View className="bg-primary/20" style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 }}>
                    <Text className="text-primary text-xs font-semibold">INS</Text>
                  </View>
                )}
              </View>
              
              {/* Right: Save button or chevron */}
              {activeParlay.betCount >= 2 && !isLocked ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleSaveParlay();
                  }}
                  disabled={loading}
                  className="bg-primary"
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-base">Save</Text>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                    {activeParlay.betCount} {activeParlay.betCount === 1 ? 'Bet' : 'Bets'}
                  </Text>
                </View>
                <Text className="text-primary font-bold text-lg">
                  +{activeParlay.insured && activeParlay.insuranceCost ? activeParlay.parlayValue - activeParlay.insuranceCost : activeParlay.parlayValue}
                </Text>
                {activeParlay.insured && (
                  <Text className="text-muted-foreground-light dark:text-muted-foreground-dark text-xs">
                    ({activeParlay.parlayValue} - {activeParlay.insuranceCost} insurance cost)
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={handleCloseButton} style={{ padding: 8 }}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Warning for 1-bet parlay */}
            {activeParlay.betCount === 1 && (
              <View className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-3 mb-4">
                <Text className="text-yellow-600 dark:text-yellow-400 text-sm">
                  Add at least one more bet to create a valid parlay, or tap ✕ to cancel.
                </Text>
              </View>
            )}

            {/* Bet Selections - show both options with selected highlighted */}
            <View style={{ gap: 10, marginBottom: 16 }}>
              {activeParlay.selections.map((selection) => {
                const sideLabels = getBetSideLabels(selection);
                const isSelected1 = selection.selectedSide === sideLabels.side1.value;
                const isSelected2 = selection.selectedSide === sideLabels.side2.value;
                
                return (
                  <View
                    key={selection.id}
                    className="bg-slate-800 border border-slate-700 rounded-xl p-3"
                  >
                    {/* Header: emoji, matchup, lock timer, remove button */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 16 }}>{getSportEmoji(selection.game.sport)}</Text>
                        <Text className="text-slate-400 text-xs flex-1" numberOfLines={1}>
                          {selection.game.awayTeam} @ {selection.game.homeTeam}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {selection.game.status === 'scheduled' && (
                          <LockTimer startTime={selection.game.startTime} status={selection.game.status} />
                        )}
                        {!isLocked && (
                          <TouchableOpacity
                            onPress={() => handleRemoveSelection(selection.id)}
                            disabled={removingId === selection.id}
                            className="h-7 w-7 items-center justify-center rounded-full bg-slate-700"
                          >
                            {removingId === selection.id ? (
                              <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                              <Ionicons name="close" size={14} color="#ef4444" />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    
                    {/* Context (for threshold/event bets) */}
                    {sideLabels.context && (
                      <Text className="text-white text-sm font-medium mb-2">
                        {sideLabels.context}
                      </Text>
                    )}
                    
                    {/* Selection buttons - both shown, selected one highlighted */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View
                        style={{
                          flex: 1,
                          paddingHorizontal: 8,
                          paddingVertical: 8,
                          borderRadius: 8,
                          borderWidth: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        className={isSelected1 ? 'border-primary bg-primary/15' : 'border-slate-700'}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            textAlign: 'center',
                          }}
                          className={isSelected1 ? 'text-primary' : 'text-slate-400'}
                          numberOfLines={2}
                        >
                          {sideLabels.side1.label}
                        </Text>
                      </View>
                      <View
                        style={{
                          flex: 1,
                          paddingHorizontal: 8,
                          paddingVertical: 8,
                          borderRadius: 8,
                          borderWidth: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        className={isSelected2 ? 'border-primary bg-primary/15' : 'border-slate-700'}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            textAlign: 'center',
                          }}
                          className={isSelected2 ? 'text-primary' : 'text-slate-400'}
                          numberOfLines={2}
                        >
                          {sideLabels.side2.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Insurance Toggle */}
            {canInsure && (
              <View className="bg-slate-800/50 rounded-xl p-3 mb-4">
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text className="text-white text-sm font-medium">Insurance</Text>
                    {insuranceCost !== null && (
                      <Text className="text-slate-400 text-xs">
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
                    }}
                    className={activeParlay.insured ? 'bg-primary' : 'bg-slate-700'}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: '#fff',
                        transform: [{ translateX: activeParlay.insured ? 24 : 4 }],
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
              <View className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-3 mb-4">
                <Text className="text-yellow-300 text-sm text-center">
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
                  }}
                  className={loading || activeParlay.betCount < 2 ? 'bg-slate-700' : 'bg-primary'}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ fontWeight: 'bold' }} className={activeParlay.betCount < 2 ? 'text-slate-400' : 'text-white'}>
                      Save Parlay
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDeleteParlay}
                  disabled={loading}
                  style={{
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                  className="bg-red-500/10 border border-red-500/20"
                >
                  <Text className="text-red-400 font-medium">
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
          <View className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-[340px]">
            <Text className="text-white text-xl font-bold text-center mb-2">
              Save Parlay?
            </Text>
            <Text className="text-slate-400 text-sm text-center mb-6">
              You have {activeParlay?.betCount} bets in your parlay worth +{activeParlay?.parlayValue} points.
            </Text>
            
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={handleSaveAndClose}
                className="bg-primary py-3.5 rounded-xl items-center"
              >
                <Text className="text-white font-bold text-base">Save</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleDiscardChanges}
                className="bg-slate-700 border border-slate-600 py-3.5 rounded-xl items-center"
              >
                <Text className="text-slate-200 font-semibold text-base">Discard Changes</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => setShowCloseModal(false)}
                style={{
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text className="text-slate-400 text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
