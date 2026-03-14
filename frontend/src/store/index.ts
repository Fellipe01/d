import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { subDays, format } from 'date-fns';

interface AppState {
  selectedClientId: number | null;
  setSelectedClientId: (id: number | null) => void;
  dateRange: { start: string; end: string };
  setDateRange: (range: { start: string; end: string }) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedClientId: null,
      setSelectedClientId: (id) => set({ selectedClientId: id }),
      dateRange: {
        start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd'),
      },
      setDateRange: (range) => set({ dateRange: range }),
      sidebarCollapsed: false,
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'dae-app-store',
      partialize: (s) => ({ selectedClientId: s.selectedClientId }),
      // Sanitize persisted state to prevent NaN/invalid IDs
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState>;
        const id = p.selectedClientId;
        return {
          ...current,
          selectedClientId: (typeof id === 'number' && !isNaN(id) && id > 0) ? id : null,
        };
      },
    }
  )
);
