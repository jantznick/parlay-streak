import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StreakGroup, StreakEvent } from '../../interfaces/streak';
import { BetSelection } from '../../interfaces/bet';
import { ParlayCard } from '../bets/ParlayCard';
import { SingleBetCard } from '../bets/SingleBetCard';

interface StreakHistoryCardProps {
  group: StreakGroup;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function StreakHistoryCard({ group }: StreakHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewingBet, setViewingBet] = useState<BetSelection | null>(null);
  const [expandedParlayId, setExpandedParlayId] = useState<string | null>(null);

  const isActive = group.status === 'active';
  const dateRange = isActive
    ? `${formatDate(group.startDate)} - Present`
    : `${formatDate(group.startDate)} - ${group.endDate ? formatDate(group.endDate) : '?'}`;

  return (
    <View className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-4 shadow-lg shadow-slate-900/10 dark:shadow-none">
      {/* Header - Always Visible */}
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
        className="flex-row items-center justify-between p-4"
      >
        <View className="flex-row items-center gap-4">
          {/* Streak Badge */}
          <View
            className={`h-12 w-12 rounded-xl items-center justify-center ${
              isActive ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700'
            }`}
          >
            <Text className={`text-xl font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {group.peakStreak}
            </Text>
          </View>

          {/* Info */}
          <View>
            <Text className="text-slate-900 dark:text-white font-semibold text-base">
              {isActive ? 'Current Streak' : 'Past Streak'}
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 text-xs">{dateRange}</Text>
          </View>
        </View>

        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#64748b"
        />
      </TouchableOpacity>

      {/* Expanded Timeline */}
      {isExpanded && (
        <ScrollView 
          nestedScrollEnabled={true}
          style={{ maxHeight: 400 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 }}
          className="border-t border-slate-200 dark:border-slate-800"
        >
          {group.events.map((event, index) => (
            <View key={event.id} className="pb-3">
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => {
                  if (event.parlay) {
                    setExpandedParlayId(expandedParlayId === event.id ? null : event.id);
                  } else if (event.betSelection) {
                    setViewingBet(event.betSelection);
                  }
                }}
                className="flex-row items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none"
              >
                {/* Left: Points or Image */}
                <View className="w-12 items-center justify-center mr-3 border-r border-slate-200 dark:border-slate-700/50 pr-3">
                  {(event.type === 'parlay_loss' || event.type === 'bet_loss') ? (
                    <Image 
                      source={require('../../../assets/images/reset.png')} 
                      style={{ width: 32, height: 32, borderRadius: 4 }} 
                      resizeMode="cover"
                    />
                  ) : (
                    <Text
                      className={`font-bold text-xl ${
                        event.pointsChange > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : event.type === 'insurance_deducted'
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {event.pointsChange > 0 ? '+' : ''}
                      {event.pointsChange}
                    </Text>
                  )}
                </View>

                {/* Middle: Info */}
                <View className="flex-1 justify-center">
                  <View className="flex-row items-center gap-2 mb-0.5">
                    <Text className="text-slate-700 dark:text-slate-300 font-bold text-sm">
                      {event.type === 'parlay_win' || event.type === 'bet_win'
                        ? 'Streak Increased'
                        : event.type === 'insurance_deducted'
                        ? 'Insurance Saved'
                        : 'Streak Ended'}
                    </Text>
                    {/* Parlay Badge */}
                    {event.parlay && (
                      <View className="bg-blue-500/20 px-1.5 py-0.5 rounded">
                        <Text className="text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase">{event.parlay.betCount} Leg</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-slate-500 dark:text-slate-500 text-xs font-medium">{formatDate(event.date)}</Text>
                </View>

                {/* Right: Streak */}
                <View className="items-end pl-3">
                   <Text className="text-slate-500 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Streak</Text>
                   <Text className="text-slate-900 dark:text-white font-bold text-lg leading-5">{event.resultingStreak}</Text>
                </View>
              </TouchableOpacity>

              {/* Expanded Card (only for Parlays) */}
              {event.parlay && expandedParlayId === event.id && (
                <View className="mt-2 pl-2 border-l-2 border-slate-300 dark:border-slate-700 ml-4">
                  <ParlayCard
                    parlay={event.parlay}
                    onOpen={() => {}}
                    onDelete={() => {}}
                    deletingId={null}
                    hideLockIcon={true}
                    initiallyExpanded={true}
                    collapsible={false}
                    onSelectionPress={(selection) => setViewingBet({
                      ...selection,
                      betId: selection.bet.id,
                      bet: { ...selection.bet, priority: 0 }
                    })}
                  />
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Bet Detail Modal */}
      <Modal
        visible={!!viewingBet}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingBet(null)}
      >
        <View className="flex-1 bg-black/80 justify-center items-center p-6">
          <View className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl shadow-slate-900/20 dark:shadow-none">
            <View className="flex-row items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <Text className="text-slate-900 dark:text-white font-bold text-lg">
                Bet Details
              </Text>
              <TouchableOpacity onPress={() => setViewingBet(null)} className="p-2">
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <View className="p-4">
              {viewingBet && (
                <SingleBetCard
                  selection={viewingBet}
                  onDelete={() => {}}
                  onMakeParlay={() => {}}
                  deletingId={null}
                  initiallyExpanded={true}
                  collapsible={false}
                  hideLockIcon={true}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
