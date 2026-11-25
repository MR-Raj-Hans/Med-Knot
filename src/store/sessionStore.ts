import { create } from 'zustand';
import type { PatientProfile } from '@/types/health';

export type SessionMode = 'backend' | 'development';

export type PatientSession = {
  accessToken: string;
  patientName: string;
  mode: SessionMode;
};

export type PendingVerification = {
  challengeId: string;
  email: string;
  patientName: string;
  mode: SessionMode;
  demoCode?: string;
};

type SessionState = {
  authReady: boolean;
  session: PatientSession | null;
  pendingVerification: PendingVerification | null;
  profile: PatientProfile | null;
  setSession: (session: PatientSession) => void;
  setAuthReady: (ready: boolean) => void;
  setPendingVerification: (pending: PendingVerification) => void;
  clearPendingVerification: () => void;
  setProfile: (profile: PatientProfile) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  authReady: false,
  session: null,
  pendingVerification: null,
  profile: null,
  setSession: (session) => set({ session }),
  setAuthReady: (authReady) => set({ authReady }),
  setPendingVerification: (pendingVerification) => set({ pendingVerification }),
  clearPendingVerification: () => set({ pendingVerification: null }),
  setProfile: (profile) => set({ profile }),
  clearSession: () => set({ session: null, profile: null, pendingVerification: null }),
}));
