import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from '../services/api';
import type { Parlay, ParlayContextType } from '../interfaces';

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

