import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from '../services/api';

interface ParlaySelection {
  id: string;
  bet: {
    id: string;
    displayText: string;
    betType: string;
    config?: any;
  };
  selectedSide: string;
  game: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
  };
}

interface Parlay {
  id: string;
  betCount: number;
  parlayValue: number;
  insured: boolean;
  insuranceCost: number;
  status: string;
  lockedAt?: string;
  selections: ParlaySelection[];
  createdAt: string;
}

interface ParlayContextType {
  activeParlay: Parlay | null;
  setActiveParlay: (parlay: Parlay | null) => void;
  refreshActiveParlay: () => Promise<void>;
  isParlayBuilderOpen: boolean;
  setIsParlayBuilderOpen: (open: boolean) => void;
}

const ParlayContext = createContext<ParlayContextType | undefined>(undefined);

export function ParlayProvider({ children }: { children: ReactNode }) {
  const [activeParlay, setActiveParlay] = useState<Parlay | null>(null);
  const [isParlayBuilderOpen, setIsParlayBuilderOpen] = useState(false);

  const refreshActiveParlay = async () => {
    if (!activeParlay) return;
    
    try {
      const response = await api.getParlay(activeParlay.id);
      if (response.success && response.data?.parlay) {
        setActiveParlay(response.data.parlay);
      }
    } catch (error) {
      console.error('Error refreshing parlay:', error);
    }
  };

  return (
    <ParlayContext.Provider
      value={{
        activeParlay,
        setActiveParlay,
        refreshActiveParlay,
        isParlayBuilderOpen,
        setIsParlayBuilderOpen,
      }}
    >
      {children}
    </ParlayContext.Provider>
  );
}

export function useParlay() {
  const context = useContext(ParlayContext);
  if (context === undefined) {
    throw new Error('useParlay must be used within a ParlayProvider');
  }
  return context;
}

