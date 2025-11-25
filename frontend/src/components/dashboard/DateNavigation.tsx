import { useState, ChangeEvent } from 'react';

interface DateNavigationProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  formatDateDisplay: (date: string) => string;
}

export function DateNavigation({ selectedDate, onDateChange, formatDateDisplay }: DateNavigationProps) {
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
          {formatDateDisplay(selectedDate)}
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

