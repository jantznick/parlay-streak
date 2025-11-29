import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

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
      className={`flex-1 px-3 py-3 rounded-xl border-2 ${
        isSelected
          ? 'border-orange-500 bg-orange-500/10'
          : 'border-slate-700 bg-slate-800'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Text
        className={`text-xs font-semibold text-center ${
          isSelected ? 'text-orange-400' : 'text-white'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

