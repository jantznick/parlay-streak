import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { BetSelectionGroup } from '../components/bets/BetSelectionGroup';
import { ParlayCard } from '../components/bets/ParlayCard';
import { CalendarModal } from '../components/common/CalendarModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { LockTimer } from '../components/common/LockTimer';
import { streakMessages } from '../utils/streakMessages';
import { useToast } from '../context/ToastContext';
import { useParlay } from '../context/ParlayContext';
import { useBets } from '../context/BetsContext';
import type { Parlay } from '../interfaces/parlay';

interface Bet {
  id: string;
  betType: string;
  displayText: string;
  priority: number;
  outcome?: string;
  config?: any;
  displayTextOverride?: string;
}

interface Game {
  id: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  bets: Bet[];
  metadata?: any;
}

interface BetSelection {
  id: string;
  betId: string;
  selectedSide: string;
  status: string;
  outcome?: string;
  bet: {
    id: string;
    displayText: string;
    betType: string;
    outcome: string;
    config?: any;
    game: {
      id: string;
      homeTeam: string;
      awayTeam: string;
      startTime: string;
      status: string;
      sport: string;
      homeScore?: number | null;
      awayScore?: number | null;
      metadata?: any;
    };
  };
}

export function Dashboard() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { setActiveParlay, setIsParlayBuilderOpen } = useParlay();
  const { refreshTrigger, triggerRefresh } = useBets();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mySelections, setMySelections] = useState<BetSelection[]>([]);
  const [myParlays, setMyParlays] = useState<Parlay[]>([]);
  const [loadingMyBets, setLoadingMyBets] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingParlayId, setDeletingParlayId] = useState<string | null>(null);
  const [streakTitle, setStreakTitle] = useState<string>('');
  const [streakSubtitle, setStreakSubtitle] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteParlayId, setConfirmDeleteParlayId] = useState<string | null>(null);
  const { showToast } = useToast();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchTodaysBets(), fetchMyBets(), fetchMyParlays()]);
    setRefreshing(false);
  }, [selectedDate]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const shiftDate = (days: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + days);
      return next;
    });
  };

  const getTimezoneOffset = () => {
    // getTimezoneOffset() returns offset in minutes, negative for ahead of UTC
    // We want hours, positive for ahead of UTC (e.g., EST is -5, so offset is -5)
    return -new Date().getTimezoneOffset() / 60;
  };

  const fetchTodaysBets = async () => {
    setLoading(true);
    setError(null);
    try {
      const dateString = formatDateString(selectedDate);
      const timezoneOffset = getTimezoneOffset();
      const response = await api.getTodaysBets(dateString, timezoneOffset);
      if (response.success && response.data?.games) {
        const sortedGames = [...response.data.games].sort((a, b) => {
          const timeA = new Date(a.startTime).getTime();
          const timeB = new Date(b.startTime).getTime();
          return timeA - timeB;
        });
        setGames(sortedGames);
      } else {
        setGames([]);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load bets');
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBets = async () => {
    setLoadingMyBets(true);
    try {
      const dateString = formatDateString(selectedDate);
      const timezoneOffset = getTimezoneOffset();
      const response = await api.getMySelections(dateString, timezoneOffset);
      if (response.success && response.data) {
        const data = response.data as { selections?: BetSelection[] };
        // Filter to only single bets (no parlay)
        const singleBets = (data.selections || []).filter(
          (s: any) => !s.parlayId || s.parlayId === null
        );
        setMySelections(singleBets);
      } else {
        setMySelections([]);
      }
    } catch (error: any) {
      console.error('Failed to load my bets:', error);
      setMySelections([]);
    } finally {
      setLoadingMyBets(false);
    }
  };

  const fetchMyParlays = async () => {
    try {
      const dateString = formatDateString(selectedDate);
      const timezoneOffset = getTimezoneOffset();
      // getParlays(status, includeSelections, date, timezoneOffset)
      const response = await api.getParlays(undefined, true, dateString, timezoneOffset);
      if (response.success && response.data) {
        const data = response.data as { parlays?: Parlay[] };
        setMyParlays(data.parlays || []);
      } else {
        setMyParlays([]);
      }
    } catch (error: any) {
      console.error('Failed to load parlays:', error);
      setMyParlays([]);
    }
  };

  const handleDeleteBet = (selectionId: string) => {
    setConfirmDeleteId(selectionId);
  };

  const performDeleteBet = async () => {
    if (!confirmDeleteId) return;
    
    const idToDelete = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(idToDelete);

    try {
      const response = await api.deleteSelection(idToDelete);
      if (response.success) {
        showToast('Bet removed successfully', 'info');
        await fetchMyBets();
      } else {
        Alert.alert('Error', response.error?.message || 'Failed to delete bet');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete bet');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenParlay = (parlay: Parlay) => {
    setActiveParlay(parlay);
    setIsParlayBuilderOpen(true);
  };

  const handleDeleteParlay = (parlayId: string) => {
    setConfirmDeleteParlayId(parlayId);
  };

  const performDeleteParlay = async () => {
    if (!confirmDeleteParlayId) return;
    
    const idToDelete = confirmDeleteParlayId;
    setConfirmDeleteParlayId(null);
    setDeletingParlayId(idToDelete);

    try {
      const response = await api.deleteParlay(idToDelete);
      if (response.success) {
        showToast('Parlay deleted', 'info');
        await fetchMyParlays();
        await fetchMyBets();
      } else {
        showToast(response.error?.message || 'Failed to delete parlay', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to delete parlay', 'error');
    } finally {
      setDeletingParlayId(null);
    }
  };

  const handleMakeParlay = async (selection: BetSelection) => {
    // Convert existing single bet to a parlay
    try {
      const response = await api.startParlay(selection.betId, selection.selectedSide);
      if (response.success && response.data) {
        const data = response.data as { parlay?: Parlay };
        if (data.parlay) {
          // Delete the old single bet selection
          await api.deleteSelection(selection.id);
          setActiveParlay(data.parlay);
          setIsParlayBuilderOpen(true);
          // showToast('Parlay started from existing bet!', 'success');
          await fetchMyBets();
          await fetchMyParlays();
        }
      } else {
        showToast(response.error?.message || 'Failed to start parlay', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to start parlay', 'error');
    }
  };

  useEffect(() => {
    // Set random streak messages on mount
    const randomTitle = streakMessages.titles[Math.floor(Math.random() * streakMessages.titles.length)];
    const randomSubtitle = streakMessages.subtitles[Math.floor(Math.random() * streakMessages.subtitles.length)];
    setStreakTitle(randomTitle);
    setStreakSubtitle(randomSubtitle);
  }, []);

  useEffect(() => {
    fetchTodaysBets();
    fetchMyBets();
    fetchMyParlays();
  }, [selectedDate]);

  // Refresh when parlay builder triggers a refresh
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchMyBets();
      fetchMyParlays();
    }
  }, [refreshTrigger]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getSportEmoji = (sport: string) => {
    const emojiMap: Record<string, string> = {
      basketball: '🏀',
      football: '🏈',
      baseball: '⚾',
      hockey: '🏒',
      soccer: '⚽',
    };
    return emojiMap[sport.toLowerCase()] || '🎮';
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e5e7eb" />
        }
      >
        {/* Header Section */}
        <View className="px-6 pt-6 pb-2">
          <Text className="text-3xl font-bold text-white">Dashboard</Text>
          <Text className="text-slate-400 text-sm mt-1">
            Welcome back, {user?.username}
          </Text>
        </View>

        {/* Hero section with streak and banner */}
        <View className="px-6 pt-4 pb-6">
          {user && (
            <View>
              {/* Primary streak card */}
              <View className="bg-orange-600 rounded-[24px] px-6 py-6 mb-5 shadow-lg shadow-orange-900/20">
                <Text className="text-sm font-medium text-orange-100 mb-1 opacity-90">
                  Current Streak
                </Text>
                <View className="flex-row items-end justify-between">
                  <View>
                    <Text className="text-6xl font-black text-white leading-tight">
                      {user.currentStreak}
                    </Text>
                    <Text className="text-sm text-orange-200 font-medium">
                      Personal Best: {user.longestStreak}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs text-orange-200 mb-1">
                      Rank
                    </Text>
                    <Text className="text-2xl font-bold text-white">
                      #{user.leaderboardRank || '-'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Status banner - only show when no bets/parlays placed */}
              {streakTitle && streakSubtitle && mySelections.length === 0 && myParlays.length === 0 && (
                <View className="bg-slate-900 rounded-xl border border-slate-800 px-4 py-3 mb-6 flex-row items-start gap-3">
                  <View className="bg-slate-800 p-2 rounded-full">
                    <Ionicons name="trending-up" size={16} color="#fb923c" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-sm font-semibold">
                      {streakTitle}
                    </Text>
                    <Text className="text-slate-400 text-xs mt-1 leading-relaxed">
                      {streakSubtitle}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Date picker row */}
          <View className="flex-row items-center justify-between bg-slate-900 rounded-2xl p-1.5 border border-slate-800 mb-2">
            <TouchableOpacity
              onPress={() => shiftDate(-1)}
              className="h-10 w-10 rounded-xl bg-slate-800 items-center justify-center"
            >
              <Ionicons name="chevron-back" size={20} color="#94a3b8" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setCalendarVisible(true)}
              className="flex-row items-center bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700/50"
            >
              <Ionicons name="calendar-outline" size={16} color="#e2e8f0" style={{ marginRight: 8 }} />
              <Text className="text-white text-base font-semibold">
                {formatDate(selectedDate)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => shiftDate(1)}
              className="h-10 w-10 rounded-xl bg-slate-800 items-center justify-center"
            >
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          
          <CalendarModal
            visible={calendarVisible}
            onClose={() => setCalendarVisible(false)}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          <ConfirmationModal
            visible={!!confirmDeleteId}
            title="Delete Bet"
            message="Are you sure you want to remove this bet selection?"
            confirmText="Remove"
            cancelText="Cancel"
            isDestructive
            onConfirm={performDeleteBet}
            onCancel={() => setConfirmDeleteId(null)}
          />

          <ConfirmationModal
            visible={!!confirmDeleteParlayId}
            title="Delete Parlay"
            message="Are you sure you want to delete this parlay? All selections will be removed."
            confirmText="Delete"
            cancelText="Cancel"
            isDestructive
            onConfirm={performDeleteParlay}
            onCancel={() => setConfirmDeleteParlayId(null)}
          />
        </View>

        {/* My Bets section */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-white">
              My Picks
            </Text>
          </View>

          {loadingMyBets && !refreshing ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#e5e7eb" />
            </View>
          ) : mySelections.length === 0 && myParlays.length === 0 ? (
            <View className="bg-slate-900/50 rounded-2xl p-6 items-center border border-slate-800 border-dashed">
              <Ionicons name="clipboard-outline" size={32} color="#475569" />
              <Text className="text-slate-500 text-sm mt-2 text-center">
                No active picks for this date
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {/* Parlays first (only show valid parlays with 2+ bets) */}
              {myParlays
                .filter((parlay) => parlay.betCount >= 2)
                .map((parlay) => (
                <ParlayCard
                  key={parlay.id}
                  parlay={parlay}
                  onOpen={handleOpenParlay}
                  onDelete={handleDeleteParlay}
                  deletingId={deletingParlayId}
                />
              ))}

              {/* Single bets */}
              {mySelections.map((selection) => {
                  const game = selection.bet.game;
                  const getBetSideLabels = (bet: any, game: any) => {
                    const config = bet.config;
                    if (!config) {
                      return { side1: { label: 'Side 1' }, side2: { label: 'Side 2' } };
                    }
                    if (bet.betType === 'COMPARISON') {
                      const compConfig = config;
                      const participant1 = compConfig.participant_1;
                      const participant2 = compConfig.participant_2;
                      let name1 = participant1?.subject_name || 'Participant 1';
                      let name2 = participant2?.subject_name || 'Participant 2';
                      if (participant1?.subject_type === 'TEAM') {
                        const metadata = game.metadata;
                        const apiData = metadata?.apiData;
                        if (apiData?.teams?.home?.id === participant1.subject_id) {
                          name1 = game.homeTeam;
                        } else if (apiData?.teams?.away?.id === participant1.subject_id) {
                          name1 = game.awayTeam;
                        }
                      }
                      if (participant2?.subject_type === 'TEAM') {
                        const metadata = game.metadata;
                        const apiData = metadata?.apiData;
                        if (apiData?.teams?.home?.id === participant2.subject_id) {
                          name2 = game.homeTeam;
                        } else if (apiData?.teams?.away?.id === participant2.subject_id) {
                          name2 = game.awayTeam;
                        }
                      }
                      if (compConfig.spread) {
                        const spreadValue = compConfig.spread.value;
                        const spreadDir = compConfig.spread.direction;
                        if (spreadDir === '+') {
                          name1 = `${name1} +${spreadValue}`;
                        } else {
                          name1 = `${name1} -${spreadValue}`;
                        }
                      }
                      return {
                        side1: { label: name1 },
                        side2: { label: name2 },
                      };
                    } else if (bet.betType === 'THRESHOLD') {
                      const threshConfig = config;
                      const threshold = threshConfig.threshold || 0;
                      return {
                        side1: { label: `OVER ${threshold}` },
                        side2: { label: `UNDER ${threshold}` },
                      };
                    } else if (bet.betType === 'EVENT') {
                      return {
                        side1: { label: 'YES' },
                        side2: { label: 'NO' },
                      };
                    }
                    return { side1: { label: 'Side 1' }, side2: { label: 'Side 2' } };
                  };
                  const sideLabels = getBetSideLabels(selection.bet, game);
                  const selectedLabel =
                    selection.selectedSide === 'participant_1' || selection.selectedSide === 'over' || selection.selectedSide === 'yes'
                      ? sideLabels.side1.label
                      : sideLabels.side2.label;

                  const canModify = selection.status !== 'locked' && game.status === 'scheduled';

                  return (
                    <View
                      key={selection.id}
                      className="bg-slate-900 rounded-2xl border border-slate-800 p-4"
                    >
                      <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-xl">{getSportEmoji(game.sport)}</Text>
                          <View>
                            <Text className="text-xs text-slate-400 font-medium">
                                {game.awayTeam} @ {game.homeTeam}
                            </Text>
                            <View className="flex-row items-center gap-2 mt-0.5">
                              <Text className="text-[10px] text-slate-500">
                                  {formatTime(game.startTime)}
                              </Text>
                              {canModify && <LockTimer startTime={game.startTime} status={game.status} />}
                            </View>
                          </View>
                        </View>
                        {selection.outcome && selection.outcome !== 'pending' && (
                          <View
                            className={`px-2 py-1 rounded-md ${
                              selection.outcome === 'win'
                                ? 'bg-emerald-500/10'
                                : selection.outcome === 'loss'
                                ? 'bg-red-500/10'
                                : 'bg-yellow-500/10'
                            }`}
                          >
                            <Text
                              className={`text-[10px] font-bold ${
                                selection.outcome === 'win'
                                  ? 'text-emerald-400'
                                  : selection.outcome === 'loss'
                                  ? 'text-red-400'
                                  : 'text-yellow-400'
                              }`}
                            >
                              {selection.outcome.toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      <View className="flex-row items-center justify-between">
                         <Text className="text-base text-white font-bold">
                            {selectedLabel}
                          </Text>
                          
                        {canModify && (
                          <View className="flex-row items-center gap-2">
                            <TouchableOpacity
                              onPress={() => handleMakeParlay(selection)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600"
                            >
                              <Text className="text-white text-xs font-semibold">Make Parlay</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteBet(selection.id)}
                              disabled={deletingId === selection.id}
                              className="h-8 w-8 items-center justify-center rounded-full bg-slate-800"
                            >
                              {deletingId === selection.id ? (
                                <ActivityIndicator size="small" color="#ef4444" />
                              ) : (
                                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {game.status === 'completed' &&
                        game.homeScore !== null &&
                        game.awayScore !== null && (
                          <View className="mt-3 pt-3 border-t border-slate-800 flex-row justify-between">
                             <Text className="text-xs text-slate-500">Final Score</Text>
                             <Text className="text-xs text-slate-400 font-medium">
                               {game.awayTeam} {game.awayScore} - {game.homeScore} {game.homeTeam}
                             </Text>
                          </View>
                        )}
                    </View>
                  );
                })}
            </View>
          )}
        </View>

        {/* Available Bets list */}
        <View className="px-6 pb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-white">
              Available Bets
            </Text>
          </View>

          {loading && !refreshing ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#ea580c" />
              <Text className="text-slate-400 text-xs mt-3">Loading available bets...</Text>
            </View>
          ) : error ? (
            <View className="bg-red-900/20 border border-red-500/30 rounded-2xl p-4">
              <Text className="text-red-200 text-sm text-center mb-2">{error}</Text>
              <TouchableOpacity
                onPress={fetchTodaysBets}
                className="self-center px-4 py-2 bg-red-600 rounded-lg"
              >
                <Text className="text-white text-xs font-semibold">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : games.length === 0 ? (
            <View className="bg-slate-900/50 rounded-2xl p-8 items-center border border-slate-800 border-dashed">
              <Text className="text-4xl mb-3">📅</Text>
              <Text className="text-slate-300 font-medium mb-1">
                No games available
              </Text>
              <Text className="text-slate-500 text-xs text-center">
                Check back later or change the date
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {games.map((game) => {
                const sortedBets = [...game.bets].sort((a, b) => a.priority - b.priority);
                
                return (
                  <View
                    key={game.id}
                    className="bg-slate-900 rounded-[20px] border border-slate-800 overflow-hidden"
                  >
                    {/* Game Header */}
                    <View className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                      <View className="flex-row items-center gap-3">
                        <Text className="text-xl">{getSportEmoji(game.sport)}</Text>
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-white">
                            {game.awayTeam} @ {game.homeTeam}
                          </Text>
                          <View className="flex-row items-center gap-2 mt-0.5">
                            <Text className="text-[11px] text-slate-400 font-medium">
                              {formatTime(game.startTime)}
                            </Text>
                            {game.status !== 'scheduled' && (
                              <View className="bg-slate-800 px-1.5 py-0.5 rounded">
                                <Text className="text-[10px] text-slate-300 capitalize">
                                  {game.status}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Bets */}
                    <View className="px-4 py-4 gap-3">
                      {sortedBets.length === 0 ? (
                        <Text className="text-slate-500 text-[11px] text-center italic">
                          No bets available
                        </Text>
                      ) : (
                        sortedBets.map((bet) => (
                          <BetSelectionGroup
                            key={bet.id}
                            bet={bet}
                            game={game}
                            onSelectionSaved={() => {
                              fetchTodaysBets();
                              fetchMyBets();
                            }}
                          />
                        ))
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
