import { create } from 'zustand';
import { getBadges } from '@/lib/api';

export type BadgeKey = 'payments' | 'inquiries';

interface BadgesState {
  counts: Partial<Record<BadgeKey, number>>;
  /** Refetches the counts; called on load, socket events and after marking things read. */
  refresh: () => void;
}

let inFlight = false;

export const useBadgesStore = create<BadgesState>((set) => ({
  counts: {},
  refresh: () => {
    if (inFlight) return;
    inFlight = true;
    getBadges()
      .then((r) => set({ counts: r.data.data || {} }))
      .catch(() => {})
      .finally(() => { inFlight = false; });
  },
}));
