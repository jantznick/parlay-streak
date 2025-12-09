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
          ? 'border-primary bg-primary/20'
          : 'border-border bg-card'
      } ${disabled ? 'opacity-50' : ''} justify-center items-center shadow-sm`}
    >
      <Text
        className={`text-xs font-bold text-center ${
          isSelected ? 'text-primary' : 'text-muted-foreground'
        }`}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

