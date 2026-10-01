import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminProfile } from '@/types';

// Sessions saved before RBAC lack the newer fields until the layout refreshes the profile.
type Admin = Pick<AdminProfile, '_id' | 'name'> & Partial<Omit<AdminProfile, '_id' | 'name'>>;

interface AuthState {
  admin: Admin | null;
  token: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  login: (admin: Admin, token: string) => void;
  updateAdmin: (patch: Partial<Admin>) => void;
  logout: () => void;
}

export const useAdminAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      admin: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      login: (admin, token) => {
        localStorage.setItem('adminToken', token);
        set({ admin, token, isAuthenticated: true });
      },
      updateAdmin: (patch) => set((s) => ({ admin: s.admin ? { ...s.admin, ...patch } : s.admin })),
      logout: () => {
        localStorage.removeItem('adminToken');
        set({ admin: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'admin-auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
