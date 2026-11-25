import { apiClient, assertDevelopmentPreviewAllowed, isBackendConfigured } from '@/services/apiClient';
import { developmentHomeSummary } from '@/mocks/homeFixtures';
import type { HomeSummary } from '@/types/health';

export async function getHomeSummary(): Promise<HomeSummary> {
  if (!isBackendConfigured) {
    assertDevelopmentPreviewAllowed();
    return developmentHomeSummary;
  }
  const { data } = await apiClient.get<Omit<HomeSummary, 'dataSource'>>('/patient/home');
  return { ...data, dataSource: 'api' };
}
