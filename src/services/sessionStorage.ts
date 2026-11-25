import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'medknot.access-token';
const REFRESH_TOKEN_KEY = 'medknot.refresh-token';
let webAccessToken: string | null = null;
let webRefreshToken: string | null = null;

export async function saveAccessToken(token: string) {
  if (Platform.OS === 'web') webAccessToken = token;
  else await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function saveRefreshToken(token: string) {
  if (Platform.OS === 'web') webRefreshToken = token;
  else await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function saveSessionTokens(accessToken: string, refreshToken: string) {
  await Promise.all([saveAccessToken(accessToken), saveRefreshToken(refreshToken)]);
}

export async function loadAccessToken() {
  if (Platform.OS === 'web') return webAccessToken;
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function loadRefreshToken() {
  if (Platform.OS === 'web') return webRefreshToken;
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearAccessToken() {
  if (Platform.OS === 'web') {
    webAccessToken = null;
    webRefreshToken = null;
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
