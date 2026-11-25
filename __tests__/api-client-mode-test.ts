import { assertDevelopmentPreviewAllowed, canUseDevelopmentPreview } from '@/services/apiClient';

describe('development preview mode', () => {
  it('is enabled only for development builds without a backend URL', () => {
    expect(canUseDevelopmentPreview(true, false, 'development')).toBe(true);
    expect(canUseDevelopmentPreview(true, false)).toBe(false);
    expect(canUseDevelopmentPreview(true, true, 'development')).toBe(false);
    expect(canUseDevelopmentPreview(false, false, 'development')).toBe(false);
  });

  it('rejects the preview flow from a release build', () => {
    expect(() => assertDevelopmentPreviewAllowed(false)).toThrow('The MedKnot service is not configured');
    expect(() => assertDevelopmentPreviewAllowed(true)).not.toThrow();
  });
});
