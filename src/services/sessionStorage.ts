import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'medknot.access-token';

export async function saveAccessToken(token: string) {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function loadAccessToken() {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearAccessToken() {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}
