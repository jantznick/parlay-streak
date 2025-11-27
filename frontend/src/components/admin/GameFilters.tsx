import React from 'react';
import { DateNavigation } from '../dashboard/DateNavigation';
import { formatDate } from '../../utils/formatting';

interface SportConfig {
  sport: string;
  leagues: Array<{ id: string; name: string }>;
}

interface GameFiltersProps {
  selectedDate: string;
  sportsConfig: SportConfig[];
  selectedSport: string;
  selectedLeague: string;
  onDateChange: (date: string) => void;
  onSportChange: (sport: string) => void;
  onLeagueChange: (league: string) => void;
  onFetchGames: (force: boolean) => void;
  loading: boolean;
  gamesCount: number;
}

export function GameFilters({
  selectedDate,
  sportsConfig,
  selectedSport,
  selectedLeague,
  onDateChange,
  onSportChange,
  onLeagueChange,
  onFetchGames,
  loading,
  gamesCount
}: GameFiltersProps) {
  const selectedLeagueName = sportsConfig
    .find(s => s.sport === selectedSport)
    ?.leagues.find(l => l.id === selectedLeague)?.name || selectedLeague;

  return (
    <div className="bg-slate-900 rounded-lg p-4 sm:p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex flex-col justify-end">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Select Date
          </label>
          <DateNavigation
            selectedDate={selectedDate}
            onDateChange={onDateChange}
          />
        </div>

        <div>
          <label htmlFor="sport" className="block text-sm font-medium text-slate-300 mb-2">
            Sport
          </label>
          <select
            id="sport"
            value={selectedSport}
            onChange={(e) => onSportChange(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sportsConfig.map((sport) => (
              <option key={sport.sport} value={sport.sport}>
                {sport.sport.charAt(0).toUpperCase() + sport.sport.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="league" className="block text-sm font-medium text-slate-300 mb-2">
            League
          </label>
          <select
            id="league"
            value={selectedLeague}
            onChange={(e) => onLeagueChange(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!selectedSport}
          >
            {sportsConfig
              .find((s) => s.sport === selectedSport)
              ?.leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <button
            onClick={() => onFetchGames(false)}
            disabled={loading || !selectedSport || !selectedLeague}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition font-medium h-[42px]"
          >
            {loading ? 'Fetching...' : 'Fetch Games'}
          </button>
          <button
            onClick={() => onFetchGames(true)}
            disabled={loading || !selectedSport || !selectedLeague}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition font-medium h-[42px] sm:flex-shrink-0"
            title="Force refresh from ESPN API (bypasses database cache)"
          >
            <span className="hidden sm:inline">Force Refresh</span>
            <span className="sm:hidden">Refresh</span>
          </button>
        </div>
      </div>

      <div className="mt-4 text-xs sm:text-sm text-slate-400">
        <span className="block sm:inline">Viewing games for <span className="text-white font-medium">{formatDate(selectedDate)}</span></span>
        {selectedSport && selectedLeague && (
          <span className="block sm:inline sm:ml-2">
            <span className="hidden sm:inline">• </span>{selectedLeagueName}
          </span>
        )}
        {gamesCount > 0 && (
          <span className="block sm:inline sm:ml-2">
            <span className="hidden sm:inline">• </span>{gamesCount} game{gamesCount !== 1 ? 's' : ''} loaded
          </span>
        )}
      </div>
    </div>
  );
}

