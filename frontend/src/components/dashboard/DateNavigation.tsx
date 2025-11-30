import { useState, ChangeEvent } from 'react';
import type { DateNavigationProps } from '../../interfaces';

// Export the default date formatting function so it can be used elsewhere
export function formatDateDisplay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(date);
  selected.setHours(0, 0, 0, 0);
  
  const diffTime = selected.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === -1) {
    return 'Yesterday';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else {
    // Format: "Mon, Nov 21" or "Mon, Nov 21, 2024" if different year
    const currentYear = today.getFullYear();
    const selectedYear = selected.getFullYear();
    
    if (selectedYear === currentYear) {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
}

export function DateNavigation({ selectedDate, onDateChange, formatDateDisplay: customFormatDateDisplay }: DateNavigationProps) {
  const formatDate = customFormatDateDisplay || formatDateDisplay;
  const [showDatePicker, setShowDatePicker] = useState(false);

  const navigateDate = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate + 'T00:00:00');
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'prev' ? -1 : 1));
    
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    onDateChange(`${year}-${month}-${day}`);
  };

  const goToToday = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    onDateChange(`${year}-${month}-${day}`);
  };

  const handleDatePickerChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onDateChange(e.target.value);
      setShowDatePicker(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigateDate('prev')}
        className="px-2 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition text-sm"
        title="Previous day"
      >
        ←
      </button>
      <div className="relative">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="px-3 py-1 bg-slate-800 text-slate-200 rounded text-sm font-medium min-w-[140px] text-center hover:bg-slate-700 transition cursor-pointer"
          title="Click to pick a date"
        >
          {formatDate(selectedDate)}
        </button>
        {showDatePicker && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2">
            <input
              type="date"
              value={selectedDate}
              onChange={handleDatePickerChange}
              className="px-3 py-2 bg-slate-900 text-white rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-600"
              onBlur={() => setTimeout(() => setShowDatePicker(false), 200)}
              autoFocus
            />
          </div>
        )}
      </div>
      <button
        onClick={() => navigateDate('next')}
        className="px-2 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition text-sm"
        title="Next day"
      >
        →
      </button>
      <button
        onClick={goToToday}
        className="px-3 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition text-sm font-medium"
        title="Go to today"
      >
        Today
      </button>
    </div>
  );
}

