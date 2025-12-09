import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

interface BetSelectionCardProps {
  side: string;
  label: string;
  isSelected: boolean;
  disabled: boolean;
  onPress: () => void;
  isSimple?: boolean; // For OVER/UNDER/YES/NO bets without descriptive labels
  hasContext?: boolean; // Whether there's a context label above (true = has title, false = titleless)
}

export function BetSelectionCard({ side, label, isSelected, disabled, onPress, isSimple = false, hasContext = false }: BetSelectionCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`flex-1 px-4 py-3 rounded-xl border ${
        isSelected
          ? 'border-orange-500 bg-orange-500/10'
          : 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950'
      } ${disabled ? 'opacity-50' : ''} justify-center items-center shadow-sm dark:shadow-none`}
    >
      <Text
        className={`${isSimple ? 'text-lg' : 'text-base'} font-bold text-center ${
          isSelected 
            ? 'text-orange-600 dark:text-orange-400' 
            : 'text-slate-700 dark:text-slate-200'
        }`}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

