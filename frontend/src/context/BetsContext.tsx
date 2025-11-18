import { createContext, useContext, useState, ReactNode } from 'react';

interface BetsContextType {
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const BetsContext = createContext<BetsContextType | undefined>(undefined);

export function BetsProvider({ children }: { children: ReactNode }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <BetsContext.Provider
      value={{
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </BetsContext.Provider>
  );
}

export function useBets() {
  const context = useContext(BetsContext);
  if (context === undefined) {
    throw new Error('useBets must be used within a BetsProvider');
  }
  return context;
}

