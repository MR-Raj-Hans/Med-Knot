import { apiClient, assertDevelopmentPreviewAllowed, isBackendConfigured } from '@/services/apiClient';
import { clearAccessToken, loadAccessToken, loadRefreshToken, saveSessionTokens } from '@/services/sessionStorage';
import type { PendingVerification, PatientSession } from '@/store/sessionStore';

type RegistrationInput = { fullName: string; email: string; phone: string; password: string; acceptedTerms: boolean };
type VerificationResponse = { challengeId: string; mode: 'backend' | 'development'; demoCode?: string };
type BackendAuthResponse = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  verified: boolean;
  patient: { id?: string; fullName: string };
};

function readVerification(data: { challengeId: string; mode?: 'backend' | 'development'; devCode?: string }): VerificationResponse {
  return { challengeId: data.challengeId, mode: data.mode ?? 'backend', demoCode: data.devCode };
}

async function toPatientSession(data: BackendAuthResponse): Promise<PatientSession> {
  if (!data.verified || !data.accessToken || !data.refreshToken) {
    throw new Error('The server has not confirmed this account yet. Please try again.');
  }
  await saveSessionTokens(data.accessToken, data.refreshToken);
  return { accessToken: data.accessToken, patientName: data.patient.fullName, mode: 'backend' };
}

export const authService = {
  async requestVerification(input: RegistrationInput): Promise<VerificationResponse> {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      return { challengeId: `dev-${Date.now()}`, mode: 'development', demoCode: '246810' };
    }
    const { data } = await apiClient.post('/auth/request-verification', input);
    return readVerification(data);
  },

  async verifyCode(pending: PendingVerification, code: string): Promise<PatientSession> {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      if (code !== pending.demoCode) throw new Error('That code did not match. Try the demo code shown above.');
      return { accessToken: 'development-preview-session', patientName: pending.patientName, mode: 'development' };
    }
    const { data } = await apiClient.post<BackendAuthResponse>('/auth/verify-otp', { challengeId: pending.challengeId, code });
    return toPatientSession(data);
  },

  async signIn(email: string, password: string): Promise<PatientSession> {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      return { accessToken: 'development-preview-session', patientName: 'there', mode: 'development' };
    }
    const { data } = await apiClient.post<BackendAuthResponse>('/auth/login', { email, password });
    return toPatientSession(data);
  },

  async resendCode(pending: PendingVerification): Promise<PendingVerification> {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      return { ...pending, challengeId: `dev-${Date.now()}` };
    }
    const { data } = await apiClient.post('/auth/resend-verification', { challengeId: pending.challengeId, email: pending.email });
    const result = readVerification(data);
    return { ...pending, challengeId: result.challengeId, mode: result.mode, demoCode: result.demoCode };
  },

  async requestPasswordReset(email: string) {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      return { accepted: true, mode: 'development' as const };
    }
    const { data } = await apiClient.post<{ accepted: boolean; devCode?: string }>('/auth/forgot-password', { email });
    return { accepted: Boolean(data.accepted), mode: data.devCode ? 'development' as const : 'backend' as const, demoCode: data.devCode };
  },

  async resetPassword(email: string, code: string, newPassword: string) {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      throw new Error('Password reset requires the MedKnot API.');
    }
    await apiClient.post('/auth/reset-password', { email, code, newPassword });
  },

  async restoreSession(): Promise<PatientSession | null> {
    if (!isBackendConfigured) {
      await clearAccessToken();
      return null;
    }
    const accessToken = await loadAccessToken();
    const refreshToken = await loadRefreshToken();
    if (!accessToken || !refreshToken) {
      await clearAccessToken();
      return null;
    }
    try {
      const { data } = await apiClient.get<{ fullName: string; patient?: { fullName: string } }>('/auth/me');
      const currentAccessToken = await loadAccessToken();
      return { accessToken: currentAccessToken ?? accessToken, patientName: data.patient?.fullName ?? data.fullName, mode: 'backend' };
    } catch {
      await clearAccessToken();
      return null;
    }
  },

  async signOut() {
    try {
      if (isBackendConfigured) await apiClient.post('/auth/sign-out');
    } finally {
      await clearAccessToken();
    }
  },
};
