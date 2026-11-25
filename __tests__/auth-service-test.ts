jest.mock('@/services/apiClient', () => ({
  apiClient: { post: jest.fn() },
  isBackendConfigured: false,
  assertDevelopmentPreviewAllowed: jest.fn(),
}));

jest.mock('@/services/sessionStorage', () => ({
  clearAccessToken: jest.fn(),
  saveAccessToken: jest.fn(),
}));

import { authService } from '@/services/authService';
import type { PendingVerification } from '@/store/sessionStore';

const pending: PendingVerification = {
  challengeId: 'dev-challenge',
  email: 'patient@example.test',
  patientName: 'Riya Sharma',
  mode: 'development',
  demoCode: '246810',
};

describe('development authentication service', () => {
  it('opens a clearly marked preview session only for the preview code', async () => {
    await expect(authService.verifyCode(pending, '246810')).resolves.toEqual({
      accessToken: 'development-preview-session',
      patientName: 'Riya Sharma',
      mode: 'development',
    });
  });

  it('rejects an incorrect preview code', async () => {
    await expect(authService.verifyCode(pending, '000000')).rejects.toThrow('That code did not match');
  });
});
