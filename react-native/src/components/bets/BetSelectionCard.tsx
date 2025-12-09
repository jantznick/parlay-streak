import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

interface BetSelectionCardProps {
  side: string;
  label: string;
  isSelected: boolean;
  disabled: boolean;
  onPress: () => void;
}

export function BetSelectionCard({ side, label, isSelected, disabled, onPress }: BetSelectionCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`flex-1 px-4 py-3.5 rounded-xl border ${
        isSelected
          ? 'border-orange-500 bg-orange-500/20'
          : 'border-slate-700 bg-slate-950'
      } ${disabled ? 'opacity-50' : ''} justify-center items-center shadow-sm`}
    >
      <Text
        className={`text-xs font-bold text-center ${
          isSelected ? 'text-orange-400' : 'text-slate-300'
        }`}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

