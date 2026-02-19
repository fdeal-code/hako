import React, { createContext, useContext, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

interface HomeExpandContextValue {
  /** 0 = home, 1 = dashboard */
  expandProgress: SharedValue<number>;
  /**
   * Ref vers la fonction qui déclenche l'animation de fermeture.
   * HomeScreen le remplit ; TabBar (et ExpandedDashboard) l'appellent.
   */
  triggerCollapse: React.MutableRefObject<() => void>;
}

const HomeExpandContext = createContext<HomeExpandContextValue | null>(null);

export function HomeExpandProvider({ children }: { children: React.ReactNode }) {
  const expandProgress  = useSharedValue(0);
  const triggerCollapse = useRef<() => void>(() => {});

  return (
    <HomeExpandContext.Provider value={{ expandProgress, triggerCollapse }}>
      {children}
    </HomeExpandContext.Provider>
  );
}

export function useHomeExpand(): HomeExpandContextValue {
  const ctx = useContext(HomeExpandContext);
  if (!ctx) throw new Error('useHomeExpand doit être utilisé dans HomeExpandProvider');
  return ctx;
}
