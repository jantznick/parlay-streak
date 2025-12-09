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
    <View className="bg-card rounded-2xl border border-border overflow-hidden mb-4">
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
              isActive ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-secondary border border-border'
            }`}
          >
            <Text className={`text-xl font-bold ${isActive ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {group.peakStreak}
            </Text>
          </View>

          {/* Info */}
          <View>
            <Text className="text-card-foreground font-semibold text-base">
              {isActive ? 'Current Streak' : 'Past Streak'}
            </Text>
            <Text className="text-muted-foreground text-xs">{dateRange}</Text>
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
          className="border-t border-border"
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
                className="flex-row items-center p-3 bg-secondary/30 rounded-xl border border-border/50"
              >
                {/* Left: Points or Image */}
                <View className="w-12 items-center justify-center mr-3 border-r border-border/50 pr-3">
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
                          ? 'text-emerald-400'
                          : event.type === 'insurance_deducted'
                          ? 'text-primary'
                          : 'text-destructive'
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
                    <Text className="text-card-foreground font-bold text-sm">
                      {event.type === 'parlay_win' || event.type === 'bet_win'
                        ? 'Streak Increased'
                        : event.type === 'insurance_deducted'
                        ? 'Insurance Saved'
                        : 'Streak Ended'}
                    </Text>
                    {/* Parlay Badge */}
                    {event.parlay && (
                      <View className="bg-blue-500/20 px-1.5 py-0.5 rounded">
                        <Text className="text-blue-400 text-[10px] font-bold uppercase">{event.parlay.betCount} Leg</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-muted-foreground text-xs font-medium">{formatDate(event.date)}</Text>
                </View>

                {/* Right: Streak */}
                <View className="items-end pl-3">
                   <Text className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider mb-0.5">Streak</Text>
                   <Text className="text-card-foreground font-bold text-lg leading-5">{event.resultingStreak}</Text>
                </View>
              </TouchableOpacity>

              {/* Expanded Card (only for Parlays) */}
              {event.parlay && expandedParlayId === event.id && (
                <View className="mt-2 pl-2 border-l-2 border-border ml-4">
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
          <View className="w-full bg-card rounded-2xl border border-border overflow-hidden">
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              <Text className="text-card-foreground font-bold text-lg">
                Bet Details
              </Text>
              <TouchableOpacity onPress={() => setViewingBet(null)} className="p-2">
                <Ionicons name="close" size={24} color="#94a3b8" />
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
