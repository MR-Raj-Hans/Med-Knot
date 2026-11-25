jest.mock('@/services/apiClient', () => ({
  apiClient: { post: jest.fn().mockRejectedValue(new Error('Network unavailable')) },
  isBackendConfigured: true,
  assertDevelopmentPreviewAllowed: jest.fn(),
}));

jest.mock('@/services/sessionStorage', () => ({
  clearAccessToken: jest.fn().mockResolvedValue(undefined),
  saveAccessToken: jest.fn(),
}));

import { authService } from '@/services/authService';
import { clearAccessToken } from '@/services/sessionStorage';

describe('sign out', () => {
  it('clears the stored token even when the server cannot be reached', async () => {
    await expect(authService.signOut()).rejects.toThrow('Network unavailable');
    expect(clearAccessToken).toHaveBeenCalledTimes(1);
  });
});
