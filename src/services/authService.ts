import { apiClient, assertDevelopmentPreviewAllowed, isBackendConfigured } from '@/services/apiClient';
import { clearAccessToken, saveAccessToken } from '@/services/sessionStorage';
import type { PendingVerification, PatientSession } from '@/store/sessionStore';

type RegistrationInput = { fullName: string; email: string; phone: string; password: string; acceptedTerms: boolean };
type VerificationResponse = { challengeId: string; mode: 'backend' | 'development'; demoCode?: string };
type BackendAuthResponse = {
  accessToken: string;
  verified: boolean;
  patient: { fullName: string };
};

export const authService = {
  async requestVerification(input: RegistrationInput): Promise<VerificationResponse> {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      return { challengeId: `dev-${Date.now()}`, mode: 'development', demoCode: '246810' };
    }
    const { data } = await apiClient.post<VerificationResponse>('/auth/request-verification', input);
    return { ...data, mode: 'backend' };
  },

  async verifyCode(pending: PendingVerification, code: string): Promise<PatientSession> {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      if (code !== pending.demoCode) throw new Error('That code did not match. Try the demo code shown above.');
      return { accessToken: 'development-preview-session', patientName: pending.patientName, mode: 'development' };
    }
    const { data } = await apiClient.post<BackendAuthResponse>('/auth/verify-otp', {
      challengeId: pending.challengeId,
      code,
    });
    if (!data.verified || !data.accessToken) {
      throw new Error('The server has not confirmed this account yet. Request a new code or try again.');
    }
    await saveAccessToken(data.accessToken);
    return { accessToken: data.accessToken, patientName: data.patient.fullName, mode: 'backend' };
  },

  async signIn(email: string, password: string): Promise<PatientSession> {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      return { accessToken: 'development-preview-session', patientName: 'there', mode: 'development' };
    }
    const { data } = await apiClient.post<BackendAuthResponse>('/auth/sign-in', { email, password });
    if (!data.verified || !data.accessToken) {
      throw new Error('The server has not confirmed this account yet. Please finish verification first.');
    }
    await saveAccessToken(data.accessToken);
    return { accessToken: data.accessToken, patientName: data.patient.fullName, mode: 'backend' };
  },

  async resendCode(pending: PendingVerification): Promise<PendingVerification> {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      return { ...pending, challengeId: `dev-${Date.now()}` };
    }
    const { data } = await apiClient.post<VerificationResponse>('/auth/resend-verification', {
      challengeId: pending.challengeId,
      email: pending.email,
    });
    return { ...pending, challengeId: data.challengeId, mode: 'backend' };
  },

  async requestPasswordReset(email: string) {
    if (!isBackendConfigured) {
      assertDevelopmentPreviewAllowed();
      return { accepted: true, mode: 'development' as const };
    }
    await apiClient.post('/auth/forgot-password', { email });
    return { accepted: true, mode: 'backend' as const };
  },

  async signOut() {
    try {
      if (isBackendConfigured) await apiClient.post('/auth/sign-out');
    } finally {
      await clearAccessToken();
    }
  },
};
