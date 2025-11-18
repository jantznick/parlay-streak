interface BetSelectionCardProps {
  side: string; // 'participant_1', 'participant_2', 'over', 'under', 'yes', 'no'
  label: string; // Display label for this side
  isSelected: boolean;
  disabled: boolean;
  onClick: () => void;
}

export function BetSelectionCard({ side, label, isSelected, disabled, onClick }: BetSelectionCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full px-4 py-3 rounded-lg border-2 transition-all
        ${isSelected
          ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20'
          : 'border-slate-700 bg-slate-800 hover:border-slate-600 hover:bg-slate-750'
        }
        ${disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer'
        }
      `}
    >
      <div className="text-center">
        <div className={`text-sm font-semibold ${isSelected ? 'text-orange-400' : 'text-white'}`}>
          {label}
        </div>
      </div>
    </button>
  );
}

