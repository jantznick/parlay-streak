import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';

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
  externalId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  metadata?: any;
  bets: Bet[];
}

interface SportConfig {
  sport: string;
  leagues: Array<{ id: string; name: string }>;
}

// Helper to get local date string in YYYY-MM-DD format
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function AdminHome() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString(new Date()));
  const [sportsConfig, setSportsConfig] = useState<SportConfig[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('basketball');
  const [selectedLeague, setSelectedLeague] = useState<string>('nba');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());
  const [resolvingBet, setResolvingBet] = useState<string | null>(null);
  const [creatingMoneyline, setCreatingMoneyline] = useState<string | null>(null);

  if (!user || !user.isAdmin) {
    // Simple guard for now; in future we can show a nicer unauthorized screen
    return (
      <SafeAreaView className={`flex-1 items-center justify-center px-6 ${isDark ? 'bg-[#050816]' : 'bg-white'}`}>
        <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Admin tools are only available to admin users.
        </Text>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    const loadSports = async () => {
      try {
        const response: any = await api.getSupportedSports();
        if (response.success && response.data && 'sports' in response.data) {
          const sports = (response.data as { sports: SportConfig[] }).sports;
          setSportsConfig(sports);
          if (sports.length > 0 && sports[0].leagues.length > 0) {
            setSelectedSport(sports[0].sport);
            setSelectedLeague(sports[0].leagues[0].id);
          }
        }
      } catch (e) {
        console.warn('Failed to load sports config', e);
      }
    };
    loadSports();
  }, []);

  useEffect(() => {
    const sport = sportsConfig.find((s) => s.sport === selectedSport);
    if (sport && sport.leagues.length > 0) {
      const exists = sport.leagues.some((l) => l.id === selectedLeague);
      if (!exists) {
        setSelectedLeague(sport.leagues[0].id);
      }
    }
  }, [sportsConfig, selectedSport, selectedLeague]);

  const shiftDate = (days: number) => {
    // Parse the YYYY-MM-DD string as local date (not UTC)
    const [year, month, day] = selectedDate.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    current.setDate(current.getDate() + days);
    setSelectedDate(getLocalDateString(current));
  };

  const fetchGames = useCallback(
    async (force: boolean = false) => {
      if (!selectedSport || !selectedLeague) {
        setError('Select a sport and league first');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Match frontend: getTimezoneOffset returns hours, positive ahead of UTC
        const timezoneOffset = -new Date().getTimezoneOffset() / 60;
        const response: any = await api.fetchGamesFromApi(
          selectedDate,
          selectedSport,
          selectedLeague,
          force,
          timezoneOffset
        );

        if (response.success && response.data && 'games' in response.data) {
          const gamesList = (response.data as { games: Game[] }).games;
          const sorted = [...gamesList].sort(
            (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          );
          setGames(sorted);
        } else {
          setGames([]);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to fetch games');
      } finally {
        setLoading(false);
      }
    },
    [selectedDate, selectedSport, selectedLeague]
  );

  useEffect(() => {
    if (sportsConfig.length > 0 && selectedSport && selectedLeague) {
      fetchGames(false);
    }
  }, [selectedDate, selectedSport, selectedLeague, sportsConfig.length, fetchGames]);

  const toggleGameExpanded = (gameId: string) => {
    setExpandedGames((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const formatDateLabel = (dateStr: string) => {
    // Parse YYYY-MM-DD as local date to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleResolveBet = async (betId: string) => {
    if (resolvingBet) return;
    setResolvingBet(betId);
    try {
      const response: any = await api.resolveBet(betId);
      if (!response.success) {
        Alert.alert('Error', response.error?.message || 'Failed to resolve bet');
      } else {
        await fetchGames(false);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to resolve bet');
    } finally {
      setResolvingBet(null);
    }
  };

  const handleDeleteBet = async (betId: string) => {
    Alert.alert('Delete bet', 'Are you sure you want to delete this bet?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response: any = await api.deleteBet(betId);
            if (!response.success) {
              Alert.alert('Error', response.error?.message || 'Failed to delete bet');
            } else {
              await fetchGames(false);
            }
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete bet');
          }
        },
      },
    ]);
  };

  const handleQuickMoneyline = async (game: Game) => {
    if (creatingMoneyline) return;
    setCreatingMoneyline(game.id);
    try {
      const metadata: any = game.metadata;
      const apiData = metadata?.apiData;
      const homeTeamId = apiData?.teams?.home?.id;
      const awayTeamId = apiData?.teams?.away?.id;
      if (!homeTeamId || !awayTeamId) {
        Alert.alert('Error', 'Game missing team IDs, refresh game data on web.');
        return;
      }
      const config = {
        type: 'COMPARISON' as const,
        participant_1: {
          subject_type: 'TEAM' as const,
          subject_id: homeTeamId,
          subject_name: game.homeTeam,
          metric: 'points',
          time_period: 'FULL_GAME' as const,
        },
        participant_2: {
          subject_type: 'TEAM' as const,
          subject_id: awayTeamId,
          subject_name: game.awayTeam,
          metric: 'points',
          time_period: 'FULL_GAME' as const,
        },
        operator: 'GREATER_THAN' as const,
      };
      const response: any = await api.createBet(game.id, 'COMPARISON', config);
      if (!response.success) {
        Alert.alert('Error', response.error?.message || 'Failed to create moneyline bet');
      } else {
        await fetchGames(false);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create moneyline bet');
    } finally {
      setCreatingMoneyline(null);
    }
  };

  const handleOpenCreateBets = (game: Game) => {
    // Navigate to a dedicated bet builder screen, passing the full game object
    (navigation as any).navigate('AdminBetBuilder', { game });
  };

  // Whenever this screen regains focus (e.g. after creating a bet),
  // refresh the games so the latest bets are visible.
  useFocusEffect(
    useCallback(() => {
      fetchGames(false);
    }, [fetchGames])
  );

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-light-bg'}`}>
      <View className={`flex-row items-center justify-between px-5 py-3 border-b ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-300 bg-light-bg-alt'}`}>
        <TouchableOpacity onPress={() => navigation.goBack()} className="pr-4 py-1">
          <Text className={`text-base ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>‹ Back</Text>
        </TouchableOpacity>
        <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Admin</Text>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}>
        {/* Filters */}
        <View className={`rounded-3xl border px-4 py-4 mb-5 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-lg shadow-slate-900/10'} dark:shadow-none`}>
          <Text className={`text-xs font-medium mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Filters</Text>
          <View className="flex-row items-center justify-between mb-3">
            <TouchableOpacity
              onPress={() => shiftDate(-1)}
              className={`h-8 w-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}
            >
              <Text className={`text-lg ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{'‹'}</Text>
            </TouchableOpacity>
            <Text className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {formatDateLabel(selectedDate)}
            </Text>
            <TouchableOpacity
              onPress={() => shiftDate(1)}
              className={`h-8 w-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}
            >
              <Text className={`text-lg ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{'›'}</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-between">
            <View className="flex-1 mr-2">
              <Text className={`text-[11px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>Sport</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {sportsConfig.map((sport) => (
                  <TouchableOpacity
                    key={sport.sport}
                    onPress={() => setSelectedSport(sport.sport)}
                    className={`px-3 py-1 rounded-full mr-2 border ${
                      selectedSport === sport.sport
                        ? (isDark ? 'bg-slate-100 border-slate-100' : 'bg-orange-600 border-orange-600')
                        : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300')
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        selectedSport === sport.sport 
                          ? (isDark ? 'text-slate-900' : 'text-white')
                          : (isDark ? 'text-slate-200' : 'text-slate-700')
                      }`}
                    >
                      {sport.sport}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {selectedSport && (
            <View className="mt-3">
              <Text className={`text-[11px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>League</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {sportsConfig
                  .find((s) => s.sport === selectedSport)
                  ?.leagues.map((league) => (
                    <TouchableOpacity
                      key={league.id}
                      onPress={() => setSelectedLeague(league.id)}
                      className={`px-3 py-1 rounded-full mr-2 border ${
                        selectedLeague === league.id
                          ? (isDark ? 'bg-slate-100 border-slate-100' : 'bg-orange-600 border-orange-600')
                          : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300')
                      }`}
                    >
                      <Text
                        className={`text-xs ${
                          selectedLeague === league.id 
                            ? (isDark ? 'text-slate-900' : 'text-white')
                            : (isDark ? 'text-slate-200' : 'text-slate-700')
                        }`}
                      >
                        {league.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          )}

          <View className="flex-row items-center justify-between mt-4">
            <TouchableOpacity
              onPress={() => fetchGames(false)}
              disabled={loading}
              className={`flex-1 mr-2 rounded-full px-4 py-2 items-center justify-center ${
                loading ? (isDark ? 'bg-slate-700' : 'bg-slate-300') : 'bg-blue-600'
              }`}
            >
              <Text className="text-white text-xs font-semibold">
                {loading ? 'Fetching…' : 'Fetch games'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => fetchGames(true)}
              disabled={loading}
              className={`rounded-full px-4 py-2 items-center justify-center ${
                loading ? (isDark ? 'bg-slate-700' : 'bg-slate-300') : 'bg-orange-500'
              }`}
            >
              <Text className="text-white text-xs font-semibold">Force refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View className="bg-red-900/30 border border-red-700 rounded-2xl px-4 py-3 mb-4">
            <Text className="text-red-200 text-xs">{error}</Text>
          </View>
        )}

        {/* Games + bets list */}
        <View className="mb-6">
              <Text className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>
            Games ({games.length})
          </Text>

          {loading && games.length === 0 ? (
            <View className={`rounded-2xl px-4 py-6 items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-white border border-slate-200 shadow-lg shadow-slate-900/10'} dark:shadow-none`}>
              <ActivityIndicator color={isDark ? "#e5e7eb" : "#64748b"} />
              <Text className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>Loading games…</Text>
            </View>
          ) : games.length === 0 ? (
            <View className={`rounded-2xl px-4 py-6 items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-white border border-slate-200 shadow-lg shadow-slate-900/10'} dark:shadow-none`}>
              <Text className={`text-sm mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>No games loaded</Text>
              <Text className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-slate-800'}`}>
                Use the filters above and tap &quot;Fetch games&quot; to load games.
              </Text>
            </View>
          ) : (
            <View className="space-y-8">
              {games.map((game) => {
                const isExpanded = expandedGames.has(game.id);
                return (
                  <View
                    key={game.id}
                    className={`rounded-3xl border px-4 py-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-lg shadow-slate-900/10'} dark:shadow-none`}
                  >
                    <TouchableOpacity
                      onPress={() => toggleGameExpanded(game.id)}
                      className="flex-row items-center justify-between"
                    >
                      <View className="flex-1 mr-3">
                        <Text className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>
                          {game.awayTeam} @ {game.homeTeam}
                        </Text>
                        <Text className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>
                          {new Date(game.startTime).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                          {' • '}
                          {new Date(game.startTime).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                        <Text className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-800'}`}>
                          {game.bets.length} bet{game.bets.length === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <View className="items-end">
                        <TouchableOpacity
                          onPress={() => handleQuickMoneyline(game)}
                          disabled={creatingMoneyline === game.id}
                          className="px-3 py-1 rounded-full bg-emerald-600 mb-2"
                        >
                          <Text className="text-white text-[11px] font-semibold">
                            {creatingMoneyline === game.id ? 'Creating…' : 'Quick ML'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleOpenCreateBets(game)}
                          className="px-3 py-1 rounded-full bg-blue-600"
                        >
                          <Text className="text-white text-[11px] font-semibold">More bets</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View className={`mt-3 border-t pt-3 space-y-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        {game.bets.length === 0 ? (
                          <Text className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                            No bets yet. Use Quick ML above or the web admin to create more.
                          </Text>
                        ) : (
                          game.bets
                            .slice()
                            .sort((a, b) => a.priority - b.priority)
                            .map((bet) => (
                              <View
                                key={bet.id}
                                className={`rounded-2xl px-3 py-2 flex-row items-center justify-between ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                              >
                                <View className="flex-1 mr-2">
                                  <Text
                                    className={`text-xs font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
                                    numberOfLines={2}
                                  >
                                    {bet.displayTextOverride || bet.displayText}
                                  </Text>
                                  <Text className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                                    Priority #{bet.priority} • {bet.betType}
                                  </Text>
                                </View>
                                <View className="items-end">
                                  <Text
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                      bet.outcome === 'win'
                                        ? 'bg-emerald-900/60 text-emerald-300'
                                        : bet.outcome === 'loss'
                                        ? 'bg-red-900/60 text-red-300'
                                        : bet.outcome === 'push'
                                        ? 'bg-yellow-900/60 text-yellow-300'
                                        : bet.outcome === 'void'
                                        ? 'bg-slate-700 text-slate-300'
                                        : 'bg-slate-700 text-slate-300'
                                    }`}
                                  >
                                    {(bet.outcome || 'pending').toUpperCase()}
                                  </Text>
                                  <View className="flex-row mt-2">
                                    <TouchableOpacity
                                      onPress={() => handleResolveBet(bet.id)}
                                      disabled={resolvingBet === bet.id}
                                      className="px-2 py-1 rounded-full bg-emerald-600 mr-2"
                                    >
                                      <Text className="text-white text-[10px] font-semibold">
                                        {resolvingBet === bet.id ? 'Resolving…' : 'Resolve'}
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => handleDeleteBet(bet.id)}
                                      className="px-2 py-1 rounded-full bg-red-600/80"
                                    >
                                      <Text className="text-white text-[10px] font-semibold">
                                        Delete
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            ))
                        )}
                      </View>
                    )}
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


