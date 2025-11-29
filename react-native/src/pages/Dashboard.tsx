import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { BetSelectionGroup } from '../components/bets/BetSelectionGroup';
import { streakMessages } from '../utils/streakMessages';

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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mySelections, setMySelections] = useState<BetSelection[]>([]);
  const [loadingMyBets, setLoadingMyBets] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [streakTitle, setStreakTitle] = useState<string>('');
  const [streakSubtitle, setStreakSubtitle] = useState<string>('');

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

  const handleDeleteBet = (selectionId: string) => {
    Alert.alert(
      'Delete Bet',
      'Are you sure you want to remove this bet?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(selectionId);
            try {
              const response = await api.deleteSelection(selectionId);
              if (response.success) {
                await fetchMyBets();
              } else {
                Alert.alert('Error', response.error?.message || 'Failed to delete bet');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete bet');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
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
  }, [selectedDate]);

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
    <SafeAreaView className="flex-1 bg-slate-900">
      {/* Top header */}
      <View className="px-6 pt-4 pb-5 bg-slate-950">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="h-9 w-9 rounded-full bg-slate-800 items-center justify-center mr-3">
              <Text className="text-sm font-semibold text-white">
                {(user?.username || 'P').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-slate-400">Welcome back</Text>
              <Text className="text-2xl font-semibold text-white mt-1">
                {user?.username || 'Player'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings' as never)}
            className="h-9 w-9 rounded-full bg-slate-800 items-center justify-center"
          >
            <Ionicons name="settings-outline" size={18} color="#e5e7eb" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Hero section with streak and banner (dark sheet) */}
        <View className="px-6 pt-2 pb-6 bg-slate-900">
          {user && (
            <View>
              {/* Primary streak card */}
              <View className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl px-5 py-5 mb-4">
                <Text className="text-xs text-orange-100/90 mb-2">
                  Today&apos;s streak
                </Text>
                <View className="flex-row items-end justify-between">
                  <View>
                    <Text className="text-5xl font-extrabold text-white">
                      {user.currentStreak}
                    </Text>
                    <Text className="text-sm text-orange-100 mt-1">
                      active streak
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[11px] text-orange-100/90">
                      Best streak
                    </Text>
                    <Text className="text-lg font-semibold text-white">
                      {user.longestStreak}
                    </Text>
                    <Text className="text-[11px] text-orange-100/90 mt-2">
                      Total points
                    </Text>
                    <Text className="text-lg font-semibold text-white">
                      {user.totalPointsEarned}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Status banner */}
              {streakTitle && streakSubtitle && (
                <View className="bg-slate-800 rounded-2xl border border-slate-700 px-4 py-3 mb-4">
                  <Text className="text-slate-100 text-sm font-medium">
                    {streakTitle}
                  </Text>
                  <Text className="text-slate-400 text-xs mt-1">
                    {streakSubtitle}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Date picker row */}
          <View className="flex-row items-center justify-between mt-2">
            <TouchableOpacity
              onPress={() => shiftDate(-1)}
              className="h-8 w-8 rounded-full bg-slate-900 items-center justify-center"
            >
              <Text className="text-slate-300 text-lg">{'‹'}</Text>
            </TouchableOpacity>
            <Text className="text-slate-100 text-sm font-medium">
              {formatDate(selectedDate)}
            </Text>
            <TouchableOpacity
              onPress={() => shiftDate(1)}
              className="h-8 w-8 rounded-full bg-slate-900 items-center justify-center"
            >
              <Text className="text-slate-300 text-lg">{'›'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Bets section */}
        <View className="flex-1 bg-slate-900">
          <View className="mt-4 rounded-t-3xl bg-slate-900 px-6 pt-5 pb-6 border-t border-slate-800">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-semibold text-white">
                My Bets
              </Text>
              <TouchableOpacity onPress={fetchMyBets} disabled={loadingMyBets}>
                <Ionicons
                  name="refresh"
                  size={18}
                  color={loadingMyBets ? '#6b7280' : '#e5e7eb'}
                />
              </TouchableOpacity>
            </View>

            {loadingMyBets ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#e5e7eb" />
                <Text className="text-slate-400 text-xs mt-2">Loading your bets...</Text>
              </View>
            ) : mySelections.length === 0 ? (
              <View className="py-6 items-center">
                <Text className="text-2xl mb-2">📝</Text>
                <Text className="text-slate-300 text-sm mb-1">
                  No bets selected yet
                </Text>
                <Text className="text-slate-500 text-xs text-center">
                  Select bets from the available bets below
                </Text>
              </View>
            ) : (
              <View className="space-y-2">
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
                      className="bg-slate-800 rounded-2xl border border-slate-700 px-4 py-3"
                    >
                      <View className="flex-row items-center gap-2 mb-2">
                        <Text className="text-lg">{getSportEmoji(game.sport)}</Text>
                        <Text className="text-[11px] text-slate-400">
                          {formatTime(game.startTime)}
                        </Text>
                        <View className="flex-1" />
                        {selection.status === 'locked' && (
                          <Text className="text-xs text-yellow-400">🔒</Text>
                        )}
                        {selection.outcome && selection.outcome !== 'pending' && (
                          <View
                            className={`px-2 py-0.5 rounded ${
                              selection.outcome === 'win'
                                ? 'bg-emerald-900/50'
                                : selection.outcome === 'loss'
                                ? 'bg-red-900/50'
                                : 'bg-yellow-900/50'
                            }`}
                          >
                            <Text
                              className={`text-[10px] font-medium ${
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
                        {canModify && (
                          <TouchableOpacity
                            onPress={() => handleDeleteBet(selection.id)}
                            disabled={deletingId === selection.id}
                            className={`ml-2 px-2 py-1 rounded ${
                              deletingId === selection.id
                                ? 'bg-slate-700 opacity-50'
                                : 'bg-red-900/30 border border-red-800/50'
                            }`}
                          >
                            {deletingId === selection.id ? (
                              <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                              <Ionicons name="trash-outline" size={16} color="#ef4444" />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text className="text-sm text-white font-medium mb-1">
                        {game.awayTeam} @ {game.homeTeam}
                      </Text>
                      <Text className="text-xs text-slate-300">
                        {selectedLabel}
                      </Text>
                      {game.status === 'completed' &&
                        game.homeScore !== null &&
                        game.awayScore !== null && (
                          <Text className="text-[11px] text-slate-400 mt-1">
                            Final: {game.awayScore} - {game.homeScore}
                          </Text>
                        )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Available Bets list */}
        <View className="flex-1 bg-slate-900">
          <View className="mt-4 rounded-t-3xl bg-slate-900 px-6 pt-5 pb-6 border-t border-slate-800">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-semibold text-white">
                {formatDate(selectedDate)}&apos;s Available Bets
              </Text>
              <TouchableOpacity onPress={fetchTodaysBets} disabled={loading}>
                <Ionicons
                  name="refresh"
                  size={18}
                  color={loading ? '#6b7280' : '#e5e7eb'}
                />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="large" color="#e5e7eb" />
                <Text className="text-slate-400 text-xs mt-3">Loading bets...</Text>
              </View>
            ) : error ? (
              <View className="bg-red-900/40 border border-red-500/70 rounded-xl px-4 py-3 mb-4">
                <Text className="text-red-200 text-xs text-center">{error}</Text>
                <TouchableOpacity
                  onPress={fetchTodaysBets}
                  className="mt-2 px-3 py-2 bg-red-600 rounded-lg"
                >
                  <Text className="text-white text-xs text-center">Retry</Text>
                </TouchableOpacity>
              </View>
            ) : games.length === 0 ? (
              <View className="py-8 items-center">
                <Text className="text-3xl mb-2">📅</Text>
                <Text className="text-slate-300 text-sm mb-1">
                  No games with bets available
                </Text>
                <Text className="text-slate-500 text-xs text-center">
                  Check back later or browse upcoming games
                </Text>
              </View>
            ) : (
              <View className="space-y-4">
                {games.map((game) => {
                  const sortedBets = [...game.bets].sort((a, b) => a.priority - b.priority);
                  
                  return (
                    <View
                      key={game.id}
                      className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"
                    >
                      {/* Game Header */}
                      <View className="px-4 py-3 border-b border-slate-700">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Text className="text-lg">{getSportEmoji(game.sport)}</Text>
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-white">
                              {game.awayTeam} @ {game.homeTeam}
                            </Text>
                            <View className="flex-row items-center gap-2 mt-1">
                              <Text className="text-[11px] text-slate-400">
                                {formatTime(game.startTime)}
                              </Text>
                              {game.status !== 'scheduled' && (
                                <Text className="text-[11px] text-slate-500">
                                  • {game.status}
                                </Text>
                              )}
                              {game.homeScore !== null && game.awayScore !== null && (
                                <Text className="text-[11px] text-slate-300">
                                  • {game.awayScore} - {game.homeScore}
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Bets */}
                      <View className="px-4 py-3">
                        {sortedBets.length === 0 ? (
                          <Text className="text-slate-500 text-[11px] text-center">
                            No bets available for this game
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
