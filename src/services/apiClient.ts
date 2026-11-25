import axios, { create, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { loadAccessToken, loadRefreshToken, saveSessionTokens, clearAccessToken } from '@/services/sessionStorage';
import { useSessionStore } from '@/store/sessionStore';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
export const isBackendConfigured = API_BASE_URL.length > 0;
export const isDevelopmentPreview = canUseDevelopmentPreview(
  __DEV__,
  isBackendConfigured,
  process.env.EXPO_PUBLIC_AUTH_MODE,
);

export function canUseDevelopmentPreview(isDevelopmentBuild: boolean, backendConfigured: boolean, authMode?: string) {
  return isDevelopmentBuild && !backendConfigured && authMode === 'development';
}

export function assertDevelopmentPreviewAllowed(
  previewAllowed = isDevelopmentPreview,
) {
  if (!previewAllowed) {
    throw new Error('The MedKnot service is not configured for this build. Connect an API before signing in or creating an account.');
  }
}

type RefreshResponse = { accessToken: string; refreshToken: string };
type RetriableConfig = InternalAxiosRequestConfig & { _medknotRetried?: boolean };
let refreshInFlight: Promise<string | null> | null = null;

function excludesRefresh(url?: string) {
  return /\/auth\/(refresh|login|sign-in|verify-otp|request-verification|resend-verification|forgot-password|reset-password)(\?|$)/.test(url ?? '');
}

async function rotateSession(): Promise<string | null> {
  if (!isBackendConfigured) return null;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) return null;
      const { data } = await axios.post<RefreshResponse>(`${API_BASE_URL.replace(/\/$/, '')}/auth/refresh`, { refreshToken }, {
        timeout: 15_000,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      });
      if (!data.accessToken || !data.refreshToken) throw new Error('The server returned an invalid session.');
      await saveSessionTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
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

apiClient.interceptors.response.use((response) => response, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;
  if (error.response?.status !== 401 || !config || config._medknotRetried || excludesRefresh(config.url)) throw error;
  config._medknotRetried = true;
  try {
    const token = await rotateSession();
    if (!token) throw error;
    config.headers.Authorization = `Bearer ${token}`;
    return await apiClient.request(config);
  } catch (refreshError) {
    await clearAccessToken();
    useSessionStore.getState().clearSession();
    throw refreshError;
  }
});
