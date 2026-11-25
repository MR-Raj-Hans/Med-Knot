import { assertDevelopmentPreviewAllowed, canUseDevelopmentPreview } from '@/services/apiClient';

describe('development preview mode', () => {
  it('is enabled only for development builds without a backend URL', () => {
    expect(canUseDevelopmentPreview(true, false)).toBe(true);
    expect(canUseDevelopmentPreview(true, true)).toBe(false);
    expect(canUseDevelopmentPreview(false, false)).toBe(false);
  });

  it('rejects the preview flow from a release build', () => {
    expect(() => assertDevelopmentPreviewAllowed(false)).toThrow('The MedKnot service is not configured');
    expect(() => assertDevelopmentPreviewAllowed(true)).not.toThrow();
  });
});
