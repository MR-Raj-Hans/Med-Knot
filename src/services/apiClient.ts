import { create } from 'axios';
import { loadAccessToken } from '@/services/sessionStorage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
export const isBackendConfigured = API_BASE_URL.length > 0;
export const isDevelopmentPreview = canUseDevelopmentPreview(
  __DEV__ || process.env.EXPO_PUBLIC_APP_VARIANT === 'preview',
  isBackendConfigured,
);

export function canUseDevelopmentPreview(isDevelopmentBuild: boolean, backendConfigured: boolean) {
  return isDevelopmentBuild && !backendConfigured;
}

export function assertDevelopmentPreviewAllowed(
  isPreviewBuild = __DEV__ || process.env.EXPO_PUBLIC_APP_VARIANT === 'preview',
) {
  if (!isPreviewBuild) {
    throw new Error('The MedKnot service is not configured for this build. Please try again later.');
  }
}

export const apiClient = create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await loadAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
